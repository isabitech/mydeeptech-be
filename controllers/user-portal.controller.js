const HVNCUser = require('../models/hvnc-user.model');
const HVNCDevice = require('../models/hvnc-device.model');
const HVNCShift = require('../models/hvnc-shift.model');
const HVNCSession = require('../models/hvnc-session.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');

/**
 * GET /api/hvnc/user/dashboard
 * Get user dashboard overview
 */
const getUserDashboard = async (req, res) => {
  try {
    const userEmail = req.user.email;

    // Get assigned devices with status
    const activeShifts = await HVNCShift.find({
      user_email: userEmail,
      status: 'active',
      $or: [
        { end_date: null },
        { end_date: { $gte: new Date() } }
      ]
    }).lean();

    const assignedDevices = [];
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    for (const shift of activeShifts) {
      const device = await HVNCDevice.findOne({ device_id: shift.device_id }).lean();
      if (device) {
        const isOnline = device.last_seen > fiveMinutesAgo && device.status === 'online';
        
        assignedDevices.push({
          id: device._id,
          name: device.pc_name,
          deviceId: device.device_id,
          status: isOnline ? 'Online' : 'Offline',
          lastSeen: device.last_seen,
          shiftTime: `${shift.start_time} - ${shift.end_time}`,
          shiftId: shift._id
        });
      }
    }

    // Count active sessions
    const activeSessions = await HVNCSession.countDocuments({
      user_email: userEmail,
      status: { $in: ['active', 'idle'] }
    });

    // Get recent session history (last 10)
    const recentSessions = await HVNCSession.find({
      user_email: userEmail
    })
    .sort({ started_at: -1 })
    .limit(10)
    .lean();

    const sessionHistory = await Promise.all(recentSessions.map(async (session) => {
      const device = await HVNCDevice.findOne({ device_id: session.device_id }).select('pc_name').lean();
      
      const duration = session.ended_at ? 
        calculateSessionDuration(session.started_at, session.ended_at) : 
        'In Progress';

      return {
        id: session._id,
        deviceName: device?.pc_name || 'Unknown Device',
        startTime: session.started_at,
        endTime: session.ended_at,
        duration: duration,
        status: session.status
      };
    }));

    // Get today's activity summary
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySessions = await HVNCSession.find({
      user_email: userEmail,
      started_at: { $gte: todayStart }
    }).lean();

    let totalTimeToday = 0;
    for (const session of todaySessions) {
      if (session.ended_at) {
        totalTimeToday += (new Date(session.ended_at) - new Date(session.started_at));
      } else if (session.status === 'active') {
        totalTimeToday += (Date.now() - new Date(session.started_at));
      }
    }

    const todayHours = Math.floor(totalTimeToday / 3600000);
    const todayMinutes = Math.floor((totalTimeToday % 3600000) / 60000);

    res.json({
      user: {
        name: req.user.full_name,
        email: req.user.email
      },
      stats: {
        assignedDevices: assignedDevices.length,
        activeSessions: activeSessions,
        todayTime: `${todayHours}h ${todayMinutes}m`,
        totalDevices: assignedDevices.length
      },
      assignedDevices: assignedDevices,
      sessionHistory: sessionHistory
    });

  } catch (error) {
    console.error('Get user dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
};

/**
 * GET /api/hvnc/user/devices
 * Get user's assigned devices
 */
const getUserDevices = async (req, res) => {
  try {
    const userEmail = req.user.email;

    // Get active shifts for this user
    const activeShifts = await HVNCShift.find({
      user_email: userEmail,
      status: 'active',
      $or: [
        { end_date: null },
        { end_date: { $gte: new Date() } }
      ]
    }).lean();

    const devices = [];
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    for (const shift of activeShifts) {
      const device = await HVNCDevice.findOne({ device_id: shift.device_id }).lean();
      if (device) {
        const isOnline = device.last_seen > fiveMinutesAgo && device.status === 'online';
        
        // Check if user has active session on this device
        const activeSession = await HVNCSession.findOne({
          user_email: userEmail,
          device_id: device.device_id,
          status: { $in: ['active', 'idle'] }
        });

        let lastSeen = 'Never';
        if (device.last_seen) {
          const lastSeenMs = Date.now() - device.last_seen.getTime();
          if (lastSeenMs < 60000) {
            lastSeen = 'Just now';
          } else if (lastSeenMs < 3600000) {
            const mins = Math.floor(lastSeenMs / 60000);
            lastSeen = `${mins} min${mins > 1 ? 's' : ''} ago`;
          } else if (lastSeenMs < 86400000) {
            const hours = Math.floor(lastSeenMs / 3600000);
            lastSeen = `${hours} hour${hours > 1 ? 's' : ''} ago`;
          } else {
            const days = Math.floor(lastSeenMs / 86400000);
            lastSeen = `${days} day${days > 1 ? 's' : ''} ago`;
          }
        }

        devices.push({
          id: device._id,
          name: device.pc_name,
          deviceId: device.device_id,
          status: isOnline ? 'Online' : 'Offline',
          lastSeen: lastSeen,
          hasActiveSession: !!activeSession,
          sessionId: activeSession?._id,
          shiftTime: `${shift.start_time} - ${shift.end_time}`,
          shiftDays: shift.days_of_week,
          isRecurring: shift.is_recurring
        });
      }
    }

    res.json({
      devices: devices
    });

  } catch (error) {
    console.error('Get user devices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assigned devices'
    });
  }
};

/**
 * GET /api/hvnc/user/sessions
 * Get user's session history
 */
const getUserSessions = async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { status, device_id, limit = 50 } = req.query;

    // Build query
    let query = { user_email: userEmail };
    
    if (status) {
      query.status = status;
    }
    
    if (device_id) {
      query.device_id = device_id;
    }

    const sessions = await HVNCSession.find(query)
      .sort({ started_at: -1 })
      .limit(parseInt(limit))
      .lean();

    const sessionData = await Promise.all(sessions.map(async (session) => {
      const device = await HVNCDevice.findOne({ device_id: session.device_id }).select('pc_name').lean();
      
      const duration = session.ended_at ? 
        calculateSessionDuration(session.started_at, session.ended_at) : 
        calculateSessionDuration(session.started_at, new Date());

      let sessionStatus = session.status;
      if (session.status === 'active' || session.status === 'idle') {
        sessionStatus = 'Active';
      } else if (session.status === 'ended') {
        sessionStatus = 'Completed';
      } else if (session.status === 'terminated') {
        sessionStatus = 'Terminated';
      }

      return {
        id: session._id,
        deviceName: device?.pc_name || 'Unknown Device',
        deviceId: session.device_id,
        startTime: session.started_at,
        endTime: session.ended_at,
        duration: duration,
        status: sessionStatus,
        terminationReason: session.termination_reason
      };
    }));

    res.json({
      sessions: sessionData,
      total: sessionData.length
    });

  } catch (error) {
    console.error('Get user sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session history'
    });
  }
};

/**
 * POST /api/hvnc/user/sessions/start
 * Start a new session on assigned device
 */
const startUserSession = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const userEmail = req.user.email;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required'
      });
    }

    // Find device
    const device = await HVNCDevice.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    // Check if user has access to this device
    const hasShift = await HVNCShift.findOne({
      user_email: userEmail,
      device_id: device.device_id,
      status: 'active',
      $or: [
        { end_date: null },
        { end_date: { $gte: new Date() } }
      ]
    });

    if (!hasShift) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this device'
      });
    }

    // Check if user already has an active session on this device
    const existingSession = await HVNCSession.findOne({
      user_email: userEmail,
      device_id: device.device_id,
      status: { $in: ['active', 'idle'] }
    });

    if (existingSession) {
      return res.status(409).json({
        success: false,
        error: 'You already have an active session on this device'
      });
    }

    // Check if device is online
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isOnline = device.last_seen > fiveMinutesAgo && device.status === 'online';

    if (!isOnline) {
      return res.status(503).json({
        success: false,
        error: 'Device is currently offline. Please try again when the device is online.'
      });
    }

    // Create session
    const session = await HVNCSession.create({
      user_email: userEmail,
      device_id: device.device_id,
      started_at: new Date(),
      status: 'active',
      client_info: {
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      }
    });

    // Log session start
    await HVNCActivityLog.logUserEvent(userEmail, 'session_started', {
      session_id: session._id,
      device_id: device.device_id,
      device_name: device.pc_name
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({
      sessionId: session._id,
      deviceName: device.pc_name,
      deviceId: device.device_id,
      startTime: session.started_at,
      status: 'active',
      message: 'Session started successfully'
    });

  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start session'
    });
  }
};

/**
 * POST /api/hvnc/user/sessions/:sessionId/end
 * End an active session
 */
const endUserSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userEmail = req.user.email;

    const session = await HVNCSession.findOne({
      _id: sessionId,
      user_email: userEmail
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or access denied'
      });
    }

    if (session.status === 'ended' || session.status === 'terminated') {
      return res.status(400).json({
        success: false,
        error: 'Session is already ended'
      });
    }

    // End session
    const endTime = new Date();
    session.status = 'ended';
    session.ended_at = endTime;
    await session.save();

    // Calculate duration
    const duration = calculateSessionDuration(session.started_at, endTime);

    // Log session end
    await HVNCActivityLog.logUserEvent(userEmail, 'session_ended', {
      session_id: session._id,
      device_id: session.device_id,
      duration: duration
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({
      sessionId: session._id,
      endTime: endTime,
      duration: duration,
      status: 'ended',
      message: 'Session ended successfully'
    });

  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end session'
    });
  }
};

/**
 * GET /api/hvnc/user/profile
 * Get user profile information
 */
const getUserProfile = async (req, res) => {
  try {
    const user = await HVNCUser.findById(req.user._id).select('-password').lean();

    // Get user statistics
    const totalSessions = await HVNCSession.countDocuments({
      user_email: user.email
    });

    const activeSessions = await HVNCSession.countDocuments({
      user_email: user.email,
      status: { $in: ['active', 'idle'] }
    });

    const assignedDevicesCount = await HVNCShift.countDocuments({
      user_email: user.email,
      status: 'active',
      $or: [
        { end_date: null },
        { end_date: { $gte: new Date() } }
      ]
    });

    // Calculate total session time (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSessions = await HVNCSession.find({
      user_email: user.email,
      started_at: { $gte: thirtyDaysAgo },
      ended_at: { $exists: true }
    }).lean();

    let totalTime = 0;
    for (const session of recentSessions) {
      totalTime += (new Date(session.ended_at) - new Date(session.started_at));
    }

    const totalHours = Math.floor(totalTime / 3600000);
    const totalMinutes = Math.floor((totalTime % 3600000) / 60000);

    res.json({
      id: user._id,
      fullName: user.full_name,
      email: user.email,
      phoneNumber: user.phone_number,
      role: user.role,
      profile: {
        timezone: user.profile?.timezone || 'UTC',
        country: user.profile?.country,
        joinedDate: user.created_at,
        lastLogin: user.last_login
      },
      statistics: {
        totalSessions: totalSessions,
        activeSessions: activeSessions,
        assignedDevices: assignedDevicesCount,
        totalTimeThisMonth: `${totalHours}h ${totalMinutes}m`
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
};

/**
 * Helper function to calculate session duration
 */
function calculateSessionDuration(start, end) {
  const durationMs = new Date(end) - new Date(start);
  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

module.exports = {
  getUserDashboard,
  getUserDevices,
  getUserSessions,
  startUserSession,
  endUserSession,
  getUserProfile
};