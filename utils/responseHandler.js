/**
 * Unified Response Handler
 * Standardizes API responses across the application
 */

class ResponseHandler {
    /**
     * Send a success response
     * @param {Object} res - Express response object
     * @param {any} data - Data to send in the response
     * @param {string} message - Success message
     * @param {number} statusCode - HTTP status code (default 200)
     * @param {Object} meta - Additional metadata
     */
    static success(res, data = null, message = 'Operation successful', statusCode = 200, meta = {}) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                ...meta
            }
        });
    }

    /**
     * Send an error response
     * @param {Object} res - Express response object
     * @param {Object} error - Error object or details
     */
    static error(res, error) {
        const statusCode = error.statusCode || 500;
        const message = error.message || 'Internal Server Error';
        const errorCode = error.code || 'INTERNAL_ERROR';
        const errorType = error.constructor.name || 'Error';

        return res.status(statusCode).json({
            success: false,
            message,
            error: {
                code: errorCode,
                type: errorType,
                details: error.details || null,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        });
    }
}

/**
 * Custom application error classes
 */
class AppError extends Error {
    constructor(message, statusCode, code, details = null) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
    }
}

class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, 'CONFLICT_ERROR');
    }
}

export {
    ResponseHandler,
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError
};

export const ForbiddenError = AuthorizationError;
export const UnauthorizedError = AuthenticationError;
