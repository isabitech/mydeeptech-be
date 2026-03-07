const Joi = require('joi');

const IdFieldSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'ID must be a valid MongoDB ObjectId'
});

const createInvoiceSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().email().required(),
    amount: Joi.number().positive().required(),
    due_date: Joi.date().iso().required(),
    description: Joi.string().trim().optional(),
    duration: Joi.string().trim().optional(),
});

const updateInvoiceSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).optional(),
    email: Joi.string().email().optional(),
    amount: Joi.number().positive().optional(),
    due_date: Joi.date().iso().optional(),
    description: Joi.string().trim().optional(),
    duration: Joi.string().trim().optional(),
}).min(1);


const IdSchema = Joi.object({ id: IdFieldSchema });

const validateIdParamSchema = (fieldName = "id") => {
    return Joi.object({
            [fieldName]: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
            'string.pattern.base': `${fieldName} must be a valid MongoDB ObjectId`
        })
    });
}



module.exports = {
    createInvoiceSchema,
    updateInvoiceSchema,
    IdSchema,
    validateIdParamSchema,
};