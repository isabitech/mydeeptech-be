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
    tasklink: Joi.string().uri({ scheme: ['http', 'https'] }) // Validates URLs with http/https
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
module.exports = { signupSchema, loginSchema, projectSchema, taskSchema};
