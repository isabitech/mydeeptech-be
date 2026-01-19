import express from 'express';
import assessmentController from '../controller/assessment.controller.js';
import multimediaAssessmentSessionController from '../controller/multimediaAssessmentSession.controller.js';
import  spideyAssessmentController  from '../controller/spideyAssessment.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { authenticateAdmin } from '../middleware/adminAuth.js';
import  tryCatch  from '../utils/tryCatch.js';

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

router.get('/questions', authenticateToken, tryCatch(getAssessmentQuestions));
router.get('/available', authenticateToken, tryCatch(getAllAssessments));
router.post('/start/:assessmentId', authenticateToken, tryCatch(startAssessmentById));
router.get('/overview', authenticateToken, tryCatch(getUserAssessmentsOverview));
router.post('/submit', authenticateToken, tryCatch(submitAssessment));
router.get('/history', authenticateToken, tryCatch(getUserAssessmentHistory));
router.get('/retake-eligibility', authenticateToken, tryCatch(checkRetakeEligibility));

// ==========================================
// MULTIMEDIA ASSESSMENT SESSION ROUTES
// ==========================================

router.post('/multimedia/:assessmentId/start', authenticateToken, tryCatch(startAssessmentSession));
router.get('/multimedia/session/:submissionId', authenticateToken, tryCatch(getAssessmentSession));
router.post('/multimedia/:submissionId/save-progress', authenticateToken, tryCatch(saveTaskProgress));
router.post('/multimedia/:submissionId/submit-task/:taskNumber', authenticateToken, tryCatch(submitTask));
router.post('/multimedia/:submissionId/timer', authenticateToken, tryCatch(controlTimer));
router.post('/multimedia/:submissionId/submit', authenticateToken, tryCatch(submitMultimediaAssessment));
router.get('/multimedia/reels/:assessmentId', authenticateToken, tryCatch(getAvailableReels));

// ==========================================
// SPIDEY ASSESSMENT ROUTES (HIGH-DISCIPLINE)
// ==========================================

router.post('/spidey/start', authenticateToken, tryCatch(startSpideyAssessment));
router.get('/spidey/:submissionId/status', authenticateToken, tryCatch(getSpideyAssessmentStatus));
router.post('/spidey/:submissionId/stage1/submit', authenticateToken, tryCatch(submitStage1));
router.post('/spidey/:submissionId/stage2/submit', authenticateToken, tryCatch(submitStage2));
router.post('/spidey/:submissionId/stage3/submit', authenticateToken, tryCatch(submitStage3));
router.post('/spidey/:submissionId/stage4/submit', authenticateToken, tryCatch(submitStage4));

// ==========================================
// ADMIN ASSESSMENT ROUTES
// ==========================================

router.get('/admin', authenticateAdmin, tryCatch(getAdminAssessments));
router.get('/admin/overview', authenticateAdmin, tryCatch(getAdminAssessmentsOverview));
router.get('/:assessmentId/submissions', authenticateToken, tryCatch(getAssessmentSubmissions));

export default router;
