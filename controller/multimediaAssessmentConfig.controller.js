const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');
const AnnotationProject = require('../models/annotationProject.model');
const VideoReel = require('../models/videoReel.model');
const Joi = require('joi');

// Validation schema for assessment configuration
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

/**
 * Create multimedia assessment configuration
 * POST /api/admin/multimedia-assessments/config
 */
const createAssessmentConfig = async (req, res) => {
  try {
    console.log(`🎯 Admin ${req.admin.email} creating multimedia assessment config`);
    
    // Validate request body
    const { error, value } = assessmentConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => detail.message)
      });
    }
    
    // Check if project exists
    const project = await AnnotationProject.findById(value.projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if assessment already exists for this project
    const existingAssessment = await MultimediaAssessmentConfig.findOne({
      projectId: value.projectId,
      isActive: true
    });
    
    if (existingAssessment) {
      return res.status(400).json({
        success: false,
        message: 'Active assessment configuration already exists for this project',
        existingAssessmentId: existingAssessment._id
      });
    }
    
    // Validate score weights sum to 100
    if (value.scoring?.scoreWeights) {
      const weights = value.scoring.scoreWeights;
      const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
      if (Math.abs(total - 100) > 0.01) {
        return res.status(400).json({
          success: false,
          message: 'Score weights must total 100',
          currentTotal: total
        });
      }
    }
    
    // Calculate total available reels
    const reelsPerNiche = value.videoReels?.reelsPerNiche || {};
    const totalConfiguredReels = Object.values(reelsPerNiche).reduce((sum, count) => sum + count, 0);
    
    // Validate that we have enough reels for each niche
    for (const [niche, requiredCount] of Object.entries(reelsPerNiche)) {
      if (requiredCount > 0) {
        const availableCount = await VideoReel.countDocuments({
          niche,
          isActive: true,
          isApproved: true
        });
        
        if (availableCount < requiredCount) {
          return res.status(400).json({
            success: false,
            message: `Insufficient video reels for niche '${niche}'. Required: ${requiredCount}, Available: ${availableCount}`
          });
        }
      }
    }
    
    // Create assessment configuration
    const assessmentConfig = new MultimediaAssessmentConfig({
      ...value,
      createdBy: req.admin.userId,
      videoReels: {
        ...value.videoReels,
        totalAvailable: totalConfiguredReels
      }
    });
    
    await assessmentConfig.save();
    
    console.log(`✅ Assessment configuration created: ${assessmentConfig.title} for project: ${project.projectName}`);
    
    res.status(201).json({
      success: true,
      message: 'Assessment configuration created successfully',
      data: {
        assessmentConfig: {
          id: assessmentConfig._id,
          title: assessmentConfig.title,
          description: assessmentConfig.description,
          projectId: assessmentConfig.projectId,
          projectName: project.projectName,
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
    console.error('❌ Error creating assessment configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating assessment configuration',
      error: error.message
    });
  }
};

/**
 * Get all assessment configurations
 * GET /api/admin/multimedia-assessments/config
 */
const getAllAssessmentConfigs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      projectId,
      isActive,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Build match conditions
    const matchConditions = {};
    
    if (projectId) matchConditions.projectId = projectId;
    if (isActive !== undefined) matchConditions.isActive = isActive === 'true';
    
    if (search) {
      matchConditions.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute queries
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
    
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    
    console.log(`📊 Retrieved ${assessmentConfigs.length} assessment configurations`);
    
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
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          limit: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error retrieving assessment configurations:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving assessment configurations',
      error: error.message
    });
  }
};

/**
 * Get assessment configuration by ID
 * GET /api/admin/multimedia-assessments/config/:id
 */
const getAssessmentConfigById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const assessmentConfig = await MultimediaAssessmentConfig.findById(id)
      .populate('projectId', 'projectName projectDescription status budget')
      .populate('createdBy', 'fullName email')
      .populate('lastModifiedBy', 'fullName email');
    
    if (!assessmentConfig) {
      return res.status(404).json({
        success: false,
        message: 'Assessment configuration not found'
      });
    }
    
    // Get available reels count for each niche
    const nicheAvailability = {};
    for (const [niche, requiredCount] of Object.entries(assessmentConfig.videoReels.reelsPerNiche)) {
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
      }
    });
    
  } catch (error) {
    console.error('❌ Error retrieving assessment configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving assessment configuration',
      error: error.message
    });
  }
};

/**
 * Update assessment configuration
 * PUT /api/admin/multimedia-assessments/config/:id
 */
const updateAssessmentConfig = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate request body (excluding projectId from updates)
    const updateSchema = assessmentConfigSchema.fork(['projectId'], schema => schema.optional());
    const { error, value } = updateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => detail.message)
      });
    }
    
    const assessmentConfig = await MultimediaAssessmentConfig.findById(id);
    if (!assessmentConfig) {
      return res.status(404).json({
        success: false,
        message: 'Assessment configuration not found'
      });
    }
    
    // Validate score weights if provided
    if (value.scoring?.scoreWeights) {
      const weights = value.scoring.scoreWeights;
      const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
      if (Math.abs(total - 100) > 0.01) {
        return res.status(400).json({
          success: false,
          message: 'Score weights must total 100',
          currentTotal: total
        });
      }
    }
    
    // If updating video reels configuration, validate availability
    if (value.videoReels?.reelsPerNiche) {
      for (const [niche, requiredCount] of Object.entries(value.videoReels.reelsPerNiche)) {
        if (requiredCount > 0) {
          const availableCount = await VideoReel.countDocuments({
            niche,
            isActive: true,
            isApproved: true
          });
          
          if (availableCount < requiredCount) {
            return res.status(400).json({
              success: false,
              message: `Insufficient video reels for niche '${niche}'. Required: ${requiredCount}, Available: ${availableCount}`
            });
          }
        }
      }
    }
    
    // Update configuration
    Object.keys(value).forEach(key => {
      if (key === 'videoReels' && value.videoReels) {
        // Update video reels configuration and calculate total
        assessmentConfig.videoReels = {
          ...assessmentConfig.videoReels,
          ...value.videoReels
        };
        if (value.videoReels.reelsPerNiche) {
          assessmentConfig.videoReels.totalAvailable = Object.values(value.videoReels.reelsPerNiche)
            .reduce((sum, count) => sum + count, 0);
        }
      } else {
        assessmentConfig[key] = value[key];
      }
    });
    
    assessmentConfig.lastModifiedBy = req.admin.userId;
    await assessmentConfig.save();
    
    console.log(`✅ Assessment configuration updated: ${assessmentConfig.title} by ${req.admin.email}`);
    
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
    console.error('❌ Error updating assessment configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating assessment configuration',
      error: error.message
    });
  }
};

/**
 * Delete assessment configuration
 * DELETE /api/admin/multimedia-assessments/config/:id
 */
const deleteAssessmentConfig = async (req, res) => {
  try {
    const { id } = req.params;
    
    const assessmentConfig = await MultimediaAssessmentConfig.findById(id);
    if (!assessmentConfig) {
      return res.status(404).json({
        success: false,
        message: 'Assessment configuration not found'
      });
    }
    
    // Check if there are any active submissions using this configuration
    const MultimediaAssessmentSubmission = require('../models/multimediaAssessmentSubmission.model');
    const activeSubmissions = await MultimediaAssessmentSubmission.countDocuments({
      assessmentId: id,
      status: { $in: ['in_progress', 'submitted', 'under_review'] }
    });
    
    if (activeSubmissions > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete assessment configuration with active submissions',
        activeSubmissions
      });
    }
    
    // Soft delete - mark as inactive
    assessmentConfig.isActive = false;
    await assessmentConfig.save();
    
    console.log(`🗑️ Assessment configuration deleted: ${assessmentConfig.title} by ${req.admin.email}`);
    
    res.status(200).json({
      success: true,
      message: 'Assessment configuration deleted successfully',
      data: {
        deletedId: assessmentConfig._id,
        title: assessmentConfig.title,
        deletedAt: new Date()
      }
    });
    
  } catch (error) {
    console.error('❌ Error deleting assessment configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting assessment configuration',
      error: error.message
    });
  }
};

/**
 * Get assessment configuration for a specific project
 * GET /api/admin/multimedia-assessments/config/project/:projectId
 */
const getAssessmentConfigByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const assessmentConfig = await MultimediaAssessmentConfig.getByProject(projectId);
    
    if (!assessmentConfig) {
      return res.status(404).json({
        success: false,
        message: 'No active assessment configuration found for this project'
      });
    }
    
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
    console.error('❌ Error retrieving assessment configuration by project:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving assessment configuration',
      error: error.message
    });
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