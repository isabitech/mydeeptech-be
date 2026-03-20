// validations/candidateTestSubmission.validation.js
const Joi = require("joi");
const validateSchema = require("../middleware/validate-schema.middleware");

const mongoIdSchema = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "ID must be a valid MongoDB ObjectId",
  });

const submissionIdParamSchema = Joi.object({
  id: mongoIdSchema.required().messages({
    "any.required": "Submission ID is required",
  }),
});

const userIdParamSchema = Joi.object({
  userId: mongoIdSchema.required().messages({
    "any.required": "User ID is required",
  }),
});

const createSubmissionSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(150).required().messages({
    "string.min": "Full name must be at least 2 characters",
    "string.max": "Full name must not exceed 150 characters",
    "any.required": "Full name is required",
  }),

  emailAddress: Joi.string().trim().email().lowercase().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email address is required",
  }),

  dateOfSubmission: Joi.date().required().messages({
    "date.base": "Please provide a valid date",
    "any.required": "Date of submission is required",
  }),

  timeOfSubmission: Joi.string()
    .pattern(/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/)
    .required()
    .messages({
      "string.pattern.base": "Time must be in the format HH:MM AM/PM",
      "any.required": "Time of submission is required",
    }),

  submissionStatus: Joi.object({
    englishTestUploaded: Joi.boolean().valid(true).required().messages({
      "any.only": "You must confirm the English Test has been uploaded",
      "any.required": "English test upload confirmation is required",
    }),
    problemSolvingTestUploaded: Joi.boolean().valid(true).required().messages({
      "any.only": "You must confirm the Problem Solving Test has been uploaded",
      "any.required": "Problem solving test upload confirmation is required",
    }),
  })
    .required()
    .messages({
      "any.required": "Submission status is required",
    }),

  englishTestScore: Joi.string().trim().min(1).max(20).required().messages({
    "string.min": "English test score is required",
    "string.max": "English test score must not exceed 20 characters",
    "any.required": "English test score is required",
  }),

  problemSolvingScore: Joi.string().trim().min(1).max(20).required().messages({
    "string.min": "Problem solving score is required",
    "string.max": "Problem solving score must not exceed 20 characters",
    "any.required": "Problem solving score is required",
  }),

  googleDriveLink: Joi.string().trim().uri().max(500).required().messages({
    "string.uri": "Please provide a valid Google Drive link",
    "string.max": "Google Drive link must not exceed 500 characters",
    "any.required": "Google Drive link is required",
  }),

  encounteredIssues: Joi.string()
    .valid("Yes, I encountered issues.", "No, the process was smooth.")
    .optional()
    .allow(null)
    .messages({
      "any.only":
        "encounteredIssues must be one of: Yes, I encountered issues. / No, the process was smooth.",
    }),

  issueDescription: Joi.when("encounteredIssues", {
    is: "Yes, I encountered issues.",
    then: Joi.string().trim().max(1000).optional().allow("", null).messages({
      "string.max": "Issue description must not exceed 1000 characters",
    }),
    otherwise: Joi.any().strip(),
  }),

  instructionClarityRating: Joi.number()
    .integer()
    .min(1)
    .max(7)
    .optional()
    .allow(null)
    .messages({
      "number.base": "instructionClarityRating must be a number",
      "number.integer": "instructionClarityRating must be an integer",
      "number.min": "Rating must be between 1 and 7",
      "number.max": "Rating must be between 1 and 7",
    }),
});

const updateSubmissionSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(150).optional().messages({
    "string.min": "Full name must be at least 2 characters",
    "string.max": "Full name must not exceed 150 characters",
  }),

  emailAddress: Joi.string().trim().email().lowercase().optional().messages({
    "string.email": "Please provide a valid email address",
  }),

  dateOfSubmission: Joi.date().optional().messages({
    "date.base": "Please provide a valid date",
  }),

  timeOfSubmission: Joi.string()
    .pattern(/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/)
    .optional()
    .messages({
      "string.pattern.base": "Time must be in the format HH:MM AM/PM",
    }),

  submissionStatus: Joi.object({
    englishTestUploaded: Joi.boolean().valid(true).optional().messages({
      "any.only": "You must confirm the English Test has been uploaded",
    }),
    problemSolvingTestUploaded: Joi.boolean().valid(true).optional().messages({
      "any.only": "You must confirm the Problem Solving Test has been uploaded",
    }),
  }).optional(),

  englishTestScore: Joi.string().trim().min(1).max(20).optional().messages({
    "string.min": "English test score is required",
    "string.max": "English test score must not exceed 20 characters",
  }),

  problemSolvingScore: Joi.string().trim().min(1).max(20).optional().messages({
    "string.min": "Problem solving score is required",
    "string.max": "Problem solving score must not exceed 20 characters",
  }),

  googleDriveLink: Joi.string().trim().uri().max(500).optional().messages({
    "string.uri": "Please provide a valid Google Drive link",
    "string.max": "Google Drive link must not exceed 500 characters",
  }),

  encounteredIssues: Joi.string()
    .valid("Yes, I encountered issues.", "No, the process was smooth.")
    .optional()
    .allow(null)
    .messages({
      "any.only":
        "encounteredIssues must be one of: Yes, I encountered issues. / No, the process was smooth.",
    }),

  issueDescription: Joi.when("encounteredIssues", {
    is: "Yes, I encountered issues.",
    then: Joi.string().trim().max(1000).optional().allow("", null).messages({
      "string.max": "Issue description must not exceed 1000 characters",
    }),
    otherwise: Joi.any().strip(),
  }),

  instructionClarityRating: Joi.number()
    .integer()
    .min(1)
    .max(7)
    .optional()
    .allow(null)
    .messages({
      "number.base": "instructionClarityRating must be a number",
      "number.integer": "instructionClarityRating must be an integer",
      "number.min": "Rating must be between 1 and 7",
      "number.max": "Rating must be between 1 and 7",
    }),
})
  .min(1)
  .messages({
    "object.min": "At least one field is required to update a submission",
  });

module.exports = {
  createSubmissionSchema,
  updateSubmissionSchema,
  submissionIdParamSchema,

  validateCreateSubmission: validateSchema(createSubmissionSchema),
  validateUpdateSubmission: validateSchema(updateSubmissionSchema),
  validateSubmissionId: validateSchema(submissionIdParamSchema, "params"),
  validateUserIdParam: validateSchema(userIdParamSchema, "params"),
};
