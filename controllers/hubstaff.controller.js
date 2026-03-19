const hubstaffService = require("../services/hubstaff.service");
const { validationResult } = require("express-validator");

class HubstaffController {
  /**
   * Handle timer update from PC Agent
   * POST /api/hvnc/hubstaff/timer-update
   */
  async handleTimerUpdate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { deviceId, timestamp, hubstaff, currentUser } = req.body;

      // Validate required fields
      if (!deviceId || !timestamp || !hubstaff) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: deviceId, timestamp, hubstaff",
        });
      }

      const result = await hubstaffService.processTimerUpdate({
        deviceId,
        hubstaffState: hubstaff,
        currentUser,
        timestamp,
      });

      // Emit real-time updates via WebSocket if state changed
      if (result.stateChanged && req.io) {
        const activeSessions = await hubstaffService.getActiveSessions();
        req.io.emit("hubstaff:timer-update", {
          type: "TIMER_UPDATE",
          deviceId,
          activeSessions,
          timestamp: new Date().toISOString(),
        });
      }

      res.status(200).json({
        success: true,
        message: "Timer update processed successfully",
        data: {
          deviceId,
          timerState: result.deviceTimer.isActive ? "active" : "inactive",
          totalElapsed: result.deviceTimer.getFormattedTime(),
          stateChanged: result.stateChanged,
        },
      });
    } catch (error) {
      console.error("❌ Error handling timer update:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error processing timer update",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  /**
  /**
   * Get all active Hubstaff sessions (Admin only)
   * Only returns sessions for users with valid device assignments
   * GET /api/hvnc/admin/hubstaff/active-sessions
   */
  async getActiveSessions(req, res) {
    try {
      const activeSessions = await hubstaffService.getActiveSessions();

      // Filter to only include sessions with valid device assignments
      const validSessions = activeSessions.filter(
        (session) => session.hasValidAssignment,
      );

      const formattedSessions = validSessions.map((session) => ({
        deviceId: session.deviceId,
        deviceName: session.deviceName,
        currentUser: {
          userId: session.userId._id,
          firstName: session.userId.firstName,
          lastName: session.userId.lastName,
          email: session.userId.email,
        },
        session: {
          sessionId: session._id,
          startTime: session.sessionStartTime,
          currentDuration: session.currentDuration,
          isActive: session.isActive,
        },
        hubstaffTimer: session.deviceTimer || {
          totalElapsed: "00:00:00",
          isActive: false,
        },
        deviceAssignment: session.assignmentDetails,
        hasValidAssignment: session.hasValidAssignment,
      }));

      res.status(200).json({
        success: true,
        data: formattedSessions,
        summary: {
          totalActiveSessions: formattedSessions.length,
          devicesInUse: [...new Set(formattedSessions.map((s) => s.deviceId))]
            .length,
          activeUsers: [
            ...new Set(formattedSessions.map((s) => s.currentUser.userId)),
          ].length,
        },
      });
    } catch (error) {
      console.error("❌ Error getting active sessions:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving active sessions",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  /**
   * Get user session history (Admin endpoint)
   * GET /api/hvnc/admin/hubstaff/user-sessions/:userId
   */
  async getUserSessionsAdmin(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, startDate, endDate } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        startDate,
        endDate,
      };

      const result = await hubstaffService.getUserSessions(userId, options);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("❌ Error getting user sessions (admin):", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving user sessions",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  /**
   * Get device utilization stats (Admin only)
   * GET /api/hvnc/admin/hubstaff/device-utilization/:deviceId
   */
  async getDeviceUtilization(req, res) {
    try {
      const { deviceId } = req.params;
      const { week = 0 } = req.query;

      const options = {
        week: parseInt(week),
      };

      const utilization = await hubstaffService.getDeviceUtilization(
        deviceId,
        options,
      );

      res.status(200).json({
        success: true,
        data: {
          ...utilization,
          deviceName: `HVNC-${deviceId.slice(-3)}`,
        },
      });
    } catch (error) {
      console.error("❌ Error getting device utilization:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving device utilization data",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  /**
   * Get current user's sessions (User endpoint)
   * GET /api/hvnc/user/hubstaff/my-sessions
   */
  async getUserSessionsSelf(req, res) {
    try {
      const userId = req.user.id; // From JWT middleware
      const { page = 1, limit = 20 } = req.query;

      // Get current active session
      const currentSession =
        await hubstaffService.getCurrentUserSession(userId);

      // Get session history
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
      };

      const sessionHistory = await hubstaffService.getUserSessions(
        userId,
        options,
      );

      // Get today's total
      const today = new Date().toISOString().split("T")[0];
      const todaySummary = await hubstaffService.getUserSessions(userId, {
        startDate: today,
        endDate: today,
        limit: 100, // Get all sessions for today
      });

      const todayTotal = {
        date: today,
        totalWorkedHours: todaySummary.summary.totalHoursWorked,
        sessionsCount: todaySummary.sessions.length,
        devices: [...new Set(todaySummary.sessions.map((s) => s.deviceId))],
      };

      // Calculate week summary
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        return date.toISOString().split("T")[0];
      });

      const weekSessions = await Promise.all(
        weekDates.map(async (date) => {
          const dayData = await hubstaffService.getUserSessions(userId, {
            startDate: date,
            endDate: date,
            limit: 100,
          });
          return {
            date: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
              new Date(date).getDay()
            ],
            hours: dayData.summary.totalHoursWorked || 0,
          };
        }),
      );

      res.status(200).json({
        success: true,
        data: {
          currentSession,
          todayTotal,
          weekSummary: {
            totalHours: weekSessions.reduce(
              (total, day) => total + day.hours,
              0,
            ),
            dailyBreakdown: weekSessions,
          },
          sessionHistory: sessionHistory.sessions.slice(0, 10), // Last 10 sessions
          pagination: sessionHistory.pagination,
        },
      });
    } catch (error) {
      console.error("❌ Error getting user sessions (self):", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving your session data",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  /**
   * Get device list with Hubstaff status (Admin only)
   * GET /api/hvnc/admin/hubstaff/devices
   */
  async getDevicesWithHubstaffStatus(req, res) {
    try {
      // This would integrate with your existing device management
      // For now, we'll return a placeholder that shows the structure
      const today = new Date().toISOString().split("T")[0];

      // Get all devices with active sessions
      const activeSessions = await hubstaffService.getActiveSessions();

      // Group by device
      const deviceMap = new Map();
      activeSessions.forEach((session) => {
        if (!deviceMap.has(session.deviceId)) {
          deviceMap.set(session.deviceId, {
            deviceId: session.deviceId,
            deviceName: `HVNC-${session.deviceId.slice(-3)}`,
            status: "online",
            hubstaffStatus: session.deviceTimer?.isActive ? "active" : "idle",
            currentUser: session.currentUser,
            totalElapsed: session.deviceTimer?.totalElapsed || "00:00:00",
            activeSince: session.session.startTime,
          });
        }
      });

      res.status(200).json({
        success: true,
        data: Array.from(deviceMap.values()),
      });
    } catch (error) {
      console.error("❌ Error getting devices with Hubstaff status:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving device status",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  /**
   * Get monthly user tracking - DTUsers with Hubstaff hours and device assignments (Admin only)
   * GET /api/hvnc/admin/hubstaff/monthly-tracking/:year/:month
   */
  async getMonthlyUserTracking(req, res) {
    try {
      const { year, month } = req.params;

      // Validate year and month
      const yearInt = parseInt(year);
      const monthInt = parseInt(month);

      if (isNaN(yearInt) || yearInt < 2020 || yearInt > 2030) {
        return res.status(400).json({
          success: false,
          message: "Invalid year. Year must be between 2020 and 2030",
        });
      }

      if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
        return res.status(400).json({
          success: false,
          message: "Invalid month. Month must be between 1 and 12",
        });
      }

      const trackingData = await hubstaffService.getMonthlyUserTracking(
        yearInt,
        monthInt,
      );

      res.status(200).json({
        success: true,
        data: trackingData,
      });
    } catch (error) {
      console.error("❌ Error getting monthly user tracking:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving monthly user tracking data",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  /**
   * Handle WebSocket connections for real-time updates
   */
  handleWebSocketConnection(io) {
    io.on("connection", (socket) => {
      console.log(`🔌 Client connected to Hubstaff WebSocket: ${socket.id}`);

      // Join admin room for admin-specific updates
      socket.on("join-admin", (data) => {
        if (data.isAdmin) {
          socket.join("admin-room");
          console.log(`👤 Admin client joined admin room: ${socket.id}`);
        }
      });

      // Join user room for user-specific updates
      socket.on("join-user", (data) => {
        if (data.userId) {
          socket.join(`user-${data.userId}`);
          console.log(`👤 User ${data.userId} joined user room: ${socket.id}`);
        }
      });

      // Handle disconnect
      socket.on("disconnect", () => {
        console.log(
          `Client disconnected from Hubstaff WebSocket: ${socket.id}`,
        );
      });
    });

    return io;
  }

  /**
   * Emit real-time updates to connected clients
   */
  async emitRealtimeUpdate(io, updateType, data) {
    try {
      switch (updateType) {
        case "session-start":
          io.to("admin-room").emit("hubstaff:session-started", data);
          io.to(`user-${data.userId}`).emit("hubstaff:session-started", data);
          break;
        case "session-end":
          io.to("admin-room").emit("hubstaff:session-ended", data);
          io.to(`user-${data.userId}`).emit("hubstaff:session-ended", data);
          break;
        case "timer-update":
          io.to("admin-room").emit("hubstaff:timer-update", data);
          break;
        default:
          console.warn("⚠️ Unknown update type:", updateType);
      }
    } catch (error) {
      console.error("❌ Error emitting real-time update:", error);
    }
  }
}

module.exports = new HubstaffController();
