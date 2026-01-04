const jwt = require('jsonwebtoken');
const DTUser = require('../models/dtUser.model');

// JWT Authentication Middleware
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from Authorization header (Bearer token) or from _usrinfo format
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : req.headers.token || req.body.token || req.query.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required. Please provide a valid JWT token.',
        code: 'TOKEN_MISSING'
      });
    }

    // Verify the token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('FATAL: JWT_SECRET environment variable is not defined.');
      return res.status(500).json({
        success: false,
        message: 'Authentication service misconfigured',
        code: 'INTERNAL_ERROR'
      });
    }

    const decoded = jwt.verify(token, jwtSecret);
    console.log('🔓 JWT decoded:', { userId: decoded.userId, email: decoded.email });

    // Optional: Check if user still exists and is active
    const user = await DTUser.findById(decoded.userId);
    console.log('👤 User found in DB:', {
      found: !!user,
      email: user?.email,
      annotatorStatus: user?.annotatorStatus,
      isEmailVerified: user?.isEmailVerified
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is valid but user no longer exists',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isEmailVerified) {
      console.log('❌ Email not verified for user:', user.email);
      return res.status(401).json({
        success: false,
        message: 'Email not verified. Please verify your email first.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Add user info to request object
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      fullName: decoded.fullName,
      userDoc: user // Full user document if needed
    };

    console.log(`🔐 Authenticated user: ${decoded.email} (ID: ${decoded.userId})`);
    next();

  } catch (error) {
    console.error('❌ JWT Authentication failed:', error.message);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
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