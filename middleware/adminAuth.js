import jwt from 'jsonwebtoken';
import dtUserRepository from '../repositories/dtUser.repository.js';
import { ResponseHandler, AuthenticationError, AuthorizationError } from '../utils/responseHandler.js';

/**
 * Admin authentication middleware
 */
export const authenticateAdmin = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : req.headers.token || req.body.token || req.query.token;

    if (!token) {
      throw new AuthenticationError('Admin access token required');
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

    // Check if user exists
    const user = await dtUserRepository.findById(decoded.userId);
    if (!user) {
      throw new AuthenticationError('Admin token is valid but user no longer exists');
    }

    // Check if user has admin privileges
    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
    const isAdmin = adminEmails.includes(user.email.toLowerCase()) ||
      user.email.endsWith('@mydeeptech.ng') ||
      user.role === 'ADMIN';

    if (!isAdmin) {
      throw new AuthorizationError('Admin privileges required. Access denied.');
    }

    // Add admin info to request object
    req.admin = {
      userId: decoded.userId,
      email: decoded.email,
      fullName: decoded.fullName,
      userDoc: user,
      _id: user._id
    };

    // Also set req.userId for backward compatibility
    req.userId = decoded.userId;

    console.log(`🔑 Admin authenticated: ${decoded.email}, ID: ${decoded.userId}`);
    next();

  } catch (error) {
    console.error('❌ Admin authentication failed:', error.message);

    if (error.name === 'JsonWebTokenError') {
      return ResponseHandler.error(res, new AuthenticationError('Invalid admin token format'));
    }

    if (error.name === 'TokenExpiredError') {
      return ResponseHandler.error(res, new AuthenticationError('Admin token has expired. Please login again.'));
    }

    return ResponseHandler.error(res, error);
  }
};

export default {
  authenticateAdmin
};
