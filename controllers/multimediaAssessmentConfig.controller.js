const Joi = require('joi');
const MultimediaAssessmentConfigService = require('../services/multimediaAssessmentConfig.service');

const assessmentConfigSchema = Joi.object({
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

const createAssessmentConfig = async (req, res) => {
  try {
    const { error, value } = assessmentConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: error.details.map(detail => detail.message) });
    }
    
    const { assessmentConfig, projectName } = await MultimediaAssessmentConfigService.createAssessmentConfig(value, req.admin.userId);
    
    res.status(201).json({
      success: true,
      message: 'Assessment configuration created successfully',
      data: {
        assessmentConfig: {
          id: assessmentConfig._id,
          title: assessmentConfig.title,
          description: assessmentConfig.description,
          projectId: assessmentConfig.projectId,
          projectName: projectName,
          requirements: assessmentConfig.requirements,
          videoReels: assessmentConfig.videoReels,
          scoring: assessmentConfig.scoring,
          taskSettings: assessmentConfig.taskSettings,
          totalConfiguredReels: assessmentConfig.totalConfiguredReels,
          isActive: assessmentConfig.isActive,
          createdAt: assessmentConfig.createdAt
        }
      }
    });
  } catch (error) {
    if (error.status) {
        return res.status(error.status).json({ success: false, message: error.message, existingAssessmentId: error.existingAssessmentId, currentTotal: error.currentTotal });
    }
    console.error('❌ Error creating assessment configuration:', error);
    res.status(500).json({ success: false, message: 'Server error creating assessment configuration', error: error.message });
  }
};

const getAllAssessmentConfigs = async (req, res) => {
  try {
    const { assessmentConfigs, totalPages, totalCount, page, limit } = await MultimediaAssessmentConfigService.getAllAssessmentConfigs(req.query);
    
    res.status(200).json({
      success: true,
      message: 'Assessment configurations retrieved successfully',
      data: {
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
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('❌ Error retrieving assessment configurations:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving assessment configurations', error: error.message });
  }
};

const getAssessmentConfigById = async (req, res) => {
  try {
    const { assessmentConfig, nicheAvailability } = await MultimediaAssessmentConfigService.getAssessmentConfigById(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Assessment configuration retrieved successfully',
      data: {
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
          videoReels: { ...assessmentConfig.videoReels, nicheAvailability },
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
      }
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error('❌ Error retrieving assessment configuration:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving assessment configuration', error: error.message });
  }
};

const updateAssessmentConfig = async (req, res) => {
  try {
    const updateSchema = assessmentConfigSchema.fork(['projectId'], schema => schema.optional());
    const { error, value } = updateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: error.details.map(detail => detail.message) });
    }
    
    const assessmentConfig = await MultimediaAssessmentConfigService.updateAssessmentConfig(req.params.id, value, req.admin.userId);
    
    res.status(200).json({
      success: true,
      message: 'Assessment configuration updated successfully',
      data: {
        assessmentConfig: {
          id: assessmentConfig._id,
          title: assessmentConfig.title,
          description: assessmentConfig.description,
          requirements: assessmentConfig.requirements,
          videoReels: assessmentConfig.videoReels,
          scoring: assessmentConfig.scoring,
          taskSettings: assessmentConfig.taskSettings,
          totalConfiguredReels: assessmentConfig.totalConfiguredReels,
          lastModifiedBy: assessmentConfig.lastModifiedBy,
          updatedAt: assessmentConfig.updatedAt
        }
      }
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message, currentTotal: error.currentTotal });
    console.error('❌ Error updating assessment configuration:', error);
    res.status(500).json({ success: false, message: 'Server error updating assessment configuration', error: error.message });
  }
};

const deleteAssessmentConfig = async (req, res) => {
  try {
    const assessmentConfig = await MultimediaAssessmentConfigService.deleteAssessmentConfig(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Assessment configuration deleted successfully',
      data: { deletedId: assessmentConfig._id, title: assessmentConfig.title, deletedAt: new Date() }
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message, activeSubmissions: error.activeSubmissions });
    console.error('❌ Error deleting assessment configuration:', error);
    res.status(500).json({ success: false, message: 'Server error deleting assessment configuration', error: error.message });
  }
};

const getAssessmentConfigByProject = async (req, res) => {
  try {
    const assessmentConfig = await MultimediaAssessmentConfigService.getAssessmentConfigByProject(req.params.projectId);
    
    res.status(200).json({
      success: true,
      message: 'Assessment configuration retrieved successfully',
      data: {
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
      }
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error('❌ Error retrieving assessment configuration by project:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving assessment configuration', error: error.message });
  }
};

module.exports = {
  createAssessmentConfig,
  getAllAssessmentConfigs,
  getAssessmentConfigById,
  updateAssessmentConfig,
  deleteAssessmentConfig,
  getAssessmentConfigByProject
};