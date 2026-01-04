import { ResponseHandler } from '../utils/responseHandler.js';

/**
 * Global Error Handling Middleware
 * Catch all errors and format them using the unified ResponseHandler
 */
const errorHandler = (err, req, res, next) => {
    // Log error for monitoring
    console.error(`[${new Date().toISOString()}] ❌ Error:`, {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body,
        userId: req.user ? req.user.userId : 'unauthenticated'
    });

    // Handle Mongoose/MongoDB duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        err.message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
        err.statusCode = 409;
        err.code = 'DUPLICATE_KEY_ERROR';
    }

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        err.message = `Validation failed: ${messages.join(', ')}`;
        err.statusCode = 400;
        err.code = 'DB_VALIDATION_ERROR';
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        err.message = 'Invalid token. Please login again.';
        err.statusCode = 401;
        err.code = 'INVALID_TOKEN';
    }

    if (err.name === 'TokenExpiredError') {
        err.message = 'Your token has expired. Please login again.';
        err.statusCode = 401;
        err.code = 'TOKEN_EXPIRED';
    }

    // Send standardized error response
    ResponseHandler.error(res, err);
};

export default errorHandler;
