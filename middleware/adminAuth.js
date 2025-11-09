const jwt = require('jsonwebtoken');
const DTUser = require('../models/dtUser.model');

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : req.headers.token || req.body.token || req.query.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Admin access token required',
        code: 'ADMIN_TOKEN_MISSING'
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if user exists
    const user = await DTUser.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Admin token is valid but user no longer exists',
        code: 'ADMIN_NOT_FOUND'
      });
    }

    // Check if user has admin privileges
    // For now, we'll use a simple check - you can enhance this later
    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
    const isAdmin = adminEmails.includes(user.email.toLowerCase()) || user.email.endsWith('@mydeeptech.ng');

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required. Access denied.',
        code: 'ADMIN_ACCESS_DENIED'
      });
    }

    // Add admin info to request object
    req.admin = {
      userId: decoded.userId,
      email: decoded.email,
      fullName: decoded.fullName,
      userDoc: user,
      _id: user._id  // Add this as backup
    };

    // Also set req.userId for backward compatibility
    req.userId = decoded.userId;

    console.log(`🔑 Admin authenticated: ${decoded.email}, ID: ${decoded.userId}`);
    next();

  } catch (error) {
    console.error('❌ Admin authentication failed:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin token format',
        code: 'INVALID_ADMIN_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Admin token has expired. Please login again.',
        code: 'ADMIN_TOKEN_EXPIRED'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error during admin authentication',
      error: error.message
    });
  }
};

module.exports = {
  authenticateAdmin
};