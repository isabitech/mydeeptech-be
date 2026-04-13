const MultimediaAssessmentConfigRepository = require('../repositories/multimediaAssessmentConfig.repository');
const AnnotationProject = require('../models/annotationProject.model');
const VideoReel = require('../models/videoReel.model');
const MultimediaAssessmentSubmission = require('../models/multimediaAssessmentSubmission.model');

class MultimediaAssessmentConfigService {
    async validateVideoReels(reelsPerNiche) {
        if (!reelsPerNiche) return;
        
        for (const [niche, requiredCount] of Object.entries(reelsPerNiche)) {
            if (requiredCount > 0) {
                const availableCount = await VideoReel.countDocuments({
                    niche,
                    isActive: true,
                    isApproved: true
                });
                if (availableCount < requiredCount) {
                    throw { status: 400, message: `Insufficient video reels for niche '${niche}'. Required: ${requiredCount}, Available: ${availableCount}` };
                }
            }
        }
    }

    async createAssessmentConfig(value, adminId) {
        const project = await AnnotationProject.findById(value.projectId);
        if (!project) throw { status: 404, message: 'Project not found' };

        const existingAssessment = await MultimediaAssessmentConfigRepository.findOne({
            projectId: value.projectId,
            isActive: true
        });

        if (existingAssessment) {
            throw { status: 400, message: 'Active assessment configuration already exists for this project', existingAssessmentId: existingAssessment._id };
        }

        if (value.scoring?.scoreWeights) {
            const weights = value.scoring.scoreWeights;
            const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
            if (Math.abs(total - 100) > 0.01) {
                throw { status: 400, message: 'Score weights must total 100', currentTotal: total };
            }
        }

        const reelsPerNiche = value.videoReels?.reelsPerNiche || {};
        await this.validateVideoReels(reelsPerNiche);
        
        const totalConfiguredReels = Object.values(reelsPerNiche).reduce((sum, count) => sum + count, 0);

        const configData = {
            ...value,
            createdBy: adminId,
            videoReels: {
                ...value.videoReels,
                totalAvailable: totalConfiguredReels
            }
        };

        const assessmentConfig = await MultimediaAssessmentConfigRepository.create(configData);
        return { assessmentConfig, projectName: project.projectName };
    }

    async getAllAssessmentConfigs(query) {
        const { page = 1, limit = 20, projectId, isActive, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
        
        const matchConditions = {};
        if (projectId) matchConditions.projectId = projectId;
        if (isActive !== undefined) matchConditions.isActive = isActive === 'true';
        if (search) {
            matchConditions.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [assessmentConfigs, totalCount] = await Promise.all([
            MultimediaAssessmentConfigRepository.findPaginated(matchConditions, sort, skip, limit),
            MultimediaAssessmentConfigRepository.countDocuments(matchConditions)
        ]);

        return {
            assessmentConfigs,
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalCount,
            page: parseInt(page),
            limit: parseInt(limit)
        };
    }

    async getAssessmentConfigById(id) {
        const assessmentConfig = await MultimediaAssessmentConfigRepository.findById(id);
        if (!assessmentConfig) throw { status: 404, message: 'Assessment configuration not found' };

        const nicheAvailability = {};
        for (const [niche, requiredCount] of Object.entries(assessmentConfig.videoReels.reelsPerNiche)) {
            if (requiredCount > 0) {
                nicheAvailability[niche] = {
                    required: requiredCount,
                    available: await VideoReel.countDocuments({ niche, isActive: true, isApproved: true })
                };
            }
        }

        return { assessmentConfig, nicheAvailability };
    }

    async updateAssessmentConfig(id, value, adminId) {
        const assessmentConfig = await MultimediaAssessmentConfigRepository.findByIdToUpdate(id);
        if (!assessmentConfig) throw { status: 404, message: 'Assessment configuration not found' };

        if (value.scoring?.scoreWeights) {
            const weights = value.scoring.scoreWeights;
            const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
            if (Math.abs(total - 100) > 0.01) {
                throw { status: 400, message: 'Score weights must total 100', currentTotal: total };
            }
        }

        await this.validateVideoReels(value.videoReels?.reelsPerNiche);

        Object.keys(value).forEach(key => {
            if (key === 'videoReels' && value.videoReels) {
                assessmentConfig.videoReels = { ...assessmentConfig.videoReels, ...value.videoReels };
                if (value.videoReels.reelsPerNiche) {
                    assessmentConfig.videoReels.totalAvailable = Object.values(value.videoReels.reelsPerNiche).reduce((sum, count) => sum + count, 0);
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
        const assessmentConfig = await MultimediaAssessmentConfigRepository.findByIdToUpdate(id);
        if (!assessmentConfig) throw { status: 404, message: 'Assessment configuration not found' };

        const activeSubmissions = await MultimediaAssessmentSubmission.countDocuments({
            assessmentId: id,
            status: { $in: ['in_progress', 'submitted', 'under_review'] }
        });

        if (activeSubmissions > 0) {
            throw { status: 400, message: 'Cannot delete assessment configuration with active submissions', activeSubmissions };
        }

        assessmentConfig.isActive = false;
        await assessmentConfig.save();
        return assessmentConfig;
    }

    async getAssessmentConfigByProject(projectId) {
        const assessmentConfig = await MultimediaAssessmentConfigRepository.getByProject(projectId);
        if (!assessmentConfig) throw { status: 404, message: 'No active assessment configuration found for this project' };
        return assessmentConfig;
    }
}

module.exports = new MultimediaAssessmentConfigService();
