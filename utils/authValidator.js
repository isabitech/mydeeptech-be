const Joi = require("joi");

// Signup validation schema

const signupSchema = Joi.object({
  fullName: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string()
    .pattern(/^[0-9+\-\s()]+$/)
    .min(7)
    .max(20)
    .required(),
    country: Joi.string().min(2).max(100).optional(),
    nativeLanguages: Joi.array().items(Joi.string().max(50)).optional(),
    otherLanguages: Joi.array().items(Joi.string().max(50)).optional(),
    primaryLanguage: Joi.string().valid("").optional(),
    englishFluencyLevel: Joi.string().valid("").optional(),
  domains: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        name: Joi.string().optional(),
      }),
    )
    .min(1)
    .required(),
  socialsFollowed: Joi.array().items(Joi.string().trim()).optional(),
  consent: Joi.string().valid("yes", "no").required(),
});

const resendVerificationEmailSchema = Joi.object({
  email: Joi.string().email().required(),
});

const idSchema = Joi.object({
  id: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "ID must be a valid MongoDB ObjectId",
    }),
});

// Login validation schema
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Project validation schema
const projectSchema = Joi.object({
  projectName: Joi.string().min(4).required(),
  company: Joi.string().min(3).required(),
  dueDate: Joi.date()
    .greater("now") // Ensure the date is in the future
    .required() // Ensure the field is mandatory
    .messages({
      "date.greater": "Due date must be in the future", // Custom error message for invalid due date
      "any.required": "Due date is required", // Custom error message for missing due date
    }),
});

const VALID_LABELS = ['Front', 'Right', 'Left', 'Bottom'];

const createTaskValidator = Joi.object({
  taskTitle: Joi.string()
    .min(4)
    .required()
    .messages({
      "string.base": "Task title must be a string.",
      "string.empty": "Task title cannot be empty.",
      "string.min": "Task title must be at least 4 characters.",
      "any.required": "Task title is required.",
    }),

    description: Joi.string()
    .min(10)
    .max(500)
    .required()
    .messages({
      "string.base": "Description must be a string.",
      "string.empty": "Description cannot be empty.",
      "string.min": "Description must be at least 10 characters.",
      "string.max": "Description cannot exceed 500 characters.",
      "any.required": "Description is required.",
    }),

    category: Joi.string()
    .valid('mask_collection', 'text_annotation', 'audio_annotation', 'video_annotation', 'age_progression')
    .required()
    .messages({
      "any.only": "Category must be one of mask_collection, text_annotation, audio_annotation, video_annotation, or age_progression.",
      "any.required": "Category is required.",
    }),

      payRate: Joi.number()
    .positive()
    .required()
    .messages({
      "number.base": "Pay rate must be a number.",
      "number.positive": "Pay rate must be greater than 0.",
      "any.required": "Pay rate is required.",
    }),

  currency: Joi.string()
    .valid('USD', 'NGN', 'EUR', 'GBP')
    .required()
    .messages({
      "any.only": "Currency must be one of USD, NGN, EUR, GBP.",
      "any.required": "Currency is required.",
    }),
  maxParticipants: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      "number.base": "Max participants must be a number.",
      "number.integer": "Max participants must be an integer.",
      "number.min": "Max participants must be at least 1.",
    }),

  taskLink: Joi.string()
    .uri({ scheme: ["http", "https"] })
    .optional()
    .messages({
      "string.uri": "Invalid task link format.",
    }),

  taskGuidelineLink: Joi.string()
    .uri({ scheme: ["http", "https"] })
    .optional()
    .messages({
      "string.uri": "Invalid guideline link format.",
    }),

  instructions: Joi.string()
    .min(10)
    .required()
    .messages({
      "string.base": "Instructions must be a string.",
      "string.empty": "Instructions cannot be empty.",
      "string.min": "Instructions must be at least 10 characters.",
      "any.required": "Instructions are required.",
    }),

  quality_guidelines: Joi.string()
    .min(10)
    .required()
    .messages({
      "string.base": "Quality guidelines must be a string.",
      "string.empty": "Quality guidelines cannot be empty.",
      "string.min": "Quality guidelines must be at least 10 characters.",
      "any.required": "Quality guidelines are required.",
    }),

  dueDate: Joi.date()
    .greater("now")
    .required()
    .messages({
      "date.base": "Due date must be a valid date.",
      "date.greater": "Due date must be in the future.",
      "any.required": "Due date is required.",
    }),

  imageRequirements: Joi.array()
    .items(
      Joi.object({
        label: Joi.string()
          .valid(...VALID_LABELS)
          .required()
          .messages({
            "any.only": "Label must be one of Front, Right, Left, Bottom.",
            "any.required": "Image label is required.",
          }),

        requiredCount: Joi.number()
          .integer()
          .min(1)
          .default(4)
          .messages({
            "number.base": "Required count must be a number.",
            "number.min": "Required count must be at least 1.",
          }),
      })
    )
    .length(4) // enforce all 4 labels present
    .optional(),

  totalImagesRequired: Joi.number()
    .integer()
    .min(1)
    .default(20)
    .messages({
      "number.base": "Total images must be a number.",
    }),

  isActive: Joi.boolean().optional(),
});

const taskAssignmentSchema = Joi.object({
  taskId: Joi.string().min(5).required(),
  userIds: Joi.array().items(Joi.string().min(5)).required(),
});

// DTUser password setup schema
const dtUserPasswordSchema = Joi.object({
  userId: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
  }),
});

// DTUser login validation schema
const dtUserLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// DTUser profile update validation schema
const dtUserProfileUpdateSchema = Joi.object({
  // Personal info updates
  personalInfo: Joi.object({
    country: Joi.string().max(50).allow(""),
    date_of_birth: Joi.string().allow(""),
    dateOfBirth: Joi.string().allow(""),
    gender: Joi.string()
      .valid("male", "female", "other", "prefer_not_to_say", "")
      .allow(""),
    timeZone: Joi.string().max(50).allow(""),
    availableHoursPerWeek: Joi.number().min(0).max(168),
    preferredCommunicationChannel: Joi.string()
      .valid("email", "phone", "whatsapp", "telegram", "slack", "")
      .allow(""),
  }).optional(),

  // Payment info updates
  paymentInfo: Joi.object({
    accountName: Joi.string().max(100).allow(""),
    accountNumber: Joi.string().max(50).allow(""),
    bankName: Joi.string().max(100).allow(""),
    bank_slug: Joi.string().allow(""), // For Paystack integration
    bankCode: Joi.string().max(50).allow(""), // For Paystack integration
    paymentMethod: Joi.string()
      .valid("bank_transfer", "paypal", "crypto", "mobile_money", "")
      .allow(""),
    paymentCurrency: Joi.string()
      .valid(
        "USD",
        "EUR",
        "GBP",
        "NGN",
        "KES",
        "GHS",
        "CAD",
        "AUD",
        "ZAR",
        "EGP",
        "",
      )
      .allow(""),
  }).optional(),

  // Professional background updates
  professionalBackground: Joi.object({
    educationField: Joi.string().max(100).allow(""),
    yearsOfExperience: Joi.number().min(0).max(50),
    annotationExperienceTypes: Joi.array().items(
      Joi.string().valid(
        "text_annotation",
        "image_annotation",
        "audio_annotation",
        "video_annotation",
        "data_labeling",
        "content_moderation",
        "transcription",
        "translation",
      ),
    ),
  }).optional(),

  // Tool experience updates
  toolExperience: Joi.array()
    .items(
      Joi.string().valid(
        "labelbox",
        "scale_ai",
        "cvat",
        "e2f",
        "appen",
        "clickworker",
        "mechanical_turk",
        "toloka",
        "remotasks",
        "annotator_tools",
        "custom_platforms",
      ),
    )
    .optional(),

  // Annotation skills updates
  annotationSkills: Joi.array()
    .items(
      Joi.string().valid(
        "text_annotation",
        "image_annotation",
        "video_annotation",
        "audio_annotation",
        "sentiment_analysis",
        "entity_recognition",
        "classification",
        "object_detection",
        "semantic_segmentation",
        "transcription",
        "translation",
        "content_moderation",
        "data_entry",
      ),
    )
    .optional(),

  // Language proficiency updates
  languageProficiency: Joi.object({
    primaryLanguage: Joi.string().max(50).allow(""),
    nativeLanguages: Joi.array().items(Joi.string().max(50)),
    otherLanguages: Joi.array().items(Joi.string().max(50)),
    englishFluencyLevel: Joi.string()
      .valid("basic", "intermediate", "advanced", "fluent", "native", "")
      .allow(""),
  }).optional(),

  // System info updates
  systemInfo: Joi.object({
    deviceType: Joi.string()
      .valid("desktop", "laptop", "tablet", "mobile", "")
      .allow(""),
    operatingSystem: Joi.string()
      .valid("windows", "macos", "linux", "android", "ios", "")
      .allow(""),
    internetSpeedMbps: Joi.number().min(0).max(10000),
    powerBackup: Joi.boolean(),
    hasWebcam: Joi.boolean(),
    hasMicrophone: Joi.boolean(),
  }).optional(),

  // Project preferences updates
  projectPreferences: Joi.object({
    domainsOfInterest: Joi.array().items(Joi.string().max(50)),
    availabilityType: Joi.string()
      .valid("full_time", "part_time", "project_based", "flexible", "")
      .allow(""),
    ndaSigned: Joi.boolean(),
  }).optional(),

  // Attachments updates
  attachments: Joi.object({
    resumeUrl: Joi.string().uri().allow(""),
    idDocumentUrl: Joi.string().uri().allow(""),
    workSamplesUrl: Joi.array().items(Joi.string().uri()),
  }).optional(),
});

// Admin creation validation schema
const adminCreateSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().min(10).max(15).required(),
  password: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
  }),
  adminKey: Joi.string().required(), // Special admin creation key
});

// Admin verification request schema (Step 1)
const adminVerificationRequestSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().min(10).max(15).required(),
  password: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
  }),
  adminKey: Joi.string().required(),
});

// Admin verification confirm schema (Step 2)
const adminVerificationConfirmSchema = Joi.object({
  email: Joi.string().email().required(),
  verificationCode: Joi.string().length(6).required(),
  adminKey: Joi.string().required(),
});

// Existing admin OTP verification schema (no admin key required)
const existingAdminVerificationSchema = Joi.object({
  email: Joi.string().email().required(),
  verificationCode: Joi.string().length(6).required(),
});

// Admin resend OTP schema - for resending verification codes
const adminResendOTPSchema = Joi.object({
  email: Joi.string().email().required(),
  adminKey: Joi.string().required(),
});

// Admin resend OTP schema for existing users - no admin key required
const existingAdminResendOTPSchema = Joi.object({
  email: Joi.string().email().required(),
});

// DTUser password reset schema
const dtUserPasswordResetSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
  confirmNewPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "New passwords do not match",
    }),
});

module.exports = {
  signupSchema,
  loginSchema,
  projectSchema,
  taskAssignmentSchema,
  dtUserPasswordSchema,
  dtUserLoginSchema,
  dtUserProfileUpdateSchema,
  adminCreateSchema,
  adminVerificationRequestSchema,
  adminVerificationConfirmSchema,
  existingAdminVerificationSchema,
  adminResendOTPSchema,
  existingAdminResendOTPSchema,
  dtUserPasswordResetSchema,
  createTaskValidator,
};
