const express = require("express");
const { body } = require("express-validator");
const hubstaffController = require("../controllers/hubstaff.controller");
const {
  authenticateAdmin,
  authenticateUserSession,
} = require("../middleware/hvnc-auth");

const router = express.Router();

// ===== PC AGENT ENDPOINTS =====

/**
 * Timer update from PC Agent
 * POST /api/hvnc/hubstaff/timer-update
 */
router.post(
  "/timer-update",
  [
    body("deviceId")
      .notEmpty()
      .withMessage("Device ID is required")
      .isString()
      .withMessage("Device ID must be a string"),

    body("timestamp")
      .notEmpty()
      .withMessage("Timestamp is required")
      .isISO8601()
      .withMessage("Timestamp must be in ISO 8601 format"),

    body("hubstaff")
      .notEmpty()
      .withMessage("Hubstaff data is required")
      .isObject()
      .withMessage("Hubstaff data must be an object"),

    body("hubstaff.isRunning")
      .isBoolean()
      .withMessage("Hubstaff isRunning must be a boolean"),

    body("hubstaff.timer")
      .optional()
      .isObject()
      .withMessage("Hubstaff timer must be an object"),

    body("hubstaff.timer.isActive")
      .optional()
      .isBoolean()
      .withMessage("Hubstaff timer isActive must be a boolean"),

    body("hubstaff.timer.totalSeconds")
      .optional()
      .isInt({ min: 0 })
      .withMessage(
        "Hubstaff timer totalSeconds must be a non-negative integer",
      ),

    body("currentUser")
      .optional()
      .isObject()
      .withMessage("Current user must be an object"),

    body("currentUser.userId")
      .optional()
      .isString()
      .withMessage("User ID must be a string"),

    body("currentUser.sessionId")
      .optional()
      .isString()
      .withMessage("Session ID must be a string"),
  ],
  hubstaffController.handleTimerUpdate,
);

// ===== ADMIN ENDPOINTS =====

/**
 * Get all active Hubstaff sessions (Admin only)
 * GET /api/hvnc/admin/hubstaff/active-sessions
 */
router.get(
  "/admin/active-sessions",
  authenticateAdmin,
  hubstaffController.getActiveSessions,
);

/**
 * Get user session history (Admin only)
 * GET /api/hvnc/admin/hubstaff/user-sessions/:userId
 */
router.get(
  "/admin/user-sessions/:userId",
  authenticateAdmin,
  hubstaffController.getUserSessionsAdmin,
);

/**
 * Get device utilization stats (Admin only)
 * GET /api/hvnc/admin/hubstaff/device-utilization/:deviceId
 */
router.get(
  "/admin/device-utilization/:deviceId",
  authenticateAdmin,
  hubstaffController.getDeviceUtilization,
);

/**
 * Get devices with Hubstaff status (Admin only)
 * GET /api/hvnc/admin/hubstaff/devices
 */
router.get(
  "/admin/devices",
  authenticateAdmin,
  hubstaffController.getDevicesWithHubstaffStatus,
);

/**
 * Get monthly user tracking - DTUsers with Hubstaff hours and device assignments (Admin only)
 * GET /api/hvnc/admin/hubstaff/monthly-tracking/:year/:month
 */
router.get(
  "/admin/monthly-tracking/:year/:month",
  authenticateAdmin,
  hubstaffController.getMonthlyUserTracking,
);

// ===== USER ENDPOINTS =====

/**
 * Get current user's Hubstaff sessions
 * GET /api/hvnc/user/hubstaff/my-sessions
 */
router.get(
  "/user/my-sessions",
  authenticateUserSession,
  hubstaffController.getUserSessionsSelf,
);

module.exports = router;
