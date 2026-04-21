// Layer: Service
/**
 * Enhanced Admin User Management Service
 * Contains business logic for DTUser management with device assignments
 */

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const DTUserRepository = require("../repositories/dtUser.repository");
const HVNCDeviceRepository = require("../repositories/hvnc-device.repository");
const HVNCShiftRepository = require("../repositories/hvnc-shift.repository");
const HVNCSessionRepository = require("../repositories/hvnc-session.repository");
const HVNCActivityLogRepository = require("../repositories/hvnc-activity-log.repository");

class EnhancedAdminUserManagementService {
  toInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  buildPagination({ page, limit, total }) {
    return {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total,
      usersPerPage: limit,
    };
  }

  buildStatusQuery(status) {
    const query = {};

    if (status) {
      if (status === "active") {
        query.is_account_locked = false;
        query.isEmailVerified = true;
      } else if (status === "locked") {
        query.is_account_locked = true;
      } else if (status === "unverified") {
        query.isEmailVerified = false;
      }
    }

    return query;
  }

  buildUserSearchQuery(search) {
    if (!search) {
      return {};
    }

    return {
      $or: [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    };
  }

  buildUserStatus(user) {
    if (user.is_account_locked) return "locked";
    if (!user.isEmailVerified) return "unverified";
    if (!user.hasSetPassword) return "incomplete";
    return "active";
  }

  async getShiftDeviceName(shift) {
    try {
      const device = await HVNCDeviceRepository.findOne({
        device_id: shift.device_id,
      });

      return device?.pc_name || "Unknown";
    } catch (err) {
      return "Unknown";
    }
  }

  /**
   * Get all DTUsers with enhanced device assignment info
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Users data
   */
  async getAllUsers(filters = {}) {
    let query = this.buildStatusQuery(filters.status);
    if (filters.role) {
      query.role = filters.role;
    }

    Object.assign(query, this.buildUserSearchQuery(filters.search));

    const page = this.toInt(filters.page, 1);
    const limit = this.toInt(filters.limit, 20);
    const skip = (page - 1) * limit;

    const users = await DTUserRepository.find(query);
    const paginatedUsers = users.slice(skip, skip + parseInt(limit));

    const userData = await Promise.all(
      paginatedUsers.map(async (user) => this._enrichDTUserData(user)),
    );

    const filteredUserData = userData.filter((u) => u !== null);

    const total = users.length;
    const activeCount = users.filter(
      (u) => !u.is_account_locked && u.isEmailVerified,
    ).length;
    const lockedCount = users.filter((u) => u.is_account_locked).length;
    const unverifiedCount = users.filter((u) => !u.isEmailVerified).length;

    // Count users with device assignments
    const allEmails = users.map((u) => u.email);
    const usersWithDevices = await HVNCShiftRepository.distinct("user_email", {
      user_email: { $in: allEmails },
      status: "active",
    });

    return {
      users: filteredUserData,
      pagination: this.buildPagination({ page, limit, total }),
      summary: {
        total,
        activeCount,
        lockedCount,
        unverifiedCount,
        withDeviceAssignments: usersWithDevices.length,
        withoutDeviceAssignments: total - usersWithDevices.length,
      },
    };
  }

  /**
   * Get DTUser detail with device assignments
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User detail
   */
  async getUserDetail(userId) {
    const user = await DTUserRepository.findById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    const [shifts, sessions, activities] = await Promise.all([
      HVNCShiftRepository.find({ user_email: user.email }),
      HVNCSessionRepository.find({ user_email: user.email }),
      HVNCActivityLogRepository.find({ user_email: user.email }),
    ]);

    const shiftsWithDevices = await Promise.all(
      shifts.map(async (shift) => ({
        id: shift._id,
        deviceId: shift.device_id,
        deviceName: await this.getShiftDeviceName(shift),
        startDate: shift.start_date,
        endDate: shift.end_date,
        startTime: shift.start_time,
        endTime: shift.end_time,
        status: shift.status,
        isRecurring: shift.is_recurring,
        timezone: shift.timezone,
      })),
    );

    const sessionData = sessions
      .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
      .slice(0, 20)
      .map((session) => ({
        id: session._id,
        deviceId: session.device_id,
        status: session.status,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        duration: this._calculateDuration(session.started_at, session.ended_at),
      }));

    return {
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: this.buildUserStatus(user),
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
      recentActivities: activities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 50)
        .map((a) => ({
          id: a._id,
          eventType: a.event_type,
          eventData: a.event_data,
          timestamp: a.timestamp,
          deviceId: a.device_id,
        })),
    };
  }

  /**
   * Create new DTUser
   * @param {Object} data - User data
   * @returns {Promise<Object>} Created user
   */
  async createUser(data) {
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
    } = data;

    const existingUser = await DTUserRepository.findByEmail(
      email.toLowerCase(),
    );
    if (existingUser) {
      throw { status: 409, message: "User already exists" };
    }

    let hashedPassword = null;
    let hasSetPassword = false;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 12);
      hasSetPassword = true;
    }

    const newUser = await DTUserRepository.create({
      fullName,
      email: email.toLowerCase(),
      phone,
      role,
      password: hashedPassword,
      hasSetPassword,
      isEmailVerified: true,
      consent: true,
      domains,
      personal_info,
      payment_info,
      system_info,
    });

    // Log creation
    try {
      await HVNCActivityLogRepository.create({
        event_type: "user_created",
        user_email: newUser.email,
        description: `User created: ${newUser.fullName}`,
        event_data: {
          created_by_admin: true,
          user_role: newUser.role,
          created_with_password: hasSetPassword,
        },
      });
    } catch (err) {
      // Logging error
    }

    return {
      id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role,
      hasSetPassword: newUser.hasSetPassword,
    };
  }

  /**
   * Update DTUser
   * @param {string} userId - User ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated user
   */
  async updateUser(userId, data) {
    // Remove sensitive fields
    delete data.password;
    delete data.passwordResetToken;
    delete data.email;

    if (!data.updatedAt) {
      data.updatedAt = new Date();
    }

    const user = await DTUserRepository.findByIdAndUpdate(userId, data, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    return this._enrichDTUserData(user, true);
  }

  /**
   * Delete DTUser and cleanup
   * @param {string} userId - User ID
   * @param {boolean} hardDelete - Permanent delete
   * @returns {Promise<Object>} Success response
   */
  async deleteUser(userId, hardDelete = false) {
    const user = await DTUserRepository.findById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    if (hardDelete === true) {
      // Permanent delete
      await HVNCShiftRepository.deleteMany({ user_email: user.email });
      await HVNCSessionRepository.deleteMany({ user_email: user.email });
      await HVNCActivityLogRepository.deleteMany({ user_email: user.email });
      await DTUserRepository.delete(userId);

      return { success: true, message: "User deleted permanently" };
    } else {
      // Soft delete
      user.is_account_locked = true;
      await user.save();

      return { success: true, message: "User deactivated successfully" };
    }
  }

  /**
   * Assign device to user
   * @param {string} userId - User ID
   * @param {Object} data - Assignment data
   * @returns {Promise<Object>} Assignment result
   */
  async assignDeviceToUser(userId, data) {
    const user = await DTUserRepository.findById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    const {
      deviceId,
      startDate,
      endDate,
      startTime,
      endTime,
      isRecurring,
      timezone,
      daysOfWeek,
    } = data;

    const device = await HVNCDeviceRepository.findById(deviceId);
    if (!device) {
      throw { status: 404, message: "Device not found" };
    }

    const shift = await HVNCShiftRepository.create({
      user_email: user.email,
      device_id: device.device_id,
      start_date: new Date(startDate),
      end_date: endDate ? new Date(endDate) : null,
      start_time: startTime,
      end_time: endTime,
      is_recurring: isRecurring || false,
      days_of_week: daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
      timezone: timezone || "UTC",
      status: "active",
    });

    return {
      success: true,
      shiftId: shift._id,
      message: "Device assigned successfully",
    };
  }

  /**
   * Remove device from user
   * @param {string} userId - User ID
   * @param {string} shiftId - Shift ID to remove
   * @returns {Promise<Object>} Success response
   */
  async removeDeviceFromUser(userId, shiftId) {
    const user = await DTUserRepository.findById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    const shift = await HVNCShiftRepository.findById(shiftId);
    if (!shift || shift.user_email !== user.email) {
      throw { status: 404, message: "Assignment not found" };
    }

    await HVNCShiftRepository.deleteById(shiftId);

    return { success: true, message: "Device assignment removed" };
  }

  /**
   * Reset DTUser password
   * @param {string} userId - User ID
   * @param {Object} data - Reset data
   * @returns {Promise<Object>} Reset result
   */
  async resetUserPassword(userId, data = {}) {
    const user = await DTUserRepository.findById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    const { newPassword, sendEmail = true } = data;
    let password = newPassword;

    if (!password) {
      password = crypto.randomBytes(8).toString("hex");
    }

    user.password = await bcrypt.hash(password, 12);
    user.last_password_change = new Date();
    await user.save();

    return {
      success: true,
      message: "Password reset successfully",
      temporaryPassword: newPassword ? undefined : password,
    };
  }

  /**
   * Toggle user lock
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Success response
   */
  async toggleUserLock(userId) {
    const user = await DTUserRepository.findById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    user.is_account_locked = !user.is_account_locked;
    await user.save();

    return {
      success: true,
      message: `User ${user.is_account_locked ? "locked" : "unlocked"} successfully`,
      isLocked: user.is_account_locked,
    };
  }

  /**
   * Get user session history
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Session history
   */
  async getUserSessions(userId, filters = {}) {
    const user = await DTUserRepository.findById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    const page = this.toInt(filters.page, 1);
    const limit = this.toInt(filters.limit, 20);
    const { status } = filters;
    const skip = (page - 1) * limit;

    let query = { user_email: user.email };
    if (status) {
      query.status = status;
    }

    const sessions = await HVNCSessionRepository.find(query);
    const totalSessions = sessions.length;

    const paginatedSessions = sessions
      .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
      .slice(skip, skip + parseInt(limit));

    const sessionData = paginatedSessions.map((session) => ({
      id: session._id,
      deviceId: session.device_id,
      status: session.status,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      duration: this._calculateDuration(session.started_at, session.ended_at),
    }));

    return {
      sessions: sessionData,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalSessions / limit),
        totalSessions,
      },
    };
  }

  // ===== Helper Methods =====

  async _enrichDTUserData(user, detailed = false) {
    try {
      const shifts = await HVNCShiftRepository.find({
        user_email: user.email,
        status: "active",
      });

      const base = {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.is_account_locked
          ? "locked"
          : !user.isEmailVerified
            ? "unverified"
            : "active",
        deviceAssignments: shifts.length,
        joinedDate: user.createdAt,
      };

      if (detailed) {
        return {
          ...base,
          phone: user.phone,
          isEmailVerified: user.isEmailVerified,
          hasSetPassword: user.hasSetPassword,
          lastLogin: user.last_login,
          domains: user.domains || [],
        };
      }

      return base;
    } catch (err) {
      return null;
    }
  }

  _calculateDuration(start, end) {
    if (!start || !end) return "0h 0m";
    const durationMs = new Date(end) - new Date(start);
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }
}

module.exports = new EnhancedAdminUserManagementService();
