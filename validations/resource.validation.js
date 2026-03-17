const Joi = require("joi");
const validateSchema = require("../middleware/validate-schema.middleware");

const mongoIdSchema = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "ID must be a valid MongoDB ObjectId",
  });

const resourceIdParamSchema = Joi.object({
  id: mongoIdSchema.required().messages({
    "any.required": "Resource ID is required",
  }),
});

const createResourceSchema = Joi.object({
  title: Joi.string().trim().min(2).max(120).required().messages({
    "string.min": "Title must be at least 2 characters",
    "string.max": "Title must not exceed 120 characters",
    "any.required": "Title is required",
  }),
  link: Joi.string().trim().min(1).max(300).required().messages({
    "string.min": "Link is required",
    "string.max": "Link must not exceed 300 characters",
    "any.required": "Link is required",
  }),
  description: Joi.string().trim().max(500).optional().allow("").messages({
    "string.max": "Description must not exceed 500 characters",
  }),
  icon: Joi.string().trim().max(120).optional().allow("").messages({
    "string.max": "Icon must not exceed 120 characters",
  }),
  parent: Joi.alternatives()
    .try(mongoIdSchema, Joi.valid(null))
    .optional()
    .messages({
      "alternatives.match": "Parent must be a valid resource ID or null",
    }),
  sortOrder: Joi.number().integer().min(1).optional().messages({
    "number.base": "sortOrder must be a number",
    "number.integer": "sortOrder must be an integer",
    "number.min": "sortOrder must be at least 1",
  }),
  isPublished: Joi.boolean().optional().messages({
    "boolean.base": "isPublished must be a boolean",
  }),
});

const updateResourceSchema = Joi.object({
  title: Joi.string().trim().min(2).max(120).optional().messages({
    "string.min": "Title must be at least 2 characters",
    "string.max": "Title must not exceed 120 characters",
  }),
  link: Joi.string().trim().min(1).max(300).optional().messages({
    "string.min": "Link is required",
    "string.max": "Link must not exceed 300 characters",
  }),
  description: Joi.string().trim().max(500).optional().allow("").messages({
    "string.max": "Description must not exceed 500 characters",
  }),
  icon: Joi.string().trim().max(120).optional().allow("").messages({
    "string.max": "Icon must not exceed 120 characters",
  }),
  parent: Joi.alternatives()
    .try(mongoIdSchema, Joi.valid(null))
    .optional()
    .messages({
      "alternatives.match": "Parent must be a valid resource ID or null",
    }),
  sortOrder: Joi.number().integer().min(1).optional().messages({
    "number.base": "sortOrder must be a number",
    "number.integer": "sortOrder must be an integer",
    "number.min": "sortOrder must be at least 1",
  }),
  isPublished: Joi.boolean().optional().messages({
    "boolean.base": "isPublished must be a boolean",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field is required to update a resource",
  });

const getAllResourcesQuerySchema = Joi.object({
  all: Joi.boolean().optional(),
  sortBy: Joi.string().valid("latest", "custom").optional().messages({
    "any.only": "sortBy must be one of: latest, custom",
  }),
  hierarchy: Joi.boolean().optional(),
});

const searchResourceQuerySchema = Joi.object({
  q: Joi.string().trim().min(1).max(120).required().messages({
    "string.min": "Search query cannot be empty",
    "string.max": "Search query must not exceed 120 characters",
    "any.required": "Search query is required",
  }),
});

module.exports = {
  createResourceSchema,
  updateResourceSchema,
  resourceIdParamSchema,
  getAllResourcesQuerySchema,
  searchResourceQuerySchema,

  validateCreateResource: validateSchema(createResourceSchema),
  validateUpdateResource: validateSchema(updateResourceSchema),
  validateResourceId: validateSchema(resourceIdParamSchema, "params"),
  validateGetAllResourcesQuery: validateSchema(
    getAllResourcesQuerySchema,
    "query",
  ),
  validateSearchResourceQuery: validateSchema(
    searchResourceQuerySchema,
    "query",
  ),
};
