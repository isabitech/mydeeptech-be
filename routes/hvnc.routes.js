const express = require("express");
const router = express.Router();

// Import controllers
const deviceController = require("../controllers/hvnc-device.controller");
const accessCodeController = require("../controllers/hvnc-access-code.controller");
const sessionController = require("../controllers/hvnc-session.controller");
const healthController = require("../controllers/hvnc-health.controller");
const adminDashboardController = require("../controllers/admin-dashboard.controller");
const adminDeviceManagementController = require("../controllers/admin-device-management.controller");
const adminShiftSchedulingController = require("../controllers/admin-shift-scheduling.controller");
const adminUserManagementController = require("../controllers/admin-user-management.controller");
const userPortalController = require("../controllers/user-portal.controller");
const sessionManagementController = require("../controllers/session-management.controller");

// Import services
const websocketService = require("../services/hvnc-websocket.service");

// Import middleware
const {
  authenticateDevice,
  authenticateUserSession,
  authRateLimit,
} = require("../middleware/hvnc-auth");

const { authenticateAdmin } = require("../middleware/adminAuth");

const { presets: rateLimitPresets } = require("../utils/rateLimiter");

// ===== DEVICE ENDPOINTS =====

/**
 * Device registration (no auth required for initial registration)
 * POST /api/hvnc/devices/register
 */
router.post(
  "/devices/register",
  rateLimitPresets.deviceRegistration,
  deviceController.registerDevice,
);

/**
 * Device heartbeat with status updates
 * POST /api/hvnc/devices/heartbeat
 */
router.post(
  "/devices/heartbeat",
  authenticateDevice,
  deviceController.heartbeat,
);

/**
 * Poll for pending commands
 * GET /api/hvnc/devices/commands
 */
router.get(
  "/devices/commands",
  authenticateDevice,
  deviceController.getCommands,
);

/**
 * Acknowledge command execution
 * POST /api/hvnc/devices/commands/:command_id/ack
 */
router.post(
  "/devices/commands/:command_id/ack",
  authenticateDevice,
  deviceController.acknowledgeCommand,
);

/**
 * Get device status and information
 * GET /api/hvnc/devices/status
 */
router.get(
  "/devices/status",
  authenticateDevice,
  deviceController.getDeviceStatus,
);

/**
 * Update device configuration
 * POST /api/hvnc/devices/config
 */
router.post(
  "/devices/config",
  authenticateDevice,
  deviceController.updateConfig,
);

/**
 * Device disconnect/cleanup
 * POST /api/hvnc/devices/disconnect
 */
router.post(
  "/devices/disconnect",
  authenticateDevice,
  deviceController.disconnect,
);

// ===== ACCESS CODE ENDPOINTS =====

/**
 * Validate user access code
 * POST /api/hvnc/codes/validate
 */
router.post(
  "/codes/validate",
  rateLimitPresets.auth,
  accessCodeController.validateCode,
);

/**
 * User requests new access code via email
 * POST /api/hvnc/codes/request
 */
router.post(
  "/codes/request",
  rateLimitPresets.auth,
  accessCodeController.requestCode,
);

/**
 * Generate access code for admin use (Admin only)
 * POST /api/hvnc/codes/generate
 */
router.post(
  "/codes/generate",
  authenticateAdmin,
  requirePermission("user_management"),
  accessCodeController.generateCode,
);

/**
 * List access codes (Admin only)
 * GET /api/hvnc/codes/list
 */
router.get(
  "/codes/list",
  authenticateAdmin,
  requirePermission("user_management"),
  accessCodeController.listCodes,
);

/**
 * Revoke access code (Admin only)
 * POST /api/hvnc/codes/:code_id/revoke
 */
router.post(
  "/codes/:code_id/revoke",
  authenticateAdmin,
  requirePermission("user_management"),
  accessCodeController.revokeCode,
);

// ===== SESSION ENDPOINTS =====

/**
 * Start user session
 * POST /api/hvnc/sessions/start
 */
router.post(
  "/sessions/start",
  authenticateDevice,
  sessionController.startSession,
);

/**
 * End user session
 * POST /api/hvnc/sessions/end
 */
router.post("/sessions/end", sessionController.endSession);

/**
 * Update session activity
 * POST /api/hvnc/sessions/activity
 */
router.post("/sessions/activity", sessionController.updateActivity);

/**
 * Get session details
 * GET /api/hvnc/sessions/:session_id
 */
router.get(
  "/sessions/:session_id",
  authenticateUserSession,
  sessionController.getSession,
);

/**
 * Get active sessions
 * GET /api/hvnc/sessions/active
 */
router.get(
  "/sessions/active",
  authenticateAdmin,
  requirePermission("device_management"),
  sessionController.getActiveSessions,
);

/**
 * Force end session (Admin only)
 * POST /api/hvnc/sessions/:session_id/force-end
 */
router.post(
  "/sessions/:session_id/force-end",
  authenticateAdmin,
  requirePermission("device_management"),
  sessionController.forceEndSession,
);

/**
 * Cleanup timed-out sessions
 * POST /api/hvnc/sessions/cleanup
 */
router.post(
  "/sessions/cleanup",
  authenticateAdmin,
  requirePermission("device_management"),
  sessionController.cleanupSessions,
);

// ===== HEALTH CHECK ENDPOINTS =====

/**
 * Server health check
 * GET /api/hvnc/health
 */
router.get("/health", healthController.hvncHealthCheck);

/**
 * 20fps streaming performance stats
 * GET /api/hvnc/streaming-stats
 */
router.get("/streaming-stats", (req, res) => {
  try {
    const stats = websocketService.getStreamingStats();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to get streaming stats",
      message: error.message,
    });
  }
});

// ===== ADMIN ENDPOINTS =====

/**
 * Get system statistics (Admin only)
 * GET /api/hvnc/admin/stats
 */
router.get(
  "/admin/stats",
  authenticateAdmin,
  adminDashboardController.getStats,
);

/**
 * Get live devices for dashboard (Admin only)
 * GET /api/hvnc/admin/devices/live
 */
router.get(
  "/admin/devices/live",
  authenticateAdmin,
  adminDashboardController.getLiveDevices,
);

/**
 * Get activity feed (Admin only)
 * GET /api/hvnc/admin/activity
 */
router.get(
  "/admin/activity",
  authenticateAdmin,
  adminDashboardController.getActivity,
);

/**
 * Legacy: Get system statistics (Admin only)
 * GET /api/hvnc/admin/stats (legacy endpoint)
 */
router.get(
  "/admin/stats-legacy",
  authenticateAdmin,
  healthController.getSystemStatistics,
);

/**
 * Get activity logs (Admin only)
 * GET /api/hvnc/admin/activity-logs
 */
router.get(
  "/admin/activity-logs",
  authenticateAdmin,
  healthController.getActivityLogs,
);

/**
 * Send command to device (Admin only)
 * POST /api/hvnc/admin/commands/send
 */
router.post("/admin/commands/send", authenticateAdmin, async (req, res) => {
  try {
    const {
      device_id,
      type,
      action,
      parameters,
      session_id,
      priority = "normal",
    } = req.body;

    const HVNCCommand = require("../models/hvnc-command.model");
    const {
      sendCommandToDevice,
    } = require("../services/hvnc-websocket.service");

    // Validate required fields
    if (!device_id || !type || !action) {
      return res.status(400).json({
        success: false,
        error: "device_id, type, and action are required",
      });
    }

    // Create command
    const command = await HVNCCommand.createCommand({
      device_id,
      session_id: session_id || `admin_${req.admin._id}`,
      user_email: req.admin.email,
      type,
      action,
      parameters: parameters || {},
      priority,
      metadata: {
        source: "admin_dashboard",
        admin_user: req.admin.email,
      },
    });

    // Send to device if connected
    try {
      await sendCommandToDevice(device_id, command);
      await command.markSent();

      res.json({
        success: true,
        command: {
          id: command.command_id,
          device_id,
          type,
          action,
          status: "sent",
          sent_at: new Date(),
          expires_at: command.expires_at,
        },
      });
    } catch (socketError) {
      res.status(202).json({
        success: true,
        command: {
          id: command.command_id,
          device_id,
          type,
          action,
          status: "pending",
          message: "Command queued - device not connected",
        },
      });
    }
  } catch (error) {
    console.error("Send command error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send command",
    });
  }
});

// ===== ADMIN DEVICE MANAGEMENT ENDPOINTS =====

/**
 * Get all devices for management (Admin only)
 * GET /api/hvnc/admin/devices
 */
router.get(
  "/admin/devices",
  authenticateAdmin,
  requirePermission("device_management"),
  adminDeviceManagementController.getAllDevices,
);

/**
 * Get device details (Admin only)
 * GET /api/hvnc/admin/devices/:deviceId
 */
router.get(
  "/admin/devices/:deviceId",
  authenticateAdmin,
  requirePermission("device_management"),
  adminDeviceManagementController.getDeviceDetail,
);

/**
 * Register new device (Admin only)
 * POST /api/hvnc/admin/devices
 */
router.post(
  "/admin/devices",
  authenticateAdmin,
  requirePermission("device_management"),
  adminDeviceManagementController.registerDevice,
);

/**
 * Update device assignment (Admin only)
 * PUT /api/hvnc/admin/devices/:deviceId
 */
router.put(
  "/admin/devices/:deviceId",
  authenticateAdmin,
  requirePermission("device_management"),
  adminDeviceManagementController.updateDevice,
);

/**
 * Delete device (Admin only)
 * DELETE /api/hvnc/admin/devices/:deviceId
 */
router.delete(
  "/admin/devices/:deviceId",
  authenticateAdmin,
  requirePermission("device_management"),
  adminDeviceManagementController.deleteDevice,
);

/**
 * Generate new access code for device (Admin only)
 * POST /api/hvnc/admin/devices/:deviceId/access-code/generate
 */
router.post(
  "/admin/devices/:deviceId/access-code/generate",
  authenticateAdmin,
  requirePermission("device_management"),
  adminDeviceManagementController.generateNewAccessCode,
);

/**
 * Start Hubstaff timer for device (Admin only)
 * POST /api/hvnc/admin/devices/:deviceId/hubstaff/start
 */
router.post(
  "/admin/devices/:deviceId/hubstaff/start",
  authenticateAdmin,
  requirePermission("device_management"),
  adminDeviceManagementController.startHubstaffTimer,
);

/**
 * Pause Hubstaff timer for device (Admin only)
 * POST /api/hvnc/admin/devices/:deviceId/hubstaff/pause
 */
router.post(
  "/admin/devices/:deviceId/hubstaff/pause",
  authenticateAdmin,
  requirePermission("device_management"),
  adminDeviceManagementController.pauseHubstaffTimer,
);

// ===== ADMIN SHIFT SCHEDULING ENDPOINTS =====

/**
 * Get all shifts for management (Admin only)
 * GET /api/hvnc/admin/shifts
 */
router.get(
  "/admin/shifts",
  authenticateAdmin,
  requirePermission("shift_management"),
  adminShiftSchedulingController.getAllShifts,
);

/**
 * Get shift details (Admin only)
 * GET /api/hvnc/admin/shifts/:shiftId
 */
router.get(
  "/admin/shifts/:shiftId",
  authenticateAdmin,
  requirePermission("shift_management"),
  adminShiftSchedulingController.getShiftDetail,
);

/**
 * Create new shift (Admin only)
 * POST /api/hvnc/admin/shifts
 */
router.post(
  "/admin/shifts",
  authenticateAdmin,
  requirePermission("shift_management"),
  adminShiftSchedulingController.createShift,
);

/**
 * Update shift (Admin only)
 * PUT /api/hvnc/admin/shifts/:shiftId
 */
router.put(
  "/admin/shifts/:shiftId",
  authenticateAdmin,
  requirePermission("shift_management"),
  adminShiftSchedulingController.updateShift,
);

/**
 * Delete shift (Admin only)
 * DELETE /api/hvnc/admin/shifts/:shiftId
 */
router.delete(
  "/admin/shifts/:shiftId",
  authenticateAdmin,
  requirePermission("shift_management"),
  adminShiftSchedulingController.deleteShift,
);

/**
 * Get shifts for calendar display (Admin only)
 * GET /api/hvnc/admin/shifts/calendar
 */
router.get(
  "/admin/shifts/calendar",
  authenticateAdmin,
  requirePermission("shift_management"),
  adminShiftSchedulingController.getShiftsCalendar,
);

// ===== ADMIN USER MANAGEMENT ENDPOINTS =====

/**
 * Get all users for management (Admin only)
 * GET /api/hvnc/admin/users
 */
router.get(
  "/admin/users",
  authenticateAdmin,
  requirePermission("user_management"),
  adminUserManagementController.getAllUsers,
);

/**
 * Get user details (Admin only)
 * GET /api/hvnc/admin/users/:userId
 */
router.get(
  "/admin/users/:userId",
  authenticateAdmin,
  requirePermission("user_management"),
  adminUserManagementController.getUserDetail,
);

/**
 * Create new user (Admin only)
 * POST /api/hvnc/admin/users
 */
router.post(
  "/admin/users",
  authenticateAdmin,
  requirePermission("user_management"),
  adminUserManagementController.createUser,
);

/**
 * Update user (Admin only)
 * PUT /api/hvnc/admin/users/:userId
 */
router.put(
  "/admin/users/:userId",
  authenticateAdmin,
  requirePermission("user_management"),
  adminUserManagementController.updateUser,
);

/**
 * Delete user (Admin only)
 * DELETE /api/hvnc/admin/users/:userId
 */
router.delete(
  "/admin/users/:userId",
  authenticateAdmin,
  requirePermission("user_management"),
  adminUserManagementController.deleteUser,
);

/**
 * Reset user password (Admin only)
 * POST /api/hvnc/admin/users/:userId/reset-password
 */
router.post(
  "/admin/users/:userId/reset-password",
  authenticateAdmin,
  requirePermission("user_management"),
  adminUserManagementController.resetUserPassword,
);

/**
 * Unlock user account (Admin only)
 * POST /api/hvnc/admin/users/:userId/unlock
 */
router.post(
  "/admin/users/:userId/unlock",
  authenticateAdmin,
  requirePermission("user_management"),
  adminUserManagementController.unlockUser,
);

// ===== USER PORTAL ENDPOINTS =====

/**
 * Get user dashboard overview (User authenticated)
 * GET /api/hvnc/user/dashboard
 */
router.get(
  "/user/dashboard",
  authenticateUserSession,
  userPortalController.getUserDashboard,
);

/**
 * Get user's assigned devices (User authenticated)
 * GET /api/hvnc/user/devices
 */
router.get(
  "/user/devices",
  authenticateUserSession,
  userPortalController.getUserDevices,
);

/**
 * Get user's session history (User authenticated)
 * GET /api/hvnc/user/sessions
 */
router.get(
  "/user/sessions",
  authenticateUserSession,
  userPortalController.getUserSessions,
);

/**
 * Start a new session (User authenticated)
 * POST /api/hvnc/user/sessions/start
 */
router.post(
  "/user/sessions/start",
  authenticateUserSession,
  userPortalController.startUserSession,
);

/**
 * End an active session (User authenticated)
 * POST /api/hvnc/user/sessions/:sessionId/end
 */
router.post(
  "/user/sessions/:sessionId/end",
  authenticateUserSession,
  userPortalController.endUserSession,
);

/**
 * Get user profile information (User authenticated)
 * GET /api/hvnc/user/profile
 */
router.get(
  "/user/profile",
  authenticateUserSession,
  userPortalController.getUserProfile,
);

// ===== SESSION MANAGEMENT ENDPOINTS =====

/**
 * Get real-time session statistics (Admin only)
 * GET /api/hvnc/sessions/stats
 */
router.get(
  "/sessions/stats",
  authenticateAdmin,
  requirePermission("admin_dashboard"),
  sessionManagementController.getSessionStats,
);

/**
 * Force end session (Admin only)
 * POST /api/hvnc/sessions/:sessionId/force-end
 */
router.post(
  "/sessions/:sessionId/force-end",
  authenticateAdmin,
  requirePermission("device_management"),
  sessionManagementController.forceEndSession,
);

module.exports = router;
