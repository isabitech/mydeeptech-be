const axios = require('axios');
const FreelancerPaymentRepository = require("../repositories/freelancerPayment.repository");
const AppError = require("../utils/app-error");
const envConfig = require('../config/envConfig');

// Map bank slug codes to Paystack numeric codes
const PAYSTACK_BANK_CODE_MAPPING = {
  'access-bank': '044',
  'access-diamond-bank': '063',
  'citibank': '023',
  'ecobank': '050',
  'ecobank-nigeria': '050',
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
  'kuda-bank': '50211',
  'opay': '999992',
  'paycom': '999992', // Opay alternative code
  'palmpay': '999991',
  'carbon': '565',
  'rubies-bank': '125',
  'vfd': '566', // VFD Microfinance Bank
  'moniepoint-mfb-ng': '50515' // Moniepoint
};

/**
 * Converts bank slug codes to Paystack numeric codes
 * @param {string} bankCode - Bank code (slug or numeric)
 * @returns {string} Paystack numeric bank code
 */
function convertToPaystackBankCode(bankCode) {
  if (!bankCode) return null;
  
  // If already numeric, return as-is
  if (/^\d+$/.test(bankCode)) {
    return bankCode;
  }
  
  // Convert slug to numeric code
  const numericCode = PAYSTACK_BANK_CODE_MAPPING[bankCode.toLowerCase()];
  if (numericCode) {
    return numericCode;
  }
  
  console.warn(`Unknown bank code: "${bankCode}" - using as-is`);
  return bankCode;
}

class PaystackTransferService {
  
  constructor() {
    this.baseURL = envConfig.paystack.PAYSTACK_BASE_URL;
    this.headers = {
      'Authorization': `Bearer ${envConfig.paystack.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    };    
    // Log environment info for debugging
    const secretKey = envConfig.paystack.PAYSTACK_SECRET_KEY || '';
    
  }

  // Create a transfer recipient (one-time setup per recipient)
  static async createRecipient(recipientData) {
    try {
      const {
        type = 'nuban', // Nigerian bank account
        name,
        account_number,
        bank_code,
        currency = 'NGN',
        email,
        description
      } = recipientData;

      const service = new PaystackTransferService();
      
      // Convert bank slug code to Paystack numeric code
      const paystackBankCode = convertToPaystackBankCode(bank_code);
      if (!paystackBankCode) {
        throw new AppError({
          message: `Invalid or unsupported bank code: ${bank_code}`,
          statusCode: 400
        });
      }
      
      const recipientPayload = {
        type,
        name,
        account_number,
        bank_code: paystackBankCode, // Use converted numeric code
        currency,
        email,
        description
      };



      const response = await axios.post(
        `${service.baseURL}/transferrecipient`,
        recipientPayload,
        { headers: service.headers }
      );

      if (!response.data.status) {
        throw new AppError({
          message: `Failed to create recipient: ${response.data.message}`,
          statusCode: 400
        });
      }

      return {
        success: true,
        recipient_code: response.data.data.recipient_code,
        recipient: response.data.data
      };

    } catch (error) {
      // Log the full error for debugging
      console.error('Paystack recipient creation error:', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        requestData: {
          type: recipientData.type || 'nuban',
          name: recipientData.name,
          account_number: recipientData.account_number,
          bank_code: recipientData.bank_code,
          currency: recipientData.currency || 'NGN'
        }
      });

      if (error instanceof AppError) {
        throw error;
      }
      
      // Extract more specific error from Paystack response
      let errorMessage = `Recipient creation failed: ${error.message}`;
      if (error.response?.data?.message) {
        errorMessage = `Recipient creation failed: ${error.response.data.message}`;
      }
      
      throw new AppError({
        message: errorMessage,
        statusCode: 500
      });
    }
  }

  // Initiate bulk transfers using Paystack's bulk transfer API
  static async initiateBulkTransfer(transferData) {
    try {
      const {
        transfers, // Array of transfer objects
        currency = 'NGN',
        source = 'balance',
      } = transferData;

      if (!Array.isArray(transfers) || transfers.length === 0) {
        throw new AppError({
          message: 'Transfers array is required and must not be empty',
          statusCode: 400
        });
      }

      if (transfers.length > 100) {
        throw new AppError({
          message: 'Maximum 100 transfers allowed per bulk operation',
          statusCode: 400
        });
      }

      // Validate each transfer
      const validationErrors = [];
      transfers.forEach((transfer, index) => {
        // Check recipient validation
        if (!transfer.recipient && !transfer.recipientData) {
          validationErrors.push(`Transfer ${index + 1}: recipient code or recipient data is required`);
        } else if (transfer.recipient && transfer.recipient.startsWith('temp_') && !transfer.recipientData) {
          validationErrors.push(`Transfer ${index + 1}: temporary recipient code provided but missing recipient data for creation`);
        } else if (transfer.recipientData) {
          // Validate recipient data if provided
          if (!transfer.recipientData.name) {
            validationErrors.push(`Transfer ${index + 1}: recipient name is required`);
          }
          if (!transfer.recipientData.account_number) {
            validationErrors.push(`Transfer ${index + 1}: recipient account number is required`);
          }
          if (!transfer.recipientData.bank_code) {
            validationErrors.push(`Transfer ${index + 1}: recipient bank code is required`);
          }
          if (!transfer.recipientData.email) {
            validationErrors.push(`Transfer ${index + 1}: recipient email is required`);
          }
        }

        if (!transfer.amount || transfer.amount <= 0) {
          validationErrors.push(`Transfer ${index + 1}: valid amount is required`);
        }
        if (!transfer.reference) {
          validationErrors.push(`Transfer ${index + 1}: reference is required`);
        } else if (transfer.reference.length > 100) {
          // Paystack reference limit
          validationErrors.push(`Transfer ${index + 1}: reference must be 100 characters or less`);
        }
      });

      if (validationErrors.length > 0) {
        throw new AppError({
          message: 'Validation errors in transfers',
          statusCode: 400,
          details: validationErrors
        });
      }

      // Create recipients first if needed, then payment records
      const batchId = `bulk_transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const paymentRecords = [];

      // Create recipients for transfers that need them
      for (let i = 0; i < transfers.length; i++) {
        const transfer = transfers[i];

        // Create recipient if recipientData is provided (meaning no valid recipient code)
        if (transfer.recipientData && (transfer.recipient.startsWith('temp_') || !transfer.recipient)) {
          try {
            const recipientResponse = await PaystackTransferService.createRecipient(transfer.recipientData);
            transfer.recipient = recipientResponse.recipient.recipient_code; // Update with real recipient code
          } catch (error) {
            console.error(`❌ Failed to create recipient for transfer ${i + 1}:`, error);
            throw new AppError({
              message: `Failed to create recipient for ${transfer.recipientData?.name || 'transfer ' + (i + 1)}: ${error.message}`,
              statusCode: 400
            });
          }
        }

        const paymentRecord = await FreelancerPaymentRepository.create(transfer);
        paymentRecords.push(paymentRecord);
      }

      // Initiate bulk transfer with Paystack
      const service = new PaystackTransferService();
      const bulkTransferPayload = {
        currency,
        source,
        transfers: transfers.map(transfer => {
          const transferAmount = Math.round(transfer.amount * 100); // Convert to kobo
          
          // Clean reference: remove special characters that Paystack might not accept
          const cleanReference = transfer.reference.replace(/[^a-zA-Z0-9\-_]/g, '');

          return {
            amount: transferAmount, // Already converted to kobo
            recipient: transfer.recipient, // recipient code (now properly created)
            reference: cleanReference,
            reason: transfer.reason || transfer.description || 'Bulk payment'
          };
        })
      };



      const transferResponse = await axios.post(
        `${service.baseURL}/transfer/bulk`,
        bulkTransferPayload,
        { headers: service.headers }
      ).catch(error => {
        console.error('Paystack bulk transfer API error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
          requestPayload: bulkTransferPayload
        });
        throw error;
      });

      if (!transferResponse.data.status) {
        // Mark all payments as failed
        await Promise.all(paymentRecords.map(payment => 
          FreelancerPaymentRepository.markAsFailed(payment._id, transferResponse.data.message)
        ));

        throw new AppError({
          message: `Bulk transfer failed: ${transferResponse.data.message}`,
          statusCode: 400,
          data: transferResponse.data
        });
      }

      // Update payment records with Paystack response
      const results = {
        batchId,
        totalTransfers: transfers.length,
        successful: [],
        failed: [],
        paystack_response: transferResponse.data.data
      };

      // Process each transfer in the response
      if (transferResponse.data.data && Array.isArray(transferResponse.data.data)) {
        for (let i = 0; i < transferResponse.data.data.length; i++) {
          const transferResult = transferResponse.data.data[i];
          const paymentRecord = paymentRecords[i];
          const originalTransfer = transfers[i];

          try {
            if (transferResult.status === 'success' || transferResult.status === 'pending') {
              // Update payment record with success/pending status
              await FreelancerPaymentRepository.updateById(paymentRecord._id, {
                status: transferResult.status === 'success' ? 'success' : 'processing',
                paystackReference: transferResult.transfer_code,
                paystackData: {
                  transfer_code: transferResult.transfer_code,
                  transfer_id: transferResult.id,
                  status: transferResult.status,
                  amount: transferResult.amount,
                  currency: transferResult.currency,
                  reason: transferResult.reason,
                  recipient: transferResult.recipient
                },
                completedAt: transferResult.status === 'success' ? new Date() : null
              });

              results.successful.push({
                index: i + 1,
                recipientId: originalTransfer.recipientId,
                amount: originalTransfer.amount,
                status: transferResult.status,
                transfer_code: transferResult.transfer_code,
                reference: originalTransfer.reference,
                paymentType: originalTransfer.paymentType || 'general'
              });
            } else {
              // Mark as failed
              await FreelancerPaymentRepository.markAsFailed(
                paymentRecord._id,
                transferResult.failures || 'Transfer failed'
              );

              results.failed.push({
                index: i + 1,
                recipientId: originalTransfer.recipientId,
                amount: originalTransfer.amount,
                status: 'failed',
                error: transferResult.failures || 'Transfer failed',
                reference: originalTransfer.reference,
                paymentType: originalTransfer.paymentType || 'general'
              });
            }
          } catch (error) {
            console.error(`Error processing transfer result ${i}:`, error);
            results.failed.push({
              index: i + 1,
              recipientId: originalTransfer.recipientId,
              amount: originalTransfer.amount,
              status: 'failed',
              error: 'Database update failed',
              reference: originalTransfer.reference,
              paymentType: originalTransfer.paymentType || 'general'
            });
          }
        }
      }

      return {
        success: true,
        batchId,
        results,
        summary: {
          total: results.successful.length + results.failed.length,
          successful: results.successful.length,
          failed: results.failed.length,
          totalAmount: transfers.reduce((sum, t) => sum + t.amount, 0)
        }
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      console.error('Full error details:', {
        name: error.name,
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      // Extract specific error message from Paystack response
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message;
      
      // Handle specific error types with helpful messages
      let customMessage = `Bulk transfer failed: ${errorMessage}`;
      if (error.response?.data?.code === 'insufficient_balance') {
        const secretKey = envConfig.paystack.PAYSTACK_SECRET_KEY || '';
        const isTestMode = secretKey.startsWith('sk_test_');
        
        if (isTestMode) {
          customMessage = `❌ Test Environment Balance Issue: ${errorMessage}. 

📋 Test Mode Solutions:
1. Ensure you're using valid TEST API keys (sk_test_...)
2. Check your Paystack test dashboard for balance
3. In test mode, try smaller amounts (e.g., ₦100)
4. Some test environments need manual balance setup
5. Verify test bank account details are correct

🔗 Paystack Test Dashboard: https://dashboard.paystack.com/test`;
        } else {
          customMessage = `❌ Insufficient Paystack Balance: ${errorMessage}. Please fund your Paystack account or contact your administrator.`;
        }
      } else if (error.response?.data?.code === 'invalid_bank_code') {
        customMessage = `❌ Bank Code Error: ${errorMessage}. Please verify bank details are correct.`;
      } else if (error.response?.data?.code === 'validation_error') {
        customMessage = `❌ Validation Error: ${errorMessage}. Please check transfer data format.`;
      }
                          
      throw new AppError({
        message: customMessage,
        statusCode: error.response?.status || 500,
        data: error.response?.data
      });
    }
  }

  // Verify a single transfer
  static async verifyTransfer(reference) {
    try {
      const service = new PaystackTransferService();
      const response = await axios.get(
        `${service.baseURL}/transfer/verify/${reference}`,
        { headers: service.headers }
      );

      if (!response.data.status) {
        throw new AppError({
          message: `Transfer verification failed: ${response.data.message}`,
          statusCode: 400
        });
      }

      return {
        success: true,
        transfer: response.data.data
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError({
        message: `Transfer verification failed: ${error.message}`,
        statusCode: 500
      });
    }
  }

  // List banks for recipient creation
  static async listBanks(country = 'nigeria') {
    try {
      const service = new PaystackTransferService();
      const response = await axios.get(
        `${service.baseURL}/bank?country=${country}`,
        { headers: service.headers }
      );

      if (!response.data.status) {
        throw new AppError({
          message: `Failed to fetch banks: ${response.data.message}`,
          statusCode: 400
        });
      }

      return {
        success: true,
        banks: response.data.data
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError({
        message: `Failed to fetch banks: ${error.message}`,
        statusCode: 500
      });
    }
  }
}

module.exports = PaystackTransferService;