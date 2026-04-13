// Layer: Service
/**
 * Admin Device Management Service
 * Contains all business logic for device management
 */

const crypto = require("crypto");
const HVNCDeviceRepository = require("../repositories/hvnc-device.repository");
const HVNCUserRepository = require("../repositories/hvnc-user.repository");
const HVNCShiftRepository = require("../repositories/hvnc-shift.repository");
const HVNCSessionRepository = require("../repositories/hvnc-session.repository");
const HVNCActivityLogRepository = require("../repositories/hvnc-activity-log.repository");
const HVNCCommand = require("../models/hvnc-command.model");
const { sendCommandToDeviceAndWait } = require("./hvnc-websocket.service");
const hvncVerificationStore = require("../utils/hvncVerificationStore");


class AdminDeviceManagementService {
  /**
   * Get all devices with filtering
   * @param {Object} filters - Filter options (status, etc.)
   * @returns {Promise<Object>} Devices data with counts
   */
  async getAllDevices(filters = {}) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    let query = {};

    if (filters.status === "Active") {
      query.last_seen = { $gt: fiveMinutesAgo };
      query.status = "online";
    } else if (filters.status === "Inactive") {
      query.$or = [
        { last_seen: { $lte: fiveMinutesAgo } },
        { status: "offline" },
      ];
    }

    const devices = await HVNCDeviceRepository.findAll(query);

    const deviceData = await Promise.all(
      devices.map(async (device) => {
        const isOnline =
          device.last_seen > fiveMinutesAgo && device.status === "online";
        await this._enrichDeviceData(device, isOnline);
        return device;
      }),
    );

    const total = devices.length;
    const activeCount = devices.filter(
      (d) => d.last_seen > fiveMinutesAgo && d.status === "online",
    ).length;
    const inactiveCount = total - activeCount;

    return {
      total,
      activeCount,
      inactiveCount,
      devices: deviceData,
    };
  }

  /**
   * Get device details by ID
   * @param {string} deviceId - Device ID
   * @returns {Promise<Object>} Device details
   */
  async getDeviceDetail(deviceId) {
    const device = await HVNCDeviceRepository.findById(deviceId);
    if (!device) {
      throw { status: 404, message: "Device not found" };
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isOnline =
      device.last_seen > fiveMinutesAgo && device.status === "online";

    // Get assigned user
    let assignedUser = "Unassigned";
    let assignedUserId = null;
    try {
      const shifts = await HVNCShiftRepository.find({
        device_id: device.device_id,
        status: "active",
        $or: [{ end_date: null }, { end_date: { $gte: new Date() } }],
      });
      if (shifts && shifts.length > 0) {
        const user = await HVNCUserRepository.findByEmail(shifts[0].user_email);
        assignedUser = user ? user.full_name : "Unassigned";
        assignedUserId = user ? user._id : null;
      }
    } catch (err) {
      // Handle error gracefully
    }

    // Calculate Hubstaff data
    const hubstaffSeconds = device.system_info?.hubstaff_seconds || 0;
    const hubstaffDisplay = this._formatHubstaffTime(hubstaffSeconds);
    const hubstaffPercent = Math.min(
      100,
      Math.floor((hubstaffSeconds / (8 * 3600)) * 100),
    );

    // Get current access code
    let accessCode = device.initial_access_code;
    if (!accessCode) {
      accessCode = this._generateAccessCode();
      // TODO: Save new access code to device
    }

    // Format last seen
    let lastSeen = "Never";
    if (device.last_seen) {
      lastSeen = this._formatLastSeen(device.last_seen);
    }

    // Get recent activity for this device
    const activities = await HVNCActivityLogRepository.find({
      device_id: device.device_id,
    });
    const activityData = activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)
      .map((activity, index) => ({
        id: activity._id,
        type: activity.event_type,
        message: activity.description || activity.event_type,
        time: this._formatTimeAgo(activity.timestamp),
      }));

    return {
      id: device._id,
      pcName: device.pc_name,
      status: isOnline ? "Active" : "Offline",
      assigned: assignedUser,
      assignedUserId: assignedUserId,
      hubstaff: hubstaffDisplay,
      hubstaffSeconds: hubstaffSeconds,
      hubstaffPercent: hubstaffPercent,
      lastSeen: lastSeen,
      accessCode: accessCode,
      activity: activityData,
    };
  }

  /**
   * Register a new device
   * @param {Object} data - Device data (pcName, assignedUserId)
   * @returns {Promise<Object>} Created device data
   */
  async registerDevice(data) {
    const { pcName, assignedUserId } = data;

    if (!pcName) {
      throw { status: 400, message: "PC name is required" };
    }

    const deviceId = `HVNC_${Date.now()}`;
    const accessCode = this._generateAccessCode();

    let assignedUser = "Unassigned";
    if (assignedUserId) {
      try {
        const user = await HVNCUserRepository.findById(assignedUserId);
        if (user) {
          assignedUser = user.full_name;
        }
      } catch (err) {
        // User not found
      }
    }

    const device = await HVNCDeviceRepository.create({
      device_id: deviceId,
      pc_name: pcName,
      hostname: pcName,
      status: "offline",
      initial_access_code: accessCode,
      installed_at: new Date(),
      last_seen: new Date(),
    });

    // Log device registration
    try {
      await HVNCActivityLogRepository.create({
        device_id: deviceId,
        event_type: "device_registered",
        description: `Device registered: ${pcName}`,
        context: {
          pc_name: pcName,
          assigned_user: assignedUser,
          access_code: accessCode,
        },
      });
    } catch (err) {
      // Logging error - don't block creation
    }

    return {
      id: device._id,
      pcName: device.pc_name,
      status: "Offline",
      hubstaff: "00:00:00",
      hubstaffSeconds: 0,
      hubstaffPercent: 0,
      lastSeen: "Never",
      accessCode: accessCode,
      assignedUserId: assignedUser,
    };
  }

  /**
   * Update device
   * @param {string} deviceId - Device ID to update
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated device detail
   */
  async updateDevice(deviceId, data) {
    const { assignedUserId, pcName } = data;

    const device = await HVNCDeviceRepository.findById(deviceId);
    if (!device) {
      throw { status: 404, message: "Device not found" };
    }

    if (pcName) {
      device.pc_name = pcName;
      device.hostname = pcName;
    }

    await device.save();

    return this.getDeviceDetail(deviceId);
  }

  /**
   * Delete device
   * @param {string} deviceId - Device ID to delete
   * @returns {Promise<Object>} Success response
   */
  async deleteDevice(deviceId) {
    const device = await HVNCDeviceRepository.findById(deviceId);
    if (!device) {
      throw { status: 404, message: "Device not found" };
    }

    // End any active sessions
    await HVNCSessionRepository.update(
      { device_id: device.device_id, status: { $in: ["active", "idle"] } },
      {
        status: "terminated",
        ended_at: new Date(),
        termination_reason: "device_removed",
      },
    );

    // Remove shifts
    await HVNCShiftRepository.deleteMany({ device_id: device.device_id });

    // Log device removal
    try {
      await HVNCActivityLogRepository.create({
        device_id: device.device_id,
        event_type: "device_removed",
        description: `Device removed: ${device.pc_name}`,
        context: { pc_name: device.pc_name },
      });
    } catch (err) {
      // Logging error - don't block deletion
    }

    // Invalidate any Redis-stored codes for this device
    await hvncVerificationStore.removeAllCodesForDevice(device.device_id);

    // Remove device
    await HVNCDeviceRepository.deleteById(deviceId);

    return { success: true, message: "Device removed successfully." };
  }

  /**
   * Generate new access code for device
   * @param {string} deviceId - Device ID
   * @returns {Promise<Object>} New access code
   */
  async generateNewAccessCode(deviceId) {
    const device = await HVNCDeviceRepository.findById(deviceId);
    if (!device) {
      throw { status: 404, message: "Device not found" };
    }

    const newAccessCode = this._generateAccessCode();
    device.initial_access_code = newAccessCode;
    await device.save();

    try {
      await HVNCActivityLogRepository.create({
        device_id: device.device_id,
        event_type: "access_code_generated",
        description: `New access code generated for device${device.pc_name}`,
        context: { device_name: device.pc_name, access_code: newAccessCode },
      });
    } catch (err) {
      // Logging error - don't block
    }

    await hvncVerificationStore.removeAllCodesForDevice(device.device_id);

    return {
      accessCode: newAccessCode,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Start Hubstaff timer
   * @param {string} deviceId - Device ID
   * @param {Object} admin - Admin user object
   * @param {Object} parameters - Project/Task parameters
   * @returns {Promise<Object>} Timer status
   */
  async startHubstaffTimer(deviceId, admin = {}, parameters = {}) {
    const { projectId, taskName } = parameters;
    const device = await HVNCDeviceRepository.findById(deviceId);
    if (!device) {
      throw { status: 404, message: "Device not found" };
    }

    // Send WebSocket command to PC Agent first
    let commandResponse = null;
    try {
      const command = await HVNCCommand.createCommand({
        device_id: device.device_id,
        session_id: `admin_hubstaff_${admin?._id || "unknown"}`,
        user_email: admin?.email || "admin",
        type: "hubstaff",
        action: "hubstaff_start",
        parameters: { projectId, taskName },
        priority: "high",
        timeout_seconds: 30,
        metadata: {
          source: "admin_dashboard",
          admin_user: admin?.email || "admin",
          action_type: "hubstaff_control",
        },
      });

      console.log(`🚀 Sending Hubstaff start command to device: ${device.device_id}`);
      commandResponse = await sendCommandToDeviceAndWait(device.device_id, command, 30000);
      console.log(`✅ Hubstaff start confirmed by device: ${device.device_id}`);
    } catch (wsError) {
      console.error("❌ Failed to send Hubstaff start command:", wsError.message);
      throw {
        status: 500,
        message: "Failed to communicate with PC Agent",
        error: wsError.message,
      };
    }

    const startedAt = new Date();
    if (!device.system_info) {
      device.system_info = {};
    }

    device.system_info.hubstaff_running = true;
    device.system_info.hubstaff_start_time = startedAt;

    await device.save();

    try {
      await HVNCActivityLogRepository.create({
        device_id: device.device_id,
        event_type: "hubstaff_started",
        description: `Hubstaff timer started on ${device.pc_name} by ${admin?.email || "admin"}`,
        context: { device_name: device.pc_name, projectId, taskName },
      });
    } catch (err) {
      // Logging error
    }

    return {
      success: true,
      deviceId: device._id,
      hubstaffRunning: true,
      startedAt: startedAt.toISOString(),
      pcAgentResponse: commandResponse,
      message: "Hubstaff timer started successfully on PC Agent",
    };
  }

  /**
   * Pause Hubstaff timer
   * @param {string} deviceId - Device ID
   * @param {Object} admin - Admin user object
   * @returns {Promise<Object>} Timer status
   */
  async pauseHubstaffTimer(deviceId, admin = {}) {
    const device = await HVNCDeviceRepository.findById(deviceId);
    if (!device) {
      throw { status: 404, message: "Device not found" };
    }

    // Send WebSocket command to PC Agent first
    let commandResponse = null;
    try {
      const command = await HVNCCommand.createCommand({
        device_id: device.device_id,
        session_id: `admin_hubstaff_${admin?._id || "unknown"}`,
        user_email: admin?.email || "admin",
        type: "hubstaff",
        action: "hubstaff_pause",
        parameters: {},
        priority: "high",
        timeout_seconds: 30,
        metadata: {
          source: "admin_dashboard",
          admin_user: admin?.email || "admin",
          action_type: "hubstaff_control",
        },
      });

      console.log(`⏸️ Sending Hubstaff pause command to device: ${device.device_id}`);
      commandResponse = await sendCommandToDeviceAndWait(device.device_id, command, 30000);
      console.log(`✅ Hubstaff pause confirmed by device: ${device.device_id}`);
    } catch (wsError) {
      console.error("❌ Failed to send Hubstaff pause command:", wsError.message);
      throw {
        status: 500,
        message: "Failed to communicate with PC Agent",
        error: wsError.message,
      };
    }

    const pausedAt = new Date();
    let elapsedMs = 0;
    if (
      device.system_info?.hubstaff_running &&
      device.system_info?.hubstaff_start_time
    ) {
      elapsedMs = pausedAt - new Date(device.system_info.hubstaff_start_time).getTime();
      device.system_info.hubstaff_seconds =
        (device.system_info.hubstaff_seconds || 0) + Math.floor(elapsedMs / 1000);
    }

    device.system_info.hubstaff_running = false;
    device.system_info.hubstaff_pause_time = pausedAt;

    await device.save();

    const elapsedFormatted = this._formatHubstaffTime(Math.floor(elapsedMs / 1000));

    try {
      await HVNCActivityLogRepository.create({
        device_id: device.device_id,
        event_type: "hubstaff_paused",
        description: `Hubstaff timer paused on ${device.pc_name} by ${admin?.email || "admin"}`,
        context: { device_name: device.pc_name, elapsed_time: elapsedFormatted },
      });
    } catch (err) {
      // Logging error
    }

    return {
      success: true,
      deviceId: device._id,
      hubstaffRunning: false,
      pausedAt: pausedAt.toISOString(),
      elapsedTime: elapsedFormatted,
      commandSent: true,
      pcAgentResponse: commandResponse,
      message: "Hubstaff timer paused successfully on PC Agent",
    };
  }

  // ===== Helper Methods =====

  async _enrichDeviceData(device, isOnline) {
    // Get assigned user from active shifts
    let assignedUser = "Unassigned";
    let assignedUserId = null;
    try {
      const shift = await HVNCShiftRepository.findOne({
        device_id: device.device_id,
        status: "active",
        $or: [{ end_date: null }, { end_date: { $gte: new Date() } }],
      });

      if (shift) {
        const user = await HVNCUserRepository.findByEmail(shift.user_email);
        if (user) {
          assignedUser = user.full_name;
          assignedUserId = user._id.toString();
        }
      }
    } catch (err) {
      // Silent fail for enrichment
    }

    const hubstaffSeconds = device.system_info?.hubstaff_seconds || 0;
    const formattedHubstaffTime = this._formatHubstaffTime(hubstaffSeconds);
    const hubstaffPercent = Math.min(
      100,
      Math.floor((hubstaffSeconds / (8 * 3600)) * 100)
    );

    return {
      id: device._id,
      pcName: device.pc_name,
      status: isOnline ? "Active" : "Offline",
      assigned: assignedUser,
      assignedUserId: assignedUserId,
      hubstaff: formattedHubstaffTime,
      hubstaffSeconds: hubstaffSeconds,
      hubstaffPercent: hubstaffPercent,
      lastSeen: device.last_seen ? this._formatLastSeen(device.last_seen) : "Never",
    };
  }

  _generateAccessCode() {
    return crypto.randomBytes(4).toString("hex").toUpperCase();
  }

  _formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  _formatHubstaffTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  _formatLastSeen(lastSeenTime) {
    const lastSeenMs = Date.now() - lastSeenTime.getTime();
    if (lastSeenMs < 60000) {
      return "Just now";
    } else if (lastSeenMs < 3600000) {
      const mins = Math.floor(lastSeenMs / 60000);
      return `${mins} min${mins > 1 ? "s" : ""} ago`;
    } else if (lastSeenMs < 86400000) {
      const hours = Math.floor(lastSeenMs / 3600000);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else {
      const days = Math.floor(lastSeenMs / 86400000);
      return `${days} day${days > 1 ? "s" : ""} ago`;
    }
  }

  _formatTimeAgo(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;

    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return past.toLocaleDateString();
  }
}

module.exports = new AdminDeviceManagementService();
