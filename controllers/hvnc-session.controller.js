const HVNCSession = require('../models/hvnc-session.model');
const HVNCDevice = require('../models/hvnc-device.model');
const HVNCUser = require('../models/hvnc-user.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');
const HVNCCommand = require('../models/hvnc-command.model');
const emailService = require('../services/hvnc-email.service');

/**
 * Start user session
 * POST /api/sessions/start
 */
const startSession = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const device = req.device; // From device auth middleware
    const {
      session_id,
      user_email,
      access_code,
      ip_address,
      started_at
    } = req.body;

    // Validate required fields
    if (!session_id || !user_email || !access_code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'session_id, user_email, and access_code are required'
        }
      });
    }

    // Check if user exists and is active
    const user = await HVNCUser.findByEmail(user_email);
    if (!user || user.is_account_locked) {
      await HVNCActivityLog.logSecurityEvent('session_start_failed', {
        reason: user ? 'account_locked' : 'user_not_found',
        user_email,
        device_id: device.device_id,
        session_id
      }, {
        ip_address: ip_address || req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'medium'
      });

      return res.status(401).json({
        success: false,
        error: {
          code: user ? 'ACCOUNT_LOCKED' : 'USER_NOT_FOUND',
          message: user ? 'User account is locked' : 'User not found or inactive'
        }
      });
    }

    // Check if session already exists
    const existingSession = await HVNCSession.findOne({ session_id });
    if (existingSession) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'SESSION_EXISTS',
          message: 'Session already exists'
        }
      });
    }

    // Create new session
    const session = new HVNCSession({
      session_id,
      device_id: device.device_id,
      user_email: user_email.toLowerCase(),
      started_at: started_at ? new Date(started_at) : new Date(),
      ip_address: ip_address || req.ip,
      status: 'active'
    });

    await session.save();

    // Update device status
    device.status = 'online';
    device.last_seen = new Date();
    await device.save();

    // Log session start
    await HVNCActivityLog.logSessionEvent(session_id, 'session_started', {
      user_email,
      device_id: device.device_id,
      device_name: device.pc_name,
      ip_address: ip_address || req.ip
    }, {
      user_email,
      device_id: device.device_id,
      ip_address: ip_address || req.ip,
      user_agent: req.headers['user-agent'],
      status: 'success',
      duration_ms: Date.now() - startTime
    });

    // Send session started notification (optional)
    if (user.preferences?.notify_session_start) {
      try {
        await emailService.sendSessionStartedNotification(user, device, session);
      } catch (emailError) {
        console.warn('Failed to send session started notification:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      session: {
        session_id: session.session_id,
        max_duration_hours: session.settings?.max_duration_hours || 8,
        idle_timeout_minutes: session.settings?.idle_timeout_minutes || 30,
        started_at: session.started_at
      }
    });

  } catch (error) {
    console.error('Start session error:', error);
    
    await HVNCActivityLog.logSessionEvent(req.body.session_id, 'session_start_failed', {
      user_email: req.body.user_email,
      device_id: req.device?.device_id,
      error: error.message
    }, {
      user_email: req.body.user_email,
      device_id: req.device?.device_id,
      ip_address: req.body.ip_address || req.ip,
      status: 'failure',
      error_message: error.message,
      duration_ms: Date.now() - startTime
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'SESSION_START_ERROR',
        message: 'Failed to start session'
      }
    });
  }
};

/**
 * End user session
 * POST /api/sessions/end
 */
const endSession = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const {
      session_id,
      ended_at,
      duration_minutes,
      reason = 'user_logout'
    } = req.body;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SESSION_ID',
          message: 'session_id is required'
        }
      });
    }

    // Find the session
    const session = await HVNCSession.findOne({ session_id });
    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        }
      });
    }

    if (session.status === 'ended') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SESSION_ALREADY_ENDED',
          message: 'Session already ended'
        }
      });
    }

    // End the session
    await session.endSession(reason);

    // Update override duration if provided
    if (duration_minutes) {
      session.duration_minutes = duration_minutes;
      await session.save();
    }

    // Cancel any pending commands for this session
    await HVNCCommand.updateMany(
      {
        session_id,
        status: { $in: ['pending', 'sent', 'acknowledged', 'executing'] }
      },
      {
        status: 'cancelled',
        completed_at: new Date(),
        error_message: `Session ended: ${reason}`,
        error_code: 'SESSION_ENDED'
      }
    );

    // Get user and device for notifications
    const user = await HVNCUser.findOne({ email: session.user_email });
    const device = await HVNCDevice.findByDeviceId(session.device_id);

    // Log session end
    await HVNCActivityLog.logSessionEvent(session_id, 'session_ended', {
      user_email: session.user_email,
      device_id: session.device_id,
      duration_minutes: session.duration_minutes,
      end_reason: reason,
      commands_executed: session.commands_executed
    }, {
      user_email: session.user_email,
      device_id: session.device_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      status: 'success',
      duration_ms: Date.now() - startTime
    });

    // Send session ended notification (optional)
    if (user?.preferences?.notify_session_end) {
      try {
        await emailService.sendSessionEndedNotification(user, device, session);
      } catch (emailError) {
        console.warn('Failed to send session ended notification:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      session: {
        session_id: session.session_id,
        ended_at: session.ended_at,
        duration_minutes: session.duration_minutes,
        end_reason: session.end_reason
      }
    });

  } catch (error) {
    console.error('End session error:', error);
    
    await HVNCActivityLog.logSessionEvent(req.body.session_id, 'session_end_failed', {
      reason: req.body.reason,
      error: error.message
    }, {
      ip_address: req.ip,
      status: 'failure',
      error_message: error.message,
      duration_ms: Date.now() - startTime
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'SESSION_END_ERROR',
        message: 'Failed to end session'
      }
    });
  }
};

/**
 * Update session activity
 * POST /api/sessions/activity
 */
const updateActivity = async (req, res) => {
  try {
    const {
      session_id,
      last_activity,
      activity_type = 'general'
    } = req.body;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SESSION_ID',
          message: 'session_id is required'
        }
      });
    }

    // Find the session
    const session = await HVNCSession.findOne({ 
      session_id,
      status: { $in: ['active', 'idle'] }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Active session not found'
        }
      });
    }

    // Check if session has timed out
    if (session.is_timed_out) {
      await session.endSession('idle_timeout');
      
      return res.status(410).json({
        success: false,
        error: {
          code: 'SESSION_TIMEOUT',
          message: 'Session has timed out'
        }
      });
    }

    // Update activity
    await session.updateActivity(activity_type);

    // Additional activity tracking based on type
    if (last_activity) {
      session.last_activity = new Date(last_activity);
      await session.save();
    }

    res.status(200).json({
      success: true,
      session: {
        session_id: session.session_id,
        last_activity: session.last_activity,
        status: session.status,
        current_duration_minutes: session.current_duration_minutes
      }
    });

  } catch (error) {
    console.error('Update activity error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ACTIVITY_UPDATE_ERROR',
        message: 'Failed to update session activity'
      }
    });
  }
};

/**
 * Get session details
 * GET /api/sessions/{session_id}
 */
const getSession = async (req, res) => {
  try {
    const { session_id } = req.params;

    const session = await HVNCSession.findOne({ session_id })
      .populate('user_email', 'email full_name role')
      .populate('device_id', 'device_id pc_name hostname status');

    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        }
      });
    }

    // Get active commands for this session
    const activeCommands = await HVNCCommand.find({
      session_id,
      status: { $in: ['pending', 'sent', 'acknowledged', 'executing'] }
    }).sort({ createdAt: -1 });

    const response = {
      success: true,
      session: {
        session_id: session.session_id,
        user_email: session.user_email,
        device_id: session.device_id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        duration_minutes: session.duration_minutes || session.current_duration_minutes,
        last_activity: session.last_activity,
        status: session.status,
        end_reason: session.end_reason,
        ip_address: session.ip_address,
        is_active: session.is_active,
        is_timed_out: session.is_timed_out,
        commands_executed: session.commands_executed,
        chrome_interactions: session.chrome_interactions,
        keyboard_events: session.keyboard_events,
        mouse_events: session.mouse_events,
        hubstaff_session: session.hubstaff_session,
        settings: session.settings,
        connection_quality: session.connection_quality
      },
      active_commands: activeCommands.map(cmd => ({
        id: cmd.command_id,
        type: cmd.type,
        action: cmd.action,
        status: cmd.status,
        created_at: cmd.createdAt,
        expires_at: cmd.expires_at
      }))
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_SESSION_ERROR',
        message: 'Failed to retrieve session'
      }
    });
  }
};

/**
 * Get active sessions
 * GET /api/sessions/active
 */
const getActiveSessions = async (req, res) => {
  try {
    const { device_id, user_email, limit = 50 } = req.query;

    let query = {
      status: { $in: ['active', 'idle'] },
      ended_at: { $exists: false }
    };

    if (device_id) query.device_id = device_id;
    if (user_email) query.user_email = user_email.toLowerCase();

    const sessions = await HVNCSession.find(query)
      .sort({ started_at: -1 })
      .limit(parseInt(limit))
      .populate('user_email', 'email full_name role')
      .populate('device_id', 'device_id pc_name hostname status');

    // Include session statistics
    const stats = {
      total_active: sessions.length,
      by_status: {},
      by_device: {},
      total_duration_minutes: 0
    };

    sessions.forEach(session => {
      // Count by status
      stats.by_status[session.status] = (stats.by_status[session.status] || 0) + 1;
      
      // Count by device
      const deviceId = session.device_id?.device_id || 'unknown';
      stats.by_device[deviceId] = (stats.by_device[deviceId] || 0) + 1;
      
      // Sum duration
      stats.total_duration_minutes += session.current_duration_minutes || 0;
    });

    res.status(200).json({
      success: true,
      sessions: sessions.map(session => ({
        session_id: session.session_id,
        user_email: session.user_email,
        device_id: session.device_id,
        started_at: session.started_at,
        last_activity: session.last_activity,
        status: session.status,
        current_duration_minutes: session.current_duration_minutes,
        is_timed_out: session.is_timed_out,
        commands_executed: session.commands_executed,
        ip_address: session.ip_address
      })),
      stats
    });

  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_SESSIONS_ERROR',
        message: 'Failed to retrieve active sessions'
      }
    });
  }
};

/**
 * Force end session (Admin only)
 * POST /api/sessions/{session_id}/force-end
 */
const forceEndSession = async (req, res) => {
  try {
    const { session_id } = req.params;
    const { reason = 'admin_disconnect', notify_user = true } = req.body;
    const adminUser = req.admin;

    const session = await HVNCSession.findOne({ session_id });
    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        }
      });
    }

    if (session.status === 'ended') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SESSION_ALREADY_ENDED',
          message: 'Session already ended'
        }
      });
    }

    // End the session
    await session.endSession(reason);

    // Cancel pending commands
    await HVNCCommand.updateMany(
      {
        session_id,
        status: { $in: ['pending', 'sent', 'acknowledged', 'executing'] }
      },
      {
        status: 'cancelled',
        completed_at: new Date(),
        error_message: `Session force-ended by admin: ${reason}`,
        error_code: 'ADMIN_FORCE_END'
      }
    );

    // Log admin action
    await HVNCActivityLog.logUserEvent(adminUser.email, 'admin_action', {
      action: 'force_end_session',
      session_id: session.session_id,
      target_user: session.user_email,
      device_id: session.device_id,
      reason,
      original_duration: session.current_duration_minutes
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      status: 'success'
    });

    // Notify user if requested
    if (notify_user) {
      try {
        const user = await HVNCUser.findOne({ email: session.user_email });
        const device = await HVNCDevice.findByDeviceId(session.device_id);
        
        if (user) {
          await emailService.sendSecurityAlert(user, device, {
            type: 'Session Force-Ended',
            message: `Your session was terminated by an administrator. Reason: ${reason}`,
            severity: 'medium',
            timestamp: new Date(),
            ip_address: req.ip
          });
        }
      } catch (emailError) {
        console.warn('Failed to send force-end notification:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Session force-ended successfully',
      session: {
        session_id: session.session_id,
        ended_at: session.ended_at,
        duration_minutes: session.duration_minutes,
        end_reason: session.end_reason
      }
    });

  } catch (error) {
    console.error('Force end session error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FORCE_END_ERROR',
        message: 'Failed to force end session'
      }
    });
  }
};

/**
 * Cleanup timed-out sessions
 * POST /api/sessions/cleanup
 */
const cleanupSessions = async (req, res) => {
  try {
    const timedOutSessions = await HVNCSession.endTimedOutSessions();
    
    // Log cleanup activity
    await HVNCActivityLog.logUserEvent('system', 'system_maintenance', {
      action: 'session_cleanup',
      sessions_cleaned: timedOutSessions.length,
      session_ids: timedOutSessions.map(s => s.session_id)
    }, {
      status: 'success',
      ip_address: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Session cleanup completed',
      sessions_cleaned: timedOutSessions.length,
      cleaned_sessions: timedOutSessions.map(session => ({
        session_id: session.session_id,
        user_email: session.user_email,
        device_id: session.device_id,
        duration_minutes: session.duration_minutes
      }))
    });

  } catch (error) {
    console.error('Session cleanup error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CLEANUP_ERROR',
        message: 'Session cleanup failed'
      }
    });
  }
};

module.exports = {
  startSession,
  endSession,
  updateActivity,
  getSession,
  getActiveSessions,
  forceEndSession,
  cleanupSessions
};