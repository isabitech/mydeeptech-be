const HVNCSessionService = require('../services/hvnc-session.service');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');

/**
 * Start user session
 * POST /api/sessions/start
 */
const startSession = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { session_id, user_email, access_code } = req.body;

    if (!session_id || !user_email || !access_code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'session_id, user_email, and access_code are required'
        }
      });
    }

    const result = await HVNCSessionService.startSession(req.device, req.body, {
      userAgent: req.headers['user-agent'],
      originalIp: req.ip
    });

    res.status(200).json({
      success: true,
      session: result
    });

  } catch (error) {
    console.error('Start session error:', error);
    if (error.status && error.code) {
      return res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

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
    if (!req.body.session_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SESSION_ID',
          message: 'session_id is required'
        }
      });
    }

    const result = await HVNCSessionService.endSession(req.body.session_id, req.body, {
      userAgent: req.headers['user-agent'],
      originalIp: req.body.ip_address || req.ip
    });

    res.status(200).json({
      success: true,
      session: result
    });

  } catch (error) {
    console.error('End session error:', error);
    if (error.status && error.code) {
      return res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

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
    if (!req.body.session_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SESSION_ID',
          message: 'session_id is required'
        }
      });
    }

    const result = await HVNCSessionService.updateActivity(req.body.session_id, req.body);

    res.status(200).json({
      success: true,
      session: result
    });

  } catch (error) {
    console.error('Update activity error:', error);
    if (error.status && error.code) {
      return res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

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
const getSessionDetails = async (req, res) => {
  try {
    const result = await HVNCSessionService.getSessionDetails(req.params.session_id);
    res.status(200).json({
      success: true,
      ...result
    });

  } catch (error) {
    if (error.status && error.code) {
      return res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

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
    const result = await HVNCSessionService.getActiveSessions(req.query);
    res.status(200).json({
      success: true,
      ...result
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
    const result = await HVNCSessionService.forceEndSession(req.params.session_id, req.body, {
      adminUser: req.admin,
      userAgent: req.headers['user-agent'],
      originalIp: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Session force-ended successfully',
      session: result
    });

  } catch (error) {
    console.error('Force end session error:', error);
    if (error.status && error.code) {
      return res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

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
    const result = await HVNCSessionService.cleanupSessions({
      originalIp: req.ip
    });

    res.status(200).json({
      success: true,
      ...result
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
  getSessionDetails,
  getActiveSessions,
  forceEndSession,
  cleanupSessions
};