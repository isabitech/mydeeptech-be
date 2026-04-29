const express = require("express");
const router = express.Router();
const { body, param, query } = require("express-validator");
const { authenticateToken } = require("../middleware/auth.js");
const { authenticateAdmin } = require("../middleware/adminAuth.js");
const aiRecommendationController = require("../controllers/ai-recommendation.controller");

// Validation middleware
const validateProjectId = [
  param("projectId")
    .isMongoId()
    .withMessage("Invalid project ID format")
];

const validateRecommendationQuery = [
  query("maxRecommendations")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("maxRecommendations must be a number between 1 and 50")
];

const validateBulkInvitation = [
  body("annotatorIds")
    .isArray({ min: 1 })
    .withMessage("annotatorIds must be a non-empty array"),
  body("annotatorIds.*")
    .isMongoId()
    .withMessage("Each annotator ID must be a valid MongoDB ObjectId"),
  body("customMessage")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Custom message must be a string with maximum 1000 characters")
];

/**
 * @route GET /api/ai-recommendations/status
 * @desc Get AI recommendation service status
 * @access Admin
 */
router.get(
  "/status",
  authenticateToken,
  authenticateAdmin,
  aiRecommendationController.getRecommendationStatus
);

/**
 * @route GET /api/ai-recommendations/projects/:projectId/annotators
 * @desc Get AI-powered annotator recommendations for a project
 * @access Admin
 */
router.get(
  "/projects/:projectId/annotators",
  authenticateToken,
  authenticateAdmin,
  validateProjectId,
  validateRecommendationQuery,
  aiRecommendationController.getAnnotatorRecommendations
);

/**
 * @route POST /api/ai-recommendations/projects/:projectId/send-invitations
 * @desc Send bulk invitation emails to recommended annotators
 * @access Admin
 */
router.post(
  "/projects/:projectId/send-invitations",
  authenticateToken,
  authenticateAdmin,
  validateProjectId,
  validateBulkInvitation,
  aiRecommendationController.sendBulkInvitations
);

module.exports = router;