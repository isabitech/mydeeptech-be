/**
 * Reusable async error wrapper for route handlers
 * Forwards any errors to the global error handler via next()
 * @param {Function} fn - Async express controller function
 * @returns {Function} Express middleware function
 */
const tryCatch = (controller) => async (req, res, next) => {
    try {
        await controller(req, res, next);
    } catch (err) {
        next(err); // Pass error to your global error handler
    }
};


export default tryCatch;
