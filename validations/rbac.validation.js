const Joi = require("joi");
const validateSchema = require("../middleware/validate-schema.middleware");

// ─────────────────────────────────────────────
//  COMMON
// ─────────────────────────────────────────────
const mongoIdSchema = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "ID must be a valid MongoDB ObjectId",
  });

const mongoIdParamSchema = Joi.object({
  id: mongoIdSchema.required().messages({
    "any.required": "ID is required",
  }),
});

const assignRoleToUserParamSchema = Joi.object({
  id: mongoIdSchema.required().messages({
    "any.required": "Role ID is required",
  }),
  userId: mongoIdSchema.required().messages({
    "any.required": "User ID is required",
  }),
});

const removePermissionsFromRoleSchema = Joi.object({
  permissions: Joi.array().items(mongoIdSchema).min(1).required().messages({
    "array.base": "permissions must be an array of permission IDs",
    "array.min": "At least one permission ID is required",
    "any.required": "permissions is required",
  }),
});

// ─────────────────────────────────────────────
//  PERMISSION SCHEMAS
// ─────────────────────────────────────────────

const ACTIONS = [
  "view",
  "view_own",
  "create",
  "edit",
  "delete",
  "approve",
  "manage",
];
const permissionConsistencyValidator = (value, helpers) => {
  const { name, resource, action } = value || {};
  if (
    typeof name === "string" &&
    typeof resource === "string" &&
    typeof action === "string"
  ) {
    const expectedName = `${resource}:${action}`;
    if (name !== expectedName) {
      return helpers.error("any.invalid", { expectedName });
    }
  }
  return value;
};

const createPermissionSchema = Joi.object({
  name: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z_]+:[a-z_]+$/)
    .required()
    .messages({
      "string.pattern.base":
        "Permission name must follow the format resource:action (e.g. projects:view)",
      "any.required": "Permission name is required",
    }),
  description: Joi.string().trim().max(300).optional().messages({
    "string.max": "Description must not exceed 300 characters",
  }),
  resource: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9_]+$/)
    .required()
    .messages({
      "string.pattern.base": "Resource must only contain lowercase letters, numbers, and underscores (e.g. 'custom_page')",
      "any.required": "Resource is required",
    }),
  action: Joi.string()
    .trim()
    .lowercase()
    .valid(...ACTIONS)
    .required()
    .messages({
      "any.only": `Action must be one of: ${ACTIONS.join(", ")}`,
      "any.required": "Action is required",
    }),
})
  .custom(permissionConsistencyValidator, "permission consistency validation")
  .messages({
    "any.invalid":
      'Permission name must match "resource:action" (e.g. "projects:view" for resource "projects" and action "view")',
  });

const updatePermissionSchema = Joi.object({
  name: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z_]+:[a-z_]+$/)
    .optional()
    .messages({
      "string.pattern.base":
        "Permission name must follow the format resource:action (e.g. projects:view)",
    }),
  description: Joi.string().trim().max(300).optional().messages({
    "string.max": "Description must not exceed 300 characters",
  }),
  resource: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9_]+$/)
    .optional()
    .messages({
      "string.pattern.base": "Resource must only contain lowercase letters, numbers, and underscores (e.g. 'custom_page')",
    }),
  action: Joi.string()
    .trim()
    .lowercase()
    .valid(...ACTIONS)
    .optional()
    .messages({
      "any.only": `Action must be one of: ${ACTIONS.join(", ")}`,
    }),
})
  .min(1)
  .messages({
    "object.min": "At least one field is required to update a permission",
  });

// ─────────────────────────────────────────────
//  ROLE SCHEMAS
// ─────────────────────────────────────────────
const createRoleSchema = Joi.object({
  name: Joi.string().trim().lowercase().min(2).max(50).required().messages({
    "string.min": "Role name must be at least 2 characters",
    "string.max": "Role name must not exceed 50 characters",
    "any.required": "Role name is required",
  }),
  description: Joi.string().trim().max(300).optional().messages({
    "string.max": "Description must not exceed 300 characters",
  }),
  permissions: Joi.array()
    .items(mongoIdSchema)
    .optional()
    .default([])
    .messages({
      "array.base": "Permissions must be an array of permission IDs",
    }),
  isActive: Joi.boolean().optional().default(true).messages({
    "boolean.base": "isActive must be a boolean",
  }),
});

const updateRoleSchema = Joi.object({
  name: Joi.string().trim().lowercase().min(2).max(50).optional().messages({
    "string.min": "Role name must be at least 2 characters",
    "string.max": "Role name must not exceed 50 characters",
  }),
  description: Joi.string().trim().max(300).optional().messages({
    "string.max": "Description must not exceed 300 characters",
  }),
  permissions: Joi.array().items(mongoIdSchema).optional().messages({
    "array.base": "Permissions must be an array of permission IDs",
  }),
  isActive: Joi.boolean().optional().messages({
    "boolean.base": "isActive must be a boolean",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field is required to update a role",
  });

// ─────────────────────────────────────────────
//  EXPORTS
// ─────────────────────────────────────────────
module.exports = {
  // Schemas (raw, for reuse)
  createPermissionSchema,
  updatePermissionSchema,
  createRoleSchema,
  updateRoleSchema,
  mongoIdParamSchema,
  assignRoleToUserParamSchema,

  // Permission middleware
  validateCreatePermission: validateSchema(createPermissionSchema),
  validateUpdatePermission: validateSchema(updatePermissionSchema),
  validatePermissionId: validateSchema(mongoIdParamSchema, "params"),

  // Role middleware
  validateCreateRole: validateSchema(createRoleSchema),
  validateUpdateRole: validateSchema(updateRoleSchema),
  validateRoleId: validateSchema(mongoIdParamSchema, "params"),
  validateRemovePermissionsFromRole: validateSchema(
    removePermissionsFromRoleSchema,
  ),
  validateAssignRoleToUserParams: validateSchema(
    assignRoleToUserParamSchema,
    "params",
  ),
};
