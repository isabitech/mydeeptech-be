const express = require('express');
const router = express.Router();

// Import controllers
const {
  submitAssessment,
  getUserAssessmentHistory,
  checkRetakeEligibility,
  getAdminAssessments,
  getAssessmentQuestions
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

module.exports = router;