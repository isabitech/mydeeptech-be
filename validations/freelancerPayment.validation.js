const Joi = require('joi');
const validateSchema = require('../middleware/validate-schema.middleware');

// Common validation schemas
const mongoIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
    'string.pattern.base': 'ID must be a valid MongoDB ObjectId'
});

const emailSchema = Joi.string().email().trim().lowercase().required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required'
});

const phoneSchema = Joi.string().trim().min(10).max(15).pattern(/^[\+]?[0-9\-\(\)\s]+$/).messages({
    'string.pattern.base': 'Please provide a valid phone number'
});

const amountSchema = Joi.number().positive().precision(2).required().messages({
    'number.positive': 'Amount must be greater than 0',
    'any.required': 'Amount is required'
});

// Initialize payment validation
const initializePaymentSchema = Joi.object({
    freelancerId: mongoIdSchema.required().messages({
        'any.required': 'Freelancer ID is required'
    }),
    projectId: mongoIdSchema.required().messages({
        'any.required': 'Project ID is required'
    }),
    invoiceId: mongoIdSchema.optional(),
    amount: amountSchema,
    currency: Joi.string().valid('NGN', 'USD', 'GHS', 'KES', 'ZAR').default('NGN').messages({
        'any.only': 'Currency must be one of: NGN, USD, GHS, KES, ZAR'
    }),
    customerEmail: emailSchema,
    customerName: Joi.string().trim().min(2).max(100).required().messages({
        'string.min': 'Customer name must be at least 2 characters',
        'string.max': 'Customer name must not exceed 100 characters',
        'any.required': 'Customer name is required'
    }),
    customerPhone: phoneSchema.optional(),
    description: Joi.string().trim().max(500).default('Freelancer service payment').messages({
        'string.max': 'Description must not exceed 500 characters'
    }),
    metadata: Joi.object().optional(),
    callbackUrl: Joi.string().uri().optional().messages({
        'string.uri': 'Callback URL must be a valid URL'
    }),
    channels: Joi.array().items(
        Joi.string().valid('card', 'bank', 'ussd', 'qr', 'mobile_money')
    ).optional().default(['card', 'bank', 'ussd', 'qr', 'mobile_money']).messages({
        'array.includesRequiredUnknowns': 'Invalid payment channel'
    }),
    initiatedBy: mongoIdSchema.optional() // This might come from auth middleware
});

// Payment reference validation
const paymentReferenceSchema = Joi.object({
    reference: Joi.string().trim().min(3).max(100).required().messages({
        'string.min': 'Payment reference must be at least 3 characters',
        'string.max': 'Payment reference must not exceed 100 characters',
        'any.required': 'Payment reference is required'
    })
});

// Payment ID validation
const paymentIdSchema = Joi.object({
    paymentId: mongoIdSchema.required().messages({
        'any.required': 'Payment ID is required'
    })
});

// Freelancer ID validation
const freelancerIdSchema = Joi.object({
    freelancerId: mongoIdSchema.required().messages({
        'any.required': 'Freelancer ID is required'
    })
});

// Project ID validation
const projectIdSchema = Joi.object({
    projectId: mongoIdSchema.required().messages({
        'any.required': 'Project ID is required'
    })
});

// Pagination validation
const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
        'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).default(10).messages({
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit must not exceed 100'
    }),
    status: Joi.string().valid(
        'pending', 
        'processing', 
        'success', 
        'failed', 
        'abandoned', 
        'cancelled'
    ).optional().messages({
        'any.only': 'Status must be one of: pending, processing, success, failed, abandoned, cancelled'
    }),
    search: Joi.string().trim().max(100).optional().messages({
        'string.max': 'Search term must not exceed 100 characters'
    })
});

// Cancel payment validation
const cancelPaymentSchema = Joi.object({
    reason: Joi.string().trim().max(200).default('Payment cancelled by user').messages({
        'string.max': 'Cancellation reason must not exceed 200 characters'
    })
});

// Payment stats validation
const paymentStatsSchema = Joi.object({
    freelancerId: mongoIdSchema.optional(),
    projectId: mongoIdSchema.optional(),
    startDate: Joi.date().iso().optional().messages({
        'date.format': 'Start date must be a valid ISO date'
    }),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional().messages({
        'date.format': 'End date must be a valid ISO date',
        'date.min': 'End date must be after start date'
    })
});

// Webhook validation
const webhookSchema = Joi.object({
    event: Joi.string().required().messages({
        'any.required': 'Webhook event is required'
    }),
    data: Joi.object().required().messages({
        'any.required': 'Webhook data is required'
    })
});

// Update payment validation
const updatePaymentSchema = Joi.object({
    status: Joi.string().valid(
        'pending', 
        'processing', 
        'success', 
        'failed', 
        'abandoned', 
        'cancelled'
    ).optional(),
    failureReason: Joi.string().trim().max(200).optional(),
    metadata: Joi.object().optional(),
    customerPhone: phoneSchema.optional(),
    description: Joi.string().trim().max(500).optional()
});

// Date range validation
const dateRangeSchema = Joi.object({
    startDate: Joi.date().iso().required().messages({
        'date.format': 'Start date must be a valid ISO date',
        'any.required': 'Start date is required'
    }),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required().messages({
        'date.format': 'End date must be a valid ISO date',
        'date.min': 'End date must be after start date',
        'any.required': 'End date is required'
    })
});

// Refund validation (for future use)
const refundSchema = Joi.object({
    amount: Joi.number().positive().precision(2).optional().messages({
        'number.positive': 'Refund amount must be greater than 0'
    }),
    reason: Joi.string().trim().max(200).required().messages({
        'string.max': 'Refund reason must not exceed 200 characters',
        'any.required': 'Refund reason is required'
    })
});

// Bulk payment validation
const bulkPaymentItemSchema = Joi.object({
    recipientId: mongoIdSchema.required().messages({
        'any.required': 'Recipient ID is required for each payment'
    }),
    projectId: mongoIdSchema.optional(),
    invoiceId: mongoIdSchema.optional(),
    amount: amountSchema,
    currency: Joi.string().valid('NGN', 'USD', 'GHS', 'KES', 'ZAR').optional(),
    customerEmail: emailSchema,
    customerName: Joi.string().trim().min(2).max(100).required().messages({
        'string.min': 'Customer name must be at least 2 characters',
        'string.max': 'Customer name must not exceed 100 characters',
        'any.required': 'Customer name is required for each payment'
    }),
    customerPhone: phoneSchema.optional(),
    description: Joi.string().trim().max(500).optional(),
    paymentType: Joi.string().valid(
        'freelancer_project', 
        'admin_bonus', 
        'stakeholder_dividend', 
        'consultant_fee', 
        'general', 
        'other'
    ).required().messages({
        'any.required': 'Payment type is required for each payment',
        'any.only': 'Payment type must be one of: freelancer_project, admin_bonus, stakeholder_dividend, consultant_fee, general, other'
    }),
    metadata: Joi.object().optional()
});

const bulkPaymentSchema = Joi.object({
    payments: Joi.array()
        .items(bulkPaymentItemSchema)
        .min(1)
        .max(50)
        .required()
        .messages({
            'array.min': 'At least 1 payment is required',
            'array.max': 'Maximum 50 payments allowed per bulk operation',
            'any.required': 'Payments array is required'
        }),
    currency: Joi.string().valid('NGN', 'USD', 'GHS', 'KES', 'ZAR').default('NGN'),
    description: Joi.string().trim().max(500).default('Bulk freelancer service payment'),
    callbackUrl: Joi.string().uri().optional(),
    channels: Joi.array().items(
        Joi.string().valid('card', 'bank', 'ussd', 'qr', 'mobile_money')
    ).optional().default(['card', 'bank', 'ussd', 'qr', 'mobile_money']),
    dryRun: Joi.boolean().optional().default(false).messages({
        'boolean.base': 'dryRun must be a boolean value'
    }),
    forceOverride: Joi.boolean().optional().default(false).messages({
        'boolean.base': 'forceOverride must be a boolean value'
    }),
    initiatedBy: mongoIdSchema.optional()
});

// Batch ID validation
const batchIdSchema = Joi.object({
    batchId: Joi.string().trim().min(3).max(100).required().messages({
        'string.min': 'Batch ID must be at least 3 characters',
        'string.max': 'Batch ID must not exceed 100 characters',
        'any.required': 'Batch ID is required'
    })
});

// Retry bulk payment validation
const retryBulkPaymentSchema = Joi.object({
    paymentReferences: Joi.array()
        .items(Joi.string().trim().min(3).max(100))
        .optional()
        .messages({'array.base': 'Payment references must be an array'}),
    initiatedBy: mongoIdSchema.optional()
});

// Cancel bulk payment validation
const cancelBulkPaymentSchema = Joi.object({
    reason: Joi.string().trim().max(200).default('Bulk operation cancelled by admin').messages({
        'string.max': 'Cancellation reason must not exceed 200 characters'
    })
});


// Transfer recipient creation validation
const createRecipientSchema = Joi.object({
    type: Joi.string().valid('nuban', 'ghipss', 'mobile_money').default('nuban').messages({
        'any.only': 'Type must be one of: nuban, ghipss, mobile_money'
    }),
    name: Joi.string().trim().min(2).max(100).required().messages({
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name must not exceed 100 characters',
        'any.required': 'Name is required'
    }),
    account_number: Joi.string().trim().min(10).max(10).required().messages({
        'string.min': 'Account number must be 10 digits',
        'string.max': 'Account number must be 10 digits',
        'any.required': 'Account number is required'
    }),
    bank_code: Joi.string().trim().min(3).max(6).required().messages({
        'string.min': 'Bank code must be at least 3 characters',
        'string.max': 'Bank code must not exceed 6 characters',
        'any.required': 'Bank code is required'
    }),
    currency: Joi.string().valid('NGN', 'USD', 'GHS', 'KES', 'ZAR').default('NGN').messages({
        'any.only': 'Currency must be one of: NGN, USD, GHS, KES, ZAR'
    }),
    email: emailSchema.optional(),
    description: Joi.string().trim().max(200).optional().messages({
        'string.max': 'Description must not exceed 200 characters'
    })
});

// Bulk transfer validation  
const bulkTransferSchema = Joi.object({
    transfers: Joi.array().items(
        Joi.object({
            recipient: Joi.string().trim().min(3).optional().messages({
                'string.min': 'Recipient code must be at least 3 characters'
            }),
            amount: amountSchema,
            reference: Joi.string().trim().min(1).max(100).optional().messages({
                'string.min': 'Reference cannot be empty',
                'string.max': 'Reference must not exceed 100 characters'
            }),
            reason: Joi.string().trim().max(200).optional().messages({
                'string.max': 'Reason must not exceed 200 characters'
            }),
            description: Joi.string().trim().max(200).optional().messages({
                'string.max': 'Description must not exceed 200 characters'
            }),
            recipientId: mongoIdSchema.required().messages({
                'any.required': 'Recipient ID is required'
            }),
            projectId: mongoIdSchema.optional(),
            invoiceId: mongoIdSchema.optional(),
            paymentType: Joi.string().valid(
                'freelancer_project',
                'admin_bonus',
                'stakeholder_dividend',
                'general'
            ).default('general').messages({
                'any.only': 'Payment type must be one of: freelancer_project, admin_bonus, stakeholder_dividend, general'
            }),
            customerEmail: emailSchema.optional(),
            customerName: Joi.string().trim().min(2).max(100).optional().messages({
                'string.min': 'Customer name must be at least 2 characters',
                'string.max': 'Customer name must not exceed 100 characters'
            }),
            customerPhone: phoneSchema.optional(),
            metadata: Joi.object().optional()
        })
    ).min(1).max(100).required().messages({
        'array.min': 'At least 1 transfer is required',
        'array.max': 'Maximum 100 transfers allowed',
        'any.required': 'Transfers array is required'
    }),
    currency: Joi.string().valid('NGN', 'USD', 'GHS', 'KES', 'ZAR').default('NGN').messages({
        'any.only': 'Currency must be one of: NGN, USD, GHS, KES, ZAR'
    }),
    source: Joi.string().valid('balance').default('balance').messages({
        'any.only': 'Source must be: balance'
    }),
    metadata: Joi.object().optional(),
    allowDuplicates: Joi.boolean().default(false).optional().messages({
        'boolean.base': 'Allow duplicates must be a boolean value'
    })
});


const bulkTransferPayloadSchema = Joi.object({
  transfers: Joi.array().items(
    Joi.object({
      invoiceId: mongoIdSchema.required().messages({
        'any.required': 'Invoice ID is required',
        'string.length': 'Invoice ID must be a valid MongoDB ObjectId'
      }),

      recipientName: Joi.string().trim().min(2).max(100).required().messages({
        'string.min': 'Recipient name must be at least 2 characters',
        'string.max': 'Recipient name must not exceed 100 characters',
        'any.required': 'Recipient name is required'
      }),

      recipientEmail: emailSchema.required().messages({
        'string.email': 'Recipient email must be a valid email address',
        'any.required': 'Recipient email is required'
      }),

      bankCode: Joi.string().trim().min(2).required().messages({
        'string.min': 'Bank code must be at least 2 characters',
        'any.required': 'Bank code is required'
      }),

      accountNumber: Joi.string()
        .pattern(/^\d{10}$/)
        .required()
        .messages({
          'string.pattern.base': 'Account number must be exactly 10 digits',
          'any.required': 'Account number is required'
        }),

      recipientPhone: phoneSchema.required().messages({
        'string.pattern.base': 'Recipient phone must be in international format',
        'any.required': 'Recipient phone is required'
      })
    })
  )
  .min(1)
  .max(100)
  .required()
  .messages({
    'array.min': 'At least 1 transfer is required',
    'array.max': 'Maximum 100 transfers allowed',
    'any.required': 'Transfers array is required'
  }),

  currency: Joi.string()
    .valid('NGN', 'KES')
    .default('NGN')
    .messages({
      'any.only': 'Currency must be one of: NGN, KES'
    }),

  source: Joi.string()
    .valid('balance')
    .default('balance')
    .messages({
      'any.only': 'Source must be: balance'
    }),

  metadata: Joi.object({
    initiated_from: Joi.string().trim().required().messages({
      'any.required': 'Initiated from is required'
    }),

    notes: Joi.string().trim().min(3).max(500).required().messages({
      'string.min': 'Notes must be at least 3 characters',
      'string.max': 'Notes must not exceed 500 characters',
      'any.required': 'Notes are required'
    }),

    batch_name: Joi.string().trim().min(3).max(100).required().messages({
      'string.min': 'Batch name must be at least 3 characters',
      'string.max': 'Batch name must not exceed 100 characters',
      'any.required': 'Batch name is required'
    }),

    selectedFilters: Joi.object({
      showNGNOnly: Joi.boolean().optional(),
      showKESOnly: Joi.boolean().optional()
    }).optional()
  })
  .required()
  .messages({
    'any.required': 'Metadata is required'
  })
  
  // Note: initiatedBy is automatically populated from req.user.id by the server
});

// Transfer verification schema
const transferReferenceSchema = Joi.object({
    reference: Joi.string().trim().min(1).required().messages({
        'string.min': 'Reference cannot be empty',
        'any.required': 'Transfer reference is required'
    })
});

module.exports = {
    // Schemas
    initializePaymentSchema,
    paymentReferenceSchema,
    paymentIdSchema,
    freelancerIdSchema,
    projectIdSchema,
    paginationSchema,
    cancelPaymentSchema,
    paymentStatsSchema,
    webhookSchema,
    updatePaymentSchema,
    dateRangeSchema,
    refundSchema,
    bulkPaymentSchema,
    batchIdSchema,
    retryBulkPaymentSchema,
    cancelBulkPaymentSchema,
    createRecipientSchema,
    bulkTransferSchema,
    transferReferenceSchema,
    
    // Validation middleware
    validateInitializePayment: validateSchema(initializePaymentSchema),
    validatePaymentReference: validateSchema(paymentReferenceSchema, 'params'),
    validatePaymentId: validateSchema(paymentIdSchema, 'params'),
    validateFreelancerId: validateSchema(freelancerIdSchema, 'params'),
    validateProjectId: validateSchema(projectIdSchema, 'params'),
    validatePagination: validateSchema(paginationSchema, 'query'),
    validateCancelPayment: validateSchema(cancelPaymentSchema),
    validatePaymentStats: validateSchema(paymentStatsSchema, 'query'),
    validateWebhook: validateSchema(webhookSchema),
    validateUpdatePayment: validateSchema(updatePaymentSchema),
    validateDateRange: validateSchema(dateRangeSchema, 'query'),
    validateRefund: validateSchema(refundSchema),
    validateBulkPayment: validateSchema(bulkPaymentSchema),
    validateBatchId: validateSchema(batchIdSchema, 'params'),
    validateRetryBulkPayment: validateSchema(retryBulkPaymentSchema),
    validateCancelBulkPayment: validateSchema(cancelBulkPaymentSchema),
    validateCreateRecipient: validateSchema(createRecipientSchema),
    validateBulkTransfer: validateSchema(bulkTransferPayloadSchema),
    validateTransferReference: validateSchema(transferReferenceSchema, 'params'),
    
    // Custom validation function
    validateSchema
};