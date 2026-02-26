const PaystackTransferService = require("../../services/paystack-transfer.service");
const ResponseClass = require("../../utils/response-handler");
const DTUser = require("../../models/dtUser.model");
const FreelancerPaymentRepository = require("../../repositories/freelancerPayment.repository");
const envConfig = require("../../config/envConfig");

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
    .replace(/\\s+/g, '-')
    .replace(/[^a-z0-9\\-]/g, '');
  
  return bankMapping[normalizedName] || bankNameOrCode;
}

// Initiate bulk transfers using Paystack's native bulk transfer API
const initializeBulkTransfer = async (req, res, next) => {
  try {
    const {
      transfers,
      currency = 'NGN',
      source = 'balance',
      metadata = {},
      allowDuplicates = false // Testing flag to bypass duplicate checks
    } = req.body;

    // Check if user is authenticated
    const initiatedBy = req.user?.userId;
    if (!initiatedBy) {
      return ResponseClass.Error(res, {
        message: "Authentication required. Please provide a valid user token or initiatedBy field.",
        statusCode: 401
      });
    }

    // Determine if duplicate checking should be enforced
    const isProduction = envConfig.NODE_ENV === 'production';
    const enforceDuplicateCheck = isProduction || !allowDuplicates;
    
    // Log duplicate check status for transparency
    if (!enforceDuplicateCheck) {
      console.warn(`⚠️  Duplicate checking DISABLED for ${envConfig.NODE_ENV} environment (allowDuplicates: ${allowDuplicates})`);
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

    // === DUPLICATE PREVENTION (Production enforced, optional for testing) ===
    if (enforceDuplicateCheck) {
      // Check for duplicate transfers within this batch
      const batchDuplicates = [];
      const seenTransfers = new Map();
      
      for (let i = 0; i < transfers.length; i++) {
        const transfer = transfers[i];
        const transferKey = `${transfer.recipientId}_${transfer.amount}_${transfer.paymentType || 'general'}`;
        
        if (seenTransfers.has(transferKey)) {
          batchDuplicates.push(`Transfer ${i + 1}: Duplicate transfer found in batch for recipient ${transfer.recipientId} with amount ${transfer.amount}`);
        } else {
          seenTransfers.set(transferKey, i);
        }
      }

      if (batchDuplicates.length > 0) {
        return ResponseClass.Error(res, {
          message: "Duplicate transfers found within the batch",
          statusCode: 400,
          data: { errors: batchDuplicates }
        });
      }

      // Check for recent transfers to prevent duplicate payments
      const recentTransferChecks = await Promise.all(
        transfers.map(async (transfer, index) => {
          // Look for transfers within the last 24 hours for the same recipient
          const recentTimeframe = new Date(Date.now() - 24 * 60 * 60 * 1000);
          
          const existingTransfers = await FreelancerPaymentRepository.findAll({
            freelancerId: transfer.recipientId,
            amount: transfer.amount,
            paymentType: transfer.paymentType || 'general',
            status: { $in: ['success', 'pending', 'processing'] },
            createdAt: { $gte: recentTimeframe }
          });

          return {
            index: index + 1,
            recipientId: transfer.recipientId,
            hasRecent: existingTransfers.length > 0,
            recentCount: existingTransfers.length,
            transfer
          };
        })
      );

      const duplicateTransfers = recentTransferChecks.filter(check => check.hasRecent);
      
      if (duplicateTransfers.length > 0) {
        return ResponseClass.Error(res, {
          message: "Recent transfers found for some recipients - potential duplicates detected. Wait 24 hours to perform the operation again",
          statusCode: 409,
          data: {
            duplicates: duplicateTransfers.map(d => ({
              index: d.index,
              recipientId: d.recipientId,
              amount: d.transfer.amount,
              paymentType: d.transfer.paymentType || 'general',
              recentTransfersCount: d.recentCount
            })),
            hint: "Wait 24 hours between transfers to the same recipient with same amount, or use different amounts/payment types if this is intentional"
          }
        });
      }
      
      // Check for reference uniqueness in the database
      const references = transfers.map(t => t.reference);
      const existingReferences = await FreelancerPaymentRepository.findAll({
        paymentReference: { $in: references }
      });

      if (existingReferences.length > 0) {
        return ResponseClass.Error(res, {
          message: "Some transfer references already exist",
          statusCode: 409,
          data: {
            existingReferences: existingReferences.map(p => p.paymentReference),
            hint: "Transfer references must be unique. Let the system auto-generate them or provide unique values"
          }
        });
      }
    } else {
      console.log(`🧪 [TESTING MODE] Skipping duplicate checks - ${transfers.length} transfer(s) will proceed regardless of duplicates`);
    }

    // Get unique recipient IDs and fetch user data including bank details
    const recipientIds = [...new Set(transfers.map(t => t.recipientId))];
    const recipients = await DTUser.find({ _id: { $in: recipientIds } }).select('_id fullName email payment_info');

    // Validate bank details and create recipients
    const recipientCreationPromises = [];
    const validationErrorsForBanks = [];

    for (const transfer of transfers) {
      const user = recipients.find(r => r._id.toString() === transfer.recipientId);
      if (!user) {
        validationErrorsForBanks.push(`Transfer to ${transfer.recipientId}: User not found`);
        continue;
      }

      if (!user.payment_info?.account_number || !user.payment_info?.bank_code) {
        validationErrorsForBanks.push(`Transfer to ${transfer.recipientId}: Missing bank details`);
        continue;
      }

      const recipientPromise = PaystackTransferService.createRecipient({
        type: 'nuban',
        name: user.fullName,
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

    if (validationErrorsForBanks.length > 0) {
      return ResponseClass.Error(res, {
        message: "Bank details validation errors found",
        statusCode: 400,
        data: { errors: validationErrorsForBanks }
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
            userId: f.userId,
            error: f.error
          }))
        }
      });
    }

    // Prepare transfer data for Paystack - include user info for database records
    const paystackTransfers = recipientResults.map(result => {
      const transfer = result.transfer;
      const user = recipients.find(r => r._id.toString() === result.userId);
      
      return {
        amount: transfer.amount,
        recipient: result.recipientCode,
        reference: transfer.reference,
        reason: transfer.reason || 'Bulk transfer payment',
        currency: transfer.currency || currency,
        source,
        // Include recipient info for database record creation
        recipientId: result.userId,
        customerEmail: user.email,
        customerName: user.fullName,
        customerPhone: transfer.customerPhone || null,
        paymentType: transfer.paymentType || 'general',
        projectId: transfer.projectId || null,
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

// Create transfer recipient
const createTransferRecipient = async (req, res, next) => {
  try {
    const { type, name, account_number, bank_code, currency, email, description } = req.body;

    if (!type || !name || !account_number || !bank_code) {
      return ResponseClass.Error(res, {
        message: "Missing required fields: type, name, account_number, bank_code",
        statusCode: 400
      });
    }

    const result = await PaystackTransferService.createRecipient({
      type,
      name,
      account_number,
      bank_code: mapBankNameToCode(bank_code),
      currency: currency || 'NGN',
      email,
      description
    });

    return ResponseClass.Success(res, {
      message: "Transfer recipient created successfully",
      data: result
    });
  } catch (err) {
    next(err);
  }
};

// Get list of banks
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

// Verify transfer
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
      message: "Transfer verification completed",
      data: result
    });
  } catch (err) {
    next(err);
  }
};

// Debug endpoint to check user bank details
const checkUserBankDetails = async (req, res, next) => {
  try {
    const { recipientId } = req.body;

    const user = await DTUser.findById(recipientId).select('_id fullName email payment_info');
    
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
      hasPaymentInfo: !!user.payment_info,
      bankInfo: user.payment_info ? {
        account_number: user.payment_info.account_number,
        bank_code: user.payment_info.bank_code,
        mapped_bank_code: mapBankNameToCode(user.payment_info.bank_code)
      } : null
    };

    return ResponseClass.Success(res, {
      message: "User bank details retrieved",
      data: bankDetails
    });
  } catch (err) {
    next(err);
  }
};

// Test recipient creation
const testRecipientCreation = async (req, res, next) => {
  try {
    const { recipientId } = req.body;

    const user = await DTUser.findById(recipientId).select('_id fullName email payment_info');
    
    if (!user || !user.payment_info?.account_number || !user.payment_info?.bank_code) {
      return ResponseClass.Error(res, {
        message: "User not found or missing bank details",
        statusCode: 400
      });
    }

    const result = await PaystackTransferService.createRecipient({
      type: 'nuban',
      name: user.fullName,
      account_number: user.payment_info.account_number,
      bank_code: mapBankNameToCode(user.payment_info.bank_code),
      currency: 'NGN',
      email: user.email
    });

    return ResponseClass.Success(res, {
      message: "Test recipient created successfully",
      data: result
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  initializeBulkTransfer,
  createTransferRecipient,
  getBanks,
  verifyTransfer,
  checkUserBankDetails,
  testRecipientCreation
};