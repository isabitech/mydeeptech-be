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
    
    if (!signature) {
      return ResponseClass.Error(res, { 
        message: "Missing webhook signature", 
        statusCode: 400 
      });
    }

    // Get raw body for signature verification
    const rawBody = req.body;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
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
      return ResponseClass.Error(res, {
        message: "Invalid webhook signature", 
        statusCode: 400 
      });
    }

    // Parse JSON after signature verification
    let payload;
    try {
      payload = JSON.parse(rawBody.toString());
    } catch (error) {
      return ResponseClass.Error(res, { 
        message: "Invalid JSON in webhook body", 
        statusCode: 400 
      });
    }

    const { event, data } = payload;
    console.log(`📨 Paystack webhook received: ${event}`, { reference: data.reference });

    // Handle payment events (existing functionality)
    if (event === 'charge.success' || event === 'charge.failed') {
      await PaystackPaymentService.handleWebhook(payload, signature);
    }
    
    // Handle transfer events for bulk invoice transfers
    else if (event === 'transfer.success') {
      await handleTransferSuccess(data);
    }
    
    else if (event === 'transfer.failed') {
      await handleTransferFailed(data);
    }
    
    else {
      console.log(`ℹ️ Unhandled webhook event: ${event}`);
    }
    
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
    
    // Find invoice(s) with matching transfer reference in payment metadata
    const invoices = await Invoice.find({
      'paymentMetadata.transferReference': reference,
      paymentStatus: 'payment_initiated'
    }).populate([
      { path: 'dtUserId', select: 'fullName email' },
      { path: 'projectId', select: 'projectName' }
    ]);

    if (invoices.length === 0) {
      console.log(`⚠️ No matching invoices found for transfer reference: ${reference}`);
      return;
    }

    console.log(`📋 Found ${invoices.length} invoice(s) for transfer reference: ${reference}`);

    // Process each invoice
    for (const invoice of invoices) {
      try {
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

        if (invoice.paymentMetadata?.recipientEmail) {
          try {
            await PaymentNotificationService.sendPaymentConfirmation(
              invoice.paymentMetadata.recipientEmail,
              invoice.paymentMetadata.recipientName || invoice.dtUserId?.fullName || 'Recipient',
              paymentData
            );
            console.log(`📧 Payment confirmation email sent for invoice ${invoice.invoiceNumber}`);
          } catch (emailError) {
            console.error(`❌ Failed to send payment email for invoice ${invoice.invoiceNumber}:`, emailError);
          }
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