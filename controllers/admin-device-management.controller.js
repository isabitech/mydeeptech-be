const adminDeviceManagementService = require("../services/admin-device-management.service");

/**
 * GET /api/hvnc/admin/devices
 * Fetch all devices for device management
 */
const getAllDevices = async (req, res) => {
  try {
    const { status } = req.query;
    const data = await adminDeviceManagementService.getAllDevices({ status });
    res.json({
      total: data.total,
      activeCount: data.activeCount,
      inactiveCount: data.inactiveCount,
      devices: data.devices
    });
  } catch (error) {
    console.error("Get devices error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch devices"
    });
  }
};

/**
 * GET /api/hvnc/admin/devices/:deviceId
 * Get detailed device information
 */
const getDeviceDetail = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const data = await adminDeviceManagementService.getDeviceDetail(deviceId);
    res.json(data);
  } catch (error) {
    console.error("Get device detail error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to fetch device details"
    });
  }
};

/**
 * POST /api/hvnc/admin/devices
 * Register a new device
 */
const registerDevice = async (req, res) => {
  try {
    const { pcName, assignedUserId } = req.body;

    if (!pcName) {
      return res.status(400).json({
        success: false,
        error: "PC name is required"
      });
    }

    const data = await adminDeviceManagementService.registerDevice({
      pcName,
      assignedUserId
    });
    res.json(data);
  } catch (error) {
    console.error("Register device error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to register device"
    });
  }
};

/**
 * PUT /api/hvnc/admin/devices/:deviceId
 * Update device assignment
 */
const updateDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { assignedUserId, pcName } = req.body;
    const data = await adminDeviceManagementService.updateDevice(deviceId, {
      assignedUserId,
      pcName
    });
    res.json(data);
  } catch (error) {
    console.error("Update device error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to update device"
    });
  }
};

/**
 * DELETE /api/hvnc/admin/devices/:deviceId
 * Remove a device
 */
const deleteDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    await adminDeviceManagementService.deleteDevice(deviceId);
    res.json({
      success: true,
      message: "Device removed successfully."
    });
  } catch (error) {
    console.error("Delete device error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to remove device"
    });
  }
};

/**
 * POST /api/hvnc/admin/devices/:deviceId/access-code/generate
 * Generate new access code for device
 */
const generateNewAccessCode = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const data = await adminDeviceManagementService.generateNewAccessCode(deviceId);
    res.json(data);
  } catch (error) {
    console.error("Generate access code error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to generate new access code"
    });
  }
};

/**
 * POST /api/hvnc/admin/devices/:deviceId/hubstaff/start
 * Start Hubstaff timer
 */
const startHubstaffTimer = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { projectId, taskName } = req.body;
    const data = await adminDeviceManagementService.startHubstaffTimer(deviceId, {
      projectId,
      taskName,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      adminEmail: req.admin?.email || "admin"
    });
    res.json(data);
  } catch (error) {
    console.error("Start Hubstaff timer error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to start Hubstaff timer",
      message: error.message,
      deviceStatus: error.deviceStatus
    });
  }
};

/**
 * POST /api/hvnc/admin/devices/:deviceId/hubstaff/pause
 * Pause Hubstaff timer
 */
const pauseHubstaffTimer = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const data = await adminDeviceManagementService.pauseHubstaffTimer(deviceId, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      adminEmail: req.admin?.email || "admin"
    });
    res.json(data);
  } catch (error) {
    console.error("Pause Hubstaff timer error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to pause Hubstaff timer",
      message: error.message,
      deviceStatus: error.deviceStatus
    });
  }
};

module.exports = {
  getAllDevices,
  getDeviceDetail,
  registerDevice,
  updateDevice,
  deleteDevice,
  generateNewAccessCode,
  startHubstaffTimer,
  pauseHubstaffTimer
};
