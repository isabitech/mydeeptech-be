const PaystackPaymentService = require("../services/paystack-payment.service");
const PaystackTransferService = require("../services/paystack-transfer.service");
const ResponseClass = require("../utils/response-handler");
const FreelancerPaymentRepository = require("../repositories/freelancerPayment.repository");
const DTUser = require("../models/dtUser.model");
const AnnotationProject = require("../models/annotationProject.model");

// Initialize payment for freelancer
const initializeFreelancerPayment = async (req, res, next) => {
  try {
    const {
      freelancerId, 
      projectId, 
      invoiceId,
      amount, 
      currency,
      customerEmail, 
      customerName,
      customerPhone,
      description,
      metadata,
      callbackUrl,
      channels
    } = req.body;

    const payload = {
      freelancerId,
      projectId,
      invoiceId,
      amount,
      currency,
      customerEmail,
      customerName,
      customerPhone,
      description,
      metadata,
      callbackUrl,
      channels,
      initiatedBy: req.user?.id || req.body.initiatedBy, // Assuming user is attached by auth middleware
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };

    const result = await PaystackPaymentService.initializePayment(payload);

    return ResponseClass.Success(res, { message: "Payment initialized successfully", data: result });
  } catch (err) {
    next(err);
  }
};

// Verify payment
const verifyPayment = async (req, res, next) => {
  try {

    const { reference } = req.params;

    if (!reference) {
      return ResponseClass.Error(res, {message: "Payment reference is required", statusCode: 400 });
    }

    const result = await PaystackPaymentService.verifyPayment(reference);

    return ResponseClass.Success(res, {  message: "Payment verified successfully", data: result });
  } catch (err) {
    next(err);
  }
};

// Handle Paystack webhooks
const handleWebhook = async (req, res, next) => {
  try {

    const signature = req.get('x-paystack-signature');
    const payload = req.body;

    if (!signature) {
      return ResponseClass.Error(res, { message: "Missing webhook signature", statusCode: 400 });
    }

    await PaystackPaymentService.handleWebhook(payload, signature);
    
    return res.status(200).json({ status: 'success' });
  } catch (err) {
    next(err);
  }
};

// Get payment details by ID
const getPaymentDetails = async (req, res, next) => {
  try {

    const { paymentId } = req.params;
    
    if (!paymentId) {
      return ResponseClass.Error(res, { message: "Payment ID is required", statusCode: 400  });
    }

    const payment = await PaystackPaymentService.getPaymentDetails(paymentId);
    
    return ResponseClass.Success(res, {  message: "Payment details retrieved successfully", data: { payment }  });
  } catch (err) {
    next(err);
  }
};

// Get freelancer payments
const getFreelancerPayments = async (req, res, next) => {
  try {

    const { freelancerId } = req.params;

    const { page = 1, limit = 10, status } = req.query;

    if (!freelancerId) {
      return ResponseClass.Error(res, {  message: "Freelancer ID is required", statusCode: 400  });
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    };

    const result = await PaystackPaymentService.getFreelancerPayments(freelancerId, options);

    return ResponseClass.Success(res, {  message: "Freelancer payments retrieved successfully", data: result });
  } catch (err) {
    next(err);
  }
};

// Get project payments
const getProjectPayments = async (req, res, next) => {

  try {

    const { projectId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    if (!projectId) {
      return ResponseClass.Error(res, { message: "Project ID is required", statusCode: 400 });
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    };

    const result = await PaystackPaymentService.getProjectPayments(projectId, options);

    return ResponseClass.Success(res, {  message: "Project payments retrieved successfully",  data: result  });
  } catch (err) {
    next(err);
  }
};

// Get all payments (admin function)
const getAllPayments = async (req, res, next) => {

  try {

    const { page = 1, limit = 10, status, search } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      search
    };

    const result = await PaystackPaymentService.getAllPayments(options);
    
    return ResponseClass.Success(res, { message: "Payments retrieved successfully", data: result });
  } catch (err) {
    next(err);
  }
};

// Get payment statistics
const getPaymentStats = async (req, res, next) => {

  try {

    const { freelancerId, projectId, startDate, endDate } = req.query;

    const filters = {
      ...(freelancerId && { freelancerId }),
      ...(projectId && { projectId }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate })
    };

    const stats = await PaystackPaymentService.getPaymentStats(filters);
    
    return ResponseClass.Success(res, { message: "Payment statistics retrieved successfully", data: { stats } });
  } catch (err) {
    next(err);
  }
};

// Cancel payment
const cancelPayment = async (req, res, next) => {

  try {

    const { paymentId } = req.params;
    const { reason } = req.body;
    
    if (!paymentId) {
      return ResponseClass.Error(res, {  message: "Payment ID is required", statusCode: 400 });
    }

    const payment = await PaystackPaymentService.cancelPayment(paymentId, reason);
    
    return ResponseClass.Success(res, { message: "Payment cancelled successfully", data: { payment } });
  } catch (err) {
    next(err);
  }
};

// Get payment by reference (for callback handling)
const getPaymentByReference = async (req, res, next) => {

  try {

    const { reference } = req.params;
    
    if (!reference) {
      return ResponseClass.Error(res, { message: "Payment reference is required", statusCode: 400 });
    }

    // First verify the payment to get latest status
    const result = await PaystackPaymentService.verifyPayment(reference);
    
    return ResponseClass.Success(res, { message: "Payment retrieved successfully", data: result  });
  } catch (err) {
    next(err);
  }
};

// Get pending payments (admin function)
const getPendingPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status: 'pending'
    };

    const result = await PaystackPaymentService.getAllPayments(options);
    
    return ResponseClass.Success(res, { message: "Pending payments retrieved successfully", data: result });
  } catch (err) {
    next(err);
  }
};

// Get failed payments (admin function)
const getFailedPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status: 'failed'
    };

    const result = await PaystackPaymentService.getAllPayments(options);
    
    return ResponseClass.Success(res, { message: "Failed payments retrieved successfully", data: result });
  } catch (err) {
    next(err);
  }
};

// Get successful payments (admin function)
const getSuccessfulPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status: 'success'
    };

    const result = await PaystackPaymentService.getAllPayments(options);
    
    return ResponseClass.Success(res, { message: "Successful payments retrieved successfully", data: result });
  } catch (err) {
    next(err);
  }
};

// Create transfer recipient for bulk transfers
const createTransferRecipient = async (req, res, next) => {
  try {
    const {
      type = 'nuban',
      name,
      account_number,
      bank_code,
      currency = 'NGN',
      email,
      description
    } = req.body;

    if (!name || !account_number || !bank_code) {
      return ResponseClass.Error(res, {
        message: "Name, account number, and bank code are required",
        statusCode: 400
      });
    }

    const recipientData = {
      type,
      name,
      account_number,
      bank_code,
      currency,
      email,
      description
    };

    const result = await PaystackTransferService.createRecipient(recipientData);
    
    return ResponseClass.Success(res, {
      message: "Transfer recipient created successfully",
      data: result
    });
  } catch (err) {
    next(err);
  }
};

// Get list of banks for recipient creation
const getBanks = async (req, res, next) => {
  try {
    const { country = 'nigeria' } = req.query;
    
    const result = await PaystackTransferService.listBanks(country);
    
    return ResponseClass.Success(res, {
      message: "Banks retrieved successfully",
      data: result
    });
  } catch (err) {
    next(err);
  }
};

// Initiate bulk transfers using Paystack's native bulk transfer API
const initializeBulkTransfer = async (req, res, next) => {
  try {
    const {
      transfers,
      currency = 'NGN',
      source = 'balance',
      metadata = {}
    } = req.body;

    // Check if user is authenticated
    const initiatedBy = req.user?.userId || req.body.initiatedBy;
    if (!initiatedBy) {
      return ResponseClass.Error(res, {
        message: "Authentication required. Please provide a valid user token or initiatedBy field.",
        statusCode: 401
      });
    }

    // Validate inputs
    if (!transfers || !Array.isArray(transfers) || transfers.length === 0) {
      return ResponseClass.Error(res, {
        message: "Transfers array is required and must not be empty",
        statusCode: 400
      });
    }

    if (transfers.length > 100) {
      return ResponseClass.Error(res, {
        message: "Maximum 100 transfers allowed per bulk operation",
        statusCode: 400
      });
    }

    // Validate each transfer has required fields
    const validationErrors = [];
    for (let i = 0; i < transfers.length; i++) {
      const transfer = transfers[i];
      if (!transfer.recipientId) {
        validationErrors.push(`Transfer ${i + 1}: recipientId is required`);
      }
      if (!transfer.amount || transfer.amount <= 0) {
        validationErrors.push(`Transfer ${i + 1}: valid amount is required`);
      }
      if (!transfer.reference) {
        // Auto-generate reference if not provided
        transfer.reference = `transfer_${transfer.recipientId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      }
    }

    if (validationErrors.length > 0) {
      return ResponseClass.Error(res, {
        message: "Validation errors found",
        statusCode: 400,
        data: { errors: validationErrors }
      });
    }

    // Get unique recipient IDs and fetch user data including bank details
    const recipientIds = [...new Set(transfers.map(t => t.recipientId))];
    console.log('Fetching users with IDs:', recipientIds);
    
    const recipients = await DTUser.find({ _id: { $in: recipientIds } })
      .select('_id fullName email payment_info');

    console.log('Found recipients:', recipients.map(r => ({
      id: r._id,
      name: r.fullName,
      email: r.email,
      hasPaymentInfo: !!r.payment_info,
      hasAccountNumber: !!r.payment_info?.account_number,
      hasBankCode: !!r.payment_info?.bank_code
    })));

    if (recipients.length !== recipientIds.length) {
      const foundIds = recipients.map(r => r._id.toString());
      const missingIds = recipientIds.filter(id => !foundIds.includes(id.toString()));
      return ResponseClass.Error(res, {
        message: "Some recipients not found in database",
        statusCode: 404,
        data: { missingRecipients: missingIds }
      });
    }

    // Create recipients and prepare transfers
    const recipientMap = new Map(recipients.map(r => [r._id.toString(), r]));
    const enhancedTransfers = [];
    const recipientCreationPromises = [];

    for (const transfer of transfers) {
      const user = recipientMap.get(transfer.recipientId.toString());
      
      console.log(`Processing transfer for user ${user.fullName}:`, {
        hasPaymentInfo: !!user.payment_info,
        accountNumber: user.payment_info?.account_number || 'Missing',
        originalBankCode: user.payment_info?.bank_code || 'Missing',
        mappedBankCode: user.payment_info?.bank_code ? mapBankNameToCode(user.payment_info.bank_code) : 'Missing',
        accountName: user.payment_info?.account_name || 'Will use fullName'
      });
      
      // Check if user has bank details
      if (!user.payment_info?.account_number || !user.payment_info?.bank_code) {
        validationErrors.push(
          `User ${user.fullName} (${transfer.recipientId}) missing required bank account details. ` +
          `Missing: ${!user.payment_info?.account_number ? 'account_number ' : ''}${!user.payment_info?.bank_code ? 'bank_code' : ''}`
        );
        continue;
      }

      // Create Paystack recipient for this user
      const recipientPromise = PaystackTransferService.createRecipient({
        type: 'nuban',
        name: user.payment_info?.account_name || user.fullName,
        account_number: user.payment_info.account_number,
        bank_code: mapBankNameToCode(user.payment_info.bank_code),
        currency: transfer.currency || currency,
        email: user.email,
        description: `Transfer recipient for ${user.fullName}`
      }).then(result => ({
        userId: transfer.recipientId,
        recipientCode: result.recipient_code,
        transfer
      })).catch(error => ({
        userId: transfer.recipientId,
        error: error.message,
        transfer
      }));

      recipientCreationPromises.push(recipientPromise);
    }

    if (validationErrors.length > 0) {
      return ResponseClass.Error(res, {
        message: "Bank details validation errors found",
        statusCode: 400,
        data: { errors: validationErrors }
      });
    }

    // Wait for all recipients to be created
    const recipientResults = await Promise.all(recipientCreationPromises);
    
    // Check for recipient creation failures
    const failedRecipients = recipientResults.filter(r => r.error);
    if (failedRecipients.length > 0) {
      return ResponseClass.Error(res, {
        message: "Failed to create some transfer recipients",
        statusCode: 400,
        data: { 
          failures: failedRecipients.map(f => ({
            recipientId: f.userId,
            error: f.error
          }))
        }
      });
    }

    // Prepare transfers for Paystack with recipient codes
    const paystackTransfers = recipientResults.map(result => {
      const transfer = result.transfer;
      const user = recipientMap.get(transfer.recipientId.toString());
      
      return {
        recipient: result.recipientCode,
        amount: transfer.amount, // Keep in naira - service will convert to kobo
        reference: transfer.reference,
        reason: transfer.reason || transfer.description || `Payment to ${user.fullName}`,
        recipientId: transfer.recipientId,
        projectId: transfer.projectId || null,
        invoiceId: transfer.invoiceId || null,
        paymentType: transfer.paymentType || 'general',
        customerEmail: transfer.customerEmail || user.email,
        customerName: transfer.customerName || user.fullName,
        customerPhone: transfer.customerPhone || null,
        metadata: transfer.metadata || {}
      };
    });

    // Execute bulk transfer
    const transferData = {
      transfers: paystackTransfers,
      currency,
      source,
      initiatedBy,
      metadata
    };

    const result = await PaystackTransferService.initiateBulkTransfer(transferData);

    return ResponseClass.Success(res, {
      message: "Bulk transfer completed successfully",
      data: result
    });
  } catch (err) {
    next(err);
  }
};

// Helper function to map bank names to Paystack bank codes
function mapBankNameToCode(bankNameOrCode) {
  // If it's already a numeric code, return as is
  if (/^\d{3}$/.test(bankNameOrCode)) {
    return bankNameOrCode;
  }
  
  // Map common bank names to their Paystack codes
  const bankMapping = {
    'access-bank': '044',
    'access-diamond-bank': '063',
    'citibank': '023',
    'ecobank': '050',
    'fidelity-bank': '070',
    'first-bank-of-nigeria': '011',
    'first-city-monument-bank': '214',
    'guaranty-trust-bank': '058',
    'heritage-bank': '030',
    'keystone-bank': '082',
    'polaris-bank': '076',
    'providus-bank': '101',
    'stanbic-ibtc-bank': '221',
    'standard-chartered-bank': '068',
    'sterling-bank': '232',
    'union-bank-of-nigeria': '032',
    'united-bank-for-africa': '033',
    'unity-bank': '215',
    'wema-bank': '035',
    'zenith-bank': '057',
    'kuda-microfinance-bank': '50211',
    'opay': '999992',
    'palmpay': '999991',
    'carbon': '565',
    'rubies-bank': '125'
  };
  
  // Normalize the input (lowercase, replace spaces with hyphens)
  const normalizedName = bankNameOrCode.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
  
  return bankMapping[normalizedName] || bankNameOrCode;
}

// Debug endpoint to check user bank details
const checkUserBankDetails = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return ResponseClass.Error(res, {
        message: "User ID is required",
        statusCode: 400
      });
    }

    const user = await DTUser.findById(userId).select('_id fullName email payment_info');
    
    if (!user) {
      return ResponseClass.Error(res, {
        message: "User not found",
        statusCode: 404
      });
    }

    const bankDetails = {
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
      paymentInfo: {
        hasPaymentInfo: !!user.payment_info,
        account_name: user.payment_info?.account_name || null,
        account_number: user.payment_info?.account_number || null,
        bank_name: user.payment_info?.bank_name || null,
        bank_code: user.payment_info?.bank_code || null,
        mapped_bank_code: user.payment_info?.bank_code ? mapBankNameToCode(user.payment_info.bank_code) : null,
        payment_method: user.payment_info?.payment_method || null,
        payment_currency: user.payment_info?.payment_currency || null
      },
      readyForTransfer: !!(
        user.payment_info?.account_number && 
        user.payment_info?.bank_code
      ),
      missingFields: []
    };

    // Check what's missing
    if (!user.payment_info?.account_number) {
      bankDetails.missingFields.push('account_number');
    }
    if (!user.payment_info?.bank_code) {
      bankDetails.missingFields.push('bank_code');
    }

    return ResponseClass.Success(res, {
      message: "User bank details retrieved",
      data: bankDetails
    });
  } catch (err) {
    next(err);
  }
};

// Test recipient creation for debugging
const testRecipientCreation = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const user = await DTUser.findById(userId).select('_id fullName email payment_info');
    
    if (!user) {
      return ResponseClass.Error(res, {
        message: "User not found",
        statusCode: 404
      });
    }

    if (!user.payment_info?.account_number || !user.payment_info?.bank_code) {
      return ResponseClass.Error(res, {
        message: "User missing bank account details",
        statusCode: 400,
        data: {
          hasAccountNumber: !!user.payment_info?.account_number,
          hasBankCode: !!user.payment_info?.bank_code
        }
      });
    }

    const recipientData = {
      type: 'nuban',
      name: user.payment_info?.account_name || user.fullName,
      account_number: user.payment_info.account_number,
      bank_code: mapBankNameToCode(user.payment_info.bank_code),
      currency: 'NGN',
      email: user.email,
      description: `Test recipient for ${user.fullName}`
    };

    console.log('Testing recipient creation with data:', recipientData);

    const result = await PaystackTransferService.createRecipient(recipientData);

    return ResponseClass.Success(res, {
      message: "Recipient created successfully",
      data: {
        user: {
          id: user._id,
          name: user.fullName,
          email: user.email
        },
        originalBankCode: user.payment_info.bank_code,
        mappedBankCode: recipientData.bank_code,
        recipient: result
      }
    });
  } catch (err) {
    next(err);
  }
};

// Verify a transfer
const verifyTransfer = async (req, res, next) => {
  try {
    const { reference } = req.params;
    
    if (!reference) {
      return ResponseClass.Error(res, {
        message: "Transfer reference is required",
        statusCode: 400
      });
    }

    const result = await PaystackTransferService.verifyTransfer(reference);
    
    return ResponseClass.Success(res, {
      message: "Transfer verification successful",
      data: result
    });
  } catch (err) {
    next(err);
  }
};

// Bulk payment initialization for multiple users (freelancers, admins, stakeholders, etc.)
// NOTE: This is the old payment-based approach. Use initializeBulkTransfer for actual transfers.
const initializeBulkPayment = async (req, res, next) => {
  try {
    const { 
      payments,
      currency = 'NGN',
      description = 'Bulk payment service',
      callbackUrl,
      channels = ['card', 'bank', 'ussd', 'qr', 'mobile_money'],
      dryRun = false,
      forceOverride = false
    } = req.body;

    // Check if user is authenticated and get user ID for initiatedBy
    const initiatedBy = req.user?.userId || req.body.initiatedBy;
    if (!initiatedBy) {
      return ResponseClass.Error(res, {
        message: "Authentication required. Please provide a valid user token or initiatedBy field.",
        statusCode: 401
      });
    }

    // Validate inputs
    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return ResponseClass.Error(res, { 
        message: "Payments array is required and must not be empty", 
        statusCode: 400 
      });
    }

    if (payments.length > 50) {
      return ResponseClass.Error(res, { 
        message: "Maximum 50 payments allowed per bulk operation", 
        statusCode: 400 
      });
    }

    if (payments.length < 1) {
      return ResponseClass.Error(res, { 
        message: "Minimum 1 payment required for bulk operation", 
        statusCode: 400
      });
    }

    // Validate each payment in the array
    const validationErrors = [];
    const processedPayments = [];
    
    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      const errors = [];

      if (!payment.recipientId) errors.push(`Payment ${i + 1}: recipientId is required`);
      if (!payment.amount || payment.amount <= 0) errors.push(`Payment ${i + 1}: valid amount is required`);
      if (!payment.customerEmail) errors.push(`Payment ${i + 1}: customerEmail is required`);
      if (!payment.customerName) errors.push(`Payment ${i + 1}: customerName is required`);
      if (!payment.paymentType) errors.push(`Payment ${i + 1}: paymentType is required (e.g., 'freelancer_project', 'admin_bonus', 'stakeholder_dividend', 'general')`);

      if (errors.length > 0) {
        validationErrors.push(...errors);
        continue;
      }

      // Check for duplicate payment attempts within this batch based on recipient, project (if any), and amount
      const duplicateInBatch = processedPayments.find(p => 
        p.recipientId === payment.recipientId && 
        p.projectId === payment.projectId &&  // Both could be null/undefined
        p.amount === payment.amount &&
        p.paymentType === payment.paymentType
      );

      if (duplicateInBatch) {
        const duplicateIdentifier = payment.projectId 
          ? `recipient ${payment.recipientId}, project ${payment.projectId}` 
          : `recipient ${payment.recipientId}`;
        validationErrors.push(`Payment ${i + 1}: Duplicate payment found in batch for ${duplicateIdentifier}`);
        continue;
      }

      processedPayments.push({
        index: i,
        ...payment,
        // Map recipientId to freelancerId for backward compatibility with existing payment service
        freelancerId: payment.recipientId,
        currency: payment.currency || currency,
        description: payment.description || `${description} - ${payment.customerName}`,
        metadata: {
          ...payment.metadata,
          batchIndex: i,
          recipientId: payment.recipientId,
          paymentType: payment.paymentType,
          batchId: `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      });
    }

    if (validationErrors.length > 0) {
      return ResponseClass.Error(res, { 
        message: "Validation errors found", 
        statusCode: 400,
        data: { errors: validationErrors }
      });
    }

    // Check for existing pending payments for the same recipient combinations
    const existingPaymentChecks = await Promise.all(
      processedPayments.map(async (payment) => {
        const query = {
          freelancerId: payment.freelancerId, // This is actually recipientId mapped to freelancerId
          status: { $in: ['pending', 'processing'] },
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Within last 24 hours
        };
        
        // Only add projectId to query if it exists (for project-based payments)
        if (payment.projectId) {
          query.projectId = payment.projectId;
        }
        
        const existing = await FreelancerPaymentRepository.findAll(query);
        return { index: payment.index, existing: existing.length > 0, payment };
      })
    );

    const duplicatePayments = existingPaymentChecks.filter(check => check.existing);
    if (duplicatePayments.length > 0 && !dryRun && !forceOverride) {
      return ResponseClass.Error(res, { 
        message: "Found existing pending payments for some recipients", 
        statusCode: 409,
        data: { 
          duplicates: duplicatePayments.map(d => ({
            index: d.index + 1,
            recipientId: d.payment.recipientId,
            projectId: d.payment.projectId || null,
            paymentType: d.payment.paymentType
          })),
          hint: "Add 'forceOverride': true to bypass this check if the duplicate payment is intentional"
        }
      });
    }

    // Log when force override is used for audit purposes
    if (forceOverride && duplicatePayments.length > 0) {
      console.warn(`⚠️ Force override used by user ${initiatedBy} for ${duplicatePayments.length} duplicate payments:`, 
        duplicatePayments.map(d => `${d.payment.recipientId} (${d.payment.paymentType})`));
    }

    // Validate recipients and projects exist
    const recipientIds = [...new Set(processedPayments.map(p => p.freelancerId))];
    const projectIds = [...new Set(processedPayments.filter(p => p.projectId).map(p => p.projectId))];

    console.log('Looking up recipients with IDs:', recipientIds); // Debug log

    const validationPromises = [
      DTUser.find({ _id: { $in: recipientIds } }).select('_id fullName email')
    ];
    
    // Only fetch projects if there are project IDs to fetch
    if (projectIds.length > 0) {
      validationPromises.push(
        AnnotationProject.find({ _id: { $in: projectIds } }).select('_id projectName')
      );
    }

    const validationResults = await Promise.all(validationPromises);
    const recipients = validationResults[0];
    const projects = validationResults[1] || [];

    console.log('Found recipients:', recipients.map(r => ({ id: r._id, name: r.fullName, email: r.email }))); // Debug log

    const recipientMap = new Map(recipients.map(r => [r._id.toString(), r]));
    const projectMap = new Map(projects.map(p => [p._id.toString(), p]));

    const notFoundErrors = [];
    processedPayments.forEach((payment, index) => {
      console.log(`Checking recipient ${payment.freelancerId} in map:`, recipientMap.has(payment.freelancerId.toString())); // Debug
      if (!recipientMap.has(payment.freelancerId.toString())) {
        notFoundErrors.push(`Payment ${index + 1}: Recipient with ID ${payment.freelancerId} not found`);
      }
      if (payment.projectId && !projectMap.has(payment.projectId.toString())) {
        notFoundErrors.push(`Payment ${index + 1}: Project not found`);
      }
    });

    if (notFoundErrors.length > 0) {
      return ResponseClass.Error(res, { 
        message: "Some recipients or projects not found", 
        statusCode: 404,
        data: { errors: notFoundErrors }
      });
    }

    // If dry run, return validation results without creating payments
    if (dryRun) {
      return ResponseClass.Success(res, {
        message: "Bulk payment validation successful",
        data: {
          totalPayments: processedPayments.length,
          validPayments: processedPayments.length,
          duplicatesFound: duplicatePayments.length,
          estimatedTotalAmount: processedPayments.reduce((sum, p) => sum + p.amount, 0),
          previewPayments: processedPayments.slice(0, 3) // Show first 3 payments as preview
        }
      });
    }

    // Initialize bulk payment processing
    const batchId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const results = {
      batchId,
      totalPayments: processedPayments.length,
      successful: [],
      failed: [],
      summary: {
        successCount: 0,
        failureCount: 0,
        totalAmount: 0,
        successfulAmount: 0
      }
    };

    // Process payments in smaller chunks to avoid overwhelming the system
    const chunkSize = 5;
    for (let i = 0; i < processedPayments.length; i += chunkSize) {
  
      const chunk = processedPayments.slice(i, i + chunkSize);
      
      const chunkResults = await Promise.allSettled(
        chunk.map(async (payment) => {
          try {
            const recipient = recipientMap.get(payment.freelancerId.toString());
            const project = payment.projectId ? projectMap.get(payment.projectId.toString()) : null;

            // Debug log to check recipient lookup
            console.log(`Processing payment for recipient ID: ${payment.freelancerId}, found:`, recipient ? recipient.fullName : 'NOT FOUND');

            const paymentPayload = {
              freelancerId: payment.freelancerId, // Actually recipientId but mapped for compatibility
              projectId: payment.projectId || null,
              invoiceId: payment.invoiceId,
              amount: payment.amount,
              currency: payment.currency,
              customerEmail: payment.customerEmail.toLowerCase(),
              customerName: payment.customerName,
              customerPhone: payment.customerPhone,
              description: payment.description,
              metadata: {
                ...payment.metadata,
                batchId,
                bulkPayment: true,
                recipientName: recipient.fullName,
                recipientType: payment.paymentType,
                projectName: project?.projectName || null
              },
              callbackUrl,
              channels,
              initiatedBy: initiatedBy, // Use the validated initiatedBy from the beginning
              ipAddress: req.ip || req.connection.remoteAddress,
              userAgent: req.get('User-Agent')
            };

            const result = await PaystackPaymentService.initializePayment(paymentPayload);
            
            return {
              index: payment.index + 1,
              recipientId: payment.recipientId,
              projectId: payment.projectId,
              amount: payment.amount,
              status: 'success',
              paymentType: payment.paymentType,
              paymentReference: result.payment.paymentReference,
              paystackReference: result.payment.paystackReference,
              authorizationUrl: result.paystack.authorization_url,
              recipientName: recipient ? recipient.fullName : 'Unknown Recipient',
              projectName: project?.projectName || null
            };
          } catch (error) {
            const recipient = recipientMap.get(payment.freelancerId.toString());
            return {
              index: payment.index + 1,
              recipientId: payment.recipientId,
              projectId: payment.projectId,
              amount: payment.amount,
              status: 'failed',
              paymentType: payment.paymentType,
              error: error.message || 'Unknown error occurred',
              recipientName: recipient ? recipient.fullName : 'Unknown Recipient',
              projectName: payment.projectId ? projectMap.get(payment.projectId.toString())?.projectName || 'Unknown' : null
            };
          }
        })
      );

      // Process chunk results
      chunkResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.status === 'success') {
            results.successful.push(result.value);
            results.summary.successCount++;
            results.summary.successfulAmount += result.value.amount;
          } else {
            results.failed.push(result.value);
            results.summary.failureCount++;
          }
          results.summary.totalAmount += result.value.amount;
        } else {
          results.failed.push({
            status: 'failed',
            error: result.reason?.message || 'System error',
            amount: 0
          });
          results.summary.failureCount++;
        }
      });

      // Add small delay between chunks to prevent rate limiting
      if (i + chunkSize < processedPayments.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return ResponseClass.Success(res, {
      message: `Bulk payment processing completed. ${results.summary.successCount} successful, ${results.summary.failureCount} failed.`,
      data: results
    });

  } catch (err) {
    next(err);
  }
};

// Get bulk payment status by batch ID
const getBulkPaymentStatus = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!batchId) {
      return ResponseClass.Error(res, { 
        message: "Batch ID is required", 
        statusCode: 400 
      });
    }

    // Find all payments with the given batch ID
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [payments, totalCount] = await Promise.all([
      FreelancerPaymentRepository.findWithPagination(
        { 'metadata.batchId': batchId },
        { skip, limit: parseInt(limit) }
      ),
      FreelancerPaymentRepository.countDocuments({ 'metadata.batchId': batchId })
    ]);

    if (payments.length === 0) {
      return ResponseClass.Error(res, { 
        message: "No payments found for the given batch ID", 
        statusCode: 404 
      });
    }

    // Calculate summary statistics
    const summary = payments.reduce((acc, payment) => {
      acc.total++;
      acc[payment.status] = (acc[payment.status] || 0) + 1;
      acc.totalAmount += payment.amount;
      
      if (payment.status === 'success') {
        acc.successfulAmount += payment.amount;
      }
      
      return acc;
    }, { 
      total: 0, 
      totalAmount: 0, 
      successfulAmount: 0 
    });

    return ResponseClass.Success(res, {
      message: "Bulk payment status retrieved successfully",
      data: {
        batchId,
        totalPayments: totalCount,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        summary,
        payments: payments.map(payment => ({
          paymentReference: payment.paymentReference,
          paystackReference: payment.paystackReference,
          recipient: payment.freelancerId.fullName || 'Unknown',
          project: payment.projectId ? payment.projectId.projectName : null,
          amount: payment.amount,
          status: payment.status,
          paymentType: payment.paymentType || 'unknown',
          createdAt: payment.createdAt,
          completedAt: payment.completedAt,
          failureReason: payment.failureReason,
          authorizationUrl: payment.paystackData?.authorization_url
        }))
      }
    });

  } catch (err) {
    next(err);
  }
};

// Retry failed payments in a bulk operation
const retryBulkPayment = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const { paymentReferences } = req.body; // Optional: specific payments to retry

    if (!batchId) {
      return ResponseClass.Error(res, { 
        message: "Batch ID is required", 
        statusCode: 400 
      });
    }

    // Find failed payments in the batch
    const query = { 
      'metadata.batchId': batchId,
      status: 'failed'
    };

    if (paymentReferences && Array.isArray(paymentReferences)) {
      query.paymentReference = { $in: paymentReferences };
    }

    const failedPayments = await FreelancerPaymentRepository.findAll(query);

    if (failedPayments.length === 0) {
      return ResponseClass.Error(res, { 
        message: "No failed payments found for retry", 
        statusCode: 404 
      });
    }

    const retryResults = {
      batchId,
      originalBatchId: batchId,
      retryBatchId: `retry_${batchId}_${Date.now()}`,
      totalRetries: failedPayments.length,
      successful: [],
      failed: [],
      summary: {
        successCount: 0,
        failureCount: 0,
        totalAmount: 0,
        successfulAmount: 0
      }
    };

    // Retry failed payments
    for (const payment of failedPayments) {
      try {
        const retryPaymentPayload = {
          freelancerId: payment.freelancerId._id,
          projectId: payment.projectId ? payment.projectId._id : null,
          invoiceId: payment.invoiceId,
          amount: payment.amount,
          currency: payment.currency,
          customerEmail: payment.customerEmail,
          customerName: payment.customerName,
          customerPhone: payment.customerPhone,
          description: `${payment.description} (Retry)`,
          metadata: {
            ...payment.metadata,
            retryOf: payment.paymentReference,
            retryBatchId: retryResults.retryBatchId,
            originalBatchId: batchId
          },
          initiatedBy: req.user?.id || req.body.initiatedBy,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent')
        };

        const result = await PaystackPaymentService.initializePayment(retryPaymentPayload);
        
        retryResults.successful.push({
          originalReference: payment.paymentReference,
          newReference: result.payment.paymentReference,
          paystackReference: result.payment.paystackReference,
          amount: payment.amount,
          recipient: payment.freelancerId.fullName || 'Unknown',
          project: payment.projectId ? payment.projectId.projectName : null,
          paymentType: payment.paymentType || 'unknown',
          authorizationUrl: result.paystack.authorization_url
        });
        
        retryResults.summary.successCount++;
        retryResults.summary.successfulAmount += payment.amount;
        
      } catch (error) {
        retryResults.failed.push({
          originalReference: payment.paymentReference,
          amount: payment.amount,
          recipient: payment.freelancerId.fullName || 'Unknown',
          project: payment.projectId ? payment.projectId.projectName : null,
          paymentType: payment.paymentType || 'unknown',
          error: error.message || 'Retry failed'
        });
        
        retryResults.summary.failureCount++;
      }
      
      retryResults.summary.totalAmount += payment.amount;

      // Add small delay between retries
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return ResponseClass.Success(res, {
      message: `Bulk payment retry completed. ${retryResults.summary.successCount} successful, ${retryResults.summary.failureCount} failed.`,
      data: retryResults
    });

  } catch (err) {
    next(err);
  }
};

// Cancel pending bulk payments
const cancelBulkPayment = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const { reason = 'Bulk operation cancelled by admin' } = req.body;

    if (!batchId) {
      return ResponseClass.Error(res, { 
        message: "Batch ID is required", 
        statusCode: 400 
      });
    }

    // Find pending payments in the batch
    const pendingPayments = await FreelancerPaymentRepository.findAll({
      'metadata.batchId': batchId,
      status: { $in: ['pending', 'processing'] }
    });

    if (pendingPayments.length === 0) {
      return ResponseClass.Error(res, { 
        message: "No pending payments found to cancel", 
        statusCode: 404 
      });
    }

    const cancelResults = {
      batchId,
      totalCancelled: pendingPayments.length,
      cancelledPayments: []
    };

    // Cancel each pending payment
    for (const payment of pendingPayments) {
      try {
        await PaystackPaymentService.cancelPayment(payment._id, reason);
        
        cancelResults.cancelledPayments.push({
          paymentReference: payment.paymentReference,
          recipient: payment.freelancerId.fullName || 'Unknown',
          project: payment.projectId ? payment.projectId.projectName : null,
          amount: payment.amount,
          paymentType: payment.paymentType || 'unknown',
          status: 'cancelled'
        });
      } catch (error) {
        // Log error but continue with other cancellations
        console.error(`Failed to cancel payment ${payment.paymentReference}:`, error);
      }
    }

    return ResponseClass.Success(res, {
      message: `${cancelResults.totalCancelled} payments cancelled successfully`,
      data: cancelResults
    });

  } catch (err) {
    next(err);
  }
};

module.exports = {
  initializeFreelancerPayment,
  verifyPayment,
  handleWebhook,
  getPaymentDetails,
  getFreelancerPayments,
  getProjectPayments,
  getAllPayments,
  getPaymentStats,
  cancelPayment,
  getPaymentByReference,
  getPendingPayments,
  getFailedPayments,
  getSuccessfulPayments,
  initializeBulkPayment,
  getBulkPaymentStatus,
  retryBulkPayment,
  cancelBulkPayment,
  // New transfer-based methods
  createTransferRecipient,
  getBanks,
  initializeBulkTransfer,
  verifyTransfer,
  checkUserBankDetails,
  testRecipientCreation
};