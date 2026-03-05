const PaystackPaymentService = require("../../services/paystack-payment.service");
const Invoice = require("../../models/invoice.model");
const DTUser = require("../../models/dtUser.model");
const PaymentNotificationService = require("../../services/mail-service/payment-notification.service");
const ResponseClass = require("../../utils/response-handler");
const crypto = require('crypto');
const envConfig = require('../../config/envConfig');

// Handle Paystack webhooks
const handleWebhook = async (req, res) => {
  try {
    const signature = req.get('x-paystack-signature');
    
    console.log('🔍 Webhook received from Paystack:');
    console.log('- Headers:', req.headers);
    console.log('- Signature present:', !!signature);
    console.log('- Body type:', typeof req.body);
    console.log('- Body length:', req.body?.length);
    
    if (!signature) {
      console.log('❌ Missing webhook signature');
      return ResponseClass.Error(res, { 
        message: "Missing webhook signature", 
        statusCode: 400 
      });
    }

    // Get raw body for signature verification
    const rawBody = req.body;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      console.log('❌ Invalid webhook body:', typeof rawBody);
      return ResponseClass.Error(res, { 
        message: "Invalid webhook body", 
        statusCode: 400 
      });
    }

    // Verify webhook signature using raw body
    const hash = crypto
      .createHmac('sha512', envConfig.paystack.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      console.log('❌ Webhook signature mismatch');
      console.log('- Computed hash:', hash);
      console.log('- Received signature:', signature);
      return ResponseClass.Error(res, {
        message: "Invalid webhook signature", 
        statusCode: 400 
      });
    }

    console.log('✅ Webhook signature verified');

    // Parse JSON after signature verification
    let payload;
    try {
      payload = JSON.parse(rawBody.toString());
      console.log('✅ Webhook payload parsed successfully');
    } catch (error) {
      console.log('❌ Failed to parse webhook JSON:', error.message);
      return ResponseClass.Error(res, { 
        message: "Invalid JSON in webhook body", 
        statusCode: 400 
      });
    }

    const { event, data } = payload;
    console.log(`📨 Paystack webhook received: ${event}`, { 
      reference: data.reference,
      amount: data.amount,
      status: data.status,
      recipient: data.recipient?.name 
    });

    // Handle payment events (existing functionality)
    if (event === 'charge.success' || event === 'charge.failed') {
      console.log('🔄 Processing charge event...');
      await PaystackPaymentService.handleWebhook(payload, signature);
    }
    
    // Handle transfer events for bulk invoice transfers
    else if (event === 'transfer.success') {
      console.log('🔄 Processing transfer success event...');
      await handleTransferSuccess(data);
    }
    
    else if (event === 'transfer.failed') {
      console.log('🔄 Processing transfer failed event...');
      await handleTransferFailed(data);
    }
    
    else {
      console.log(`ℹ️ Unhandled webhook event: ${event}`);
    }
    
    console.log('✅ Webhook processed successfully');
    return res.status(200).json({ status: 'success' });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
};

// Handle successful transfer events
async function handleTransferSuccess(transferData) {
  try {
    const { reference, amount, recipient } = transferData;
    console.log(`✅ Transfer success webhook: ${reference}`);
    console.log(`💰 Amount: ${amount}, Recipient: ${recipient?.name || 'N/A'}`);
    
    // Find invoice(s) with matching transfer reference in payment metadata
    const invoices = await Invoice.find({
      'paymentMetadata.transferReference': reference,
      paymentStatus: 'payment_initiated'
    }).populate([
      { path: 'dtUserId', select: 'fullName email' },
      { path: 'projectId', select: 'projectName' }
    ]);

    console.log(`🔍 Searching for invoices with transfer reference: ${reference}`);
    
    if (invoices.length === 0) {
      console.log(`⚠️ No matching invoices found for transfer reference: ${reference}`);
      
      // Try to find any invoice with this reference (maybe in different status)
      const allWithRef = await Invoice.find({
        'paymentMetadata.transferReference': reference
      }).select('invoiceNumber paymentStatus');
      
      if (allWithRef.length > 0) {
        console.log('📋 Found invoices with this reference but different status:');
        allWithRef.forEach(inv => {
          console.log(`  - ${inv.invoiceNumber}: ${inv.paymentStatus}`);
        });
      } else {
        console.log('📋 No invoices found with this reference at all');
      }
      return;
    }

    console.log(`📋 Found ${invoices.length} invoice(s) for transfer reference: ${reference}`);
    
    // Log invoice details
    invoices.forEach(invoice => {
      console.log(`📄 Invoice: ${invoice.invoiceNumber}`);
      console.log(`  - Status: ${invoice.paymentStatus}`);
      console.log(`  - User: ${invoice.dtUserId?.fullName} (${invoice.dtUserId?.email})`);
      console.log(`  - Project: ${invoice.projectId?.projectName || 'N/A'}`);
    });

    // Process each invoice
    for (const invoice of invoices) {
      try {
        console.log(`🔄 Processing invoice: ${invoice.invoiceNumber}`);
        
        // Mark invoice as paid
        await invoice.markAsPaid({
          paymentMethod: 'bulk_transfer',
          paymentReference: reference,
          paymentNotes: `Bulk transfer payment confirmed via Paystack webhook. Batch ID: ${invoice.paymentMetadata?.batchId}.`
        });

        console.log(`✅ Invoice ${invoice.invoiceNumber} marked as paid`);

        // Send payment confirmation email to recipient
        const paymentData = {
          invoiceNumber: invoice.invoiceNumber,
          projectName: invoice.projectId?.projectName || 'Project',
          amountUSD: invoice.paymentMetadata?.usdAmount || invoice.invoiceAmount,
          amountNGN: invoice.paymentMetadata?.ngnAmount || 0,
          exchangeRate: invoice.paymentMetadata?.exchangeRate || 1,
          paymentReference: reference,
          paymentDate: new Date(),
          batchId: invoice.paymentMetadata?.batchId || 'unknown'
        };

        console.log(`📧 Preparing to send email for invoice ${invoice.invoiceNumber}`);
        console.log(`   - Recipient: ${invoice.paymentMetadata?.recipientEmail || invoice.dtUserId?.email}`);
        console.log(`   - Name: ${invoice.paymentMetadata?.recipientName || invoice.dtUserId?.fullName}`);

        const recipientEmail = invoice.paymentMetadata?.recipientEmail || invoice.dtUserId?.email;
        const recipientName = invoice.paymentMetadata?.recipientName || invoice.dtUserId?.fullName;

        if (recipientEmail) {
          try {
            console.log(`📨 Sending payment confirmation email to ${recipientEmail}...`);
            await PaymentNotificationService.sendPaymentConfirmation(
              recipientEmail,
              recipientName || 'Recipient',
              paymentData
            );
            console.log(`📧 ✅ Payment confirmation email sent for invoice ${invoice.invoiceNumber}`);
          } catch (emailError) {
            console.error(`❌ Failed to send payment email for invoice ${invoice.invoiceNumber}:`, emailError);
            console.error('   - Error details:', emailError.stack);
          }
        } else {
          console.log(`⚠️ No email address found for invoice ${invoice.invoiceNumber}`);
        }

        // Send admin notification for successful transfer
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

            console.log(`📨 Sending admin transfer notification to ${adminEmail} for invoice ${invoice.invoiceNumber}...`);
            await PaymentNotificationService.sendAdminTransferNotification(
              adminEmail,
              'Administrator',
              adminNotificationData
            );
            console.log(`📧 ✅ Admin transfer notification sent for invoice ${invoice.invoiceNumber}`);
          } else {
            console.log(`⭕ Admin transfer notifications disabled via environment variable`);
          }
        } catch (adminEmailError) {
          console.error(`❌ Failed to send admin notification for invoice ${invoice.invoiceNumber}:`, adminEmailError);
        }

      } catch (invoiceError) {
        console.error(`❌ Error processing invoice ${invoice.invoiceNumber}:`, invoiceError);
      }
    }

    // Check if this completes a batch and send admin summary
    await checkAndSendBatchSummary(invoices[0].paymentMetadata?.batchId);

  } catch (error) {
    console.error('❌ Error handling transfer success:', error);
    throw error;
  }
}

// Handle failed transfer events
async function handleTransferFailed(transferData) {
  try {
    const { reference, failure_reason } = transferData;
    console.log(`❌ Transfer failed webhook: ${reference} - ${failure_reason}`);
    
    // Find invoice(s) with matching transfer reference
    const invoices = await Invoice.find({
      'paymentMetadata.transferReference': reference,
      paymentStatus: 'payment_initiated'
    });

    for (const invoice of invoices) {
      try {
        // Mark invoice as payment failed
        invoice.paymentStatus = 'payment_failed';
        invoice.paymentMetadata = {
          ...invoice.paymentMetadata,
          failureReason: failure_reason,
          failedAt: new Date()
        };
        await invoice.save();

        console.log(`❌ Invoice ${invoice.invoiceNumber} marked as payment failed: ${failure_reason}`);

      } catch (invoiceError) {
        console.error(`❌ Error updating failed invoice ${invoice.invoiceNumber}:`, invoiceError);
      }
    }

  } catch (error) {
    console.error('❌ Error handling transfer failure:', error);
    throw error;
  }
}

// Check if batch is complete and send admin summary
async function checkAndSendBatchSummary(batchId) {
  if (!batchId) return;

  try {
    // Get all invoices in this batch
    const batchInvoices = await Invoice.find({
      'paymentMetadata.batchId': batchId
    }).populate([
      { path: 'dtUserId', select: 'fullName email' },
      { path: 'projectId', select: 'projectName' }
    ]);

    if (batchInvoices.length === 0) return;

    // Check if all invoices in batch are processed (paid or failed)
    const pendingInvoices = batchInvoices.filter(inv => 
      inv.paymentStatus === 'payment_initiated'
    );

    if (pendingInvoices.length > 0) {
      console.log(`⏳ Batch ${batchId} still has ${pendingInvoices.length} pending invoices`);
      return; // Batch not complete yet
    }

    console.log(`🎯 Batch ${batchId} is complete - sending admin summary`);

    // Prepare batch summary data
    const paidInvoices = batchInvoices.filter(inv => inv.paymentStatus === 'paid');
    const failedInvoices = batchInvoices.filter(inv => inv.paymentStatus === 'payment_failed');
    
    const totalUSD = batchInvoices.reduce((sum, inv) => sum + (inv.paymentMetadata?.usdAmount || inv.invoiceAmount), 0);
    const totalNGN = batchInvoices.reduce((sum, inv) => sum + (inv.paymentMetadata?.ngnAmount || 0), 0);
    const avgExchangeRate = totalUSD > 0 ? totalNGN / totalUSD : 0;

    // Get admin details from the first invoice
    const adminId = batchInvoices[0].paymentMetadata?.initiatedBy;
    if (!adminId) return;

    const admin = await DTUser.findById(adminId).select('fullName email');
    if (!admin || !admin.email) return;

    const summaryData = {
      batchId,
      paystackBatchId: batchInvoices[0].paymentMetadata?.paystackBatchId,
      totalTransfers: batchInvoices.length,
      successfulTransfers: paidInvoices.length,
      totalAmountUSD: totalUSD,
      totalAmountNGN: totalNGN,
      exchangeRate: avgExchangeRate,
      paidInvoices: paidInvoices.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        recipient: inv.paymentMetadata?.recipientName || inv.dtUserId?.fullName,
        usdAmount: inv.paymentMetadata?.usdAmount || inv.invoiceAmount,
        ngnAmount: inv.paymentMetadata?.ngnAmount || 0
      })),
      errors: failedInvoices.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        invoiceId: inv._id,
        error: inv.paymentMetadata?.failureReason || 'Transfer failed'
      })),
      processedAt: new Date()
    };

    await PaymentNotificationService.sendBulkPaymentSummary(
      admin.email,
      admin.fullName,
      summaryData
    );

    console.log(`📧 Batch summary sent to admin: ${admin.email}`);

  } catch (error) {
    console.error(`❌ Error sending batch summary for ${batchId}:`, error);
  }
}

module.exports = {
  handleWebhook
};