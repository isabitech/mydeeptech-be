const HubstaffUserSession = require("../models/hubstaffUserSession.model");
const HubstaffDeviceTimer = require("../models/hubstaffDeviceTimer.model");
const DTUser = require("../models/dtUser.model");
const HVNCSession = require("../models/hvnc-session.model");
const HVNCShift = require("../models/hvnc-shift.model");

class HubstaffService {
  /**
   * Process timer update from PC Agent
   * @param {Object} updateData - Timer update data from PC Agent
   */
  async processTimerUpdate(updateData) {
    const { deviceId, hubstaffState, currentUser, timestamp } = updateData;
    const today = new Date(timestamp).toISOString().split("T")[0];

    try {
      // Find or create device timer for today
      const deviceTimer = await HubstaffDeviceTimer.findOrCreateDailyTimer(
        deviceId,
        today,
      );

      // Update device timer state
      if (hubstaffState.isRunning && hubstaffState.timer) {
        deviceTimer.updateTimerState({
          isActive: hubstaffState.timer.isActive,
          totalSeconds: hubstaffState.timer.totalSeconds,
        });
      } else {
        deviceTimer.updateTimerState({
          isActive: false,
          totalSeconds: deviceTimer.totalElapsedSeconds,
        });
      }

      // Check if timer state has changed
      const hasStateChanged = deviceTimer.hasStateChanged();

      if (hasStateChanged && currentUser && currentUser.userId) {
        await this.handleTimerStateChange(deviceTimer, currentUser, today);
      }

      await deviceTimer.save();

      return {
        success: true,
        deviceTimer: deviceTimer,
        stateChanged: hasStateChanged,
      };
    } catch (error) {
      console.error("Error processing timer update:", error);
      throw error;
    }
  }

  /**
   * Handle timer state changes (start/stop/pause)
   */
  async handleTimerStateChange(deviceTimer, currentUser, date) {
    try {
      const activeSession = await HubstaffUserSession.getActiveSessionForDevice(
        deviceTimer.deviceId,
      );

      // Timer just started
      if (!deviceTimer.lastKnownState.isActive && deviceTimer.isActive) {
        // If there's an existing active session for different user, end it first
        if (
          activeSession &&
          activeSession.userId.toString() !== currentUser.userId
        ) {
          await this.endUserSession(
            activeSession,
            deviceTimer.lastKnownState.elapsedSeconds,
            "user_switched",
          );
        }

        // Start new session if no active session or different user
        if (
          !activeSession ||
          activeSession.userId.toString() !== currentUser.userId
        ) {
          await this.startUserSession(currentUser, deviceTimer, date);
        }
      }

      // Timer was paused/stopped
      if (deviceTimer.lastKnownState.isActive && !deviceTimer.isActive) {
        if (activeSession) {
          await this.endUserSession(
            activeSession,
            deviceTimer.totalElapsedSeconds,
            "user_paused",
          );
        }
      }

      // User changed while timer running
      if (
        deviceTimer.isActive &&
        activeSession &&
        activeSession.userId.toString() !== currentUser.userId
      ) {
        await this.endUserSession(
          activeSession,
          deviceTimer.totalElapsedSeconds,
          "user_switched",
        );
        await this.startUserSession(currentUser, deviceTimer, date);
      }
    } catch (error) {
      console.error("Error handling timer state change:", error);
      throw error;
    }
  }

  /**
   * Start a new user session
   */
  async startUserSession(currentUser, deviceTimer, date) {
    try {
      const newSession = new HubstaffUserSession({
        userId: currentUser.userId,
        deviceId: deviceTimer.deviceId,
        hvncSessionId: currentUser.sessionId,
        date: date,
        sessionStartTime: new Date(),
        hubstaffStartOffset: deviceTimer.totalElapsedSeconds,
        isActive: true,
      });

      await newSession.save();
      return newSession;
    } catch (error) {
      console.error("Error starting user session:", error);
      throw error;
    }
  }

  /**
   * End an active user session
   */
  async endUserSession(session, endOffset, reason = "user_stopped") {
    try {
      session.endSession(endOffset, reason);
      await session.save();
      return session;
    } catch (error) {
      console.error("Error ending user session:", error);
      throw error;
    }
  }

  /**
   * Get all active sessions across devices
   */
  async getActiveSessions() {
    try {
      const today = new Date().toISOString().split("T")[0];

      const activeSessions = await HubstaffUserSession.find({
        date: today,
        isActive: true,
      })
        .populate("userId", "firstName lastName email")
        .lean();

      const enrichedSessions = await Promise.all(
        activeSessions.map(async (session) => {
          const deviceTimer = await HubstaffDeviceTimer.findOne({
            deviceId: session.deviceId,
            date: today,
          });

          const currentDuration = deviceTimer
            ? deviceTimer.totalElapsedSeconds - session.hubstaffStartOffset
            : 0;

          return {
            ...session,
            deviceTimer: deviceTimer
              ? {
                  totalElapsed: deviceTimer.getFormattedTime(),
                  isActive: deviceTimer.isActive,
                }
              : null,
            currentDuration: this.formatDuration(currentDuration),
          };
        }),
      );

      return enrichedSessions;
    } catch (error) {
      console.error("Error getting active sessions:", error);
      throw error;
    }
  }

  /**
   * Get user session history
   */
  async getUserSessions(userId, options = {}) {
    try {
      const { page = 1, limit = 20, startDate, endDate } = options;

      const query = { userId };

      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = startDate;
        if (endDate) query.date.$lte = endDate;
      }

      const sessions = await HubstaffUserSession.find(query)
        .sort({ date: -1, sessionStartTime: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const totalSessions = await HubstaffUserSession.countDocuments(query);

      // Calculate summary statistics
      const summaryStats = await HubstaffUserSession.aggregate([
        { $match: { ...query, isActive: false } },
        {
          $group: {
            _id: null,
            totalHoursWorked: { $sum: "$userWorkedHours" },
            totalSessions: { $sum: 1 },
            averageSessionHours: { $avg: "$userWorkedHours" },
          },
        },
      ]);

      return {
        sessions: sessions.map((session) => ({
          ...session,
          formattedDuration: session.userWorkedHours
            ? `${Math.floor(session.userWorkedHours)}h ${Math.round((session.userWorkedHours % 1) * 60)}m`
            : "0h 0m",
        })),
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalSessions / limit),
          totalSessions,
          hasNextPage: page < Math.ceil(totalSessions / limit),
          hasPrevPage: page > 1,
        },
        summary: summaryStats[0] || {
          totalHoursWorked: 0,
          totalSessions: 0,
          averageSessionHours: 0,
        },
      };
    } catch (error) {
      console.error("Error getting user sessions:", error);
      throw error;
    }
  }

  /**
   * Get device utilization data
   */
  async getDeviceUtilization(deviceId, options = {}) {
    try {
      const { week = 0 } = options;
      const today = new Date();
      const targetDate = new Date(
        today.getTime() + week * 7 * 24 * 60 * 60 * 1000,
      );
      const dateStr = targetDate.toISOString().split("T")[0];

      // Get today's sessions for the device
      const todaySessions = await HubstaffUserSession.find({
        deviceId,
        date: dateStr,
        isActive: false,
      })
        .populate("userId", "firstName lastName email")
        .sort({ sessionStartTime: 1 })
        .lean();

      // Get device timer for today
      const deviceTimer = await HubstaffDeviceTimer.findOne({
        deviceId,
        date: dateStr,
      });

      // Calculate total hours worked today
      const totalHoursToday = todaySessions.reduce(
        (total, session) => total + (session.userWorkedHours || 0),
        0,
      );

      // Get week summary
      const weekStart = new Date(targetDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        return date.toISOString().split("T")[0];
      });

      const weekSessions = await HubstaffUserSession.aggregate([
        {
          $match: {
            deviceId,
            date: { $in: weekDates },
            isActive: false,
          },
        },
        {
          $group: {
            _id: "$date",
            totalHours: { $sum: "$userWorkedHours" },
            sessionsCount: { $sum: 1 },
            users: { $addToSet: "$userId" },
          },
        },
      ]);

      const weekTotalHours = weekSessions.reduce(
        (total, day) => total + day.totalHours,
        0,
      );
      const utilizationRate = (weekTotalHours / (7 * 24)) * 100; // Assuming 24/7 availability

      return {
        deviceId,
        today: {
          date: dateStr,
          totalHubstaffHours: Math.round(totalHoursToday * 100) / 100,
          activeUsers: todaySessions.length,
          sessions: todaySessions.map((session) => ({
            userId: session.userId._id,
            userName: `${session.userId.firstName} ${session.userId.lastName}`,
            startTime: new Date(session.sessionStartTime).toLocaleTimeString(
              "en-US",
              {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
              },
            ),
            endTime: session.sessionEndTime
              ? new Date(session.sessionEndTime).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Ongoing",
            workedHours: Math.round((session.userWorkedHours || 0) * 100) / 100,
          })),
          currentTimer: deviceTimer
            ? {
                isActive: deviceTimer.isActive,
                totalElapsed: deviceTimer.getFormattedTime(),
              }
            : null,
        },
        weekSummary: {
          totalHours: Math.round(weekTotalHours * 100) / 100,
          averageDailyHours: Math.round((weekTotalHours / 7) * 100) / 100,
          utilizationRate: Math.round(utilizationRate * 100) / 100,
          activeDays: weekSessions.length,
        },
      };
    } catch (error) {
      console.error("Error getting device utilization:", error);
      throw error;
    }
  }

  /**
   * Get current session for user
   */
  async getCurrentUserSession(userId) {
    try {
      const today = new Date().toISOString().split("T")[0];

      const currentSession = await HubstaffUserSession.findOne({
        userId,
        date: today,
        isActive: true,
      }).lean();

      if (!currentSession) {
        return null;
      }

      const deviceTimer = await HubstaffDeviceTimer.findOne({
        deviceId: currentSession.deviceId,
        date: today,
      });

      const currentDuration = deviceTimer
        ? deviceTimer.totalElapsedSeconds - currentSession.hubstaffStartOffset
        : 0;

      return {
        ...currentSession,
        currentDuration: this.formatDuration(currentDuration),
        hubstaffTimer: deviceTimer
          ? deviceTimer.getFormattedTime()
          : "00:00:00",
      };
    } catch (error) {
      console.error("Error getting current user session:", error);
      throw error;
    }
  }

  /**
   * Get DTUsers with Hubstaff hours and device assignments for a specific month
   */
  async getMonthlyUserTracking(year, month) {
    try {
      // Create date range for the month
      const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
      const endDate = new Date(year, month, 0).toISOString().split("T")[0]; // Last day of month

      // Get all DTUsers who have Hubstaff sessions in this month
      const userSessions = await HubstaffUserSession.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lte: endDate },
            isActive: false, // Only completed sessions
          },
        },
        {
          $group: {
            _id: "$userId",
            totalHoursWorked: { $sum: "$userWorkedHours" },
            totalSessions: { $sum: 1 },
            devicesUsed: { $addToSet: "$deviceId" },
            firstSessionDate: { $min: "$date" },
            lastSessionDate: { $max: "$date" },
            totalMinutesWorked: { $sum: "$userWorkedSeconds" },
          },
        },
        {
          $match: {
            totalHoursWorked: { $gt: 0 }, // Only users with actual work hours
          },
        },
      ]);

      if (userSessions.length === 0) {
        return {
          month: `${year}-${month.toString().padStart(2, "0")}`,
          totalUsers: 0,
          users: [],
          summary: {
            totalUsersWithHours: 0,
            totalUsersWithDeviceAssignments: 0,
            totalHoursWorked: 0,
            averageHoursPerUser: 0,
          },
        };
      }

      const userIds = userSessions.map((session) => session._id);

      // Get DTUser details for these users
      const dtUsers = await DTUser.find({ _id: { $in: userIds } })
        .select("firstName lastName email phoneNumber isActive")
        .lean();

      // Create email to userId mapping
      const emailToUserIdMap = new Map();
      dtUsers.forEach((user) => {
        emailToUserIdMap.set(user.email, user._id.toString());
      });

      // Get device assignments for these users using email addresses (past or present)
      const userEmails = dtUsers.map((user) => user.email);
      const userDeviceAssignments = await HVNCShift.find({
        user_email: { $in: userEmails },
      })
        .select(
          "device_id user_email start_time end_time days_of_week status start_date end_date",
        )
        .lean();

      // Filter to only include users who have device assignments
      const usersWithDeviceAssignments = new Set();
      const deviceAssignmentMap = new Map();

      userDeviceAssignments.forEach((assignment) => {
        const userId = emailToUserIdMap.get(assignment.user_email);
        if (userId) {
          usersWithDeviceAssignments.add(userId);

          if (!deviceAssignmentMap.has(userId)) {
            deviceAssignmentMap.set(userId, []);
          }
          deviceAssignmentMap.get(userId).push({
            deviceId: assignment.device_id,
            startTime: assignment.start_time,
            endTime: assignment.end_time,
            assignedDays: assignment.days_of_week || [],
            isActive: assignment.status === "active",
            status: assignment.status,
            startDate: assignment.start_date,
            endDate: assignment.end_date,
          });
        }
      });

      // Combine data and filter for users with device assignments
      const enrichedUsers = userSessions
        .filter((session) =>
          usersWithDeviceAssignments.has(session._id.toString()),
        )
        .map((session) => {
          const userId = session._id.toString();
          const userDetails = dtUsers.find(
            (user) => user._id.toString() === userId,
          );
          const deviceAssignments = deviceAssignmentMap.get(userId) || [];

          return {
            userId: session._id,
            userDetails: {
              firstName: userDetails?.firstName || "Unknown",
              lastName: userDetails?.lastName || "User",
              email: userDetails?.email || "",
              phoneNumber: userDetails?.phoneNumber || "",
              isActive: userDetails?.isActive || false,
            },
            workingStats: {
              totalHoursWorked:
                Math.round(session.totalHoursWorked * 100) / 100,
              totalSessions: session.totalSessions,
              devicesUsed: session.devicesUsed,
              totalMinutesWorked: Math.round(session.totalMinutesWorked / 60),
              averageHoursPerSession:
                Math.round(
                  (session.totalHoursWorked / session.totalSessions) * 100,
                ) / 100,
              firstWorkDate: session.firstSessionDate,
              lastWorkDate: session.lastSessionDate,
            },
            deviceAssignments: deviceAssignments,
            assignmentStatus: {
              hasActiveAssignments: deviceAssignments.some(
                (assignment) => assignment.isActive,
              ),
              totalDevicesAssigned: [
                ...new Set(
                  deviceAssignments.map((assignment) => assignment.deviceId),
                ),
              ].length,
              currentDevices: deviceAssignments
                .filter((assignment) => assignment.isActive)
                .map((assignment) => assignment.deviceId),
              pastDevices: deviceAssignments
                .filter((assignment) => !assignment.isActive)
                .map((assignment) => assignment.deviceId),
            },
          };
        })
        .sort(
          (a, b) =>
            b.workingStats.totalHoursWorked - a.workingStats.totalHoursWorked,
        ); // Sort by hours worked descending

      // Calculate summary statistics
      const totalHoursWorked = enrichedUsers.reduce(
        (total, user) => total + user.workingStats.totalHoursWorked,
        0,
      );
      const averageHoursPerUser =
        enrichedUsers.length > 0 ? totalHoursWorked / enrichedUsers.length : 0;

      return {
        month: `${year}-${month.toString().padStart(2, "0")}`,
        dateRange: {
          startDate,
          endDate,
        },
        totalUsers: enrichedUsers.length,
        users: enrichedUsers,
        summary: {
          totalUsersWithHours: userSessions.length,
          totalUsersWithDeviceAssignments: enrichedUsers.length,
          totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
          averageHoursPerUser: Math.round(averageHoursPerUser * 100) / 100,
          totalDevicesUsed: [
            ...new Set(
              enrichedUsers.flatMap((user) => user.workingStats.devicesUsed),
            ),
          ].length,
          activeUsers: enrichedUsers.filter((user) => user.userDetails.isActive)
            .length,
        },
      };
    } catch (error) {
      console.error("Error getting monthly user tracking:", error);
      throw error;
    }
  }

  /**
   * Format duration in seconds to HH:MM:SS
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
}

module.exports = new HubstaffService();
