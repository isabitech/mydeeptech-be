import jwt from 'jsonwebtoken';
import dtUserRepository from '../repositories/dtUser.repository.js';
import { ResponseHandler, AuthenticationError, AuthorizationError } from '../utils/responseHandler.js';

/**
 * JWT Authentication Middleware
 */
export const authenticateToken = async (req, res, next) => {
  try {
    // Get token from Authorization header (Bearer token) or from _usrinfo format
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : req.headers.token || req.body.token || req.query.token;

    if (!token) {
      throw new AuthenticationError('Access token required. Please provide a valid JWT token.');
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

    // Check if user still exists and is active
    const user = await dtUserRepository.findById(decoded.userId);

    if (!user) {
      throw new AuthenticationError('Token is valid but user no longer exists');
    }

    if (!user.isEmailVerified) {
      console.log('❌ Email not verified for user:', user.email);
      throw new AuthenticationError('Email not verified. Please verify your email first.');
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
      return ResponseHandler.error(res, new AuthenticationError('Invalid token format'));
    }

    if (error.name === 'TokenExpiredError') {
      return ResponseHandler.error(res, new AuthenticationError('Token has expired. Please login again.'));
    }

    return ResponseHandler.handleError(res, error);
  }
};

/**
 * Middleware to check if user can access their own profile
 */
export const authorizeProfileAccess = (req, res, next) => {
  try {
    const requestedUserId = req.params.userId;
    const currentUserId = req.user.userId;

    // Users can only access their own profile
    if (requestedUserId !== currentUserId) {
      throw new AuthorizationError('Access denied. You can only access your own profile.');
    }

    next();
  } catch (error) {
    return ResponseHandler.handleError(res, error);
  }
};

export default {
  authenticateToken,
  authorizeProfileAccess
};
