/**
 * Generic middleware to validate request body against a Joi schema
 * @param {Object} schema - Joi schema object
 * @returns {Function} Express middleware function
 */
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
            errors: {
                label: 'key',
                wrap: {
                    label: false
                }
            }
        });

        if (error) {
            const errorMessage = error.details.map((detail) => detail.message).join(', ');
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: errorMessage,
                details: error.details
            });
        }

        next();
    };
};

module.exports = {
    validateRequest
};
