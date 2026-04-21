const MultimediaAssessmentConfigRepository = require("../repositories/multimediaAssessmentConfig.repository");
const AnnotationProject = require("../models/annotationProject.model");
const VideoReel = require("../models/videoReel.model");
const MultimediaAssessmentSubmission = require("../models/multimediaAssessmentSubmission.model");

class MultimediaAssessmentConfigService {
  toInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  buildMatchConditions(query) {
    const { projectId, isActive, search } = query;
    const matchConditions = {};

    if (projectId) matchConditions.projectId = projectId;
    if (isActive !== undefined) matchConditions.isActive = isActive === "true";
    if (search) {
      matchConditions.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    return matchConditions;
  }

  async validateVideoReels(reelsPerNiche) {
    if (!reelsPerNiche) return;

    const nicheChecks = await Promise.all(
      Object.entries(reelsPerNiche).map(async ([niche, requiredCount]) => ({
        niche,
        requiredCount,
        availableCount:
          requiredCount > 0
            ? await VideoReel.countDocuments({
                niche,
                isActive: true,
                isApproved: true,
              })
            : 0,
      })),
    );

    for (const { niche, requiredCount, availableCount } of nicheChecks) {
      if (requiredCount > 0 && availableCount < requiredCount) {
        throw {
          status: 400,
          message: `Insufficient video reels for niche '${niche}'. Required: ${requiredCount}, Available: ${availableCount}`,
        };
      }
    }
  }

  async createAssessmentConfig(value, adminId) {
    const project = await AnnotationProject.findById(value.projectId);
    if (!project) throw { status: 404, message: "Project not found" };

    const existingAssessment =
      await MultimediaAssessmentConfigRepository.findOne({
        projectId: value.projectId,
        isActive: true,
      });

    if (existingAssessment) {
      throw {
        status: 400,
        message:
          "Active assessment configuration already exists for this project",
        existingAssessmentId: existingAssessment._id,
      };
    }

    if (value.scoring?.scoreWeights) {
      const weights = value.scoring.scoreWeights;
      const total = Object.values(weights).reduce(
        (sum, weight) => sum + weight,
        0,
      );
      if (Math.abs(total - 100) > 0.01) {
        throw {
          status: 400,
          message: "Score weights must total 100",
          currentTotal: total,
        };
      }
    }

    const reelsPerNiche = value.videoReels?.reelsPerNiche || {};
    await this.validateVideoReels(reelsPerNiche);

    const totalConfiguredReels = Object.values(reelsPerNiche).reduce(
      (sum, count) => sum + count,
      0,
    );

    const configData = {
      ...value,
      createdBy: adminId,
      videoReels: {
        ...value.videoReels,
        totalAvailable: totalConfiguredReels,
      },
    };

    const assessmentConfig =
      await MultimediaAssessmentConfigRepository.create(configData);
    return { assessmentConfig, projectName: project.projectName };
  }

  async getAllAssessmentConfigs(query) {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;
    const matchConditions = this.buildMatchConditions(query);

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;
    const pageNumber = this.toInt(page, 1);
    const pageSize = this.toInt(limit, 20);
    const skip = (pageNumber - 1) * pageSize;

    const [assessmentConfigs, totalCount] = await Promise.all([
      MultimediaAssessmentConfigRepository.findPaginated(
        matchConditions,
        sort,
        skip,
        pageSize,
      ),
      MultimediaAssessmentConfigRepository.countDocuments(matchConditions),
    ]);

    return {
      assessmentConfigs,
      totalPages: Math.ceil(totalCount / pageSize),
      totalCount,
      page: pageNumber,
      limit: pageSize,
    };
  }

  async getAssessmentConfigById(id) {
    const assessmentConfig =
      await MultimediaAssessmentConfigRepository.findById(id);
    if (!assessmentConfig)
      throw { status: 404, message: "Assessment configuration not found" };

    const nicheAvailabilityEntries = await Promise.all(
      Object.entries(assessmentConfig.videoReels.reelsPerNiche || {}).map(
        async ([niche, requiredCount]) => [
          niche,
          requiredCount > 0
            ? {
                required: requiredCount,
                available: await VideoReel.countDocuments({
                  niche,
                  isActive: true,
                  isApproved: true,
                }),
              }
            : null,
        ],
      ),
    );

    const nicheAvailability = nicheAvailabilityEntries.reduce(
      (accumulator, [niche, value]) => {
        if (value) {
          accumulator[niche] = value;
        }
        return accumulator;
      },
      {},
    );

    return { assessmentConfig, nicheAvailability };
  }

  async updateAssessmentConfig(id, value, adminId) {
    const assessmentConfig =
      await MultimediaAssessmentConfigRepository.findByIdToUpdate(id);
    if (!assessmentConfig)
      throw { status: 404, message: "Assessment configuration not found" };

    if (value.scoring?.scoreWeights) {
      const weights = value.scoring.scoreWeights;
      const total = Object.values(weights).reduce(
        (sum, weight) => sum + weight,
        0,
      );
      if (Math.abs(total - 100) > 0.01) {
        throw {
          status: 400,
          message: "Score weights must total 100",
          currentTotal: total,
        };
      }
    }

    await this.validateVideoReels(value.videoReels?.reelsPerNiche);

    Object.keys(value).forEach((key) => {
      if (key === "videoReels" && value.videoReels) {
        assessmentConfig.videoReels = {
          ...assessmentConfig.videoReels,
          ...value.videoReels,
        };
        if (value.videoReels.reelsPerNiche) {
          assessmentConfig.videoReels.totalAvailable = Object.values(
            value.videoReels.reelsPerNiche,
          ).reduce((sum, count) => sum + count, 0);
        }
      } else {
        assessmentConfig[key] = value[key];
      }
    });

    assessmentConfig.lastModifiedBy = adminId;
    await assessmentConfig.save();
    return assessmentConfig;
  }

  async deleteAssessmentConfig(id) {
    const assessmentConfig =
      await MultimediaAssessmentConfigRepository.findByIdToUpdate(id);
    if (!assessmentConfig)
      throw { status: 404, message: "Assessment configuration not found" };

    const activeSubmissions =
      await MultimediaAssessmentSubmission.countDocuments({
        assessmentId: id,
        status: { $in: ["in_progress", "submitted", "under_review"] },
      });

    if (activeSubmissions > 0) {
      throw {
        status: 400,
        message:
          "Cannot delete assessment configuration with active submissions",
        activeSubmissions,
      };
    }

    assessmentConfig.isActive = false;
    await assessmentConfig.save();
    return assessmentConfig;
  }

  async getAssessmentConfigByProject(projectId) {
    const assessmentConfig =
      await MultimediaAssessmentConfigRepository.getByProject(projectId);
    if (!assessmentConfig)
      throw {
        status: 404,
        message: "No active assessment configuration found for this project",
      };
    return assessmentConfig;
  }
}

module.exports = new MultimediaAssessmentConfigService();
