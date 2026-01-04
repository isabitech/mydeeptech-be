import assessmentService from '../services/assessment.service.js';
import { ResponseHandler, ValidationError, AuthenticationError } from '../utils/responseHandler.js';
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
    const userId = req.user?.userId || req.userId;
    if (!userId) throw new AuthenticationError("User authentication required");

    const { error, value } = AssessmentController.submitAssessmentSchema.validate(req.body);
    if (error) throw new ValidationError("Validation error", error.details.map(d => d.message));

    const result = await assessmentService.submitAssessment(userId, value, req.ip, req.get('User-Agent'));
    ResponseHandler.success(res, result, `Assessment completed successfully. You ${result.results.passed ? 'PASSED' : 'FAILED'}`, 201);
  }

  async getUserAssessmentHistory(req, res) {
    const userId = req.user?.userId || req.userId;
    if (!userId) throw new AuthenticationError("User authentication required");

    const { error, value } = AssessmentController.getAssessmentsSchema.validate(req.query);
    if (error) throw new ValidationError("Validation error", error.details.map(d => d.message));

    const result = await assessmentService.getHistory(userId, value);
    ResponseHandler.success(res, result, "Assessment history retrieved successfully");
  }

  async checkRetakeEligibility(req, res) {
    const userId = req.user?.userId || req.userId;
    if (!userId) throw new AuthenticationError("User authentication required");

    const { assessmentType = 'annotator_qualification' } = req.query;
    const result = await assessmentService.getRetakeEligibility(userId, assessmentType);
    ResponseHandler.success(res, result);
  }

  async getAdminAssessments(req, res) {
    if (!req.admin) throw new AuthenticationError("Admin authentication required");

    const { error, value } = AssessmentController.getAssessmentsSchema.validate(req.query);
    if (error) throw new ValidationError("Validation error", error.details.map(d => d.message));

    const result = await assessmentService.getAdminAssessments(value);
    ResponseHandler.success(res, result, "Admin assessments retrieved successfully");
  }

  async getAssessmentQuestions(req, res) {
    const userId = req.user?.userId || req.userId;
    if (!userId) throw new AuthenticationError("User authentication required");

    const { questionsPerSection = 5 } = req.query;
    const questions = await assessmentService.getQuestions(questionsPerSection);

    ResponseHandler.success(res, {
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
  }

  async getSectionStatistics(req, res) {
    const { isAdmin = false } = req.query;
    if (isAdmin && !req.admin) throw new AuthenticationError("Admin authentication required");

    const result = await assessmentService.getSectionStats();
    ResponseHandler.success(res, result, "Section statistics retrieved successfully");
  }

  async getAllAssessments(req, res) {
    const userId = req.user?.userId || req.userId;
    if (!userId) throw new AuthenticationError("User authentication required");

    const result = await assessmentService.getAvailableAssessments(userId);
    ResponseHandler.success(res, result, "Available assessments retrieved successfully");
  }
}

export default new AssessmentController();