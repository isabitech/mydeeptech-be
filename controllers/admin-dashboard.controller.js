const adminDashboardService = require("../services/admin-dashboard.service");

/**
 * GET /api/hvnc/admin/stats
 * Fetch dashboard statistics
 */
const getStats = async (req, res) => {
  try {
    const stats = await adminDashboardService.getStats();
    res.json({
      totalDevices: stats.totalDevices,
      onlineDevices: stats.onlineDevices,
      activeSessions: stats.activeSessions,
      activeTimers: stats.activeTimers,
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard statistics",
    });
  }
};

/**
 * GET /api/hvnc/admin/devices/live
 * Fetch live devices for dashboard grid
 */
const getLiveDevices = async (req, res) => {
  try {
    const deviceData = await adminDashboardService.getLiveDevices();
    res.json({
      devices: deviceData,
    });
  } catch (error) {
    console.error("Get live devices error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch live devices",
    });
  }
};

/**
 * GET /api/hvnc/admin/activity
 * Fetch recent activity feed
 */
const getActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const activityItems = await adminDashboardService.getActivity(limit);
    res.json({
      items: activityItems,
    });
  } catch (error) {
    console.error("Get activity error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch activity",
    });
  }
};

module.exports = {
  getStats,
  getLiveDevices,
  getActivity,
};
