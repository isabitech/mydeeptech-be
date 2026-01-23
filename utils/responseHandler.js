/**
 * Standardized Response Handler
 * 
 * Provides consistent response structure across the application.
 */

/**
 * Send a success response
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 * @param {Object} [data=null] - Payload data (will be wrapped in 'data' key)
 * @param {number} [statusCode=200] - HTTP status code
 * @param {Object} [extraRootFields=null] - Extra fields to merge at the root level (useful for legacy compatibility or auth tokens)
 * @returns {Object} Express response
 */
const successResponse = (res, message, data = null, statusCode = 200, extraRootFields = null) => {
    const response = {
        success: true,
        message
    };

    if (data !== null && data !== undefined) {
        response.data = data;
    }

    if (extraRootFields) {
        Object.assign(response, extraRootFields);
    }

    return res.status(statusCode).json(response);
};

/**
 * Send an error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Object|string} [error=null] - Detailed error info (usually for logging or debugging)
 * @param {number} [statusCode=500] - HTTP status code
 * @param {Array} [validationErrors=null] - Array of validation error messages
 * @returns {Object} Express response
 */
const errorResponse = (res, message, error = null, statusCode = 500, validationErrors = null) => {
    const response = {
        success: false,
        message
    };

    if (error) {
        response.error = error instanceof Error ? error.message : error;
    }

    if (validationErrors) {
        response.errors = validationErrors;
    }

    return res.status(statusCode).json(response);
};

/**
 * Format pagination data consistently
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} totalItems - Total number of items
 * @returns {Object} Pagination object
 */
const getPaginationData = (page, limit, totalItems) => {
    const totalPages = Math.ceil(totalItems / limit);

    return {
        currentPage: Number(page),
        totalPages: totalPages,
        totalItems: totalItems,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit: Number(limit)
    };
};

/**
 * Send a paginated response
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 * @param {Array} items - List of items
 * @param {string} itemsKey - Key for the items list (e.g., 'projects', 'users')
 * @param {Object} paginationInfo - Object containing page, limit, totalItems
 * @param {Object} [summary=null] - Optional summary statistics
 * @returns {Object} Express response
 */
const paginatedResponse = (res, message, items, itemsKey, paginationInfo, summary = null) => {
    const { page, limit, totalItems } = paginationInfo;

    const responseData = {
        [itemsKey]: items,
        pagination: getPaginationData(page, limit, totalItems)
    };

    if (summary) {
        responseData.summary = summary;
    }

    return successResponse(res, message, responseData, 200);
};

/**
 * Send a legacy format response (for user.js, task.js, project.js compatibility)
 * Pattern: { responseCode: "90"|"99", responseMessage: "...", data: ... }
 * @param {Object} res - Express response object
 * @param {string} responseCode - "90" for success, "99" for error
 * @param {string} responseMessage - Message string
 * @param {Object} [data=null] - Data payload
 * @param {number} [statusCode=200] - HTTP status code
 * @returns {Object} Express response
 */
const legacyResponse = (res, responseCode, responseMessage, data = null, statusCode = 200) => {
    const response = {
        responseCode,
        responseMessage
    };

    if (data !== null && data !== undefined) {
        response.data = data;
    }

    return res.status(statusCode).send(response);
};

module.exports = {
    successResponse,
    errorResponse,
    paginatedResponse,
    getPaginationData,
    legacyResponse
};
