const Joi = require('joi');


const idSchema = Joi.object({
    id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'ID must be a valid MongoDB ObjectId'
    })
});

const categorySchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    description: Joi.string().trim().optional(),
});

const subCategorySchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    domain_category: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'Sub-Category ID must be a valid MongoDB ObjectId'
    }),
    description: Joi.string().trim().optional(),
});

const domainSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    domain_category: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'Parent ID must be a valid MongoDB ObjectId'
    }),
    domain_sub_category: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow(null).messages({
        'string.pattern.base': 'Parent ID must be a valid MongoDB ObjectId'
    }),
    description: Joi.string().trim().optional(),
});

const updateSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).optional(),
    domain_category: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    domain_sub_category: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    description: Joi.string().trim().optional(),
}).min(1);


const CreateALLSchema = Joi.object({
    categoryname: Joi.number().integer().min(1).max(100).required(),
    subcategory: Joi.number().integer().min(1).max(100).allow(null),
    name: Joi.string().trim().min(2).max(100).required()
});

const assignDomainToUserSchema = Joi.object({
    domainIds: Joi.array().items(
        Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
            'string.pattern.base': 'Domain ID must be a valid MongoDB ObjectId'
        })
    ).min(1).required().messages({
        'array.min': 'At least one Domain ID is required'
    }),
});



const updateDomainToUserSchema = Joi.object({
    userId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'User ID must be a valid MongoDB ObjectId'
    }),
    domainId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'Domain ID must be a valid MongoDB ObjectId'
    }),
});

module.exports = {
    categorySchema,
    subCategorySchema,
    domainSchema,
    updateSchema,
    CreateALLSchema,
    idSchema,
    assignDomainToUserSchema,
    updateDomainToUserSchema
};
