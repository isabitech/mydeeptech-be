
// Validation middleware factory
const validateSchema = (schema, source = 'body') => {
    return (req, res, next) => {

        let data;

        switch (source) {
            case 'params':
                data = req.params;
                break;
            case 'query':
                data = req.query;
                break;
            case 'body':
            default:
                data = req.body;
                break;
        }

        const { error, value } = schema.validate(data, {
            abortEarly: false,
            allowUnknown: false,
            stripUnknown: true
        });

        if (error) {
            const errorMessage = error.details
                .map(detail => detail.message)
                .join(', ');
                
            return res.status(400).json({
                success: false,
                message: errorMessage ?? 'Validation error',
                errors: errorMessage,
                details: error.details
            });
        }

        // Replace the original data with validated data
        if (source === 'params') {
            req.params = value;
        } else if (source === 'query') {
            req.query = value;
        } else {
            req.body = value;
        }

        next();
    };
};

module.exports = validateSchema;