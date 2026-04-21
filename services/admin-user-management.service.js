// Layer: Service
/**
 * Admin User Management Service
 * Contains all business logic for HVNC user management
 */

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const HVNCUserRepository = require("../repositories/hvnc-user.repository");
const HVNCShiftRepository = require("../repositories/hvnc-shift.repository");
const HVNCSessionRepository = require("../repositories/hvnc-session.repository");
const HVNCActivityLogRepository = require("../repositories/hvnc-activity-log.repository");

class AdminUserManagementService {
  /**
   * Get all users with filtering
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Users data with counts
   */
  async getAllUsers(filters = {}) {
    let query = {};

    if (filters.status) {
      if (filters.status === "active") {
        query.is_locked = false;
        query.is_active = true;
      } else if (filters.status === "locked") {
        query.is_locked = true;
      } else if (filters.status === "inactive") {
        query.is_active = false;
      }
    }

    if (filters.role) {
      query.role = filters.role;
    }

    if (filters.search) {
      query.$or = [
        { full_name: { $regex: filters.search, $options: "i" } },
        { email: { $regex: filters.search, $options: "i" } },
      ];
    }

    const users = await HVNCUserRepository.find(query);

    const userData = await Promise.all(
      users.map(async (user) => this._enrichUserData(user)),
    );

    const total = users.length;
    const activeCount = users.filter((u) => !u.is_locked && u.is_active).length;
    const lockedCount = users.filter((u) => u.is_locked).length;
    const inactiveCount = users.filter((u) => !u.is_active).length;

    return {
      total,
      activeCount,
      lockedCount,
      inactiveCount,
      users: userData,
    };
  }

  /**
   * Get user detail
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User detail
   */
  async getUserDetail(userId) {
    const user = await HVNCUserRepository.findById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    const shifts = await HVNCShiftRepository.find({
      user_email: user.email,
      status: "active",
      $or: [{ end_date: null }, { end_date: { $gte: new Date() } }],
    });

    const assignedDevices = [];
    for (const shift of shifts) {
      assignedDevices.push({
        deviceId: shift.device_id,
        shiftStart: shift.start_time,
        shiftEnd: shift.end_time,
      });
    }

    const sessions = await HVNCSessionRepository.find({
      user_email: user.email,
    });

    const sessionData = sessions
      .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
      .slice(0, 10)
      .map((session) => ({
        id: session._id,
        deviceId: session.device_id,
        status: session.status,
        startedAt: session.started_at,
        endedAt: session.ended_at,
      }));

    const activities = await HVNCActivityLogRepository.find({
      user_email: user.email,
    });

    const activityData = activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 15)
      .map((activity) => ({
        id: activity._id,
        type: activity.event_type,
        message: activity.description || activity.event_type.replace(/_/g, " "),
        time: activity.timestamp,
        details: activity.metadata,
      }));

    return {
      id: user._id,
      userName: user.full_name,
      email: user.email,
      role: user.role || "user",
      status: user.is_locked
        ? "Locked"
        : user.is_active
          ? "Active"
          : "Inactive",
      permissions: user.permissions || [],
      profile: {
        fullName: user.full_name,
        phone: user.phone_number,
        timezone: user.profile?.timezone || "UTC",
        country: user.profile?.country,
        joinedDate: user.created_at,
        lastLogin: user.last_login,
      },
      assignedDevices,
      recentSessions: sessionData,
      activityLog: activityData,
    };
  }

  /**
   * Create a new user
   * @param {Object} data - User data
   * @returns {Promise<Object>} Created user
   */
  async createUser(data) {
    const {
      fullName,
      email,
      password,
      role,
      permissions,
      phone,
      timezone,
      country,
    } = data;

    if (!fullName || !email || !password) {
      throw { status: 400, message: "Required fields missing" };
    }

    const existingUser = await HVNCUserRepository.findByEmail(
      email.toLowerCase(),
    );
    if (existingUser) {
      throw { status: 409, message: "User already exists" };
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await HVNCUserRepository.create({
      full_name: fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || "user",
      permissions: permissions || [],
      phone_number: phone,
      profile: {
        timezone: timezone || "UTC",
        country: country,
      },
      is_active: true,
      is_locked: false,
      last_password_change: new Date(),
    });

    // Log user creation
    try {
      await HVNCActivityLogRepository.create({
        user_email: user.email,
        event_type: "user_created",
        description: `User created: ${user.full_name}`,
        context: {
          role: user.role,
          permissions: user.permissions,
        },
      });
    } catch (err) {
      // Logging error
    }

    return this._enrichUserData(user);
  }

  /**
   * Update user
   * @param {string} userId - User ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated user
   */
  async updateUser(userId, data) {
    const user = await HVNCUserRepository.findById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    const {
      fullName,
      email,
      role,
      permissions,
      phone,
      timezone,
      country,
      isActive,
      isLocked,
    } = data;

    const originalEmail = user.email;

    if (fullName) user.full_name = fullName;
    if (email && email !== originalEmail) {
      const existingUser = await HVNCUserRepository.findByEmail(
        email.toLowerCase(),
      );
      if (existingUser) {
        throw { status: 409, message: "Email already in use" };
      }
      user.email = email.toLowerCase();
    }
    if (role) user.role = role;
    if (permissions) user.permissions = permissions;
    if (phone !== undefined) user.phone_number = phone;
    if (isActive !== undefined) user.is_active = isActive;
    if (isLocked !== undefined) user.is_locked = isLocked;

    if (!user.profile) user.profile = {};
    if (timezone) user.profile.timezone = timezone;
    if (country) user.profile.country = country;

    await user.save();

    // If email changed, update shifts and sessions
    if (originalEmail !== user.email) {
      await HVNCShiftRepository.updateMany(
        { user_email: originalEmail },
        { user_email: user.email },
      );
      await HVNCSessionRepository.updateMany(
        { user_email: originalEmail },
        { user_email: user.email },
      );
    }

    // Log update
    try {
      await HVNCActivityLogRepository.create({
        user_email: user.email,
        event_type: "user_updated",
        description: `User updated: ${user.full_name}`,
        context: { changes: data },
      });
    } catch (err) {
      // Logging error
    }

    return this._enrichUserData(user);
  }

  /**
   * Delete user
   * @param {string} userId - User ID
   * @param {boolean} hardDelete - Whether to permanently delete
   * @returns {Promise<Object>} Success response
   */
  async deleteUser(userId, hardDelete = false) {
    const user = await HVNCUserRepository.findById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    if (hardDelete === true) {
      // Permanent delete - remove all related data
      await HVNCShiftRepository.deleteMany({ user_email: user.email });
      await HVNCSessionRepository.deleteMany({ user_email: user.email });
      await HVNCActivityLogRepository.deleteMany({ user_email: user.email });
      await HVNCUserRepository.deleteById(userId);

      try {
        await HVNCActivityLogRepository.create({
          user_email: user.email,
          event_type: "user_deleted_permanently",
          description: `User permanently deleted: ${user.full_name}`,
        });
      } catch (err) {
        // Logging error
      }

      return { success: true, message: "User deleted permanently" };
    } else {
      // Soft delete - deactivate user
      user.is_active = false;
      await user.save();

      try {
        await HVNCActivityLogRepository.create({
          user_email: user.email,
          event_type: "user_deactivated",
          description: `User deactivated: ${user.full_name}`,
        });
      } catch (err) {
        // Logging error
      }

      return { success: true, message: "User deactivated successfully" };
    }
  }

  /**
   * Reset user password
   * @param {string} userId - User ID
   * @param {Object} data - Reset data
   * @returns {Promise<Object>} Reset result
   */
  async resetUserPassword(userId, data = {}) {
    const user = await HVNCUserRepository.findById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    const { newPassword, sendEmail = true } = data;
    let password = newPassword;

    if (!password) {
      password = crypto.randomBytes(8).toString("hex");
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    user.password = hashedPassword;
    user.last_password_change = new Date();
    await user.save();

    // Log password reset
    try {
      await HVNCActivityLogRepository.create({
        user_email: user.email,
        event_type: "password_reset",
        description: `Password reset for user: ${user.full_name}`,
        context: { auto_generated: !newPassword },
      });
    } catch (err) {
      // Logging error
    }

    return {
      success: true,
      message: "Password reset successfully",
      temporaryPassword: newPassword ? undefined : password,
    };
  }

  /**
   * Unlock user account
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Success response
   */
  async unlockUser(userId) {
    const user = await HVNCUserRepository.findById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    if (!user.is_locked) {
      throw { status: 400, message: "User is not locked" };
    }

    user.is_locked = false;
    user.failed_login_attempts = 0;
    await user.save();

    // Log unlock
    try {
      await HVNCActivityLogRepository.create({
        user_email: user.email,
        event_type: "user_unlocked",
        description: `User account unlocked: ${user.full_name}`,
      });
    } catch (err) {
      // Logging error
    }

    return { success: true, message: "User unlocked successfully" };
  }

  // ===== Helper Methods =====

  async _enrichUserData(user) {
    try {
      const shifts = await HVNCShiftRepository.find({
        user_email: user.email,
        status: "active",
      });

      return {
        id: user._id,
        userName: user.full_name,
        email: user.email,
        role: user.role || "user",
        status: user.is_locked
          ? "Locked"
          : user.is_active
            ? "Active"
            : "Inactive",
        activeShifts: shifts.length,
        joinedDate: user.created_at,
        lastLogin: user.last_login,
        permissions: user.permissions || [],
      };
    } catch (err) {
      return {
        id: user._id,
        userName: user.full_name,
        email: user.email,
        role: user.role || "user",
        status: "Unknown",
      };
    }
  }
}

module.exports = new AdminUserManagementService();
