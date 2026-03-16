const DTUser = require("../models/dtUser.model");
const HVNCDevice = require("../models/hvnc-device.model");
const HVNCShift = require("../models/hvnc-shift.model");
const HVNCSession = require("../models/hvnc-session.model");
const HVNCActivityLog = require("../models/hvnc-activity-log.model");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

/**
 * GET /api/hvnc/admin/users
 * Fetch all DTUsers with enhanced device assignment info
 */
const getAllUsers = async (req, res) => {
  try {
    const {
      status, // active, locked, inactive
      role,
      search,
      hasDeviceAssignment,
      page = 1,
      limit = 20,
    } = req.query;

    // Build query filter
    let query = {};

    if (status) {
      if (status === "active") {
        query.is_account_locked = false;
        query.isEmailVerified = true;
      } else if (status === "locked") {
        query.is_account_locked = true;
      } else if (status === "inactive") {
        query.isEmailVerified = false;
      }
    }

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const users = await DTUser.find(query)
      .select("-password -passwordResetToken")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Enhanced user data with device assignments
    const userData = await Promise.all(
      users.map(async (user) => {
        // Get active shifts (device assignments)
        const activeShifts = await HVNCShift.find({
          user_email: user.email,
          status: "active",
          $or: [{ end_date: null }, { end_date: { $gte: new Date() } }],
        })
          .populate({
            path: "device_id",
            model: "HVNCDevice",
            select: "pc_name device_id status last_seen",
          })
          .lean();

        // Get assigned devices with real-time status
        const assignedDevices = await Promise.all(
          activeShifts.map(async (shift) => {
            const device = await HVNCDevice.findOne({
              device_id: shift.device_id,
            });
            if (!device) return null;

            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const isOnline =
              device.last_seen > fiveMinutesAgo && device.status === "online";

            return {
              shiftId: shift._id,
              deviceId: device.device_id,
              deviceName: device.pc_name,
              status: isOnline ? "online" : "offline",
              schedule: `${shift.start_time} - ${shift.end_time}`,
              startDate: shift.start_date,
              endDate: shift.end_date,
              daysOfWeek: shift.days_of_week,
              timezone: shift.timezone,
            };
          }),
        );

        // Filter out null devices and apply device filter if specified
        const validDevices = assignedDevices.filter((d) => d !== null);

        if (hasDeviceAssignment === "true" && validDevices.length === 0) {
          return null; // Filter out users without device assignments
        }
        if (hasDeviceAssignment === "false" && validDevices.length > 0) {
          return null; // Filter out users with device assignments
        }

        // Count active sessions across all devices
        const activeSessions = await HVNCSession.countDocuments({
          user_email: user.email,
          status: { $in: ["active", "idle"] },
        });

        // Calculate status
        let userStatus = "active";
        if (user.is_account_locked) {
          userStatus = "locked";
        } else if (!user.isEmailVerified) {
          userStatus = "unverified";
        } else if (!user.hasSetPassword) {
          userStatus = "incomplete";
        }

        return {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role || "user",
          status: userStatus,
          assignedDevices: validDevices,
          deviceCount: validDevices.length,
          activeSessions: activeSessions,
          lastLogin: user.last_login || null,
          createdAt: user.createdAt,
          annotatorStatus: user.annotatorStatus,
          qaStatus: user.qaStatus,
          domains: user.domains || [],
          permissions: user.permissions || [],
        };
      }),
    );

    // Filter out null results
    const filteredUserData = userData.filter((user) => user !== null);

    // Count totals
    const total = await DTUser.countDocuments(query);
    const activeCount = await DTUser.countDocuments({
      ...query,
      is_account_locked: false,
      isEmailVerified: true,
    });
    const lockedCount = await DTUser.countDocuments({
      ...query,
      is_account_locked: true,
    });
    const unverifiedCount = await DTUser.countDocuments({
      ...query,
      isEmailVerified: false,
    });

    // Count users with/without device assignments
    const allUserEmails = (await DTUser.find(query).select("email").lean()).map(
      (u) => u.email,
    );
    const usersWithDevices = await HVNCShift.distinct("user_email", {
      user_email: { $in: allUserEmails },
      status: "active",
      $or: [{ end_date: null }, { end_date: { $gte: new Date() } }],
    });

    res.json({
      success: true,
      data: {
        users: filteredUserData,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          usersPerPage: parseInt(limit),
        },
        summary: {
          total,
          activeCount,
          lockedCount,
          unverifiedCount,
          withDeviceAssignments: usersWithDevices.length,
          withoutDeviceAssignments: total - usersWithDevices.length,
        },
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch users",
      message: error.message,
    });
  }
};

/**
 * GET /api/hvnc/admin/users/:userId
 * Get detailed user information with device assignments
 */
const getUserDetail = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await DTUser.findById(userId)
      .select("-password -passwordResetToken")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Get all shifts for this user (active and historical)
    const allShifts = await HVNCShift.find({
      user_email: user.email,
    })
      .sort({ created_at: -1 })
      .lean();

    // Get detailed device information for each shift
    const shiftsWithDevices = await Promise.all(
      allShifts.map(async (shift) => {
        const device = await HVNCDevice.findOne({
          device_id: shift.device_id,
        }).lean();
        if (!device) return { ...shift, device: null };

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const isOnline =
          device.last_seen > fiveMinutesAgo && device.status === "online";

        return {
          ...shift,
          device: {
            deviceId: device.device_id,
            name: device.pc_name,
            status: isOnline ? "online" : "offline",
            lastSeen: device.last_seen,
            osVersion: device.os_version,
            publicIp: device.public_ip,
          },
        };
      }),
    );

    // Get recent sessions
    const recentSessions = await HVNCSession.find({
      user_email: user.email,
    })
      .sort({ started_at: -1 })
      .limit(20)
      .lean();

    const sessionData = await Promise.all(
      recentSessions.map(async (session) => {
        const device = await HVNCDevice.findOne({
          device_id: session.device_id,
        })
          .select("pc_name device_id")
          .lean();

        const duration = session.ended_at
          ? Math.round((session.ended_at - session.started_at) / (1000 * 60)) // minutes
          : null;

        return {
          sessionId: session.session_id || session._id,
          device: device
            ? {
                deviceId: device.device_id,
                name: device.pc_name,
              }
            : null,
          startTime: session.started_at,
          endTime: session.ended_at,
          duration: duration,
          status: session.status,
          activityCount: session.activity_count || 0,
        };
      }),
    );

    // Get recent activity logs
    const recentActivities = await HVNCActivityLog.find({
      user_email: user.email,
    })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.is_account_locked
            ? "locked"
            : !user.isEmailVerified
              ? "unverified"
              : !user.hasSetPassword
                ? "incomplete"
                : "active",
          createdAt: user.createdAt,
          lastLogin: user.last_login,
          annotatorStatus: user.annotatorStatus,
          qaStatus: user.qaStatus,
          domains: user.domains || [],
          personal_info: user.personal_info || {},
          payment_info: user.payment_info || {},
          system_info: user.system_info || {},
        },
        deviceAssignments: shiftsWithDevices,
        recentSessions: sessionData,
        recentActivities: recentActivities.map((activity) => ({
          id: activity._id,
          eventType: activity.event_type,
          eventData: activity.event_data,
          timestamp: activity.timestamp,
          deviceId: activity.device_id,
        })),
      },
    });
  } catch (error) {
    console.error("Get user detail error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user details",
      message: error.message,
    });
  }
};

/**
 * POST /api/hvnc/admin/users
 * Create new DTUser
 */
const createUser = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      role = "user",
      password,
      domains = [],
      personal_info = {},
      payment_info = {},
      system_info = {},
    } = req.body;

    // Check if user already exists
    const existingUser = await DTUser.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "User with this email already exists",
      });
    }

    // Hash password if provided
    let hashedPassword = null;
    let hasSetPassword = false;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 12);
      hasSetPassword = true;
    }

    // Create new user
    const newUser = new DTUser({
      fullName,
      email: email.toLowerCase(),
      phone,
      role,
      password: hashedPassword,
      hasSetPassword,
      isEmailVerified: true, // Admin-created users are auto-verified
      consent: true, // Admin-created users auto-consent
      domains,
      personal_info,
      payment_info,
      system_info,
    });

    await newUser.save();

    // Log the creation
    await HVNCActivityLog.create({
      event_type: "user_created",
      user_email: newUser.email,
      event_data: {
        created_by_admin: req.admin?.email || "system",
        user_role: newUser.role,
        created_with_password: hasSetPassword,
      },
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        hasSetPassword: newUser.hasSetPassword,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create user",
      message: error.message,
    });
  }
};

/**
 * PUT /api/hvnc/admin/users/:userId
 * Update DTUser
 */
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // Remove sensitive fields from updates
    delete updates.password;
    delete updates.passwordResetToken;
    delete updates.email; // Email updates should be separate endpoint

    const user = await DTUser.findByIdAndUpdate(
      userId,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true },
    ).select("-password -passwordResetToken");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Log the update
    await HVNCActivityLog.create({
      event_type: "user_modified",
      user_email: user.email,
      event_data: {
        updated_by_admin: req.admin?.email || "system",
        updated_fields: Object.keys(updates),
      },
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update user",
      message: error.message,
    });
  }
};

/**
 * DELETE /api/hvnc/admin/users/:userId
 * Delete DTUser and cleanup assignments
 */
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await DTUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // End all active sessions
    await HVNCSession.updateMany(
      { user_email: user.email, status: { $in: ["active", "idle"] } },
      {
        status: "ended",
        ended_at: new Date(),
        end_reason: "user_deleted",
      },
    );

    // Cancel all active shifts
    await HVNCShift.updateMany(
      { user_email: user.email, status: "active" },
      {
        status: "cancelled",
        end_date: new Date(),
      },
    );

    // Delete the user
    await DTUser.findByIdAndDelete(userId);

    // Log the deletion
    await HVNCActivityLog.create({
      event_type: "user_deleted",
      user_email: user.email,
      event_data: {
        deleted_by_admin: req.admin?.email || "system",
        user_role: user.role,
        had_device_assignments: true,
      },
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      message: "User deleted successfully and all assignments cleaned up",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete user",
      message: error.message,
    });
  }
};

/**
 * POST /api/hvnc/admin/users/:userId/assign-device
 * Assign device to user
 */
const assignDeviceToUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      deviceId,
      startDate,
      endDate,
      startTime,
      endTime,
      daysOfWeek = [1, 2, 3, 4, 5], // Default to weekdays
      timezone = "UTC",
      isRecurring = true,
      autoStartHubstaff = true,
    } = req.body;

    // Validate user exists
    const user = await DTUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Validate device exists
    const device = await HVNCDevice.findOne({ device_id: deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        error: "Device not found",
      });
    }

    // Check for time slot conflicts (not device conflicts)
    // Multiple users can use same device at different times
    const conflictingShifts = await HVNCShift.find({
      device_id: deviceId,
      status: "active",
      $or: [{ end_date: null }, { end_date: { $gte: new Date(startDate) } }],
      // Check for overlapping days
      days_of_week: { $in: daysOfWeek },
    });

    // Check for time overlaps on the same days
    const timeConflicts = conflictingShifts.filter((shift) => {
      // Convert times to minutes for comparison
      const newStartMinutes = timeToMinutes(startTime);
      const newEndMinutes = timeToMinutes(endTime);
      const existingStartMinutes = timeToMinutes(shift.start_time);
      const existingEndMinutes = timeToMinutes(shift.end_time);

      // Check if times overlap
      return (
        newStartMinutes < existingEndMinutes &&
        newEndMinutes > existingStartMinutes
      );
    });

    if (timeConflicts.length > 0) {
      const conflictDetails = timeConflicts.map((shift) => ({
        userEmail: shift.user_email,
        schedule: `${shift.start_time} - ${shift.end_time}`,
        days: shift.days_of_week,
      }));

      return res.status(409).json({
        success: false,
        error: "Time slot conflicts with existing assignments",
        conflicts: conflictDetails,
      });
    }

    // Create new shift assignment
    const newShift = new HVNCShift({
      device_id: deviceId,
      user_email: user.email,
      start_date: new Date(startDate),
      end_date: endDate ? new Date(endDate) : null,
      start_time: startTime,
      end_time: endTime,
      timezone,
      is_recurring: isRecurring,
      days_of_week: daysOfWeek,
      status: "active",
      shift_config: {
        auto_start_hubstaff: autoStartHubstaff,
      },
    });

    await newShift.save();

    // Log the assignment
    await HVNCActivityLog.create({
      event_type: "device_assignment_created",
      user_email: user.email,
      device_id: deviceId,
      event_data: {
        assigned_by_admin: req.admin?.email || "system",
        shift_id: newShift._id,
        schedule: `${startTime} - ${endTime}`,
        days_of_week: daysOfWeek,
      },
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    res.status(201).json({
      success: true,
      message: "Device assigned to user successfully",
      data: {
        shiftId: newShift._id,
        deviceId: deviceId,
        deviceName: device.pc_name,
        userEmail: user.email,
        schedule: `${startTime} - ${endTime}`,
        daysOfWeek: daysOfWeek,
      },
    });
  } catch (error) {
    console.error("Assign device error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to assign device to user",
      message: error.message,
    });
  }
};

/**
 * DELETE /api/hvnc/admin/users/:userId/device-assignments/:shiftId
 * Remove device assignment from user
 */
const removeDeviceFromUser = async (req, res) => {
  try {
    const { userId, shiftId } = req.params;

    // Validate user exists
    const user = await DTUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Find and validate shift
    const shift = await HVNCShift.findById(shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: "Shift assignment not found",
      });
    }

    if (shift.user_email !== user.email) {
      return res.status(403).json({
        success: false,
        error: "Shift does not belong to this user",
      });
    }

    // End any active sessions for this device
    await HVNCSession.updateMany(
      {
        user_email: user.email,
        device_id: shift.device_id,
        status: { $in: ["active", "idle"] },
      },
      {
        status: "ended",
        ended_at: new Date(),
        end_reason: "assignment_removed",
      },
    );

    // Cancel the shift
    await HVNCShift.findByIdAndUpdate(shiftId, {
      status: "cancelled",
      end_date: new Date(),
    });

    // Log the removal
    await HVNCActivityLog.create({
      event_type: "device_assignment_removed",
      user_email: user.email,
      device_id: shift.device_id,
      event_data: {
        removed_by_admin: req.admin?.email || "system",
        shift_id: shiftId,
        reason: "manual_removal",
      },
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      message: "Device assignment removed successfully",
    });
  } catch (error) {
    console.error("Remove device assignment error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to remove device assignment",
      message: error.message,
    });
  }
};

/**
 * POST /api/hvnc/admin/users/:userId/reset-password
 * Reset user password
 */
const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword, sendEmail = false } = req.body;

    const user = await DTUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    let finalPassword = newPassword;
    if (!finalPassword) {
      // Generate random password if not provided
      finalPassword = crypto.randomBytes(8).toString("hex");
    }

    const hashedPassword = await bcrypt.hash(finalPassword, 12);

    await DTUser.findByIdAndUpdate(userId, {
      password: hashedPassword,
      hasSetPassword: true,
      passwordResetToken: null,
      passwordResetExpires: null,
      passwordResetAttempts: 0,
    });

    // Log the password reset
    await HVNCActivityLog.create({
      event_type: "password_reset",
      user_email: user.email,
      event_data: {
        reset_by_admin: req.admin?.email || "system",
        password_generated: !newPassword,
      },
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      message: "Password reset successfully",
      data: {
        temporaryPassword: !newPassword ? finalPassword : undefined,
        sendEmail: sendEmail,
      },
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reset password",
      message: error.message,
    });
  }
};

/**
 * POST /api/hvnc/admin/users/:userId/toggle-lock
 * Lock/unlock user account
 */
const toggleUserLock = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await DTUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const newLockStatus = !user.is_account_locked;

    // If locking, end all active sessions
    if (newLockStatus) {
      await HVNCSession.updateMany(
        { user_email: user.email, status: { $in: ["active", "idle"] } },
        {
          status: "ended",
          ended_at: new Date(),
          end_reason: "account_locked",
        },
      );
    }

    await DTUser.findByIdAndUpdate(userId, {
      is_account_locked: newLockStatus,
    });

    // Log the action
    await HVNCActivityLog.create({
      event_type: newLockStatus ? "account_locked" : "account_unlocked",
      user_email: user.email,
      event_data: {
        action_by_admin: req.admin?.email || "system",
      },
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      message: `User account ${newLockStatus ? "locked" : "unlocked"} successfully`,
      data: {
        isLocked: newLockStatus,
      },
    });
  } catch (error) {
    console.error("Toggle user lock error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to toggle user lock status",
      message: error.message,
    });
  }
};

/**
 * GET /api/hvnc/admin/users/:userId/sessions
 * Get user session history
 */
const getUserSessions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    const user = await DTUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    let query = { user_email: user.email };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    const sessions = await HVNCSession.find(query)
      .sort({ started_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const sessionData = await Promise.all(
      sessions.map(async (session) => {
        const device = await HVNCDevice.findOne({
          device_id: session.device_id,
        })
          .select("pc_name device_id status")
          .lean();

        const duration = session.ended_at
          ? Math.round((session.ended_at - session.started_at) / (1000 * 60))
          : session.started_at
            ? Math.round((Date.now() - session.started_at) / (1000 * 60))
            : 0;

        return {
          sessionId: session.session_id || session._id,
          device: device
            ? {
                deviceId: device.device_id,
                name: device.pc_name,
                status: device.status,
              }
            : null,
          startTime: session.started_at,
          endTime: session.ended_at,
          duration: duration,
          status: session.status,
          endReason: session.end_reason,
          activityCount: session.activity_count || 0,
        };
      }),
    );

    const total = await HVNCSession.countDocuments(query);

    res.json({
      success: true,
      data: {
        sessions: sessionData,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalSessions: total,
          sessionsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Get user sessions error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get user sessions",
      message: error.message,
    });
  }
};

// Helper function to convert time string to minutes
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * GET /api/hvnc/admin/devices/:deviceId/users
 * Get all users assigned to a specific device
 */
const getDeviceUsers = async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Validate device exists
    const device = await HVNCDevice.findOne({ device_id: deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        error: "Device not found",
      });
    }

    // Get all active shifts for this device
    const shifts = await HVNCShift.find({
      device_id: deviceId,
      status: "active",
      $or: [{ end_date: null }, { end_date: { $gte: new Date() } }],
    })
      .sort({ start_time: 1 })
      .lean();

    // Get user details for each shift
    const deviceUsers = await Promise.all(
      shifts.map(async (shift) => {
        const user = await DTUser.findOne({ email: shift.user_email })
          .select("_id fullName email phone role")
          .lean();

        if (!user) return null;

        // Check if user has active session
        const activeSession = await HVNCSession.findOne({
          user_email: user.email,
          device_id: deviceId,
          status: { $in: ["active", "idle"] },
        });

        return {
          user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            role: user.role,
          },
          assignment: {
            shiftId: shift._id,
            schedule: `${shift.start_time} - ${shift.end_time}`,
            daysOfWeek: shift.days_of_week,
            startDate: shift.start_date,
            endDate: shift.end_date,
            timezone: shift.timezone,
            isRecurring: shift.is_recurring,
          },
          status: {
            hasActiveSession: !!activeSession,
            sessionId: activeSession?.session_id,
          },
        };
      }),
    );

    // Filter out null results
    const validUsers = deviceUsers.filter((user) => user !== null);

    res.json({
      success: true,
      data: {
        device: {
          deviceId: device.device_id,
          name: device.pc_name,
          status: device.status,
          lastSeen: device.last_seen,
        },
        assignedUsers: validUsers,
        totalAssignments: validUsers.length,
      },
    });
  } catch (error) {
    console.error("Get device users error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get device users",
      message: error.message,
    });
  }
};

/**
 * POST /api/hvnc/admin/devices/:deviceId/assign-multiple-users
 * Assign multiple users to a device with different time slots
 */
const assignMultipleUsersToDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { assignments } = req.body; // Array of { userId, startTime, endTime, daysOfWeek, startDate, endDate }

    // Validate device exists
    const device = await HVNCDevice.findOne({ device_id: deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        error: "Device not found",
      });
    }

    const results = [];
    const conflicts = [];

    for (const assignment of assignments) {
      const {
        userId,
        startDate,
        endDate,
        startTime,
        endTime,
        daysOfWeek = [1, 2, 3, 4, 5],
        timezone = "UTC",
        isRecurring = true,
      } = assignment;

      try {
        // Validate user exists
        const user = await DTUser.findById(userId);
        if (!user) {
          conflicts.push({
            userId,
            error: "User not found",
          });
          continue;
        }

        // Check for time conflicts with existing assignments
        const existingShifts = await HVNCShift.find({
          device_id: deviceId,
          status: "active",
          days_of_week: { $in: daysOfWeek },
        });

        const timeConflicts = existingShifts.filter((shift) => {
          const newStartMinutes = timeToMinutes(startTime);
          const newEndMinutes = timeToMinutes(endTime);
          const existingStartMinutes = timeToMinutes(shift.start_time);
          const existingEndMinutes = timeToMinutes(shift.end_time);

          return (
            newStartMinutes < existingEndMinutes &&
            newEndMinutes > existingStartMinutes
          );
        });

        if (timeConflicts.length > 0) {
          conflicts.push({
            userId,
            userEmail: user.email,
            error: "Time slot conflicts with existing assignments",
            conflictsWith: timeConflicts.map((shift) => ({
              userEmail: shift.user_email,
              schedule: `${shift.start_time} - ${shift.end_time}`,
            })),
          });
          continue;
        }

        // Create shift assignment
        const newShift = new HVNCShift({
          device_id: deviceId,
          user_email: user.email,
          start_date: new Date(startDate),
          end_date: endDate ? new Date(endDate) : null,
          start_time: startTime,
          end_time: endTime,
          timezone,
          is_recurring: isRecurring,
          days_of_week: daysOfWeek,
          status: "active",
        });

        await newShift.save();

        // Log assignment
        await HVNCActivityLog.create({
          event_type: "device_assignment_created",
          user_email: user.email,
          device_id: deviceId,
          event_data: {
            assigned_by_admin: req.admin?.email || "system",
            shift_id: newShift._id,
            schedule: `${startTime} - ${endTime}`,
            bulk_assignment: true,
          },
          ip_address: req.ip,
          user_agent: req.headers["user-agent"],
        });

        results.push({
          userId,
          userEmail: user.email,
          shiftId: newShift._id,
          schedule: `${startTime} - ${endTime}`,
          success: true,
        });
      } catch (error) {
        conflicts.push({
          userId,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: `${results.length} users assigned successfully, ${conflicts.length} conflicts found`,
      data: {
        successful: results,
        conflicts: conflicts,
        deviceId,
        deviceName: device.pc_name,
      },
    });
  } catch (error) {
    console.error("Assign multiple users error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to assign multiple users to device",
      message: error.message,
    });
  }
};

/**
 * GET /api/hvnc/admin/devices/:deviceId/schedule
 * Get device schedule showing all time slots and assignments
 */
const getDeviceSchedule = async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Validate device exists
    const device = await HVNCDevice.findOne({ device_id: deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        error: "Device not found",
      });
    }

    // Get all active shifts for this device
    const shifts = await HVNCShift.find({
      device_id: deviceId,
      status: "active",
      $or: [{ end_date: null }, { end_date: { $gte: new Date() } }],
    })
      .sort({ start_time: 1 })
      .lean();

    // Create schedule grid (7 days x 24 hours)
    const schedule = {};
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    // Initialize empty schedule
    for (let day = 0; day < 7; day++) {
      schedule[dayNames[day]] = {
        dayIndex: day,
        timeSlots: [],
      };
    }

    // Fill in assignments
    for (const shift of shifts) {
      const user = await DTUser.findOne({ email: shift.user_email })
        .select("fullName email")
        .lean();

      if (!user) continue;

      for (const dayIndex of shift.days_of_week) {
        schedule[dayNames[dayIndex]].timeSlots.push({
          shiftId: shift._id,
          user: {
            email: user.email,
            fullName: user.fullName,
          },
          startTime: shift.start_time,
          endTime: shift.end_time,
          timezone: shift.timezone,
          isRecurring: shift.is_recurring,
          startDate: shift.start_date,
          endDate: shift.end_date,
        });
      }
    }

    // Sort time slots by start time
    Object.values(schedule).forEach((day) => {
      day.timeSlots.sort(
        (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
      );
    });

    // Calculate utilization stats
    const totalHours = 7 * 24; // 7 days * 24 hours
    let usedHours = 0;

    Object.values(schedule).forEach((day) => {
      day.timeSlots.forEach((slot) => {
        const startMinutes = timeToMinutes(slot.startTime);
        const endMinutes = timeToMinutes(slot.endTime);
        usedHours += (endMinutes - startMinutes) / 60;
      });
    });

    const utilization = (usedHours / totalHours) * 100;

    res.json({
      success: true,
      data: {
        device: {
          deviceId: device.device_id,
          name: device.pc_name,
          status: device.status,
        },
        schedule,
        stats: {
          totalTimeSlots: shifts.length,
          totalUsersAssigned: [...new Set(shifts.map((s) => s.user_email))]
            .length,
          utilizationPercentage: Math.round(utilization * 100) / 100,
          totalHoursPerWeek: Math.round(usedHours * 100) / 100,
        },
      },
    });
  } catch (error) {
    console.error("Get device schedule error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get device schedule",
      message: error.message,
    });
  }
};

module.exports = {
  getAllUsers,
  getUserDetail,
  createUser,
  updateUser,
  deleteUser,
  assignDeviceToUser,
  removeDeviceFromUser,
  resetUserPassword,
  toggleUserLock,
  getUserSessions,
  getDeviceUsers,
  assignMultipleUsersToDevice,
  getDeviceSchedule,
};
