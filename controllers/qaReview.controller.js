// Layer: Controller
const Joi = require('joi');
const qaReviewService = require('../services/qaReview.service');

// Validation schemas
const reviewTaskSchema = Joi.object({
    submissionId: Joi.string().required(),
    taskIndex: Joi.number().integer().min(0).required(),
    score: Joi.number().min(0).max(10).required(),
    feedback: Joi.string().max(1000).allow('').default(''),
    qualityRating: Joi.string().valid('Excellent', 'Good', 'Fair', 'Poor').default('Good'),
    notes: Joi.string().max(2000).allow('').default('')
});

const finalReviewSchema = Joi.object({
    submissionId: Joi.string().required(),
    overallScore: Joi.number().min(0).max(10).required(),
    overallFeedback: Joi.string().max(2000).allow('').default(''),
    decision: Joi.string().valid('Approve', 'Reject', 'Request Revision').required(),
    privateNotes: Joi.string().max(2000).allow('').default('')
});

const batchReviewSchema = Joi.object({
    submissionIds: Joi.array().items(Joi.string()).min(1).max(50).required(),
    decision: Joi.string().valid('Approve', 'Reject').required(),
    overallFeedback: Joi.string().max(1000).allow('').default('Batch processed')
});

/**
 * @desc Get pending submissions for QA review
 */
const getPendingSubmissions = async (req, res) => {
    try {
        const result = await qaReviewService.getPendingSubmissions(req.query);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching pending submissions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending submissions',
            error: error.message
        });
    }
};

/**
 * @desc Get detailed submission for review
 */
const getSubmissionForReview = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const result = await qaReviewService.getSubmissionForReview(submissionId);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching submission for review:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch submission details',
            error: error.message
        });
    }
};

/**
 * @desc Review and score individual task
 */
const reviewTask = async (req, res) => {
    try {
        const { error, value } = reviewTaskSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                details: error.details
            });
        }

        const result = await qaReviewService.reviewTask(value, req.user);
        res.json({
            success: true,
            message: 'Task reviewed successfully',
            data: result
        });
    } catch (error) {
        console.error('Error reviewing task:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to review task',
            error: error.message
        });
    }
};

/**
 * @desc Submit final review and decision
 */
const submitFinalReview = async (req, res) => {
    try {
        const { error, value } = finalReviewSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                details: error.details
            });
        }

        const result = await qaReviewService.submitFinalReview(value, req.user);
        res.json({
            success: true,
            message: `Assessment ${value.decision.toLowerCase()}d successfully`,
            data: {
                ...result,
                newUserStatus: value.decision === 'Approve' ? 'approved' : (value.decision === 'Reject' ? 'failed' : 'pending')
            }
        });
    } catch (error) {
        console.error('Error submitting final review:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit final review',
            error: error.message
        });
    }
};

/**
 * @desc Get QA reviewer dashboard statistics
 */
const getReviewerDashboard = async (req, res) => {
    try {
        const result = await qaReviewService.getReviewerDashboard(req.user);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching reviewer dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data',
            error: error.message
        });
    }
};

/**
 * @desc Batch process multiple submissions
 */
const batchReviewSubmissions = async (req, res) => {
    try {
        const { error, value } = batchReviewSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                details: error.details
            });
        }

        const result = await qaReviewService.batchReviewSubmissions(value, req.user);
        res.json({
            success: true,
            message: `Batch processing completed. ${result.processed} processed, ${result.failed} failed.`,
            data: result
        });
    } catch (error) {
        console.error('Error in batch review:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process batch review',
            error: error.message
        });
    }
};

/**
 * @desc Get submission analytics for admin
 */
const getSubmissionAnalytics = async (req, res) => {
    try {
        const result = await qaReviewService.getSubmissionAnalytics(req.query);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching submission analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics',
            error: error.message
        });
    }
};

/**
 * @desc Get approved submissions
 */
const getApprovedSubmissions = async (req, res) => {
    try {
        const result = await qaReviewService.getSubmissionsByStatus('approved', req.query);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching approved submissions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch approved submissions',
            error: error.message
        });
    }
};

/**
 * @desc Get rejected submissions
 */
const getRejectedSubmissions = async (req, res) => {
    try {
        const result = await qaReviewService.getSubmissionsByStatus('rejected', req.query);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching rejected submissions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch rejected submissions',
            error: error.message
        });
    }
};

module.exports = {
    getPendingSubmissions,
    getApprovedSubmissions,
    getRejectedSubmissions,
    getSubmissionForReview,
    reviewTask,
    submitFinalReview,
    getReviewerDashboard,
    batchReviewSubmissions,
    getSubmissionAnalytics
};