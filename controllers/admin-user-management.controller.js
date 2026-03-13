const HVNCUser = require('../models/hvnc-user.model');
const HVNCShift = require('../models/hvnc-shift.model');
const HVNCDevice = require('../models/hvnc-device.model');
const HVNCSession = require('../models/hvnc-session.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

/**
 * GET /api/hvnc/admin/users
 * Fetch all users for user management
 */
const getAllUsers = async (req, res) => {
  try {
    const { 
      status, // active, locked, inactive 
      role,
      search 
    } = req.query;

    // Build query filter
    let query = {};
    
    if (status) {
      if (status === 'active') {
        query.is_locked = false;
        query.is_active = true;
      } else if (status === 'locked') {
        query.is_locked = true;
      } else if (status === 'inactive') {
        query.is_active = false;
      }
    }

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { full_name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await HVNCUser.find(query)
      .select('-password')
      .sort({ created_at: -1 })
      .lean();

    // Transform users with additional info
    const userData = await Promise.all(users.map(async (user) => {
      // Count active shifts
      const activeShifts = await HVNCShift.countDocuments({
        user_email: user.email,
        status: 'active',
        $or: [
          { end_date: null },
          { end_date: { $gte: new Date() } }
        ]
      });

      // Count active sessions
      const activeSessions = await HVNCSession.countDocuments({
        user_email: user.email,
        status: { $in: ['active', 'idle'] }
      });

      // Get last login time
      const lastLogin = user.last_login ? 
        formatLastSeen(user.last_login) : 'Never';

      // Calculate status
      let status = 'Active';
      if (user.is_locked) {
        status = 'Locked';
      } else if (!user.is_active) {
        status = 'Inactive';
      }

      return {
        id: user._id,
        userName: user.full_name,
        email: user.email,
        role: user.role || 'user',
        status: status,
        activeShifts: activeShifts,
        activeSessions: activeSessions,
        lastLogin: lastLogin,
        joinedDate: user.created_at,
        permissions: user.permissions || []
      };
    }));

    // Count totals
    const total = await HVNCUser.countDocuments();
    const activeCount = await HVNCUser.countDocuments({ 
      is_locked: false, 
      is_active: true 
    });
    const lockedCount = await HVNCUser.countDocuments({ is_locked: true });
    const inactiveCount = await HVNCUser.countDocuments({ is_active: false });

    res.json({
      total,
      activeCount,
      lockedCount,
      inactiveCount,
      users: userData
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
};

/**
 * GET /api/hvnc/admin/users/:userId
 * Get detailed user information
 */
const getUserDetail = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await HVNCUser.findById(userId)
      .select('-password')
      .lean();
      
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user's active shifts
    const shifts = await HVNCShift.find({
      user_email: user.email,
      status: 'active',
      $or: [
        { end_date: null },
        { end_date: { $gte: new Date() } }
      ]
    }).lean();

    // Get assigned devices
    const assignedDevices = [];
    for (const shift of shifts) {
      const device = await HVNCDevice.findOne({ device_id: shift.device_id })
        .select('_id pc_name device_id status last_seen')
        .lean();
      
      if (device) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const isOnline = device.last_seen > fiveMinutesAgo && device.status === 'online';
        
        assignedDevices.push({
          id: device._id,
          name: device.pc_name,
          deviceId: device.device_id,
          status: isOnline ? 'Online' : 'Offline',
          shiftId: shift._id,
          schedule: `${shift.start_time} - ${shift.end_time}`
        });
      }
    }

    // Get user's recent sessions
    const recentSessions = await HVNCSession.find({
      user_email: user.email
    })
    .sort({ started_at: -1 })
    .limit(10)
    .lean();

    const sessionData = await Promise.all(recentSessions.map(async (session) => {
      const device = await HVNCDevice.findOne({ device_id: session.device_id })
        .select('pc_name')
        .lean();

      const duration = session.ended_at ? 
        calculateDuration(session.started_at, session.ended_at) : 
        'In progress';

      return {
        id: session._id,
        device: device?.pc_name || 'Unknown',
        startTime: session.started_at,
        endTime: session.ended_at,
        duration: duration,
        status: session.status
      };
    }));

    // Get user activity logs
    const activities = await HVNCActivityLog.find({
      user_email: user.email
    })
    .sort({ timestamp: -1 })
    .limit(15)
    .lean();

    const activityData = activities.map(activity => ({
      id: activity._id,
      type: activity.event_type,
      message: activity.description || activity.event_type.replace(/_/g, ' '),
      time: activity.timestamp,
      details: activity.metadata
    }));

    res.json({
      id: user._id,
      userName: user.full_name,
      email: user.email,
      role: user.role || 'user',
      status: user.is_locked ? 'Locked' : (user.is_active ? 'Active' : 'Inactive'),
      permissions: user.permissions || [],
      profile: {
        fullName: user.full_name,
        phone: user.phone_number,
        timezone: user.profile?.timezone || 'UTC',
        country: user.profile?.country,
        joinedDate: user.created_at,
        lastLogin: user.last_login
      },
      assignedDevices: assignedDevices,
      recentSessions: sessionData,
      activityLog: activityData
    });

  } catch (error) {
    console.error('Get user detail error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user details'
    });
  }
};

/**
 * POST /api/hvnc/admin/users
 * Create a new user
 */
const createUser = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      role,
      permissions,
      phone,
      timezone,
      country
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Full name, email and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await HVNCUser.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await HVNCUser.create({
      full_name: fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || 'user',
      permissions: permissions || [],
      phone_number: phone,
      profile: {
        timezone: timezone || 'UTC',
        country: country
      },
      is_active: true,
      is_locked: false,
      last_password_change: new Date()
    });

    // Log user creation
    await HVNCActivityLog.logUserEvent(user.email, 'user_created', {
      created_by: req.admin?.email || 'admin',
      role: user.role,
      permissions: user.permissions
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({
      id: user._id,
      userName: user.full_name,
      email: user.email,
      role: user.role,
      status: 'Active',
      activeShifts: 0,
      activeSessions: 0,
      lastLogin: 'Never',
      joinedDate: user.created_at,
      permissions: user.permissions
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
};

/**
 * PUT /api/hvnc/admin/users/:userId
 * Update user details
 */
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      fullName,
      email,
      role,
      permissions,
      phone,
      timezone,
      country,
      isActive,
      isLocked
    } = req.body;

    const user = await HVNCUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const originalEmail = user.email;

    // Update user fields
    if (fullName) user.full_name = fullName;
    if (email) {
      // Check if new email is already in use
      const emailExists = await HVNCUser.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: userId }
      });
      if (emailExists) {
        return res.status(409).json({
          success: false,
          error: 'Email already in use'
        });
      }
      user.email = email.toLowerCase();
    }
    if (role) user.role = role;
    if (permissions) user.permissions = permissions;
    if (phone !== undefined) user.phone_number = phone;
    if (isActive !== undefined) user.is_active = isActive;
    if (isLocked !== undefined) user.is_locked = isLocked;

    // Update profile
    if (!user.profile) user.profile = {};
    if (timezone) user.profile.timezone = timezone;
    if (country) user.profile.country = country;

    await user.save();

    // If email changed, update shifts and sessions
    if (originalEmail !== user.email) {
      await HVNCShift.updateMany(
        { user_email: originalEmail },
        { user_email: user.email }
      );
      
      await HVNCSession.updateMany(
        { user_email: originalEmail },
        { user_email: user.email }
      );
    }

    // Log user update
    await HVNCActivityLog.logUserEvent(user.email, 'user_updated', {
      updated_by: req.admin?.email || 'admin',
      changes: req.body
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    // Return updated user detail
    const updatedUser = await getUserDetailById(userId);
    res.json(updatedUser);

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
};

/**
 * DELETE /api/hvnc/admin/users/:userId
 * Delete a user (soft delete by deactivation)
 */
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { hardDelete = false } = req.query;

    const user = await HVNCUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (hardDelete === 'true') {
      // Hard delete - remove completely
      // End active sessions
      await HVNCSession.updateMany(
        { user_email: user.email, status: { $in: ['active', 'idle'] } },
        { 
          status: 'terminated',
          ended_at: new Date(),
          termination_reason: 'user_deleted'
        }
      );

      // Remove shifts
      await HVNCShift.deleteMany({ user_email: user.email });

      // Log user deletion
      await HVNCActivityLog.logUserEvent(user.email, 'user_deleted', {
        deleted_by: req.admin?.email || 'admin',
        deletion_type: 'hard'
      }, {
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      // Delete user
      await HVNCUser.findByIdAndDelete(userId);
    } else {
      // Soft delete - deactivate
      user.is_active = false;
      user.is_locked = true;
      await user.save();

      // End active sessions
      await HVNCSession.updateMany(
        { user_email: user.email, status: { $in: ['active', 'idle'] } },
        { 
          status: 'terminated',
          ended_at: new Date(),
          termination_reason: 'user_deactivated'
        }
      );

      // Deactivate shifts
      await HVNCShift.updateMany(
        { user_email: user.email },
        { status: 'inactive' }
      );

      // Log user deactivation
      await HVNCActivityLog.logUserEvent(user.email, 'user_deactivated', {
        deactivated_by: req.admin?.email || 'admin',
        deletion_type: 'soft'
      }, {
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
    }

    res.json({
      success: true,
      message: hardDelete === 'true' ? 'User deleted permanently' : 'User deactivated successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
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
    const { newPassword, sendEmail = true } = req.body;

    const user = await HVNCUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let password = newPassword;
    if (!password) {
      // Generate random password if none provided
      password = crypto.randomBytes(8).toString('hex');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update user password
    user.password = hashedPassword;
    user.last_password_change = new Date();
    await user.save();

    // Log password reset
    await HVNCActivityLog.logUserEvent(user.email, 'password_reset', {
      reset_by: req.admin?.email || 'admin',
      auto_generated: !newPassword
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    // Send email notification (if email service is configured)
    if (sendEmail) {
      // TODO: Implement email notification for password reset
      // This would use the existing email service to send the new password
    }

    res.json({
      success: true,
      message: 'Password reset successfully',
      temporaryPassword: newPassword ? undefined : password
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
};

/**
 * POST /api/hvnc/admin/users/:userId/unlock
 * Unlock a locked user account
 */
const unlockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await HVNCUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.is_locked = false;
    user.failed_login_attempts = 0;
    await user.save();

    // Log account unlock
    await HVNCActivityLog.logUserEvent(user.email, 'account_unlocked', {
      unlocked_by: req.admin?.email || 'admin'
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'User account unlocked successfully'
    });

  } catch (error) {
    console.error('Unlock user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlock user'
    });
  }
};

/**
 * Helper functions
 */
function formatLastSeen(timestamp) {
  const lastSeenMs = Date.now() - new Date(timestamp).getTime();
  if (lastSeenMs < 60000) {
    return 'Just now';
  } else if (lastSeenMs < 3600000) {
    const mins = Math.floor(lastSeenMs / 60000);
    return `${mins} min${mins > 1 ? 's' : ''} ago`;
  } else if (lastSeenMs < 86400000) {
    const hours = Math.floor(lastSeenMs / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(lastSeenMs / 86400000);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}

function calculateDuration(start, end) {
  const durationMs = new Date(end) - new Date(start);
  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

async function getUserDetailById(userId) {
  // Helper to return user detail in expected format
  // Implementation similar to getUserDetail but returns data directly
  const user = await HVNCUser.findById(userId).select('-password').lean();
  return { 
    id: userId, 
    userName: user.full_name, 
    email: user.email,
    // ... add other fields as needed
  };
}

module.exports = {
  getAllUsers,
  getUserDetail,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  unlockUser
};