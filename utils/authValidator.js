const Joi = require('joi');

// Signup validation schema
const signupSchema = Joi.object({
    firstname: Joi.string().min(3).max(30).required(),
    lastname: Joi.string().min(3).max(30).required(),
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    phone: Joi.string().required()
});

// Login validation schema
const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

// Project validation schema
const projectSchema = Joi.object({
    projectName: Joi.string().min(4).required(),
    company: Joi.string().min(3).required(),
    dueDate: Joi.date()
        .greater('now') // Ensure the date is in the future
        .required() // Ensure the field is mandatory
        .messages({
            'date.greater': 'Due date must be in the future', // Custom error message for invalid due date
            'any.required': 'Due date is required', // Custom error message for missing due date
        }),
});

const taskSchema = Joi.object({
    taskLink: Joi.string().uri({ scheme: ['http', 'https'] }) // Validates URLs with http/https
    .required()
    .messages({
        'string.base': 'URL must be a string.',
        'string.uri': 'Invalid URL format.',
        'any.required': 'URL is required.',
    }),
    taskGuidelineLink: Joi.string().uri({ scheme: ['http', 'https'] }) // Validates URLs with http/https
    .required()
    .messages({
        'string.base': 'URL must be a string.',
        'string.uri': 'Invalid URL format.',
        'any.required': 'URL is required.',
    }),
    taskName: Joi.string().min(4).required(),
    createdBy: Joi.string().min(4).required(),
    dueDate: Joi.date()
    .greater('now') // Ensure the date is in the future
    .required() // Ensure the field is mandatory
    .messages({
        'date.greater': 'Due date must be in the future', // Custom error message for invalid due date
        'any.required': 'Due date is required', // Custom error message for missing due date
    }),
});
const taskAssignmentSchema = Joi.object({
    taskId: Joi.string().min(5).required(),
    userId: Joi.string().min(5).required()
});

// DTUser password setup schema
const dtUserPasswordSchema = Joi.object({
    userId: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
        .messages({
            'any.only': 'Passwords do not match'
        })
});

// DTUser login validation schema
const dtUserLoginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

// DTUser profile update validation schema
const dtUserProfileUpdateSchema = Joi.object({
    // Personal info updates
    personalInfo: Joi.object({
        country: Joi.string().max(50).allow(''),
        timeZone: Joi.string().max(50).allow(''),
        availableHoursPerWeek: Joi.number().min(0).max(168),
        preferredCommunicationChannel: Joi.string().valid('email', 'phone', 'whatsapp', 'telegram', 'slack', '').allow('')
    }).optional(),

    // Payment info updates
    paymentInfo: Joi.object({
        accountName: Joi.string().max(100).allow(''),
        accountNumber: Joi.string().max(50).allow(''),
        bankName: Joi.string().max(100).allow(''),
        bankCode: Joi.string().max(50).allow(''), // For Paystack integration
        paymentMethod: Joi.string().valid('bank_transfer', 'paypal', 'crypto', 'mobile_money', '').allow(''),
        paymentCurrency: Joi.string().valid('USD', 'EUR', 'GBP', 'NGN', 'KES', 'GHS', '').allow('')
    }).optional(),

    // Professional background updates
    professionalBackground: Joi.object({
        educationField: Joi.string().max(100).allow(''),
        yearsOfExperience: Joi.number().min(0).max(50),
        annotationExperienceTypes: Joi.array().items(
            Joi.string().valid('text_annotation', 'image_annotation', 'audio_annotation', 'video_annotation', 
                              'data_labeling', 'content_moderation', 'transcription', 'translation')
        )
    }).optional(),

    // Tool experience updates
    toolExperience: Joi.array().items(
        Joi.string().valid('labelbox', 'scale_ai', 'cvat', 'e2f', 'appen', 'clickworker', 'mechanical_turk', 
                          'toloka', 'remotasks', 'annotator_tools', 'custom_platforms')
    ).optional(),

    // Annotation skills updates
    annotationSkills: Joi.array().items(
        Joi.string().valid('text_annotation', 'image_annotation', 'video_annotation', 'audio_annotation', 'sentiment_analysis', 'entity_recognition', 'classification', 'object_detection', 
                          'semantic_segmentation', 'transcription', 'translation', 'content_moderation', 'data_entry')
    ).optional(),

    // Language proficiency updates
    languageProficiency: Joi.object({
        primaryLanguage: Joi.string().max(50).allow(''),
        otherLanguages: Joi.array().items(Joi.string().max(50)),
        englishFluencyLevel: Joi.string().valid('basic', 'intermediate', 'advanced', 'native', '').allow('')
    }).optional(),

    // System info updates
    systemInfo: Joi.object({
        deviceType: Joi.string().valid('desktop', 'laptop', 'tablet', 'mobile', '').allow(''),
        operatingSystem: Joi.string().valid('windows', 'macos', 'linux', 'android', 'ios', '').allow(''),
        internetSpeedMbps: Joi.number().min(0).max(10000),
        powerBackup: Joi.boolean(),
        hasWebcam: Joi.boolean(),
        hasMicrophone: Joi.boolean()
    }).optional(),

    // Project preferences updates
    projectPreferences: Joi.object({
        domainsOfInterest: Joi.array().items(Joi.string().max(50)),
        availabilityType: Joi.string().valid('full_time', 'part_time', 'project_based', 'flexible', '').allow(''),
        ndaSigned: Joi.boolean()
    }).optional(),

    // Attachments updates
    attachments: Joi.object({
        resumeUrl: Joi.string().uri().allow(''),
        idDocumentUrl: Joi.string().uri().allow(''),
        workSamplesUrl: Joi.array().items(Joi.string().uri())
    }).optional()
});

// Admin creation validation schema
const adminCreateSchema = Joi.object({
    fullName: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().min(10).max(15).required(),
    password: Joi.string().min(8).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
        .messages({
            'any.only': 'Passwords do not match'
        }),
    adminKey: Joi.string().required() // Special admin creation key
});

// Admin verification request schema (Step 1)
const adminVerificationRequestSchema = Joi.object({
    fullName: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().min(10).max(15).required(),
    password: Joi.string().min(8).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
        .messages({
            'any.only': 'Passwords do not match'
        }),
    adminKey: Joi.string().required()
});

// Admin verification confirm schema (Step 2)
const adminVerificationConfirmSchema = Joi.object({
    email: Joi.string().email().required(),
    verificationCode: Joi.string().length(6).required(),
    adminKey: Joi.string().required()
});

// DTUser password reset schema
const dtUserPasswordResetSchema = Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
    confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required()
        .messages({
            'any.only': 'New passwords do not match'
        })
});

module.exports = { 
    signupSchema, 
    loginSchema, 
    projectSchema, 
    taskSchema, 
    taskAssignmentSchema, 
    dtUserPasswordSchema, 
    dtUserLoginSchema,
    dtUserProfileUpdateSchema,
    adminCreateSchema,
    adminVerificationRequestSchema,
    adminVerificationConfirmSchema,
    dtUserPasswordResetSchema
};
