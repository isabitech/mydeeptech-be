const jwt = require('jsonwebtoken');
const DTUser = require('../models/dtUser.model');
const envConfig = require('./../config/envConfig');

// JWT Authentication Middleware
const authenticateToken = async (req, res, next) => {

  try {

 // Get token from Authorization header (Bearer token) or from _usrinfo format
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : req.headers?.token || req.body?.token || req.query?.token;

    if (!token) {
      console.warn('⚠️ No token provided in request');
      return res.status(401).json({
        success: false,
        message: 'Access token required. Please provide a valid JWT token.',
        code: 'TOKEN_MISSING'
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, envConfig.jwt.JWT_SECRET || 'your-secret-key');

    // Optional: Check if user still exists and is active
    const user = await DTUser.findById(decoded.userId).populate({
      path: "role_permission",
      select: "name isActive permissions",
      populate: {
        path: "permissions",
        select: "resource action",
      },
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is valid but user no longer exists',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isEmailVerified) {
      return res.status(401).json({
        success: false,
        message: 'Email not verified. Please verify your email first.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Add user info to request object
    req.user = {
      id: user._id.toString(),
      userId: decoded.userId,
      email: decoded.email,
      fullName: decoded.fullName,
      role: user.role,
      qaStatus: user.qaStatus,
      annotatorStatus: user.annotatorStatus,
      microTaskerStatus: user.microTaskerStatus,
      role_permission: user.role_permission || null,
      userDoc: user, // Full user document if needed
    };

    next();

  } catch (error) {
    console.error('❌ JWT Authentication failed:', error.message);
    
    if (error instanceof jwt.JsonWebTokenError || error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error instanceof jwt.TokenExpiredError || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error during authentication',
      error: error.message
    });
  }
};

// Optional: Middleware to check if user can access their own profile or admin access
const authorizeProfileAccess = (req, res, next) => {
  const requestedUserId = req.params.userId;
  const currentUserId = req.user.userId;

  // Users can only access their own profile (add admin logic later if needed)
  if (requestedUserId !== currentUserId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own profile.',
      code: 'ACCESS_DENIED'
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  authorizeProfileAccess
};
