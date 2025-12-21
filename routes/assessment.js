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
} = require('../controller/assessment.controller');

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