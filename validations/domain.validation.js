const Joi = require('joi');

const categorySchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
});

const subCategorySchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    category: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'Category ID must be a valid MongoDB ObjectId'
    })
});

const domainSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    parent: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'Parent ID must be a valid MongoDB ObjectId'
    }),
    parentModel: Joi.string().valid('Category', 'SubCategory').required()
});

const updateSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).optional(),
    slug: Joi.string().trim().lowercase().optional(),
    category: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    parent: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    parentModel: Joi.string().valid('Category', 'SubCategory').optional()
}).min(1);


const CreateALLSchema = Joi.object({
    categoryname: Joi.number().integer().min(1).max(100).required(),
    subcategory: Joi.number().integer().min(1).max(100).allow(null),
    name: Joi.string().trim().min(2).max(100).required()
});

module.exports = {
    categorySchema,
    subCategorySchema,
    domainSchema,
    updateSchema,
    CreateALLSchema
};
