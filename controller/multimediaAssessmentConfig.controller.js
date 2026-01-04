import multimediaAssessmentConfigService from '../services/multimediaAssessmentConfig.service.js';
import ResponseHandler from '../utils/responseHandler.js';
import Joi from 'joi';

/**
 * MULTIMEDIA ASSESSMENT CONFIGURATION CONTROLLER
 * REST API for managing assessment configurations
 */
class MultimediaAssessmentConfigController {
  // Validation schema for assessment configuration
  static assessmentConfigSchema = Joi.object({
    title: Joi.string().required().trim().max(100),
    description: Joi.string().required().trim().max(1000),
    instructions: Joi.string().required().max(5000),
    projectId: Joi.string().required(),

    requirements: Joi.object({
      tasksPerAssessment: Joi.number().min(1).max(10).default(5),
      timeLimit: Joi.number().min(15).max(300).default(60),
      allowPausing: Joi.boolean().default(true),
      retakePolicy: Joi.object({
        allowed: Joi.boolean().default(true),
        cooldownHours: Joi.number().min(1).max(168).default(24),
        maxAttempts: Joi.number().min(1).max(10).default(3)
      }).optional()
    }).optional(),

    videoReels: Joi.object({
      reelsPerNiche: Joi.object({
        lifestyle: Joi.number().min(0).default(0),
        fashion: Joi.number().min(0).default(0),
        food: Joi.number().min(0).default(0),
        travel: Joi.number().min(0).default(0),
        fitness: Joi.number().min(0).default(0),
        beauty: Joi.number().min(0).default(0),
        comedy: Joi.number().min(0).default(0),
        education: Joi.number().min(0).default(0),
        technology: Joi.number().min(0).default(0),
        music: Joi.number().min(0).default(0),
        dance: Joi.number().min(0).default(0),
        art: Joi.number().min(0).default(0),
        pets: Joi.number().min(0).default(0),
        nature: Joi.number().min(0).default(0),
        business: Joi.number().min(0).default(0),
        motivation: Joi.number().min(0).default(0),
        diy: Joi.number().min(0).default(0),
        gaming: Joi.number().min(0).default(0),
        sports: Joi.number().min(0).default(0),
        other: Joi.number().min(0).default(0)
      }).optional(),
      randomizationEnabled: Joi.boolean().default(true)
    }).optional(),

    scoring: Joi.object({
      passingScore: Joi.number().min(0).max(100).default(70),
      qaRequired: Joi.boolean().default(true),
      autoApprovalThreshold: Joi.number().min(0).max(100).allow(null).optional(),
      scoreWeights: Joi.object({
        conversationQuality: Joi.number().min(0).max(100).default(20),
        videoSegmentation: Joi.number().min(0).max(100).default(20),
        promptRelevance: Joi.number().min(0).max(100).default(20),
        creativityAndCoherence: Joi.number().min(0).max(100).default(20),
        technicalExecution: Joi.number().min(0).max(100).default(20)
      }).optional()
    }).optional(),

    taskSettings: Joi.object({
      conversationTurns: Joi.object({
        min: Joi.number().min(1).default(3),
        max: Joi.number().min(1).default(8),
        recommended: Joi.number().min(1).default(5)
      }).optional(),
      videoSegmentLength: Joi.object({
        min: Joi.number().min(1).default(5),
        max: Joi.number().min(1).default(30),
        recommended: Joi.number().min(1).default(15)
      }).optional(),
      allowVideoAsStartingPoint: Joi.boolean().default(true),
      allowPromptAsStartingPoint: Joi.boolean().default(true)
    }).optional()
  });

  /**
   * Create multimedia assessment configuration
   * POST /api/admin/multimedia-assessments/config
   */
  async createAssessmentConfig(req, res) {
    try {
      const { error, value } = MultimediaAssessmentConfigController.assessmentConfigSchema.validate(req.body);
      if (error) {
        return ResponseHandler.error(res, error.details[0].message, 400);
      }

      const assessmentConfig = await multimediaAssessmentConfigService.createAssessmentConfig(value, req.admin.userId);
      return ResponseHandler.success(res, { assessmentConfig }, 'Assessment configuration created successfully', 201);
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Get all assessment configurations
   * GET /api/admin/multimedia-assessments/config
   */
  async getAllAssessmentConfigs(req, res) {
    try {
      const { assessmentConfigs, totalCount, totalPages } = await multimediaAssessmentConfigService.getAllAssessmentConfigs(req.query);

      return ResponseHandler.success(res, {
        assessmentConfigs: assessmentConfigs.map(config => ({
          id: config._id,
          title: config.title,
          description: config.description,
          project: {
            id: config.projectId._id,
            name: config.projectId.projectName,
            status: config.projectId.status
          },
          requirements: config.requirements,
          totalConfiguredReels: config.totalConfiguredReels,
          completionRate: config.completionRate,
          statistics: config.statistics,
          isActive: config.isActive,
          createdBy: config.createdBy,
          lastModifiedBy: config.lastModifiedBy,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt
        })),
        pagination: {
          currentPage: parseInt(req.query.page || 1),
          totalPages,
          totalCount,
          limit: parseInt(req.query.limit || 20),
          hasNextPage: parseInt(req.query.page || 1) < totalPages,
          hasPrevPage: parseInt(req.query.page || 1) > 1
        }
      });
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Get assessment configuration by ID
   * GET /api/admin/multimedia-assessments/config/:id
   */
  async getAssessmentConfigById(req, res) {
    try {
      const { id } = req.params;
      const { assessmentConfig, nicheAvailability } = await multimediaAssessmentConfigService.getAssessmentConfigById(id);

      return ResponseHandler.success(res, {
        assessmentConfig: {
          id: assessmentConfig._id,
          title: assessmentConfig.title,
          description: assessmentConfig.description,
          instructions: assessmentConfig.instructions,
          project: {
            id: assessmentConfig.projectId._id,
            name: assessmentConfig.projectId.projectName,
            description: assessmentConfig.projectId.projectDescription,
            status: assessmentConfig.projectId.status,
            budget: assessmentConfig.projectId.budget
          },
          requirements: assessmentConfig.requirements,
          videoReels: {
            ...assessmentConfig.videoReels,
            nicheAvailability
          },
          scoring: assessmentConfig.scoring,
          taskSettings: assessmentConfig.taskSettings,
          totalConfiguredReels: assessmentConfig.totalConfiguredReels,
          completionRate: assessmentConfig.completionRate,
          statistics: assessmentConfig.statistics,
          isActive: assessmentConfig.isActive,
          createdBy: assessmentConfig.createdBy,
          lastModifiedBy: assessmentConfig.lastModifiedBy,
          createdAt: assessmentConfig.createdAt,
          updatedAt: assessmentConfig.updatedAt
        }
      });
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Update assessment configuration
   * PUT /api/admin/multimedia-assessments/config/:id
   */
  async updateAssessmentConfig(req, res) {
    try {
      const { id } = req.params;
      const updateSchema = MultimediaAssessmentConfigController.assessmentConfigSchema.fork(['projectId'], schema => schema.optional());
      const { error, value } = updateSchema.validate(req.body);

      if (error) {
        return ResponseHandler.error(res, error.details[0].message, 400);
      }

      const assessmentConfig = await multimediaAssessmentConfigService.updateAssessmentConfig(id, value, req.admin.userId);
      return ResponseHandler.success(res, { assessmentConfig }, 'Assessment configuration updated successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Delete assessment configuration
   * DELETE /api/admin/multimedia-assessments/config/:id
   */
  async deleteAssessmentConfig(req, res) {
    try {
      const { id } = req.params;
      const assessmentConfig = await multimediaAssessmentConfigService.deleteAssessmentConfig(id);

      return ResponseHandler.success(res, {
        deletedId: assessmentConfig._id,
        title: assessmentConfig.title,
        deletedAt: new Date()
      }, 'Assessment configuration deleted successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Get assessment configuration for a specific project
   * GET /api/admin/multimedia-assessments/config/project/:projectId
   */
  async getAssessmentConfigByProject(req, res) {
    try {
      const { projectId } = req.params;
      const assessmentConfig = await multimediaAssessmentConfigService.getAssessmentConfigByProject(projectId);

      return ResponseHandler.success(res, {
        assessmentConfig: {
          id: assessmentConfig._id,
          title: assessmentConfig.title,
          description: assessmentConfig.description,
          requirements: assessmentConfig.requirements,
          videoReels: assessmentConfig.videoReels,
          scoring: assessmentConfig.scoring,
          isActive: assessmentConfig.isActive,
          project: assessmentConfig.projectId,
          createdBy: assessmentConfig.createdBy
        }
      });
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }
}

export default new MultimediaAssessmentConfigController();