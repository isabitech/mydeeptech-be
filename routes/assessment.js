import express from 'express';
import assessmentController from '../controller/assessment.controller.js';
import multimediaAssessmentSessionController from '../controller/multimediaAssessmentSession.controller.js';
import spideyAssessmentController from '../controller/spideyAssessment.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { authenticateAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

const {
  submitAssessment, getUserAssessmentHistory, checkRetakeEligibility,
  getAdminAssessments, getAssessmentQuestions, getAllAssessments,
  startAssessmentById, getAssessmentSubmissions, getAdminAssessmentsOverview,
  getUserAssessmentsOverview
} = assessmentController;

const {
  startAssessmentSession, getAssessmentSession, saveTaskProgress,
  submitTask, controlTimer, submitAssessment: submitMultimediaAssessment,
  getAvailableReels
} = multimediaAssessmentSessionController;

const {
  startSpideyAssessment, submitStage1, submitStage2,
  submitStage3, submitStage4, getSpideyAssessmentStatus
} = spideyAssessmentController;

// ==========================================
// USER ASSESSMENT ROUTES
// ==========================================

router.get('/questions', authenticateToken, getAssessmentQuestions);
router.get('/available', authenticateToken, getAllAssessments);
router.post('/start/:assessmentId', authenticateToken, startAssessmentById);
router.get('/overview', authenticateToken, getUserAssessmentsOverview);
router.post('/submit', authenticateToken, submitAssessment);
router.get('/history', authenticateToken, getUserAssessmentHistory);
router.get('/retake-eligibility', authenticateToken, checkRetakeEligibility);

// ==========================================
// MULTIMEDIA ASSESSMENT SESSION ROUTES
// ==========================================

router.post('/multimedia/:assessmentId/start', authenticateToken, startAssessmentSession);
router.get('/multimedia/session/:submissionId', authenticateToken, getAssessmentSession);
router.post('/multimedia/:submissionId/save-progress', authenticateToken, saveTaskProgress);
router.post('/multimedia/:submissionId/submit-task/:taskNumber', authenticateToken, submitTask);
router.post('/multimedia/:submissionId/timer', authenticateToken, controlTimer);
router.post('/multimedia/:submissionId/submit', authenticateToken, submitMultimediaAssessment);
router.get('/multimedia/reels/:assessmentId', authenticateToken, getAvailableReels);

// ==========================================
// SPIDEY ASSESSMENT ROUTES (HIGH-DISCIPLINE)
// ==========================================

router.post('/spidey/start', authenticateToken, startSpideyAssessment);
router.get('/spidey/:submissionId/status', authenticateToken, getSpideyAssessmentStatus);
router.post('/spidey/:submissionId/stage1/submit', authenticateToken, submitStage1);
router.post('/spidey/:submissionId/stage2/submit', authenticateToken, submitStage2);
router.post('/spidey/:submissionId/stage3/submit', authenticateToken, submitStage3);
router.post('/spidey/:submissionId/stage4/submit', authenticateToken, submitStage4);

// ==========================================
// ADMIN ASSESSMENT ROUTES
// ==========================================

router.get('/admin', authenticateAdmin, getAdminAssessments);
router.get('/admin/overview', authenticateAdmin, getAdminAssessmentsOverview);
router.get('/:assessmentId/submissions', authenticateToken, getAssessmentSubmissions);

export default router;
