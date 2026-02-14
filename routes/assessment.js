const express = require('express');
const router = express.Router();

// Import controllers
const {
  submitAssessment,
  getUserAssessmentHistory,
  checkRetakeEligibility,
  getAdminAssessments,
  getAssessmentQuestions,
  getAllAssessments,
  startAssessmentById,
  getAssessmentSubmissions,
  getAdminAssessmentsOverview,
  getUserAssessmentsOverview
} = require('../controllers/assessment.controller');

const {
  startAssessmentSession,
  getAssessmentSession,
  saveTaskProgress,
  submitTask,
  controlTimer,
  submitAssessment: submitMultimediaAssessment,
  getAvailableReels
} = require('../controllers/multimediaAssessmentSession.controller');

// Import Spidey Assessment Controller (integrates with existing system)
const {
  startSpideyAssessment,
  submitStage1,
  submitStage2,
  submitStage3,
  submitStage4,
  getSpideyAssessmentStatus
} = require('../controllers/spideyAssessment.controller');

// Import middleware
const { authenticateToken } = require('../middleware/auth');
const { authenticateAdmin } = require('../middleware/adminAuth');

// ==========================================
// USER ASSESSMENT ROUTES
// ==========================================

/**
 * @route GET /api/assessments/questions
 * @desc Get random assessment questions for taking assessment
 * @access Private (User)
 * @query assessmentType, difficulty, category, limit
 */
router.get('/questions', authenticateToken, getAssessmentQuestions);

/**
 * @route GET /api/assessments/available
 * @desc Get all available assessments (English & Multimedia)
 * @access Private (User)
 * @returns List of assessments user can take with status and requirements
 */
router.get('/available', authenticateToken, getAllAssessments);

/**
 * @route POST /api/assessments/start/:assessmentId
 * @desc Start an assessment by ID (english-proficiency or multimedia ID)
 * @access Private (User)
 * @param assessmentId - 'english-proficiency' or multimedia assessment ObjectId
 * @returns Assessment questions/session or error if not eligible
 */
router.post('/start/:assessmentId', authenticateToken, startAssessmentById);

/**
 * @route GET /api/assessments/overview
 * @desc Get user's personal assessment overview with progress and recommendations
 * @access Private (User)
 * @returns User's assessment progress, scores, and personalized recommendations
 */
router.get('/overview', authenticateToken, getUserAssessmentsOverview);

/**
 * @route POST /api/assessments/submit
 * @desc Submit assessment and automatically update user status
 * @access Private (User)
 * @body {
 *   assessmentType: string,
 *   startedAt: date,
 *   completedAt: date,
 *   questions: [question objects],
 *   category: string,
 *   difficulty: string,
 *   passingScore: number
 * }
 */
router.post('/submit', authenticateToken, submitAssessment);

/**
 * @route GET /api/assessments/history
 * @desc Get user's assessment history
 * @access Private (User)
 * @query page, limit, assessmentType, passed
 */
router.get('/history', authenticateToken, getUserAssessmentHistory);

/**
 * @route GET /api/assessments/retake-eligibility
 * @desc Check if user can retake assessment (24-hour cooldown)
 * @access Private (User)
 * @query assessmentType
 */
router.get('/retake-eligibility', authenticateToken, checkRetakeEligibility);

// ==========================================
// MULTIMEDIA ASSESSMENT SESSION ROUTES
// ==========================================

/**
 * @route POST /api/assessments/multimedia/:assessmentId/start
 * @desc Start multimedia assessment session
 * @access Private (Annotator)
 */
router.post('/multimedia/:assessmentId/start', authenticateToken, startAssessmentSession);

/**
 * @route GET /api/assessments/multimedia/session/:submissionId
 * @desc Get multimedia assessment session
 * @access Private (Annotator)
 */
router.get('/multimedia/session/:submissionId', authenticateToken, getAssessmentSession);

/**
 * @route POST /api/assessments/multimedia/:submissionId/save-progress
 * @desc Save task progress in multimedia assessment
 * @access Private (Annotator)
 */
router.post('/multimedia/:submissionId/save-progress', authenticateToken, saveTaskProgress);

/**
 * @route POST /api/assessments/multimedia/:submissionId/submit-task/:taskNumber
 * @desc Submit individual task in multimedia assessment
 * @access Private (Annotator)
 */
router.post('/multimedia/:submissionId/submit-task/:taskNumber', authenticateToken, submitTask);

/**
 * @route POST /api/assessments/multimedia/:submissionId/timer
 * @desc Control timer for multimedia assessment
 * @access Private (Annotator)
 */
router.post('/multimedia/:submissionId/timer', authenticateToken, controlTimer);

/**
 * @route POST /api/assessments/multimedia/:submissionId/submit
 * @desc Submit final multimedia assessment
 * @access Private (Annotator)
 */
router.post('/multimedia/:submissionId/submit', authenticateToken, submitMultimediaAssessment);

/**
 * @route GET /api/assessments/multimedia/reels/:assessmentId
 * @desc Get available reels for multimedia assessment
 * @access Private (Annotator)
 */
router.get('/multimedia/reels/:assessmentId', authenticateToken, getAvailableReels);

// ==========================================
// SPIDEY ASSESSMENT ROUTES (HIGH-DISCIPLINE)
// ==========================================

/**
 * @route POST /api/assessments/spidey/start
 * @desc Start Spidey High-Discipline Assessment
 * @access Private (User)
 * @returns New Spidey assessment session with Stage 1 configuration
 * @note Integrates with existing assessment infrastructure
 */
router.post('/spidey/start', authenticateToken, startSpideyAssessment);

/**
 * @route GET /api/assessments/spidey/:submissionId/status
 * @desc Get current Spidey assessment status and progress
 * @access Private (User - own assessment)
 * @returns Assessment status, current stage, and completion data
 */
router.get('/spidey/:submissionId/status', authenticateToken, getSpideyAssessmentStatus);

/**
 * @route POST /api/assessments/spidey/:submissionId/stage1/submit
 * @desc Submit Stage 1 - Guideline Comprehension responses
 * @access Private (User)
 * @body { responses: Array, timeSpent: Number }
 * @returns Stage completion result and next stage info
 * @note Server authority - frontend never decides pass/fail
 */
router.post('/spidey/:submissionId/stage1/submit', authenticateToken, submitStage1);

/**
 * @route POST /api/assessments/spidey/:submissionId/stage2/submit
 * @desc Submit Stage 2 - Mini Task Validation
 * @access Private (User)
 * @body { promptText, domain, failureExplanation, fileReferences, response, timeSpent }
 * @returns Validation results and progression status
 * @note Hard rules enforced - any violation = immediate fail
 */
router.post('/spidey/:submissionId/stage2/submit', authenticateToken, submitStage2);

/**
 * @route POST /api/assessments/spidey/:submissionId/stage3/submit
 * @desc Submit Stage 3 - Golden Solution & Rubric
 * @access Private (User)
 * @body { positiveRubric, negativeRubric, timeSpent }
 * @note Files uploaded separately, virus scan required
 * @returns File validation and rubric assessment results
 */
router.post('/spidey/:submissionId/stage3/submit', authenticateToken, submitStage3);

/**
 * @route POST /api/assessments/spidey/:submissionId/stage4/submit
 * @desc Submit Stage 4 - Integrity Trap Evaluation
 * @access Private (User)
 * @body { instructionGiven, userResponse, violationFlagged, responseTime, timeSpent }
 * @returns Final assessment completion and scoring
 * @note Blind compliance detection - critical for quality enforcement
 */
router.post('/spidey/:submissionId/stage4/submit', authenticateToken, submitStage4);

// ==========================================
// ADMIN ASSESSMENT ROUTES
// ==========================================

/**
 * @route GET /api/admin/assessments
 * @desc Get all assessments with filtering (Admin only)
 * @access Private (Admin)
 * @query page, limit, assessmentType, passed, userId
 */
router.get('/admin', authenticateAdmin, getAdminAssessments);

/**
 * @route GET /api/admin/assessments/overview
 * @desc Get all assessment types with aggregate statistics (Admin only)
 * @access Private (Admin)
 * @returns Overview of all assessment types with comprehensive statistics
 */
router.get('/admin/overview', authenticateAdmin, getAdminAssessmentsOverview);

/**
 * @route GET /api/assessments/:assessmentId/submissions
 * @desc Get assessment submissions by assessment ID
 * @access Private (User - own submissions, Admin - all submissions)
 * @param assessmentId - 'english-proficiency' or multimedia assessment ObjectId
 * @query page, limit, status, userId (admin only), sortBy, sortOrder
 * @returns List of submissions for the specified assessment
 */
router.get('/:assessmentId/submissions', authenticateToken, getAssessmentSubmissions);

module.exports = router;