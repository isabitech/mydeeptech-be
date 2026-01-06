import MultimediaAssessmentConfig from '../models/multimediaAssessmentConfig.model.js';
import AnnotationProject from '../models/annotationProject.model.js';
import VideoReel from '../models/videoReel.model.js';
import MultimediaAssessmentSubmission from '../models/multimediaAssessmentSubmission.model.js';
import { NotFoundError, ValidationError } from '../utils/responseHandler.js';

class MultimediaAssessmentConfigService {
    /**
     * Create multimedia assessment configuration
     */
    async createAssessmentConfig(configData, adminId) {
        // Check if project exists
        const project = await AnnotationProject.findById(configData.projectId);
        if (!project) {
            throw new NotFoundError('Project not found');
        }

        // Check if assessment already exists for this project
        const existingAssessment = await MultimediaAssessmentConfig.findOne({
            projectId: configData.projectId,
            isActive: true
        });

        if (existingAssessment) {
            throw new ValidationError('Active assessment configuration already exists for this project');
        }

        // Validate score weights sum to 100
        if (configData.scoring?.scoreWeights) {
            const weights = configData.scoring.scoreWeights;
            const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
            if (Math.abs(total - 100) > 0.01) {
                throw new ValidationError(`Score weights must total 100. Current total: ${total}`);
            }
        }

        // Validate reel availability
        const reelsPerNiche = configData.videoReels?.reelsPerNiche || {};
        const totalConfiguredReels = Object.values(reelsPerNiche).reduce((sum, count) => sum + count, 0);

        for (const [niche, requiredCount] of Object.entries(reelsPerNiche)) {
            if (requiredCount > 0) {
                const availableCount = await VideoReel.countDocuments({
                    niche,
                    isActive: true,
                    isApproved: true
                });

                if (availableCount < requiredCount) {
                    throw new ValidationError(`Insufficient video reels for niche '${niche}'. Required: ${requiredCount}, Available: ${availableCount}`);
                }
            }
        }

        // Create assessment configuration
        const assessmentConfig = new MultimediaAssessmentConfig({
            ...configData,
            createdBy: adminId,
            videoReels: {
                ...configData.videoReels,
                totalAvailable: totalConfiguredReels
            }
        });

        await assessmentConfig.save();
        return assessmentConfig;
    }

    /**
     * Get all assessment configurations
     */
    async getAllAssessmentConfigs(query) {
        const {
            page = 1,
            limit = 20,
            projectId,
            isActive,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = query;

        const matchConditions = {};
        if (projectId) matchConditions.projectId = projectId;
        if (isActive !== undefined) matchConditions.isActive = isActive === 'true';

        if (search) {
            matchConditions.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [assessmentConfigs, totalCount] = await Promise.all([
            MultimediaAssessmentConfig.find(matchConditions)
                .populate('projectId', 'projectName projectDescription status')
                .populate('createdBy', 'fullName email')
                .populate('lastModifiedBy', 'fullName email')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit)),
            MultimediaAssessmentConfig.countDocuments(matchConditions)
        ]);

        return {
            assessmentConfigs,
            totalCount,
            totalPages: Math.ceil(totalCount / parseInt(limit))
        };
    }

    /**
     * Get assessment configuration by ID
     */
    async getAssessmentConfigById(id) {
        const assessmentConfig = await MultimediaAssessmentConfig.findById(id)
            .populate('projectId', 'projectName projectDescription status budget')
            .populate('createdBy', 'fullName email')
            .populate('lastModifiedBy', 'fullName email');

        if (!assessmentConfig) {
            throw new NotFoundError('Assessment configuration not found');
        }

        // Get available reels count for each niche
        const nicheAvailability = {};
        const reelsPerNiche = assessmentConfig.videoReels?.reelsPerNiche || {};

        for (const [niche, requiredCount] of Object.entries(reelsPerNiche)) {
            if (requiredCount > 0) {
                nicheAvailability[niche] = {
                    required: requiredCount,
                    available: await VideoReel.countDocuments({
                        niche,
                        isActive: true,
                        isApproved: true
                    })
                };
            }
        }

        return { assessmentConfig, nicheAvailability };
    }

    /**
     * Update assessment configuration
     */
    async updateAssessmentConfig(id, updateData, adminId) {
        const assessmentConfig = await MultimediaAssessmentConfig.findById(id);
        if (!assessmentConfig) {
            throw new NotFoundError('Assessment configuration not found');
        }

        // Validate score weights if provided
        if (updateData.scoring?.scoreWeights) {
            const weights = updateData.scoring.scoreWeights;
            const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
            if (Math.abs(total - 100) > 0.01) {
                throw new ValidationError(`Score weights must total 100. Current total: ${total}`);
            }
        }

        // Validate reel availability if niches are updated
        if (updateData.videoReels?.reelsPerNiche) {
            for (const [niche, requiredCount] of Object.entries(updateData.videoReels.reelsPerNiche)) {
                if (requiredCount > 0) {
                    const availableCount = await VideoReel.countDocuments({
                        niche,
                        isActive: true,
                        isApproved: true
                    });

                    if (availableCount < requiredCount) {
                        throw new ValidationError(`Insufficient video reels for niche '${niche}'. Required: ${requiredCount}, Available: ${availableCount}`);
                    }
                }
            }
        }

        // Update fields
        Object.keys(updateData).forEach(key => {
            if (key === 'videoReels' && updateData.videoReels) {
                assessmentConfig.videoReels = {
                    ...assessmentConfig.videoReels.toObject(),
                    ...updateData.videoReels
                };
                if (updateData.videoReels.reelsPerNiche) {
                    assessmentConfig.videoReels.totalAvailable = Object.values(updateData.videoReels.reelsPerNiche)
                        .reduce((sum, count) => sum + count, 0);
                }
            } else {
                assessmentConfig[key] = updateData[key];
            }
        });

        assessmentConfig.lastModifiedBy = adminId;
        await assessmentConfig.save();
        return assessmentConfig;
    }

    /**
     * Delete assessment configuration (soft delete)
     */
    async deleteAssessmentConfig(id) {
        const assessmentConfig = await MultimediaAssessmentConfig.findById(id);
        if (!assessmentConfig) {
            throw new NotFoundError('Assessment configuration not found');
        }

        // Check for active submissions
        const activeSubmissions = await MultimediaAssessmentSubmission.countDocuments({
            assessmentId: id,
            status: { $in: ['in_progress', 'submitted', 'under_review'] }
        });

        if (activeSubmissions > 0) {
            throw new ValidationError(`Cannot delete assessment configuration with ${activeSubmissions} active submissions`);
        }

        assessmentConfig.isActive = false;
        await assessmentConfig.save();
        return assessmentConfig;
    }

    /**
     * Get assessment configuration for a specific project
     */
    async getAssessmentConfigByProject(projectId) {
        const assessmentConfig = await MultimediaAssessmentConfig.findOne({
            projectId,
            isActive: true
        }).populate('projectId');

        if (!assessmentConfig) {
            throw new NotFoundError('No active assessment configuration found for this project');
        }

        return assessmentConfig;
    }
}

export default new MultimediaAssessmentConfigService();
