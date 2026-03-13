const HVNCAccessCode = require('../models/hvnc-access-code.model');
const DTUser = require('../models/dtUser.model');
const HVNCDevice = require('../models/hvnc-device.model');
const HVNCShift = require('../models/hvnc-shift.model');
const HVNCSession = require('../models/hvnc-session.model');
const HVNCCommand = require('../models/hvnc-command.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');
const emailService = require('../services/hvnc-email.service');
const hvncVerificationStore = require('../utils/hvncVerificationStore');
const { sendCommandToDevice } = require('../services/hvnc-websocket.service');

/**
 * Validate user access code
 * POST /api/codes/validate
 */
const validateCode = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { email, code, device_id, ip_address, request_time } = req.body;

    // Validate required fields
    if (!email || !code || !device_id) {
      await HVNCActivityLog.logSecurityEvent('authentication_failed', {
        reason: 'missing_credentials',
        email,
        device_id,
        provided_fields: { email: !!email, code: !!code, device_id: !!device_id }
      }, {
        ip_address: ip_address || req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'medium'
      });

      return res.status(400).json({
        valid: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email, code, and device_id are required'
        }
      });
    }

    // Find the user
    const user = await DTUser.findOne({ email: email.toLowerCase() });
    if (!user) {
      await HVNCActivityLog.logSecurityEvent('authentication_failed', {
        reason: 'user_not_found',
        email,
        device_id
      }, {
        ip_address: ip_address || req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'medium'
      });

      return res.status(401).json({
        valid: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: user ? 'User account is locked' : 'Invalid credentials'
        }
      });
    }

    // Validate the access code using Redis-based verification
    const validationResult = await hvncVerificationStore.validateCode(email, device_id, code);
    console.log('🔍 Redis validation result:', validationResult);
    
    if (!validationResult.valid) {
      await user.recordFailedLogin();
      
      await HVNCActivityLog.logSecurityEvent('authentication_failed', {
        reason: validationResult.reason,
        email,
        device_id,
        message: validationResult.message,
        attempts_remaining: validationResult.attemptsRemaining
      }, {
        ip_address: ip_address || req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'high'
      });

      return res.status(401).json({
        valid: false,
        error: {
          code: validationResult.reason,
          message: validationResult.message,
          attempts_remaining: validationResult.attemptsRemaining
        }
      });
    }

    // Resolve device_id (support both device IDs and device names)
    const device = await HVNCDevice.findByDeviceId(device_id);
    if (!device) {
      await HVNCActivityLog.logSecurityEvent('authentication_failed', {
        reason: 'device_not_found',
        email,
        device_id
      }, {
        ip_address: ip_address || req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'medium'
      });

      return res.status(401).json({
        valid: false,
        error: {
          code: 'DEVICE_NOT_FOUND',
          message: 'Device not found'
        }
      });
    }

    // Use the resolved device_id for all subsequent operations
    const resolvedDeviceId = device.device_id;

    // Check if user has valid shift for this device at this time
    const now = new Date(request_time || Date.now());
    const isAllowed = await HVNCShift.isUserAllowedAccess(email, resolvedDeviceId, now);
    
    if (!isAllowed) {
      await HVNCActivityLog.logSecurityEvent('authentication_failed', {
        reason: 'outside_shift_hours',
        email,
        device_id: resolvedDeviceId,
        attempted_time: now
      }, {
        ip_address: ip_address || req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'low'
      });

      return res.status(401).json({
        valid: false,
        error: {
          code: 'OUTSIDE_SHIFT',
          message: 'Access not allowed outside shift hours'
        }
      });
    }

    // Get user's current shift details
    const currentShift = await HVNCShift.findCurrentActiveShift(email, resolvedDeviceId);
    
    // Create a new session
    const session = await HVNCSession.createSession(
      resolvedDeviceId,
      email,
      null, // No DB access code record — validated via Redis
      ip_address || req.ip
    );

    // Dispatch start_session command to the physical PC
    const command = await HVNCCommand.createCommand({
      device_id: resolvedDeviceId,
      session_id: session.session_id,
      user_email: email,
      type: 'session',
      action: 'start_session',
      parameters: {
        session_id: session.session_id,
        user_email: email,
        user_name: user.fullName,
        ip_address: ip_address || req.ip
      },
      priority: 'high'
    });

    // Try to push via WebSocket immediately; fall back to command queue if device offline
    try {
      await sendCommandToDevice(resolvedDeviceId, command);
      await command.markSent();
    } catch (wsError) {
      // Device not connected via WebSocket — it will pick up the command on next poll
      console.log(`📋 Device ${resolvedDeviceId} not connected via WS, command queued for polling`);
    }

    // Record successful login
    await user.recordLogin(ip_address || req.ip);

    // Log successful authentication
    await HVNCActivityLog.logUserEvent(email, 'user_login', {
      device_id: resolvedDeviceId,
      session_id: session.session_id,
      access_method: 'access_code',
      device_name: device.pc_name
    }, {
      ip_address: ip_address || req.ip,
      user_agent: req.headers['user-agent'],
      status: 'success',
      duration_ms: Date.now() - startTime
    });

    // Prepare response
    const response = {
      valid: true,
      session: {
        session_id: session.session_id,
        user: {
          email: user.email,
          name: user.fullName,
          role: user.role
        },
        expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
        permissions: user.permissions
      }
    };

    // Add shift information if available
    if (currentShift) {
      response.shift = {
        start_time: currentShift.start_time,
        end_time: currentShift.end_time,
        timezone: currentShift.timezone,
        remaining_minutes: currentShift.getRemainingTime()
      };
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Code validation error:', error);
    
    await HVNCActivityLog.logSecurityEvent('authentication_failed', {
      reason: 'system_error',
      email: req.body.email,
      device_id: req.body.device_id,
      error: error.message
    }, {
      ip_address: req.body.ip_address || req.ip,
      user_agent: req.headers['user-agent'],
      severity: 'high',
      error_message: error.message
    });

    res.status(500).json({
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Code validation failed'
      }
    });
  }
};

/**
 * User requests new access code via email
 * POST /api/codes/request
 */
const requestCode = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { email, device_id } = req.body;

    // Validate required fields
    if (!email || !device_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and device_id are required'
        }
      });
    }

    // Find the user
    const user = await DTUser.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Log attempt but don't reveal user existence
      await HVNCActivityLog.logSecurityEvent('access_code_requested', {
        email,
        device_id,
        result: 'user_not_found'
      }, {
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'low'
      });

      // Always return success to prevent email enumeration
      return res.status(200).json({
        success: true,
        message: 'If the email exists and is active, an access code has been sent',
        expires_in: 3600
      });
    }

    // Check if device exists
    const device = await HVNCDevice.findByDeviceId(device_id);
    if (!device || device.status === 'disabled') {
      await HVNCActivityLog.logSecurityEvent('access_code_requested', {
        email,
        device_id,
        result: device ? 'device_disabled' : 'device_not_found'
      }, {
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'medium'
      });

      return res.status(400).json({
        success: false,
        error: {
          code: device ? 'DEVICE_DISABLED' : 'DEVICE_NOT_FOUND',
          message: device ? 'Device is disabled' : 'Device not found'
        }
      });
    }

    // Check if user has any shifts for this device
    const shifts = await HVNCShift.findActiveShiftsForUser(email, device.device_id);
    if (shifts.length === 0) {
      await HVNCActivityLog.logSecurityEvent('access_code_requested', {
        email,
        device_id,
        result: 'no_active_shifts'
      }, {
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'low'
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'NO_SHIFTS',
          message: 'No active shifts found for this device'
        }
      });
    }

    // Invalidate any existing codes for this user/device in Redis
    await hvncVerificationStore.removeAccessCode(email, device_id);

    // Generate 6-digit access code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('🔢 Generated new access code for', { email, device_id, code });

    // Store access code in Redis with user data
    const userData = {
      userId: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      deviceId: device_id,
      deviceName: device.pc_name,
      purpose: 'hvnc_access'
    };

    await hvncVerificationStore.setAccessCode(email, device_id, code, userData);

    // Send email with access code
    try {
      console.log('📧 Attempting to send access code email...');
      console.log('   User:', { email: user.email, name: user.fullName });
      console.log('   Device:', { name: device.pc_name, id: device.device_id });
      console.log('   Code:', code);
      
      // Calculate expiry time (15 minutes from now)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      
      await emailService.sendAccessCode(user, device, code, expiresAt);
      
      console.log('✅ Email service completed successfully');

    } catch (emailError) {
      console.error('❌ Failed to send access code email:', emailError);
      
      // Clean up Redis entry if email fails
      await hvncVerificationStore.removeAccessCode(email, device_id);
      
      await HVNCActivityLog.logUserEvent(email, 'access_code_requested', {
        device_id,
        result: 'email_failed',
        error: emailError.message
      }, {
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        status: 'failure',
        error_message: emailError.message
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'EMAIL_ERROR',
          message: 'Failed to send access code'
        }
      });
    }

    // Log successful code generation
    await HVNCActivityLog.logUserEvent(email, 'access_code_requested', {
      device_id,
      device_name: device.pc_name,
      storage_type: hvncVerificationStore.getStorageType(),
      expires_in_minutes: 15,
      result: 'success'
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      status: 'success',
      duration_ms: Date.now() - startTime
    });

    res.status(200).json({
      success: true,
      message: 'Access code sent to your email',
      expires_in: 15 * 60 // 15 minutes in seconds
    });

  } catch (error) {
    console.error('Code request error:', error);
    
    await HVNCActivityLog.logUserEvent(req.body.email, 'access_code_requested', {
      device_id: req.body.device_id,
      result: 'system_error',
      error: error.message
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      status: 'failure',
      error_message: error.message,
      duration_ms: Date.now() - startTime
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'REQUEST_ERROR',
        message: 'Access code request failed'
      }
    });
  }
};

/**
 * Generate access code for admin use
 * POST /api/codes/generate (Admin only)
 */
const generateCode = async (req, res) => {
  try {
    const { email, device_id, expires_in_hours = 24, max_uses = 1 } = req.body;
    const adminUser = req.admin; // From admin auth middleware

    // Validate required fields
    if (!email || !device_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and device_id are required'
        }
      });
    }

    // Find the user
    const user = await DTUser.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Check if device exists
    const device = await HVNCDevice.findByDeviceId(device_id);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DEVICE_NOT_FOUND',
          message: 'Device not found'
        }
      });
    }

    // Invalidate existing codes if requested
    if (req.body.invalidate_existing) {
      await HVNCAccessCode.invalidateUserCodes(email, device_id);
    }

    // Create new access code
    const { accessCode, code } = await HVNCAccessCode.createForUser(
      email,
      device_id,
      req.ip,
      expires_in_hours
    );

    // Update max uses if specified
    if (max_uses !== 1) {
      accessCode.max_uses = max_uses;
      await accessCode.save();
    }

    // Send email if requested
    if (req.body.send_email) {
      try {
        await emailService.sendAccessCode(user, device, code, accessCode.expires_at);
        accessCode.email_sent = true;
        accessCode.email_sent_at = new Date();
        await accessCode.save();
      } catch (emailError) {
        console.warn('Failed to send admin-generated access code email:', emailError);
      }
    }

    // Log admin action
    await HVNCActivityLog.logUserEvent(adminUser.email, 'admin_action', {
      action: 'generate_access_code',
      target_user: email,
      device_id,
      code_id: accessCode._id,
      expires_in_hours,
      max_uses,
      email_sent: req.body.send_email
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      status: 'success'
    });

    res.status(200).json({
      success: true,
      access_code: {
        id: accessCode._id,
        code: req.body.return_code ? code : undefined, // Only return code if explicitly requested
        expires_at: accessCode.expires_at,
        max_uses: accessCode.max_uses,
        email_sent: accessCode.email_sent
      },
      user: {
        email: user.email,
        name: user.fullName
      },
      device: {
        device_id: device.device_id,
        name: device.pc_name
      }
    });

  } catch (error) {
    console.error('Generate code error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GENERATE_ERROR',
        message: 'Access code generation failed'
      }
    });
  }
};

/**
 * List access codes (Admin only)
 * GET /api/codes/list
 */
const listCodes = async (req, res) => {
  try {
    const {
      email,
      device_id,
      status = 'active',
      page = 1,
      limit = 50
    } = req.query;

    const query = {};
    
    if (email) query.user_email = email.toLowerCase();
    if (device_id) query.device_id = device_id;
    
    // Filter by status
    if (status === 'active') {
      query.is_active = true;
      query.expires_at = { $gt: new Date() };
    } else if (status === 'expired') {
      query.expires_at = { $lt: new Date() };
    } else if (status === 'inactive') {
      query.is_active = false;
    }

    const skip = (page - 1) * limit;
    
    const codes = await HVNCAccessCode.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await HVNCAccessCode.countDocuments(query);

    res.status(200).json({
      success: true,
      codes: codes.map(code => ({
        id: code._id,
        user_email: code.user_email,
        device_id: code.device_id,
        created_at: code.createdAt,
        expires_at: code.expires_at,
        max_uses: code.max_uses,
        used_count: code.used_count,
        is_active: code.is_active,
        is_valid: code.is_valid,
        email_sent: code.email_sent,
        usage_logs: code.usage_logs
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('List codes error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_ERROR',
        message: 'Failed to list access codes'
      }
    });
  }
};

/**
 * Revoke access code (Admin only)
 * POST /api/codes/{code_id}/revoke
 */
const revokeCode = async (req, res) => {
  try {
    const { code_id } = req.params;
    const { reason = 'admin_revoked' } = req.body;
    const adminUser = req.admin;

    const accessCode = await HVNCAccessCode.findById(code_id);
    if (!accessCode) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CODE_NOT_FOUND',
          message: 'Access code not found'
        }
      });
    }

    await accessCode.deactivate(reason);

    // Log admin action
    await HVNCActivityLog.logUserEvent(adminUser.email, 'admin_action', {
      action: 'revoke_access_code',
      code_id: accessCode._id,
      target_user: accessCode.user_email,
      device_id: accessCode.device_id,
      reason
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'Access code revoked successfully',
      code_id: accessCode._id
    });

  } catch (error) {
    console.error('Revoke code error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REVOKE_ERROR',
        message: 'Failed to revoke access code'
      }
    });
  }
};

module.exports = {
  validateCode,
  requestCode,
  generateCode,
  listCodes,
  revokeCode
};