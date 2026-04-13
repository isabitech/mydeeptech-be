const HVNCUserPortalService = require("../services/hvnc-user-portal.service");

/**
 * GET /api/hvnc/user/dashboard
 * Get user dashboard overview
 */
const getUserDashboard = async (req, res) => {
  try {
    const result = await HVNCUserPortalService.getDashboard(req.user);
    res.json(result);
  } catch (error) {
    console.error("Get user dashboard error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch dashboard data",
    });
  }
};

/**
 * GET /api/hvnc/user/devices
 * Get user's assigned devices
 */
const getUserDevices = async (req, res) => {
  try {
    const result = await HVNCUserPortalService.getDevices(req.user.email);
    res.json(result);
  } catch (error) {
    console.error("Get user devices error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch assigned devices",
    });
  }
};

/**
 * GET /api/hvnc/user/sessions
 * Get user's session history
 */
const getUserSessions = async (req, res) => {
  try {
    const result = await HVNCUserPortalService.getSessions(req.user.email, req.query);
    res.json(result);
  } catch (error) {
    console.error("Get user sessions error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch session history",
    });
  }
};

/**
 * POST /api/hvnc/user/sessions/start
 * Start a new session on assigned device
 */
const startUserSession = async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: "Device ID is required",
      });
    }

    const clientInfo = {
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    };

    const result = await HVNCUserPortalService.startSession(req.user.email, deviceId, clientInfo);
    res.json({
      ...result,
      message: "Session started successfully",
    });
  } catch (error) {
    console.error("Start session error:", error);
    const status = error.message.includes("not found") ? 404 : 
                   error.message.includes("access") ? 403 :
                   error.message.includes("already have") ? 409 :
                   error.message.includes("offline") ? 503 : 500;
    
    res.status(status).json({
      success: false,
      error: error.message || "Failed to start session",
    });
  }
};

/**
 * POST /api/hvnc/user/sessions/:sessionId/end
 * End an active session
 */
const endUserSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const clientInfo = {
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    };

    const result = await HVNCUserPortalService.endSession(req.user.email, sessionId, clientInfo);
    res.json({
      ...result,
      message: "Session ended successfully",
    });
  } catch (error) {
    console.error("End session error:", error);
    const status = error.message.includes("not found") ? 404 : 
                   error.message.includes("already ended") ? 400 : 500;
    res.status(status).json({
      success: false,
      error: error.message || "Failed to end session",
    });
  }
};

/**
 * GET /api/hvnc/user/profile
 * Get user profile information
 */
const getUserProfile = async (req, res) => {
  try {
    const result = await HVNCUserPortalService.getUserProfile(req.user);
    res.json(result);
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch profile",
    });
  }
};

module.exports = {
  getUserDashboard,
  getUserDevices,
  getUserSessions,
  startUserSession,
  endUserSession,
  getUserProfile,
};
