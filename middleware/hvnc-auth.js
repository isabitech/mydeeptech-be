const jwt = require('jsonwebtoken');
const DTUser = require('../models/dtUser.model');
const HVNCDevice = require('../models/hvnc-device.model');
const HVNCSession = require('../models/hvnc-session.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');
const envConfig = require('../config/envConfig');

// HVNC Device Authentication Middleware
const authenticateDevice = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : req.headers.token || req.body.token || req.query.token;

    if (!token) {
      await HVNCActivityLog.logSecurityEvent('unauthorized_access_attempt', {
        endpoint: req.path,
        method: req.method,
        reason: 'missing_device_token'
      }, {
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'medium'
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_MISSING',
          message: 'Device authentication token required'
        }
      });
    }

    // Verify the device token
    const decoded = jwt.verify(token, envConfig.jwt.JWT_SECRET);
    
    if (decoded.type !== 'device') {
      await HVNCActivityLog.logSecurityEvent('unauthorized_access_attempt', {
        endpoint: req.path,
        method: req.method,
        reason: 'invalid_token_type',
        token_type: decoded.type
      }, {
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'high'
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_TYPE',
          message: 'Invalid token type for device authentication'
        }
      });
    }

    // Fetch the device from database
    const device = await HVNCDevice.findById(decoded.id);
    
    if (!device || device.device_id !== decoded.device_id) {
      await HVNCActivityLog.logSecurityEvent('unauthorized_access_attempt', {
        endpoint: req.path,
        method: req.method,
        reason: 'device_not_found',
        device_id: decoded.device_id
      }, {
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'high'
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'DEVICE_NOT_FOUND',
          message: 'Device not found or invalid device token'
        }
      });
    }

    if (device.status === 'disabled') {
      await HVNCActivityLog.logSecurityEvent('unauthorized_access_attempt', {
        endpoint: req.path,
        method: req.method,
        reason: 'device_disabled',
        device_id: device.device_id
      }, {
        device_id: device.device_id,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'medium'
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'DEVICE_DISABLED',
          message: 'Device is disabled'
        }
      });
    }

    // Add device info to request object
    req.device = device;
    req.deviceToken = decoded;

    // Log successful device authentication
    await HVNCActivityLog.logDeviceEvent(device.device_id, 'device_heartbeat', {
      endpoint: req.path,
      method: req.method,
      authenticated: true
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      await HVNCActivityLog.logSecurityEvent('authentication_failed', {
        endpoint: req.path,
        method: req.method,
        reason: 'invalid_jwt_token',
        error: error.message
      }, {
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'high'
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token'
        }
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired'
        }
      });
    }

    console.error('Device authentication error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication error occurred'
      }
    });
  }
};

// HVNC User Authentication Middleware — uses main DTUser JWT
const authenticateUserSession = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : req.headers.token || req.body.token || req.query.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_MISSING', message: 'Authentication token required' }
      });
    }

    const decoded = jwt.verify(token, envConfig.jwt.JWT_SECRET);
    const user = await DTUser.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    if (!user.isEmailVerified) {
      return res.status(401).json({
        success: false,
        error: { code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' }
      });
    }

    req.user = {
      _id: user._id,
      userId: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      userDoc: user
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' }
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Token has expired' }
      });
    }
    console.error('User session authentication error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SESSION_AUTH_ERROR', message: 'Authentication error occurred' }
    });
  }
};

// HVNC Admin Authentication Middleware — uses main DTUser JWT
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : req.headers.token || req.body.token || req.query.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_MISSING', message: 'Authentication token required' }
      });
    }

    const decoded = jwt.verify(token, envConfig.jwt.JWT_SECRET);
    const user = await DTUser.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    if (!user.isEmailVerified) {
      return res.status(401).json({
        success: false,
        error: { code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' }
      });
    }

    const isAdmin = user.role === 'admin' || user.email.endsWith('@mydeeptech.ng');

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: 'ADMIN_ACCESS_DENIED', message: 'Admin access required' }
      });
    }

    req.admin = {
      _id: user._id,
      email: user.email,
      full_name: user.fullName,
      role: 'admin',
      userDoc: user
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' }
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Token has expired' }
      });
    }
    console.error('Admin authentication error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ADMIN_AUTH_ERROR', message: 'Admin authentication error occurred' }
    });
  }
};

// Permission checking middleware
const requirePermission = (permission) => {
  return async (req, res, next) => {
    const currentUser = req.admin || req.user;

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_AUTHENTICATED', message: 'User authentication required' }
      });
    }

    // DTUser admins and @mydeeptech.ng domain have all HVNC permissions
    const hasPermission =
      currentUser.role === 'admin' ||
      (currentUser.email && currentUser.email.endsWith('@mydeeptech.ng'));

    if (!hasPermission) {
      await HVNCActivityLog.logSecurityEvent('unauthorized_access_attempt', {
        endpoint: req.path,
        method: req.method,
        reason: 'insufficient_permissions',
        required_permission: permission,
        user_permissions: currentUser.permissions || [],
        user_role: currentUser.role
      }, {
        user_email: currentUser.email,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'medium'
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Permission '${permission}' required for this action`
        }
      });
    }

    next();
  };
};

// Rate limiting middleware for auth endpoints
const { rateLimiter } = require('../utils/rateLimiter');

const authRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later'
    }
  },
  skipSuccessfulRequests: true,
  onLimitReached: async (req) => {
    await HVNCActivityLog.logSecurityEvent('rate_limit_exceeded', {
      endpoint: req.path,
      method: req.method,
      limit_type: 'authentication'
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      severity: 'high'
    });
  }
});

// Combined device authentication with rate limiting
const authenticateDeviceWithRateLimit = [authRateLimit, authenticateDevice];

module.exports = {
  authenticateDevice,
  authenticateUserSession,
  authenticateAdmin,
  requirePermission,
  authRateLimit,
  authenticateDeviceWithRateLimit
};