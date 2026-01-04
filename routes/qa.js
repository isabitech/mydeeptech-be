import express from 'express';
import qaReviewController from '../controller/qaReview.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

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
} = qaReviewController;

// ==========================================
// QA REVIEW SYSTEM ROUTES
// ==========================================

router.get('/submissions/pending', authenticateToken, getPendingSubmissions);
router.get('/submissions/approved', authenticateToken, getApprovedSubmissions);
router.get('/submissions/rejected', authenticateToken, getRejectedSubmissions);
router.get('/submissions/:submissionId/review', authenticateToken, getSubmissionForReview);
router.post('/submissions/review-task', reviewTask);
router.post('/submissions/final-review', authenticateToken, submitFinalReview);
router.get('/dashboard', authenticateToken, getReviewerDashboard);
router.post('/submissions/batch-review', authenticateToken, batchReviewSubmissions);
router.get('/analytics', authenticateToken, getSubmissionAnalytics);

export default router;
