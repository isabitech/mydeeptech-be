import express from 'express';
import qaReviewController from '../controller/qaReview.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import tryCatch from '../utils/tryCatch.js';
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

router.get('/submissions/pending', authenticateToken, tryCatch(getPendingSubmissions));
router.get('/submissions/approved', authenticateToken, tryCatch(getApprovedSubmissions));
router.get('/submissions/rejected', authenticateToken, tryCatch(getRejectedSubmissions));
router.get('/submissions/:submissionId/review', authenticateToken, tryCatch(getSubmissionForReview));
router.post('/submissions/review-task', tryCatch(reviewTask));
router.post('/submissions/final-review', authenticateToken, tryCatch(submitFinalReview));
router.get('/dashboard', authenticateToken, tryCatch(getReviewerDashboard));
router.post('/submissions/batch-review', authenticateToken, tryCatch(batchReviewSubmissions));
router.get('/analytics', authenticateToken, tryCatch(getSubmissionAnalytics));

export default router;
