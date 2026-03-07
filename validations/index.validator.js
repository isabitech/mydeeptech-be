const Joi = require("joi");

// Validators for commonly used fields
const ValidateEmail  =  Joi.string().email();
const IdFieldSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'ID must be a valid MongoDB ObjectId'
});

const validateIdParamSchema = (fieldName = "id") => {
    return Joi.object({
            [fieldName]: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
            'string.pattern.base': `${fieldName} must be a valid MongoDB ObjectId`
        })
    });
}

module.exports = { ValidateEmail, IdFieldSchema, validateIdParamSchema }