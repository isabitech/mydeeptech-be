const express = require('express');
const router = express.Router();

// Import QA controllers
const {
  getPendingSubmissions,
  getApprovedSubmissions,
  getRejectedSubmissions,
  getSubmissionForReview,
  reviewTask,
  submitFinalReview,
  getReviewerDashboard,
  batchReviewSubmissions,
  getSubmissionAnalytics
} = require('../controller/qaReview.controller');

// Import middleware
const { authenticateToken } = require('../middleware/auth');

// ==========================================
// QA REVIEW SYSTEM ROUTES
// ==========================================

/**
 * @route GET /api/qa/submissions/pending
 * @desc Get pending submissions for QA review
 * @access Private (QA Reviewer)
 */
router.get('/submissions/pending', authenticateToken, getPendingSubmissions);

/**
 * @route GET /api/qa/debug/check
 * @desc Debug endpoint to check QA system status
 * @access Private
 */
router.get('/debug/check', authenticateToken, async (req, res) => {
    try {
        const MultimediaAssessmentSubmission = require('../models/multimediaAssessmentSubmission.model');
        
        const totalCount = await MultimediaAssessmentSubmission.countDocuments();
        const submittedCount = await MultimediaAssessmentSubmission.countDocuments({ status: 'submitted' });
        const statusBreakdown = await MultimediaAssessmentSubmission.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        res.json({
            success: true,
            debug: {
                totalSubmissions: totalCount,
                submittedSubmissions: submittedCount,
                statusBreakdown: statusBreakdown,
                user: req.user ? { email: req.user.email, roles: req.user.userDoc?.roles } : null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/qa/submissions/approved
 * @desc Get approved submissions
 * @access Private (QA Reviewer)
 */
router.get('/submissions/approved', authenticateToken, getApprovedSubmissions);

/**
 * @route GET /api/qa/submissions/rejected
 * @desc Get rejected submissions
 * @access Private (QA Reviewer)
 */
router.get('/submissions/rejected', authenticateToken, getRejectedSubmissions);

/**
 * @route GET /api/qa/submissions/:submissionId/review
 * @desc Get submission details for review
 * @access Private (QA Reviewer)
 */
router.get('/submissions/:submissionId/review', authenticateToken, getSubmissionForReview);

/**
 * @route POST /api/qa/submissions/review-task
 * @desc Review individual task in a submission
 * @access Private (QA Reviewer) - Temporarily public for testing
 */
router.post('/submissions/review-task', reviewTask);

/**
 * @route POST /api/qa/submissions/final-review
 * @desc Submit final review for a submission
 * @access Private (QA Reviewer)
 */
router.post('/submissions/final-review', authenticateToken, submitFinalReview);

/**
 * @route GET /api/qa/dashboard
 * @desc Get QA reviewer dashboard with statistics
 * @access Private (QA Reviewer)
 */
router.get('/dashboard', authenticateToken, getReviewerDashboard);

/**
 * @route POST /api/qa/submissions/batch-review
 * @desc Batch process multiple submissions
 * @access Private (QA Reviewer)
 */
router.post('/submissions/batch-review', authenticateToken, batchReviewSubmissions);

/**
 * @route GET /api/qa/analytics
 * @desc Get QA analytics and submission statistics
 * @access Private (QA Reviewer)
 */
router.get('/analytics', authenticateToken, getSubmissionAnalytics);

module.exports = router;