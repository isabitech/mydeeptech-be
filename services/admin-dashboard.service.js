// Layer: Service
/**
 * Admin Dashboard Service
 * Contains all business logic for dashboard statistics and displays
 */

const HVNCDeviceRepository = require("../repositories/hvnc-device.repository");
const HVNCUserRepository = require("../repositories/hvnc-user.repository");
const HVNCSessionRepository = require("../repositories/hvnc-session.repository");
const HVNCActivityLogRepository = require("../repositories/hvnc-activity-log.repository");
const HVNCShiftRepository = require("../repositories/hvnc-shift.repository");

class AdminDashboardService {
  /**
   * Get dashboard statistics
   * @returns {Promise<Object>} Dashboard stats
   */
  async getStats() {
    // Get total devices
    const totalDevicesCount = await HVNCDeviceRepository.count({});

    // Get online devices (last seen within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineDevicesCount = await HVNCDeviceRepository.count({
      last_seen: { $gt: fiveMinutesAgo },
      status: "online",
    });

    // Get active sessions
    const activeSessionsCount = await HVNCSessionRepository.countDocuments({
      status: { $in: ["active", "idle"] },
      ended_at: null,
    });

    // Get active timers (sessions with running Hubstaff)
    const activeTimersCount = await HVNCSessionRepository.countDocuments({
      status: { $in: ["active", "idle"] },
      ended_at: null,
      "hubstaff_data.is_running": true,
    });

    return {
      totalDevices: totalDevicesCount,
      onlineDevices: onlineDevicesCount,
      activeSessions: activeSessionsCount,
      activeTimers: activeTimersCount,
    };
  }

  /**
   * Get live devices for dashboard grid
   * @returns {Promise<Array>} Transformed device data
   */
  async getLiveDevices() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const devices = await HVNCDeviceRepository.findAllLive();

    const deviceData = await Promise.all(
      devices.map(async (device) => {
        const isOnline =
          device.last_seen > fiveMinutesAgo && device.status === "online";

        // Get assigned user
        let assignedUser = null;
        try {
          const shift = await HVNCShiftRepository.findOne({
            device_id: device.device_id,
            status: "active",
            $or: [{ end_date: null }, { end_date: { $gte: new Date() } }],
          });

          if (shift) {
            const user = await HVNCUserRepository.findByEmail(shift.user_email);
            assignedUser = user ? user.full_name : null;
          }
        } catch (err) {
          // Error handling or user not found
        }

        // Calculate uptime for online devices
        let uptime = null;
        if (isOnline) {
          uptime = this._formatUptime(device.last_seen);
        }

        // Last seen for offline devices
        let lastSeen = null;
        if (!isOnline) {
          lastSeen = this._formatLastSeen(device.last_seen);
        }

        return {
          id: device.device_id,
          name: device.pc_name,
          status: isOnline ? "online" : "offline",
          uptime,
          user: assignedUser,
          lastSeen,
        };
      }),
    );

    return deviceData;
  }

  /**
   * Get recent activity feed
   * @param {number} limit - Number of activities to fetch
   * @returns {Promise<Array>} Transformed activity items
   */
  async getActivity(limit = 10) {
    const activities = await HVNCActivityLogRepository.findAll({}, limit);

    const activityItems = activities.map((activity) => {
      const type = this._mapActivityType(activity);
      const timeAgo = this._formatTimeAgo(activity.timestamp);

      const subject = activity.user_id || activity.device_id || "System";
      let message = (activity.event_type || "event")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());

      if (activity.context && activity.context.device_name) {
        message += ` on ${activity.context.device_name}`;
      }

      return {
        id: activity._id.toString(),
        type,
        subject,
        message,
        time: timeAgo,
      };
    });

    return activityItems;
  }

  /**
   * Map activity event_type to frontend type
   */
  _mapActivityType(activity) {
    if (
      activity.event_type === "user_login" ||
      activity.event_type === "authentication_successful"
    ) {
      return "login";
    } else if (
      activity.event_type === "user_logout" ||
      activity.event_type === "session_ended"
    ) {
      return "logout";
    } else if (activity.event_type === "session_completed") {
      return "completed";
    } else if (activity.severity === "high" || activity.severity === "medium") {
      return "warning";
    }
    return "session";
  }

  /**
   * Format uptime duration
   */
  _formatUptime(lastSeenTime) {
    const uptimeMs = Date.now() - lastSeenTime.getTime();
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  /**
   * Format last seen time
   */
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

  /**
   * Format time ago
   */
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

module.exports = new AdminDashboardService();
