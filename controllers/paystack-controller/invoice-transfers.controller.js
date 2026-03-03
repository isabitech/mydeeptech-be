const PaystackTransferService = require("../../services/paystack-transfer.service");
const ResponseClass = require("../../utils/response-handler");
const Invoice = require("../../models/invoice.model");
const DTUser = require("../../models/dtUser.model");
const PaymentNotificationService = require("../../services/mail-service/payment-notification.service");
const { convertUSDToNGN } = require("../../utils/exchangeRateService");
const envConfig = require("../../config/envConfig");



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
        data: { errors: validationErrors }
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
        data: { missingInvoiceIds: missingIds }
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
        data: { alreadyPaidInvoices: paidInvoiceNumbers }
      });
    }

    // Handle exchange rate with improved fallback logic
    let exchangeRate;
    let exchangeRateSource = 'api'; // Track the source for logging
    
    // First, try to get exchange rate from the service
    try {
      exchangeRate = await convertUSDToNGN(1); // Test with $1
      exchangeRateSource = 'api';
    } catch (rateError) {
      console.warn('Exchange rate service failed:', rateError.message);
      
      // If service fails, check for frontend-provided exchange rate
      if (typeof frontendExchangeRate === 'number' && frontendExchangeRate > 0) {
        exchangeRate = Number(Number(frontendExchangeRate).toFixed(2));
        exchangeRateSource = 'frontend';
        console.log(`Using frontend-provided exchange rate: ${exchangeRate} (API service unavailable)`);
      } else {
        // Check if frontendExchangeRate exists but is invalid
        const exchangeRateInfo = frontendExchangeRate !== undefined 
          ? `Received: ${frontendExchangeRate} (type: ${typeof frontendExchangeRate})`
          : 'Not provided';
          
        return ResponseClass.Error(res, {
          message: "Cannot process transfers: Exchange rate service unavailable and no valid fallback rate provided",
          statusCode: 503,
          error: "Exchange rate service unavailable",
          data: {
            exchangeRateError: rateError.message,
            frontendExchangeRateInfo: exchangeRateInfo,
            message: "Please provide a valid exchange rate value or try again when the service is available",
            expectedFormat: "exchangeRate should be a positive number (e.g., 1650.50)"
          }
        });
      }
    }
    
    // If API worked but we have a frontend rate, prefer the frontend rate for manual override
    if (exchangeRateSource === 'api' && typeof frontendExchangeRate === 'number' && frontendExchangeRate > 0) {
      const apiRate = exchangeRate;
      exchangeRate = Number(Number(frontendExchangeRate).toFixed(2));
      exchangeRateSource = 'frontend_override';
      console.log(`Using frontend override exchange rate: ${exchangeRate} (API rate was: ${apiRate})`);
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
          data: { message: error.message }
        });
      }
    }

    if (processedTransfers.length === 0) {
      return ResponseClass.Error(res, {
        message: "No transfers could be processed",
        statusCode: 400,
        data: { errors }
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
        data: {
          batchId,
          processedTransfers: processedTransfers.length,
          totalAmount: `$${totalUSDAmount.toFixed(2)} USD (₦${totalNGNAmount.toFixed(2)} NGN)`
        }
      });
    }

    // Mark invoices as paid and send email notifications immediately 
    // (since Paystack doesn't support transfer webhooks)
    const processedInvoices = [];
    const emailResults = [];
    
    for (const invoice of invoices) {
      try {
        const transferRequest = transfers.find(t => t.invoiceId === invoice._id.toString());
        const amountData = invoiceAmountMap.get(invoice._id.toString());
        
        if (!amountData) {
          throw new Error(`Amount data not found for invoice ${invoice.invoiceNumber}`);
        }

        const transferReference = `TXN-${invoice.invoiceNumber}-${Date.now()}`;

        // Mark invoice as paid immediately (no webhook support for transfers)
        await invoice.markAsPaid({
          paymentMethod: 'bulk_transfer',
          paymentReference: transferReference,
          paymentNotes: `Bulk transfer payment processed via Paystack. Batch ID: ${batchId}. No webhook confirmation available for transfers.`
        });

        // Set payment metadata for record keeping
        invoice.paymentMetadata = {
          batchId,
          paystackBatchId: bulkTransferResponse.batchId || bulkTransferResponse.data?.batch_id,
          transferReference,
          usdAmount: amountData.usdAmount,
          ngnAmount: amountData.ngnAmount,
          exchangeRate: amountData.exchangeRate,
          recipientEmail: transferRequest.recipientEmail,
          recipientName: transferRequest.recipientName,
          processedAt: new Date(),
          processedBy: req.user?.userId || req.user?.id
        };
        
        await invoice.save();

        console.log(`✅ Invoice ${invoice.invoiceNumber} marked as paid immediately`);

        // Send payment confirmation email to recipient immediately
        const paymentData = {
          invoiceNumber: invoice.invoiceNumber,
          projectName: invoice.projectId?.projectName || 'Project',
          amountUSD: amountData.usdAmount,
          amountNGN: amountData.ngnAmount,
          exchangeRate: amountData.exchangeRate,
          paymentReference: transferReference,
          paymentDate: new Date(),
          batchId: batchId
        };

        const recipientEmail = transferRequest.recipientEmail || invoice.dtUserId?.email;
        const recipientName = transferRequest.recipientName || invoice.dtUserId?.fullName;

        // Send recipient email
        if (recipientEmail) {
          try {
            console.log(`📨 Sending payment confirmation to ${recipientEmail}...`);
            await PaymentNotificationService.sendPaymentConfirmation(
              recipientEmail,
              recipientName || 'Recipient',
              paymentData
            );
            console.log(`📧 ✅ Payment confirmation sent for invoice ${invoice.invoiceNumber}`);
            emailResults.push({
              invoiceNumber: invoice.invoiceNumber,
              recipientEmail,
              status: 'sent'
            });
          } catch (emailError) {
            console.error(`❌ Failed to send payment email for invoice ${invoice.invoiceNumber}:`, emailError);
            emailResults.push({
              invoiceNumber: invoice.invoiceNumber,
              recipientEmail,
              status: 'failed',
              error: emailError.message
            });
          }
        } else {
          console.log(`⚠️ No email address found for invoice ${invoice.invoiceNumber}`);
          emailResults.push({
            invoiceNumber: invoice.invoiceNumber,
            recipientEmail: 'N/A',
            status: 'no_email'
          });
        }

        // Send admin notification
        try {
          const adminEmail = envConfig.email.ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@mydeeptech.com';
          const enableAdminNotifications = process.env.ENABLE_ADMIN_TRANSFER_NOTIFICATIONS !== 'false';
          
          if (enableAdminNotifications) {
            const adminNotificationData = {
              ...paymentData,
              recipientName: recipientName || 'N/A',
              recipientEmail: recipientEmail || 'N/A',
              invoiceStatus: 'paid'
            };

            await PaymentNotificationService.sendAdminTransferNotification(
              adminEmail,
              'Administrator',
              adminNotificationData
            );
            console.log(`📧 ✅ Admin notification sent for invoice ${invoice.invoiceNumber}`);
          }
        } catch (adminEmailError) {
          console.error(`❌ Failed to send admin notification for invoice ${invoice.invoiceNumber}:`, adminEmailError);
        }

        processedInvoices.push({
          invoiceNumber: invoice.invoiceNumber,
          invoiceId: invoice._id.toString(),
          amountUSD: amountData.usdAmount,
          amountNGN: amountData.ngnAmount,
          recipientName: recipientName || 'N/A',
          recipientEmail: recipientEmail || 'N/A',
          transferReference,
          status: 'completed'
        });

        console.log(`💰 Payment completed for invoice ${invoice.invoiceNumber}`);

      } catch (invoiceError) {
        console.error(`❌ Error processing invoice ${invoice._id}:`, invoiceError);
        processedInvoices.push({
          invoiceNumber: invoice.invoiceNumber || 'Unknown',
          invoiceId: invoice._id.toString(),
          status: 'error',
          error: invoiceError.message
        });
      }
    }

    console.log(`🔄 Bulk transfer completed - ${processedInvoices.length} invoices processed`);
    console.log(`📧 Email notifications: ${emailResults.filter(e => e.status === 'sent').length} sent, ${emailResults.filter(e => e.status === 'failed').length} failed`);
    
    const successfulTransfers = processedInvoices.filter(inv => inv.status === 'completed').length;
    const failedTransfers = processedInvoices.filter(inv => inv.status === 'error').length;
    const sentEmails = emailResults.filter(e => e.status === 'sent').length;
    const failedEmails = emailResults.filter(e => e.status === 'failed').length;
    // Return immediate transfer completion response (no webhook dependency)
    const responseData = {
      success: true,
      batchId,
      paystackBatchId: bulkTransferResponse.batchId || bulkTransferResponse.data?.batch_id,
      transferCode: bulkTransferResponse.data?.transfer_code,
      status: 'transfers_completed',
      summary: {
        totalTransfers: processedTransfers.length,
        completedTransfers: successfulTransfers,
        failedTransfers: failedTransfers,
        totalUSDAmount: totalUSDAmount.toFixed(2),
        totalNGNAmount: totalNGNAmount.toFixed(2),
        exchangeRateUsed: exchangeRateSource === 'frontend' ? exchangeRate : (totalNGNAmount / totalUSDAmount).toFixed(2),
        exchangeRateSource: exchangeRateSource,
        completedAt: new Date(),
        emailSummary: {
          sent: sentEmails,
          failed: failedEmails,
          noEmail: emailResults.filter(e => e.status === 'no_email').length
        }
      },
      processedInvoices,
      emailResults,
      errors: processedInvoices.filter(inv => inv.status === 'error'),
      paystackResponse: {
        status: bulkTransferResponse.success,
        message: bulkTransferResponse.message || 'Bulk transfer completed',
        reference: bulkTransferResponse.reference
      },
      notification: {
        message: 'Transfers have been completed and processed immediately. Recipients have been notified via email where email addresses are available.',
        noWebhookNote: 'Paystack does not support webhooks for bulk transfers, so payments are marked as completed immediately upon successful Paystack initiation.',
        statusTracking: `Transfer batch completed with ID: ${batchId}`
      }
    };

    const statusMessage = successfulTransfers === processedInvoices.length 
      ? `✅ All ${successfulTransfers} transfers completed successfully`
      : `⚠️ ${successfulTransfers}/${processedInvoices.length} transfers completed successfully. ${failedTransfers} failed.`;

    return ResponseClass.Success(res, {
      message: `${statusMessage}. Email notifications sent to ${sentEmails} recipients.`,
      data: responseData
    });
};

module.exports = {
  initializeBulkTransferWithInvoices
};