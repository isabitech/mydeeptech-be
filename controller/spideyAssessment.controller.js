const SpideyAssessmentEngine = require('../utils/spideyAssessmentEngine');
const SpideyFinalDecisionEngine = require('../utils/spideyFinalDecisionEngine');
const Joi = require('joi');

/**
 * SPIDEY ASSESSMENT CONTROLLER
 * REST API endpoints with NO embedded business logic
 * All logic delegated to assessment engine components
 * Implements strict non-negotiable rules
 */

class SpideyAssessmentController {
  constructor() {
    this.assessmentEngine = new SpideyAssessmentEngine();
    this.finalDecisionEngine = new SpideyFinalDecisionEngine();
    
    // Validation schemas
    this.schemas = {
      startAssessment: Joi.object({
        assessmentId: Joi.string().required(),
        sessionData: Joi.object({
          ipAddress: Joi.string().ip().optional(),
          userAgent: Joi.string().max(500).optional(),
          sessionId: Joi.string().max(100).optional()
        }).optional()
      }),

      submitStage: Joi.object({
        submissionId: Joi.string().required(),
        stage: Joi.string().valid('stage1', 'stage2', 'stage3', 'stage4').required(),
        submissionData: Joi.object().required(),
        timeSpent: Joi.number().min(0).optional()
      }),

      getStatus: Joi.object({
        submissionId: Joi.string().required()
      })
    };
  }

  /**
   * Start new Spidey Assessment
   * POST /api/assessments/spidey/start
   */
  async startAssessment(req, res) {
    try {
      // Extract candidate ID from authenticated user
      const candidateId = req.user._id;
      
      // Validate request
      const { error, value } = this.schemas.startAssessment.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message
          }))
        });
      }

      const { assessmentId, sessionData = {} } = value;

      // Add request metadata to session data
      sessionData.ipAddress = req.ip || req.connection.remoteAddress;
      sessionData.userAgent = req.get('User-Agent');
      sessionData.sessionId = req.sessionID;

      // Delegate to assessment engine
      const result = await this.assessmentEngine.startAssessment(
        assessmentId,
        candidateId,
        sessionData
      );

      return res.status(200).json(result);

    } catch (error) {
      return this._handleError(res, error, 'Assessment start failed');
    }
  }

  /**
   * Submit stage response
   * POST /api/assessments/spidey/submit-stage
   */
  async submitStage(req, res) {
    try {
      // Validate request
      const { error, value } = this.schemas.submitStage.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message
          }))
        });
      }

      const { submissionId, stage, submissionData } = value;
      const files = req.files || [];

      // Delegate to assessment engine
      const result = await this.assessmentEngine.submitStage(
        submissionId,
        stage,
        submissionData,
        files
      );

      // Set appropriate HTTP status based on result
      const statusCode = result.success ? 
        (result.completed ? 200 : 200) : 
        (result.terminated ? 403 : 422);

      return res.status(statusCode).json(result);

    } catch (error) {
      return this._handleError(res, error, 'Stage submission failed');
    }
  }

  /**
   * Get assessment status
   * GET /api/assessments/spidey/:submissionId/status
   */
  async getAssessmentStatus(req, res) {
    try {
      const { submissionId } = req.params;

      // Validate submission ID
      if (!submissionId) {
        return res.status(400).json({
          success: false,
          message: 'Submission ID is required'
        });
      }

      // Delegate to assessment engine
      const result = await this.assessmentEngine.getAssessmentStatus(submissionId);

      return res.status(200).json(result);

    } catch (error) {
      return this._handleError(res, error, 'Status retrieval failed');
    }
  }

  /**
   * Get final decision
   * POST /api/assessments/spidey/:submissionId/finalize
   */
  async getFinalDecision(req, res) {
    try {
      const { submissionId } = req.params;

      if (!submissionId) {
        return res.status(400).json({
          success: false,
          message: 'Submission ID is required'
        });
      }

      // Delegate to final decision engine
      const result = await this.finalDecisionEngine.makeFinalDecision(submissionId);

      return res.status(200).json({
        success: true,
        finalDecision: result
      });

    } catch (error) {
      return this._handleError(res, error, 'Final decision failed');
    }
  }

  /**
   * Get audit report (Admin only)
   * GET /api/assessments/spidey/:submissionId/audit
   */
  async getAuditReport(req, res) {
    try {
      const { submissionId } = req.params;

      // Check admin permissions
      if (!req.user.isAdmin && !req.user.roles?.includes('qa_reviewer')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      // Delegate to final decision engine
      const report = await this.finalDecisionEngine.generateAuditReport(submissionId);

      return res.status(200).json({
        success: true,
        auditReport: report
      });

    } catch (error) {
      return this._handleError(res, error, 'Audit report generation failed');
    }
  }

  /**
   * Get assessment analytics (Admin only)
   * GET /api/assessments/spidey/:assessmentId/analytics
   */
  async getAssessmentAnalytics(req, res) {
    try {
      const { assessmentId } = req.params;

      // Check admin permissions
      if (!req.user.isAdmin && !req.user.roles?.includes('analytics_viewer')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      // Delegate to assessment engine
      const analytics = await this.assessmentEngine.getAssessmentAnalytics(assessmentId);

      return res.status(200).json({
        success: true,
        analytics
      });

    } catch (error) {
      return this._handleError(res, error, 'Analytics generation failed');
    }
  }

  /**
   * Get assessment configuration (For frontend initialization)
   * GET /api/assessments/spidey/:assessmentId/config
   */
  async getAssessmentConfig(req, res) {
    try {
      const { assessmentId } = req.params;
      
      const SpideyAssessmentConfig = require('../models/spideyAssessmentConfig.model');
      const config = await SpideyAssessmentConfig.findById(assessmentId)
        .populate('projectId', 'projectName projectDescription');

      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Assessment configuration not found'
        });
      }

      if (!config.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Assessment is not active'
        });
      }

      // Return sanitized config for frontend - DO NOT expose answers or validation rules
      const sanitizedConfig = {
        assessmentId: config._id,
        title: config.title,
        description: config.description,
        projectName: config.projectId.projectName,
        stages: {
          stage1: {
            name: config.stages.stage1.name,
            timeLimit: config.stages.stage1.timeLimit,
            questionCount: config.stages.stage1.questions?.length || 0
          },
          stage2: {
            name: config.stages.stage2.name,
            timeLimit: config.stages.stage2.timeLimit,
            hasFileUpload: true
          },
          stage3: {
            name: config.stages.stage3.name,
            timeLimit: config.stages.stage3.timeLimit,
            hasFileUpload: true
          },
          stage4: {
            name: config.stages.stage4.name,
            timeLimit: config.stages.stage4.timeLimit,
            hasFileUpload: false
          }
        },
        totalStages: 4,
        expectedDifficulty: 'expert',
        estimatedDuration: '4+ hours'
      };

      return res.status(200).json({
        success: true,
        config: sanitizedConfig
      });

    } catch (error) {
      return this._handleError(res, error, 'Config retrieval failed');
    }
  }

  /**
   * Error handling helper
   */
  _handleError(res, error, defaultMessage) {
    console.error('Spidey Assessment Error:', error);

    // Determine error type and appropriate response
    let statusCode = 500;
    let message = defaultMessage;

    if (error.message.includes('not found')) {
      statusCode = 404;
      message = error.message;
    } else if (error.message.includes('not authorized') || error.message.includes('permission')) {
      statusCode = 403;
      message = 'Access denied';
    } else if (error.message.includes('validation') || error.message.includes('invalid')) {
      statusCode = 400;
      message = error.message;
    } else if (error.message.includes('already')) {
      statusCode = 409;
      message = error.message;
    }

    return res.status(statusCode).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Export controller methods for route binding
const controller = new SpideyAssessmentController();

// Individual stage submission methods for backward compatibility with routes
const submitStage1 = async (req, res) => {
  req.body.stage = 'stage1';
  req.body.submissionId = req.params.submissionId;
  return controller.submitStage(req, res);
};

const submitStage2 = async (req, res) => {
  req.body.stage = 'stage2';
  req.body.submissionId = req.params.submissionId;
  return controller.submitStage(req, res);
};

const submitStage3 = async (req, res) => {
  req.body.stage = 'stage3';
  req.body.submissionId = req.params.submissionId;
  return controller.submitStage(req, res);
};

const submitStage4 = async (req, res) => {
  req.body.stage = 'stage4';
  req.body.submissionId = req.params.submissionId;
  return controller.submitStage(req, res);
};

module.exports = {
  startSpideyAssessment: controller.startAssessment.bind(controller),
  submitStage: controller.submitStage.bind(controller),
  submitStage1,
  submitStage2, 
  submitStage3,
  submitStage4,
  getSpideyAssessmentStatus: controller.getAssessmentStatus.bind(controller),
  getFinalDecision: controller.getFinalDecision.bind(controller),
  getAuditReport: controller.getAuditReport.bind(controller),
  getAssessmentAnalytics: controller.getAssessmentAnalytics.bind(controller),
  getAssessmentConfig: controller.getAssessmentConfig.bind(controller)
};