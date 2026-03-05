const axios = require('axios');
const PaystackTransferService = require("../../services/paystack-transfer.service");
const ResponseClass = require("../../utils/response-handler");
const Invoice = require("../../models/invoice.model");
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

    // Check if Paystack requires approval before marking invoices as paid
    const requiresApproval = !bulkTransferResponse.success || 
                            bulkTransferResponse.data?.status === 'pending' ||
                            bulkTransferResponse.data?.approval_url ||
                            bulkTransferResponse.message?.toLowerCase().includes('approval');

    if (requiresApproval) {
      console.log('Transfer requires manual approval in Paystack Dashboard');
      
      // Mark invoices as pending approval (not paid yet)
      const pendingInvoices = [];
      
      for (const invoice of invoices) {
        try {
          const transferRequest = transfers.find(t => t.invoiceId === invoice._id.toString());
          const amountData = invoiceAmountMap.get(invoice._id.toString());
          
          if (!amountData) {
            throw new Error(`Amount data not found for invoice ${invoice.invoiceNumber}`);
          }

          const transferReference = `TXN-${invoice.invoiceNumber}-${Date.now()}`;

          // Mark invoice as pending approval (not paid yet)
          invoice.paymentStatus = 'approval_required';
          invoice.paymentMetadata = {
            batchId,
            paystackBatchId: bulkTransferResponse.batchId || bulkTransferResponse.data?.batch_id,
            transferReference,
            usdAmount: amountData.usdAmount,
            ngnAmount: amountData.ngnAmount,
            exchangeRate: amountData.exchangeRate,
            recipientEmail: transferRequest.recipientEmail,
            recipientName: transferRequest.recipientName,
            approvalUrl: bulkTransferResponse.data?.approval_url,
            requiresApproval: true,
            submittedAt: new Date(),
            submittedBy: req.user?.userId || req.user?.id
          };
          
          await invoice.save();

          pendingInvoices.push({
            invoiceNumber: invoice.invoiceNumber,
            invoiceId: invoice._id.toString(),
            amountUSD: amountData.usdAmount,
            amountNGN: amountData.ngnAmount,
            recipientName: transferRequest.recipientName || 'N/A',
            recipientEmail: transferRequest.recipientEmail || 'N/A',
            transferReference,
            status: 'approval_required'
          });

          console.log(`⏳ Invoice ${invoice.invoiceNumber} pending approval`);

        } catch (error) {
          console.error(`❌ Error processing invoice ${invoice._id}:`, error);
        }
      }

      // Send admin notification with approval URL
      const adminEmail = envConfig.email.ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@mydeeptech.com';
      const approvalUrl = bulkTransferResponse.data?.approval_url;
      
      if (approvalUrl) {
        // Send approval required notification to admin
        console.log(`📧 Sending approval required notification to admin: ${adminEmail}`);
        // You could create a new email template for approval notifications
      }

      return ResponseClass.Success(res, {
        message: `⚠️ Transfer submitted but requires manual approval. ${pendingInvoices.length} invoices pending approval.`,
        data: {
          success: true,
          batchId,
          paystackBatchId: bulkTransferResponse.batchId || bulkTransferResponse.data?.batch_id,
          status: 'approval_required',
          approvalUrl: approvalUrl,
          approvalInstructions: {
            message: "Manual approval required in Paystack Dashboard",
            steps: [
              "1. Visit the approval URL below",
              "2. Login to your Paystack Dashboard", 
              "3. Review transfer details",
              "4. Approve or reject the transfers",
              "5. Recipients will be notified after approval"
            ],
            approvalUrl: approvalUrl
          },
          summary: {
            totalTransfers: processedTransfers.length,
            pendingApproval: pendingInvoices.length,
            totalUSDAmount: totalUSDAmount.toFixed(2),
            totalNGNAmount: totalNGNAmount.toFixed(2),
            exchangeRateUsed: exchangeRateSource === 'frontend' ? exchangeRate : (totalNGNAmount / totalUSDAmount).toFixed(2),
            exchangeRateSource: exchangeRateSource,
            submittedAt: new Date()
          },
          pendingInvoices,
          paystackResponse: {
            status: bulkTransferResponse.success,
            message: bulkTransferResponse.message || 'Transfer submitted for approval',
            reference: bulkTransferResponse.reference
          }
        }
      });
    }

    // If no approval required, process immediately as before
    console.log('✅ Transfer approved automatically, processing payments...');

    // Mark invoices as paid and send email notifications immediately 
    // (when no approval is required)
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
          const adminEmail = 'payments@mydeeptech.ng';
          const enableAdminNotifications = true;
          
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

// Complete transfers after manual Paystack approval
const completeApprovedTransfers = async (req, res) => {
  try {
    const { batchId } = req.params;
    
    console.log(`🔄 Processing approved transfers for batch: ${batchId}`);
    
    // Find all invoices with approval_required status for this batch
    const pendingInvoices = await Invoice.find({
      'paymentMetadata.batchId': batchId,
      paymentStatus: 'approval_required'
    }).populate([
      { path: 'dtUserId', select: 'fullName email' },  
      { path: 'projectId', select: 'projectName' }
    ]);

    if (pendingInvoices.length === 0) {
      return ResponseClass.Error(res, {
        message: "No pending approval invoices found for this batch",
        statusCode: 404,
        data: { batchId }
      });
    }

    const processedInvoices = [];
    const emailResults = [];

    // Process each invoice - mark as paid and send emails
    for (const invoice of pendingInvoices) {
      try {
        // Mark invoice as paid
        await invoice.markAsPaid({
          paymentMethod: 'bulk_transfer',
          paymentReference: invoice.paymentMetadata.transferReference,
          paymentNotes: `Bulk transfer payment approved and completed via Paystack Dashboard. Batch ID: ${batchId}.`
        });

        // Update metadata to reflect approval completion
        invoice.paymentMetadata = {
          ...invoice.paymentMetadata,
          approvedAt: new Date(),
          approvedBy: req.user?.userId || req.user?.id
        };
        await invoice.save();

        console.log(`✅ Invoice ${invoice.invoiceNumber} marked as paid after approval`);

        // Send payment confirmation email to recipient
        const paymentData = {
          invoiceNumber: invoice.invoiceNumber,
          projectName: invoice.projectId?.projectName || 'Project',
          amountUSD: invoice.paymentMetadata.usdAmount,
          amountNGN: invoice.paymentMetadata.ngnAmount,
          exchangeRate: invoice.paymentMetadata.exchangeRate,
          paymentReference: invoice.paymentMetadata.transferReference,
          paymentDate: new Date(),
          batchId: batchId
        };

        const recipientEmail = invoice.paymentMetadata.recipientEmail || invoice.dtUserId?.email;
        const recipientName = invoice.paymentMetadata.recipientName || invoice.dtUserId?.fullName;

        if (recipientEmail) {
          try {
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
        }

        // Send admin notification  
        try {
          const adminEmail = envConfig.email.ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@mydeeptech.com';
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
        } catch (adminEmailError) {
          console.error(`❌ Failed to send admin notification for invoice ${invoice.invoiceNumber}:`, adminEmailError);
        }

        processedInvoices.push({
          invoiceNumber: invoice.invoiceNumber,
          invoiceId: invoice._id.toString(),
          amountUSD: invoice.paymentMetadata.usdAmount,
          amountNGN: invoice.paymentMetadata.ngnAmount,
          recipientName: recipientName || 'N/A',
          recipientEmail: recipientEmail || 'N/A', 
          transferReference: invoice.paymentMetadata.transferReference,
          status: 'completed'
        });

      } catch (error) {
        console.error(`❌ Error processing approved invoice ${invoice.invoiceNumber}:`, error);
        processedInvoices.push({
          invoiceNumber: invoice.invoiceNumber,
          invoiceId: invoice._id.toString(),
          status: 'error',
          error: error.message
        });
      }
    }

    const successfulTransfers = processedInvoices.filter(inv => inv.status === 'completed').length;
    const sentEmails = emailResults.filter(e => e.status === 'sent').length;

    return ResponseClass.Success(res, {
      message: `✅ ${successfulTransfers} approved transfers completed. Email notifications sent to ${sentEmails} recipients.`,
      data: {
        batchId,
        processedInvoices,
        emailResults,
        summary: {
          totalInvoices: pendingInvoices.length,
          successful: successfulTransfers,
          emailsSent: sentEmails,
          completedAt: new Date()
        }
      }
    });

  } catch (error) {
    console.error('❌ Error completing approved transfers:', error);
    return ResponseClass.Error(res, {
      message: "Failed to complete approved transfers",
      statusCode: 500,
      error: error.message
    });
  }
};

// Get all transfers pending approval
const getPendingApprovalTransfers = async (req, res) => {
  try {
    const pendingInvoices = await Invoice.find({
      paymentStatus: 'approval_required'
    }).populate([
      { path: 'dtUserId', select: 'fullName email' },
      { path: 'projectId', select: 'projectName' }
    ]).sort({ createdAt: -1 });

    const groupedByBatch = {};

    pendingInvoices.forEach(invoice => {
      const batchId = invoice.paymentMetadata?.batchId;
      if (!groupedByBatch[batchId]) {
        groupedByBatch[batchId] = {
          batchId,
          approvalUrl: invoice.paymentMetadata?.approval_url,
          submittedAt: invoice.paymentMetadata?.submittedAt,
          paystackBatchId: invoice.paymentMetadata?.paystackBatchId,
          invoices: [],
          totalUSD: 0,
          totalNGN: 0
        };
      }

      groupedByBatch[batchId].invoices.push({
        invoiceNumber: invoice.invoiceNumber,
        invoiceId: invoice._id,
        recipientName: invoice.paymentMetadata?.recipientName,
        recipientEmail: invoice.paymentMetadata?.recipientEmail,
        amountUSD: invoice.paymentMetadata?.usdAmount,
        amountNGN: invoice.paymentMetadata?.ngnAmount,
        projectName: invoice.projectId?.projectName
      });

      groupedByBatch[batchId].totalUSD += invoice.paymentMetadata?.usdAmount || 0;
      groupedByBatch[batchId].totalNGN += invoice.paymentMetadata?.ngnAmount || 0;
    });

    const pendingBatches = Object.values(groupedByBatch);

    return ResponseClass.Success(res, {
      message: `Found ${pendingBatches.length} batches with ${pendingInvoices.length} invoices pending approval`,
      data: {
        pendingBatches,
        totalPendingInvoices: pendingInvoices.length,
        instructions: {
          message: "Use the approval URLs to approve transfers in Paystack Dashboard",
          nextStep: "After approval, call POST /transfer/approve-complete/:batchId to complete the process"
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching pending approval transfers:', error);
    return ResponseClass.Error(res, {
      message: "Failed to fetch pending approval transfers",
      statusCode: 500,
      error: error.message
    });
  }
};


const VerifyAccountNumber = async (req, res) => {

    let { accountNumber, bankCode } = req.query;

    try {
        // Validate input parameters
        if (!accountNumber || !bankCode) {
            return ResponseClass.Error(res, {
                message: "Account number and bank code are required",
                statusCode: 400,
                data: {
                    required: ["accountNumber", "bankCode"],
                    received: { accountNumber, bankCode }
                }
            });
        }

        // Validate account number format (should be 10 digits for Nigerian banks)
        // if (!/^\d{10}$/.test(accountNumber)) {
        //     return ResponseClass.Error(res, {
        //         message: "Invalid account number format. Account number should be 10 digits",
        //         statusCode: 400,
        //         data: { accountNumber }
        //     });
        // }

        // Validate bank code format (should be 3 digits)
        // if (!/^\d{3}$/.test(bankCode)) {
        //     return ResponseClass.Error(res, {
        //         message: "Invalid bank code format. Bank code should be 3 digits",
        //         statusCode: 400,
        //         data: { bankCode }
        //     });
        // }

        const paystackSecretKey = envConfig.paystack.PAYSTACK_SECRET_KEY;

        if (!paystackSecretKey) {
            return ResponseClass.Error(res, {
                message: "Paystack configuration error: Secret key not found",
                statusCode: 500,
                error: "Missing PAYSTACK_SECRET_KEY"
            });
        }

        const paystackUrl = `${envConfig.paystack.PAYSTACK_BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`;
        
        console.log(`🔍 Verifying account: ${accountNumber} with bank code: ${bankCode}`);

        const response = await axios.get(paystackUrl, {
            headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 second timeout
        });

        if (response.data && response.data.status === true) {
            const accountData = response.data.data;
            
            return ResponseClass.Success(res, {
                message: "Account number verified successfully",
                data: {
                    accountNumber: accountData.account_number,
                    accountName: accountData.account_name,
                    bankCode: bankCode,
                    verified: true,
                    verificationDate: new Date()
                }
            });
        } else {
            return ResponseClass.Error(res, {
                message: "Account verification failed",
                statusCode: 400,
                data: {
                    accountNumber,
                    bankCode,
                    paystackResponse: response.data
                }
            });
        }

    } catch (error) {

        console.error('❌ Account verification error:', error);

        // Handle specific Paystack API errors
        if (error.response && error.response.data) {

            const errorData = error.response.data;

            return ResponseClass.Error(res, {
                message: errorData.message || "Account verification failed",
                statusCode: error.response.status || 400,
                error: errorData.message,
                data: {
                    accountNumber,
                    bankCode,
                    paystackError: errorData
                }
            });
        }

        // Handle network/timeout errors
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            return ResponseClass.Error(res, {
                message: "Account verification request timed out. Please try again.",
                statusCode: 408,
                error: "Request timeout"
            });
        }

        // Handle other errors
        return ResponseClass.Error(res, {
            message: "Account verification service unavailable",
            statusCode: 503,
            error: error.message,
            data: { accountNumber, bankCode }
        });
    }
}

const getAllBanksByCountryInAfrica = async (req, res) => {
    try {
        const {
            country,
            use_cursor,
            perPage = 50,
            pay_with_bank_transfer,
            pay_with_bank,
            enabled_for_verification,
            next,
            previous,
            gateway,
            type,
            currency,
            include_nip_sort_code
        } = req.query;

        console.log(`🏦 Fetching banks for country: ${country || 'all'}`);

        // Validate country parameter if provided
        const validCountries = ['ghana', 'kenya', 'nigeria', 'south africa'];
        if (country && !validCountries.includes(country.toLowerCase())) {
            return ResponseClass.Error(res, {
                message: "Invalid country parameter",
                statusCode: 400,
                data: {
                    validCountries,
                    received: country
                }
            });
        }

        // Validate perPage parameter
        const pageSize = parseInt(perPage);
        if (pageSize && (pageSize < 1 || pageSize > 100)) {
            return ResponseClass.Error(res, {
                message: "perPage must be between 1 and 100",
                statusCode: 400,
                data: { received: perPage, allowed: "1-100" }
            });
        }

        // Get Paystack configuration
        const paystackSecretKey = envConfig.paystack.PAYSTACK_SECRET_KEY;
        if (!paystackSecretKey) {
            return ResponseClass.Error(res, {
                message: "Paystack configuration error: Secret key not found",
                statusCode: 500,
                error: "Missing PAYSTACK_SECRET_KEY"
            });
        }

        // Build query parameters for Paystack API
        const queryParams = new URLSearchParams();
        
        // Add parameters only if they are provided
        if (country) queryParams.append('country', country.toLowerCase());
        if (use_cursor !== undefined) queryParams.append('use_cursor', use_cursor);
        if (perPage) queryParams.append('perPage', pageSize.toString());
        if (pay_with_bank_transfer !== undefined) queryParams.append('pay_with_bank_transfer', pay_with_bank_transfer);
        if (pay_with_bank !== undefined) queryParams.append('pay_with_bank', pay_with_bank);
        if (enabled_for_verification !== undefined) queryParams.append('enabled_for_verification', enabled_for_verification);
        if (next) queryParams.append('next', next);
        if (previous) queryParams.append('previous', previous);
        if (gateway) queryParams.append('gateway', gateway);
        if (type) queryParams.append('type', type);
        if (currency) queryParams.append('currency', currency);
        if (include_nip_sort_code !== undefined) queryParams.append('include_nip_sort_code', include_nip_sort_code);

        // Build the complete Paystack URL
        const paystackUrl = `${envConfig.paystack.PAYSTACK_BASE_URL}/bank${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        
        console.log(`🔍 Fetching banks from: ${paystackUrl}`);

        // Make API call to Paystack
        const response = await axios.get(paystackUrl, {
            headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000 // 15 second timeout
        });

        if (response.data && response.data.status === true) {
            const banksData = response.data.data;
            const meta = response.data.meta;
            
            console.log(`✅ Successfully fetched ${Array.isArray(banksData) ? banksData.length : 0} banks`);
            
            // Transform the data to include useful information
            const transformedBanks = Array.isArray(banksData) ? banksData.map(bank => ({
                id: bank.id,
                name: bank.name,
                slug: bank.slug,
                code: bank.code,
                longcode: bank.longcode,
                gateway: bank.gateway,
                pay_with_bank: bank.pay_with_bank,
                active: bank.active,
                country: bank.country,
                currency: bank.currency,
                type: bank.type,
                is_deleted: bank.is_deleted,
                createdAt: bank.createdAt,
                updatedAt: bank.updatedAt,
                // Include NIP sort code if available (Nigeria specific)
                ...(bank.nip_institution_code && { nip_institution_code: bank.nip_institution_code })
            })) : [];

            return ResponseClass.Success(res, {
                message: `Successfully fetched ${transformedBanks.length} banks${country ? ` for ${country}` : ''}`,
                data: {
                    banks: transformedBanks,
                    meta: meta || null,
                    summary: {
                        total: transformedBanks.length,
                        country: country || 'all',
                        active_banks: transformedBanks.filter(bank => bank.active).length,
                        inactive_banks: transformedBanks.filter(bank => !bank.active).length,
                        countries_available: [...new Set(transformedBanks.map(bank => bank.country))].sort(),
                        currencies_available: [...new Set(transformedBanks.map(bank => bank.currency))].filter(Boolean).sort()
                    },
                    filters_applied: {
                        country: country || null,
                        perPage: pageSize || 50,
                        pay_with_bank_transfer: pay_with_bank_transfer || null,
                        pay_with_bank: pay_with_bank || null,
                        enabled_for_verification: enabled_for_verification || null,
                        gateway: gateway || null,
                        type: type || null,
                        currency: currency || null,
                        cursor_pagination: use_cursor === 'true'
                    },
                    pagination: meta ? {
                        next: meta.next || null,
                        previous: meta.previous || null,
                        perPage: meta.perPage || pageSize,
                        total: meta.total || null
                    } : null
                }
            });
        } else {
            return ResponseClass.Error(res, {
                message: "Failed to fetch banks from Paystack",
                statusCode: 400,
                data: {
                    paystackResponse: response.data
                }
            });
        }

    } catch (error) {
        console.error('❌ Error fetching banks:', error);

        // Handle specific Paystack API errors
        if (error.response && error.response.data) {
            const errorData = error.response.data;
            
            return ResponseClass.Error(res, {
                message: errorData.message || "Failed to fetch banks from Paystack",
                statusCode: error.response.status || 400,
                error: errorData.message,
                data: {
                    paystackError: errorData,
                    request_url: error.config?.url || 'N/A'
                }
            });
        }

        // Handle network/timeout errors
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            return ResponseClass.Error(res, {
                message: "Request to fetch banks timed out. Please try again.",
                statusCode: 408,
                data: { error: "Request timeout" }
            });
        }

        // Handle other errors
        return ResponseClass.Error(res, {
            message: "Bank service unavailable",
            statusCode: 503,
            data: { error: error.message }
        });
    }
}


module.exports = {
  initializeBulkTransferWithInvoices,
  completeApprovedTransfers,
  getPendingApprovalTransfers,
  VerifyAccountNumber,
  getAllBanksByCountryInAfrica,
};