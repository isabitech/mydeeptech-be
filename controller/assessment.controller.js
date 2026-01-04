import assessmentService from '../services/assessment.service.js';
import { ResponseHandler } from '../utils/responseHandler.js';
import Joi from 'joi';

class AssessmentController {
  static submitAssessmentSchema = Joi.object({
    assessmentType: Joi.string().valid('annotator_qualification', 'skill_assessment', 'project_specific').default('annotator_qualification'),
    startedAt: Joi.date().required(),
    completedAt: Joi.date().min(Joi.ref('startedAt')).required(),
    answers: Joi.array().items(
      Joi.object({
        questionId: Joi.number().required(),
        section: Joi.string().valid('Comprehension', 'Vocabulary', 'Grammar', 'Writing').required(),
        userAnswer: Joi.string().required(),
        question: Joi.string().required(),
        options: Joi.array().items(Joi.string())
      })
    ).min(20).max(20).required(),
    passingScore: Joi.number().min(0).max(100).default(60)
  });

  static getAssessmentsSchema = Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(50).default(10),
    assessmentType: Joi.string().valid('annotator_qualification', 'skill_assessment', 'project_specific').optional(),
    passed: Joi.boolean().optional(),
    userId: Joi.string().optional()
  });

  async submitAssessment(req, res) {
    try {
      const userId = req.user?.userId || req.userId;
      if (!userId) return ResponseHandler.error(res, { statusCode: 401, message: "User authentication required" });

      const { error, value } = AssessmentController.submitAssessmentSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, { statusCode: 400, message: "Validation error", details: error.details.map(d => d.message) });

      const result = await assessmentService.submitAssessment(userId, value, req.ip, req.get('User-Agent'));
      return ResponseHandler.success(res, result, `Assessment completed successfully. You ${result.results.passed ? 'PASSED' : 'FAILED'}`, 201);
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  async getUserAssessmentHistory(req, res) {
    try {
      const userId = req.user?.userId || req.userId;
      if (!userId) return ResponseHandler.error(res, { statusCode: 401, message: "User authentication required" });

      const { error, value } = AssessmentController.getAssessmentsSchema.validate(req.query);
      if (error) return ResponseHandler.error(res, { statusCode: 400, message: "Validation error", details: error.details.map(d => d.message) });

      const result = await assessmentService.getHistory(userId, value);
      return ResponseHandler.success(res, result, "Assessment history retrieved successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  async checkRetakeEligibility(req, res) {
    try {
      const userId = req.user?.userId || req.userId;
      if (!userId) return ResponseHandler.error(res, { statusCode: 401, message: "User authentication required" });

      const { assessmentType = 'annotator_qualification' } = req.query;
      const result = await assessmentService.getRetakeEligibility(userId, assessmentType);
      return ResponseHandler.success(res, result);
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  async getAdminAssessments(req, res) {
    try {
      if (!req.admin) return ResponseHandler.error(res, { statusCode: 401, message: "Admin authentication required" });

      const { error, value } = AssessmentController.getAssessmentsSchema.validate(req.query);
      if (error) return ResponseHandler.error(res, { statusCode: 400, message: "Validation error", details: error.details.map(d => d.message) });

      const result = await assessmentService.getAdminAssessments(value);
      return ResponseHandler.success(res, result, "Admin assessments retrieved successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  async getAssessmentQuestions(req, res) {
    try {
      const userId = req.user?.userId || req.userId;
      if (!userId) return ResponseHandler.error(res, { statusCode: 401, message: "User authentication required" });

      const { questionsPerSection = 5 } = req.query;
      const questions = await assessmentService.getQuestions(questionsPerSection);

      return ResponseHandler.success(res, {
        questions,
        assessmentInfo: {
          totalQuestions: questions.length,
          questionsPerSection: parseInt(questionsPerSection),
          sections: ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'],
          passingScore: 60,
          timeLimit: 30,
          assessmentType: 'annotator_qualification',
          instructions: "This assessment contains questions from 4 sections: Comprehension, Vocabulary, Grammar, and Writing. You have 30 minutes to complete all 20 questions. A passing score is 60%."
        }
      }, "Assessment questions retrieved successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  async getSectionStatistics(req, res) {
    try {
      const { isAdmin = false } = req.query;
      if (isAdmin && !req.admin) return ResponseHandler.error(res, { statusCode: 401, message: "Admin authentication required" });

      const result = await assessmentService.getSectionStats();
      return ResponseHandler.success(res, result, "Section statistics retrieved successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  async getAllAssessments(req, res) {
    try {
      const userId = req.user?.userId || req.userId;
      if (!userId) return ResponseHandler.error(res, { statusCode: 401, message: "User authentication required" });

      const result = await assessmentService.getAvailableAssessments(userId);
      return ResponseHandler.success(res, result, "Available assessments retrieved successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }
}

export default new AssessmentController();