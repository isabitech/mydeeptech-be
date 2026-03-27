// validations/candidateTestSubmission.validation.js
const Joi = require("joi");
const validateSchema = require("../middleware/validate-schema.middleware");

const BRITISH_COUNCIL_BANDS = [
  { grade: "Pre-A1", level: "Beginner", min: 0, max: 99 },
  { grade: "A1", level: "Elementary", min: 100, max: 199 },
  { grade: "A2", level: "Pre Intermediate", min: 200, max: 299 },
  { grade: "B1", level: "Intermediate", min: 300, max: 399 },
  { grade: "B2", level: "Upper Intermediate", min: 400, max: 499 },
  { grade: "C1", level: "Advanced", min: 500, max: 599 },
];

function validateReviewRating(value, helpers) {
  if (!value || Object.keys(value).length === 0) return value;

  const { grade, score, level } = value;

  // If score is provided, ensure it sits in a defined band and other fields align.
  if (score !== undefined && score !== null) {
    const band = BRITISH_COUNCIL_BANDS.find(
      (b) => score >= b.min && score <= b.max,
    );

    if (!band) {
      return helpers.error("any.custom", {
        message: "score must be between 0 and 599 and within a defined band",
      });
    }

    if (grade && grade !== band.grade) {
      return helpers.error("any.custom", {
        message: `grade must be ${band.grade} for score ${score} (band range: ${band.min}-${band.max})`,
      });
    }

    if (level && level !== band.level) {
      return helpers.error("any.custom", {
        message: `level must be ${band.level} for score ${score} (band range: ${band.min}-${band.max})`,
      });
    }

    // If grade/level omitted, they implicitly match band; allow value to pass.
  }

  return value;
}

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

  englishTestScore: Joi.number().min(0).max(599).optional().messages({
    "number.base": "English test score must be a number",
    "number.min": "English test score must be at least 0",
    "number.max": "English test score must not exceed 599",
  }),

  problemSolvingScore: Joi.number().min(0).max(599).optional().messages({
    "number.base": "Problem solving score must be a number",
    "number.min": "Problem solving score must be at least 0",
    "number.max": "Problem solving score must not exceed 599",
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

  reviewerComment: Joi.string()
    .trim()
    .max(2000)
    .optional()
    .allow(null, '')
    .messages({
      "string.max": "Reviewer comment must not exceed 2000 characters",
    }),

  reviewRating: Joi.alternatives()
    .try(
      Joi.string().valid("Pre-A1", "A1", "A2", "B1", "B2", "C1").messages({
        "any.only": "reviewRating must be one of: Pre-A1, A1, A2, B1, B2, C1",
      }),
      Joi.object({
        grade: Joi.string()
          .valid("Pre-A1", "A1", "A2", "B1", "B2", "C1")
          .optional()
          .allow(null)
          .messages({
            "any.only": "grade must be one of: Pre-A1, A1, A2, B1, B2, C1",
          }),
        score: Joi.number().min(0).max(599).optional().allow(null).messages({
          "number.base": "score must be a number",
          "number.min": "score must be between 0 and 599",
          "number.max": "score must be between 0 and 599",
        }),
        level: Joi.string()
          .valid(
            "Beginner",
            "Elementary",
            "Pre Intermediate",
            "Intermediate",
            "Upper Intermediate",
            "Advanced",
          )
          .optional()
          .allow(null)
          .messages({
            "any.only":
              "level must be one of: Beginner, Elementary, Pre Intermediate, Intermediate, Upper Intermediate, Advanced",
          }),
      }).messages({
        "object.base": "reviewRating must be an object",
      }),
    )
    .optional()
    .allow(null),
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
