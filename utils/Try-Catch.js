// src/Utils/try-catch.js

/**
 * Wrapper to handle async errors in controllers.
 * Avoids repetitive try/catch blocks in each route.
 * @param {Function} controller - Async controller function
 * @returns {Function} Express middleware
 */
export const tryCatch = (controller) => async (req, res, next) => {
    try {
        await controller(req, res, next);
    } catch (err) {
        next(err); // Pass error to your global error handler
    }
};
