import spideyAssessmentService from '../services/spideyAssessment.service.js';
import ResponseHandler from '../utils/responseHandler.js';
import Joi from 'joi';

/**
 * SPIDEY ASSESSMENT CONTROLLER
 * REST API endpoints with NO embedded business logic
 * All logic delegated to assessment service
 */
class SpideyAssessmentController {
  // Validation schemas
  static startAssessmentSchema = Joi.object({
    assessmentId: Joi.string().required(),
    sessionData: Joi.object({
      ipAddress: Joi.string().ip().optional(),
      userAgent: Joi.string().max(500).optional(),
      sessionId: Joi.string().max(100).optional()
    }).optional()
  });

  static submitStageSchema = Joi.object({
    submissionId: Joi.string().required(),
    stage: Joi.string().valid('stage1', 'stage2', 'stage3', 'stage4').required(),
    submissionData: Joi.object().required(),
    timeSpent: Joi.number().min(0).optional()
  });

  /**
   * Start new Spidey Assessment
   * POST /api/assessments/spidey/start
   */
  async startAssessment(req, res) {
    try {
      const candidateId = req.user._id;
      const { error, value } = SpideyAssessmentController.startAssessmentSchema.validate(req.body);

      if (error) {
        return ResponseHandler.error(res, error.details[0].message, 400);
      }

      const { assessmentId, sessionData = {} } = value;

      // Add request metadata to session data
      sessionData.ipAddress = req.ip || req.connection.remoteAddress;
      sessionData.userAgent = req.get('User-Agent');
      sessionData.sessionId = req.sessionID;

      const result = await spideyAssessmentService.startAssessment(
        assessmentId,
        candidateId,
        sessionData
      );

      return ResponseHandler.success(res, result, 'Assessment started successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Submit stage response
   * POST /api/assessments/spidey/submit-stage
   */
  async submitStage(req, res) {
    try {
      const { error, value } = SpideyAssessmentController.submitStageSchema.validate(req.body);

      if (error) {
        return ResponseHandler.error(res, error.details[0].message, 400);
      }

      const { submissionId, stage, submissionData } = value;
      const files = req.files || [];

      const result = await spideyAssessmentService.submitStage(
        submissionId,
        stage,
        submissionData,
        files
      );

      // result contains its own success/message/etc.
      // We pass the whole result as data
      return ResponseHandler.success(res, result, result.message || 'Stage submitted successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Get assessment status
   * GET /api/assessments/spidey/:submissionId/status
   */
  async getAssessmentStatus(req, res) {
    try {
      const { submissionId } = req.params;

      if (!submissionId) {
        return ResponseHandler.error(res, 'Submission ID is required', 400);
      }

      const result = await spideyAssessmentService.getAssessmentStatus(submissionId);
      return ResponseHandler.success(res, result);
    } catch (error) {
      return ResponseHandler.handleError(res, error);
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
        return ResponseHandler.error(res, 'Submission ID is required', 400);
      }

      const result = await spideyAssessmentService.getFinalDecision(submissionId);
      return ResponseHandler.success(res, { finalDecision: result });
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Get audit report (Admin only)
   * GET /api/assessments/spidey/:submissionId/audit
   */
  async getAuditReport(req, res) {
    try {
      const { submissionId } = req.params;

      if (!req.user.isAdmin && !req.user.roles?.includes('qa_reviewer')) {
        return ResponseHandler.error(res, 'Admin access required', 403);
      }

      const report = await spideyAssessmentService.getAuditReport(submissionId);
      return ResponseHandler.success(res, { auditReport: report });
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Get assessment analytics (Admin only)
   * GET /api/assessments/spidey/:assessmentId/analytics
   */
  async getAssessmentAnalytics(req, res) {
    try {
      const { assessmentId } = req.params;

      if (!req.user.isAdmin && !req.user.roles?.includes('analytics_viewer')) {
        return ResponseHandler.error(res, 'Admin access required', 403);
      }

      const analytics = await spideyAssessmentService.getAssessmentAnalytics(assessmentId);
      return ResponseHandler.success(res, { analytics });
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Get assessment configuration (For frontend initialization)
   * GET /api/assessments/spidey/:assessmentId/config
   */
  async getAssessmentConfig(req, res) {
    try {
      const { assessmentId } = req.params;
      const config = await spideyAssessmentService.getAssessmentConfig(assessmentId);
      return ResponseHandler.success(res, { config });
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }
}

export default new SpideyAssessmentController();