const PaystackTransferService = require("../../services/paystack-transfer.service");
const ResponseClass = require("../../utils/response-handler");
const Invoice = require("../../models/invoice.model");
const DTUser = require("../../models/dtUser.model");
const PaymentNotificationService = require("../../services/mail-service/payment-notification.service");
const { convertUSDToNGN } = require("../../utils/exchangeRateService");



// New Bulk Transfer Controller with Invoice-based Payments
const initializeBulkTransferWithInvoices = async (req, res) => {
 const {
      transfers, // Array of transfer objects with invoiceIds and user details
      currency = 'NGN',
      source = 'balance',
      metadata = {},
      exchangeRate: frontendExchangeRate
    } = req.body;

    // console.log({ body: JSON.stringify(req.body, null, 2) });

    // return res.status(200).json({
    //   success: true,
    //   message: "Bulk transfer with invoice-based payments is currently under development. Please check back later or contact support for assistance.",
    //   data: null
    // });

    if(!req.user?.userId) {
      return ResponseClass.Error(res, {
        message: "Unauthorized: User information missing in request",
        statusCode: 401
      });
    }

    // Validate input
    if (!Array.isArray(transfers) || transfers.length === 0) {
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

    // Validate required fields in each transfer
    const validationErrors = [];
    const invoiceIds = [];
    const receivedInvoiceIds = new Set(); // Track for duplicates

    transfers.forEach((transfer, index) => {
      if (!transfer.invoiceId) {
        validationErrors.push(`Transfer ${index + 1}: invoiceId is required`);
      } else {
        if (receivedInvoiceIds.has(transfer.invoiceId)) {
          validationErrors.push(`Transfer ${index + 1}: Duplicate invoiceId ${transfer.invoiceId}`);
        } else {
          receivedInvoiceIds.add(transfer.invoiceId);
          invoiceIds.push(transfer.invoiceId);
        }
      }
      if (!transfer.recipientCode && (!transfer.bankCode || !transfer.accountNumber)) {
        validationErrors.push(`Transfer ${index + 1}: Either recipientCode or valid bank details (bankCode + accountNumber) required`);
      }
      if (!transfer.recipientName) {
        validationErrors.push(`Transfer ${index + 1}: recipientName is required`);
      }
      if (!transfer.recipientEmail) {
        validationErrors.push(`Transfer ${index + 1}: recipientEmail is required`);  
      }
    });

    if (validationErrors.length > 0) {
      return ResponseClass.Error(res, {
        message: "Validation errors in transfers",
        statusCode: 400,
        details: validationErrors
      });
    }

    // Fetch invoices based on the provided invoiceIds

    const invoices = await Invoice.find({_id: { $in: invoiceIds }}).populate([
      { path: 'dtUserId', select: 'fullName email payment_info.account_number payment_info.bank_code' },
      { path: 'projectId', select: 'projectName' }
    ]);

    if (invoices.length === 0) {
      return ResponseClass.Error(res, {
        message: "No valid invoices found for the provided invoice IDs",
        statusCode: 404
      });
    }

    if (invoices.length !== invoiceIds.length) {
      const foundIds = invoices.map(inv => inv._id.toString());
      const missingIds = invoiceIds.filter(id => !foundIds.includes(id));
      return ResponseClass.Error(res, {
        message: "Some invoice IDs were not found",
        statusCode: 404,
        details: { missingInvoiceIds: missingIds }
      });
    }

    // Check for already paid invoices (prevent double payment)
    const alreadyPaidInvoices = invoices.filter(invoice => 
      invoice.paymentStatus === 'paid' || invoice.status === 'paid'
    );

    if (alreadyPaidInvoices.length > 0) {
      const paidInvoiceNumbers = alreadyPaidInvoices.map(inv => inv.invoiceNumber);
      return ResponseClass.Error(res, {
        message: "Some invoices are already paid. Cannot process double payments.",
        statusCode: 400,
        details: { alreadyPaidInvoices: paidInvoiceNumbers }
      });
    }

    // Test exchange rate API first

    let exchangeRate;
    if (typeof frontendExchangeRate === 'number' && frontendExchangeRate > 0) {
      exchangeRate = Number(Number(frontendExchangeRate).toFixed(2));
    } else {
      try {
        exchangeRate = await convertUSDToNGN(1); // Test with $1
      } catch (rateError) {
        return ResponseClass.Error(res, {
          message: "Cannot process transfers due to exchange rate service failure",
          statusCode: 503,
          error: "Exchange rate service unavailable",
          details: {
            exchangeRateError: rateError.message,
            message: "Please try again later or contact support if the issue persists"
          }
        });
      }
    }

    // Create mapping between transfer requests and invoices
    const transferInvoiceMap = new Map();
    invoices.forEach(invoice => {
      const transferRequest = transfers.find(t => t.invoiceId === invoice._id.toString());
      if (transferRequest) {
        transferInvoiceMap.set(invoice._id.toString(), {
          invoice,
          transferRequest
        });
      }
    });

    // Process transfers with currency conversion

    const processedTransfers = [];
    const invoiceAmountMap = new Map(); // Store calculated NGN amounts to avoid duplicate API calls
    const batchId = `bulk_transfer_invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let totalUSDAmount = 0;
    let totalNGNAmount = 0;
    const errors = [];

    for (const [invoiceIdStr, { invoice, transferRequest }] of transferInvoiceMap) {
      try {
        // Convert USD amount to NGN
        const usdAmount = invoice.invoiceAmount;
        let ngnAmount;
        if (typeof exchangeRate === 'number' && exchangeRate > 0) {
          ngnAmount = usdAmount * exchangeRate;
        } else {
          ngnAmount = await convertUSDToNGN(usdAmount);
        }
        
        // Store the calculated NGN amount for later use in email notifications
        invoiceAmountMap.set(invoice._id.toString(), {
          usdAmount,
          ngnAmount,
          exchangeRate: ngnAmount / usdAmount
        });
        
        // TEST MODE: Override with smaller amounts for testing
        // const isTestMode = process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_test_');
        // if (isTestMode && ngnAmount > 2000) {
        //   ngnAmount = Math.min(ngnAmount, 500); // Cap at ₦500 for testing
        // }

        totalUSDAmount += usdAmount;
        totalNGNAmount += ngnAmount;

        // Generate unique transfer reference
        const transferReference = `TXN-${invoice.invoiceNumber}-${Date.now()}`;

        // Prepare transfer object for Paystack (let service handle payment record creation)
        const transferObj = {
          // Paystack API fields
          amount: Math.round(ngnAmount * 100), // Convert to kobo for Paystack API
          recipient: transferRequest.recipientCode || `temp_${Date.now()}`, // Will be replaced if creating recipient
          reference: transferReference,
          reason: `Payment for invoice ${invoice.invoiceNumber} - ${invoice.description || 'Project completion'}`,
          
          // FreelancerPayment record fields for PaystackTransferService
          freelancerId: (typeof invoice.dtUserId === 'string' ? invoice.dtUserId : invoice.dtUserId._id).toString(),
          projectId: invoice.projectId?._id?.toString() || null,
          invoiceId: invoice._id.toString(),
          customerEmail: transferRequest.recipientEmail,
          customerName: transferRequest.recipientName,
          customerPhone: transferRequest.recipientPhone || null,
          paymentType: 'general',
          paymentReference: transferReference,
          // Use 'amount' not 'rawAmount' - this is what FreelancerPayment expects
          amount: ngnAmount, // Raw NGN amount for FreelancerPayment record
          currency,
          initiatedBy: (req.user?.id || req.user?.userId).toString(),
          description: `Bulk transfer payment for invoice ${invoice.invoiceNumber}`,
          status: 'processing',
          metadata: {
            ...metadata,
            batchId,
            bulkTransfer: true,
            originalUSDAmount: usdAmount,
            exchangeRate: ngnAmount / usdAmount,
            conversionDate: new Date(),
            recipientCode: transferRequest.recipientCode || null,
            bankCode: transferRequest.bankCode || null,
            accountNumber: transferRequest.accountNumber || null,
            isDirectTransfer: true
          }
        };

        // If no recipient code provided, we need bank details for Paystack to create one
        if (!transferRequest.recipientCode) {
          transferObj.recipientData = {
            type: 'nuban',
            name: transferRequest.recipientName,
            account_number: transferRequest.accountNumber,
            bank_code: transferRequest.bankCode,
            currency,
            email: transferRequest.recipientEmail,
            description: `Recipient for invoice ${invoice.invoiceNumber}`
          };
        }

        processedTransfers.push(transferObj);

      } catch (error) {
        console.error(res, `❌ Error processing invoice ${invoice.invoiceNumber}:`, error);
        errors.push({
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          error: 'Processing failed',
          details: error.message
        });
      }
    }

    if (processedTransfers.length === 0) {
      return ResponseClass.Error(res, {
        message: "No transfers could be processed",
        statusCode: 400,
        details: { errors }
      });
    }

    // Debug: Log processedTransfers and return early for inspection
    // console.log('Processed transfers payload for Paystack:', JSON.stringify(processedTransfers, null, 2));
    
    // Initiate bulk transfer with Paystack
    let bulkTransferResponse;
    try {
      bulkTransferResponse = await PaystackTransferService.initiateBulkTransfer({
        transfers: processedTransfers,
        currency,
        source,
        initiatedBy: (req.user?.userId || req.user?.id)?.toString(),
        metadata: {
          ...metadata,
          batchId,
          totalTransfers: processedTransfers.length,
          totalUSDAmount,
          totalNGNAmount,
          invoiceBasedTransfer: true
        }
      });

    } catch (transferError) {
      console.error('❌ Paystack bulk transfer failed:', transferError);

      return ResponseClass.Error(res, {
        message: transferError?.message ?? "Bulk transfer initiation failed",
        statusCode: 500,
        error: transferError.message,
        details: {
          batchId,
          processedTransfers: processedTransfers.length,
          totalAmount: `$${totalUSDAmount.toFixed(2)} USD (₦${totalNGNAmount.toFixed(2)} NGN)`
        }
      });
    }

    // Mark invoices as payment initiated (will be confirmed by webhook)
    const initiatedInvoices = [];
    
    for (const invoice of invoices) {
      try {
        const transferRequest = transfers.find(t => t.invoiceId === invoice._id.toString());
        const amountData = invoiceAmountMap.get(invoice._id.toString());
        
        if (!amountData) {
          throw new Error(`Amount data not found for invoice ${invoice.invoiceNumber}`);
        }

        // Update invoice status to indicate payment is being processed
        invoice.paymentStatus = 'payment_initiated';
        invoice.paymentMetadata = {
          batchId,
          paystackBatchId: bulkTransferResponse.batchId || bulkTransferResponse.data?.batch_id,
          transferReference: `TXN-${invoice.invoiceNumber}-${Date.now()}`,
          usdAmount: amountData.usdAmount,
          ngnAmount: amountData.ngnAmount,
          exchangeRate: amountData.exchangeRate,
          recipientEmail: transferRequest.recipientEmail,
          recipientName: transferRequest.recipientName,
          initiatedAt: new Date(),
          initiatedBy: req.user?.userId || req.user?.id
        };
        
        await invoice.save();

        initiatedInvoices.push({
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          recipient: transferRequest.recipientName,
          usdAmount: amountData.usdAmount,
          ngnAmount: amountData.ngnAmount,
          status: 'payment_initiated'
        });

        console.log(`✅ Payment initiated for invoice ${invoice.invoiceNumber} - awaiting Paystack confirmation`);

      } catch (error) {
        console.error(`❌ Error marking invoice ${invoice.invoiceNumber} as payment initiated:`, error);
        errors.push({
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          error: 'Failed to mark as payment initiated',
          details: error.message
        });
      }
    }

    console.log(`🔄 Bulk transfer initiated - payments will be confirmed via Paystack webhooks`);
    console.log(`📧 Email notifications will be sent after webhook confirmation`);

    // Return transfer initiation response
    const responseData = {
      success: true,
      batchId,
      paystackBatchId: bulkTransferResponse.batchId || bulkTransferResponse.data?.batch_id,
      transferCode: bulkTransferResponse.data?.transfer_code,
      status: 'transfers_initiated',
      summary: {
        totalTransfers: processedTransfers.length,
        initiatedTransfers: initiatedInvoices.length,
        totalUSDAmount: totalUSDAmount.toFixed(2),
        totalNGNAmount: totalNGNAmount.toFixed(2),
        exchangeRateUsed: (totalNGNAmount / totalUSDAmount).toFixed(2),
        initiatedAt: new Date()
      },
      initiatedInvoices,
      errors: errors.length > 0 ? errors : undefined,
      paystackResponse: {
        status: bulkTransferResponse.success,
        message: bulkTransferResponse.message || 'Bulk transfer initiated',
        reference: bulkTransferResponse.reference
      },
      webhookInfo: {
        message: 'Transfers have been initiated with Paystack. Payment confirmations and email notifications will be sent when Paystack webhooks confirm successful transfers.',
        webhookUrl: '/api/payments/webhook',
        statusTracking: `Monitor transfer status using batch ID: ${batchId}`
      }
    };

    return ResponseClass.Success(res, {
      message: `Bulk transfer initiated successfully. ${initiatedInvoices.length} transfers submitted to Paystack. Payment confirmations and email notifications will be sent via webhooks.`,
      data: responseData
    });
};

module.exports = {
  initializeBulkTransferWithInvoices
};