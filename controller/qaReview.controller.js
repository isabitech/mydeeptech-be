import qaReviewService from '../services/qaReview.service.js';
import { ResponseHandler } from '../utils/responseHandler.js';
import Joi from 'joi';

class QAReviewController {
    static reviewTaskSchema = Joi.object({
        submissionId: Joi.string().required(),
        taskIndex: Joi.number().integer().min(0).required(),
        score: Joi.number().min(0).max(10).required(),
        feedback: Joi.string().max(1000).allow('').default(''),
        qualityRating: Joi.string().valid('Excellent', 'Good', 'Fair', 'Poor').default('Good'),
        notes: Joi.string().max(2000).allow('').default('')
    });

    static finalReviewSchema = Joi.object({
        submissionId: Joi.string().required(),
        overallScore: Joi.number().min(0).max(10).required(),
        overallFeedback: Joi.string().max(2000).allow('').default(''),
        decision: Joi.string().valid('Approve', 'Reject', 'Request Revision').required(),
        privateNotes: Joi.string().max(2000).allow('').default('')
    });

    static batchReviewSchema = Joi.object({
        submissionIds: Joi.array().items(Joi.string()).min(1).max(50).required(),
        decision: Joi.string().valid('Approve', 'Reject').required(),
        overallFeedback: Joi.string().max(1000).allow('').default('Batch processed')
    });
    async getRejectedSubmissions(req, res) {
        const result = await qaReviewService.getRejectedSubmissions(req.query);
        return ResponseHandler.success(res, result, 'Rejected submissions retrieved successfully');
    }
    async getPendingSubmissions(req, res) {
        try {
            const result = await qaReviewService.getPendingSubmissions(req.query);
            return ResponseHandler.success(res, result, 'Pending submissions retrieved successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async getSubmissionForReview(req, res) {
        try {
            const { submissionId } = req.params;
            const result = await qaReviewService.getSubmissionForReview(submissionId);
            return ResponseHandler.success(res, result, 'Submission details retrieved successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async reviewTask(req, res) {
        try {
            const { error, value } = QAReviewController.reviewTaskSchema.validate(req.body);
            if (error) return ResponseHandler.error(res, { statusCode: 400, message: 'Validation error', details: error.details.map(d => d.message) });

            const reviewerId = req.user?._id || req.user?.userId;
            const result = await qaReviewService.reviewTask(reviewerId, value);
            return ResponseHandler.success(res, result, 'Task reviewed successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async submitFinalReview(req, res) {
        try {
            const { error, value } = QAReviewController.finalReviewSchema.validate(req.body);
            if (error) return ResponseHandler.error(res, { statusCode: 400, message: 'Validation error', details: error.details.map(d => d.message) });

            const reviewerId = req.user?._id || req.user?.userId;
            const result = await qaReviewService.submitFinalReview(reviewerId, value);
            return ResponseHandler.success(res, result, `Assessment ${value.decision.toLowerCase()}d successfully`);
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async getReviewerDashboard(req, res) {
        try {
            const reviewerId = req.user?._id || req.user?.userId;
            const result = await qaReviewService.getReviewerDashboard(reviewerId);
            return ResponseHandler.success(res, result, 'Reviewer dashboard data retrieved successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async batchReviewSubmissions(req, res) {
        try {
            const { error, value } = QAReviewController.batchReviewSchema.validate(req.body);
            if (error) return ResponseHandler.error(res, { statusCode: 400, message: 'Validation error', details: error.details.map(d => d.message) });

            const reviewerId = req.user?._id || req.user?.userId;
            const result = await qaReviewService.batchReview(reviewerId, value);
            return ResponseHandler.success(res, result, 'Batch review completed successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async getSubmissionAnalytics(req, res) {
        try {
            const result = await qaReviewService.getAnalytics(req.query);
            return ResponseHandler.success(res, result, 'Submission analytics retrieved successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async getApprovedSubmissions(req, res) {
        try {
            const result = await qaReviewService.getApprovedSubmissions(req.query);
            return ResponseHandler.success(res, result, 'Approved submissions retrieved successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }
}

const qaReviewController = new QAReviewController();
export default qaReviewController;
export const {
    getPendingSubmissions,
    getApprovedSubmissions,
    getRejectedSubmissions,
    getSubmissionForReview,
    reviewTask,
    submitFinalReview,
    getReviewerDashboard,
    batchReviewSubmissions,
    getSubmissionAnalytics
} = qaReviewController;