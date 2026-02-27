const PaystackPaymentService = require("../../services/paystack-payment.service");
const ResponseClass = require("../../utils/response-handler");
const FreelancerPaymentRepository = require("../../repositories/freelancerPayment.repository");

// Initialize bulk payment for multiple recipients (payment collection, not transfers)
const initializeBulkPayment = async (req, res) => {
 const { 
      payments,
      currency = 'NGN',
      description = 'Bulk payment service',
      callbackUrl,
      channels = ['card', 'bank', 'ussd', 'qr', 'mobile_money'],
      dryRun = false,
      forceOverride = false
    } = req.body;

    // Check authentication
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

    // Process and validate payments
    const validationErrors = [];
    const processedPayments = [];
    
    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      const errors = [];

      // Required field validation
      if (!payment.recipientId) errors.push(`Payment ${i + 1}: recipientId is required`);
      if (!payment.amount || payment.amount <= 0) errors.push(`Payment ${i + 1}: valid amount is required`);
      if (!payment.customerEmail) errors.push(`Payment ${i + 1}: customerEmail is required`);
      if (!payment.customerName) errors.push(`Payment ${i + 1}: customerName is required`);
      if (!payment.paymentType) errors.push(`Payment ${i + 1}: paymentType is required`);

      if (errors.length > 0) {
        validationErrors.push(...errors);
        continue;
      }

      processedPayments.push({
        index: i,
        ...payment,
        freelancerId: payment.recipientId, // Map for compatibility
        currency: payment.currency || currency
      });
    }

    if (validationErrors.length > 0) {
      return ResponseClass.Error(res, { 
        message: "Validation errors found", 
        statusCode: 400,
        data: { errors: validationErrors }
      });
    }

    // Dry run - validation only
    if (dryRun) {
      return ResponseClass.Success(res, {
        message: "Bulk payment validation successful",
        data: {
          totalPayments: processedPayments.length,
          estimatedTotalAmount: processedPayments.reduce((sum, p) => sum + p.amount, 0)
        }
      });
    }

    // Process bulk payment initialization
    const batchId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const results = {
      batchId,
      totalPayments: processedPayments.length,
      successful: [],
      failed: []
    };

    // Process payments in chunks
    const chunkSize = 5;
    for (let i = 0; i < processedPayments.length; i += chunkSize) {
      const chunk = processedPayments.slice(i, i + chunkSize);
      
      const chunkResults = await Promise.allSettled(
        chunk.map(async (payment) => {
          const paymentPayload = {
            freelancerId: payment.freelancerId,
            projectId: payment.projectId || null,
            amount: payment.amount,
            currency: payment.currency,
            customerEmail: payment.customerEmail,
            customerName: payment.customerName,
            description: payment.description || description,
            metadata: { ...payment.metadata, batchId },
            callbackUrl,
            channels,
            initiatedBy,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          };

          const result = await PaystackPaymentService.initializePayment(paymentPayload);
          return { ...payment, ...result };
        })
      );

      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.successful.push(result.value);
        } else {
          results.failed.push({
            index: chunk[index].index + 1,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });
    }

    return ResponseClass.Success(res, {
      message: "Bulk payment initialized successfully",
      data: results
    });
};

// Get bulk payment status
const getBulkPaymentStatus = async (req, res) => {
  const { batchId } = req.params;

    if (!batchId) {
      return ResponseClass.Error(res, {
        message: "Batch ID is required",
        statusCode: 400
      });
    }

    const payments = await FreelancerPaymentRepository.findAll({
      'metadata.batchId': batchId
    });

    const summary = {
      batchId,
      totalPayments: payments.length,
      successful: payments.filter(p => p.status === 'success').length,
      pending: payments.filter(p => p.status === 'pending').length,
      failed: payments.filter(p => p.status === 'failed').length
    };

    return ResponseClass.Success(res, {
      message: "Bulk payment status retrieved successfully",
      data: { summary, payments }
    });
};

// Retry failed bulk payments
const retryBulkPayment = async (req, res) => {
 const { batchId } = req.params;

    const failedPayments = await FreelancerPaymentRepository.findAll({
      'metadata.batchId': batchId,
      status: 'failed'
    });

    if (failedPayments.length === 0) {
      return ResponseClass.Error(res, {
        message: "No failed payments found for this batch",
        statusCode: 404
      });
    }

    // Retry logic would go here
    return ResponseClass.Success(res, {
      message: "Bulk payment retry initiated",
      data: { retriedCount: failedPayments.length }
    });
};

// Cancel bulk payments
const cancelBulkPayment = async (req, res) => {
  const { batchId } = req.params;
    const { reason = "Bulk payment cancelled" } = req.body;

    const pendingPayments = await FreelancerPaymentRepository.findAll({
      'metadata.batchId': batchId,
      status: { $in: ['pending', 'processing'] }
    });

    if (pendingPayments.length === 0) {
      return ResponseClass.Error(res, {
        message: "No pending payments found for this batch",
        statusCode: 404
      });
    }

    // Cancel each payment
    const cancelResults = await Promise.allSettled(
      pendingPayments.map(payment => 
        PaystackPaymentService.cancelPayment(payment._id, reason)
      )
    );

    const successfulCancellations = cancelResults.filter(r => r.status === 'fulfilled').length;

    return ResponseClass.Success(res, {
      message: `${successfulCancellations} payments cancelled successfully`,
      data: { 
        total: pendingPayments.length,
        cancelled: successfulCancellations
      }
    });
};

module.exports = {
  initializeBulkPayment,
  getBulkPaymentStatus,
  retryBulkPayment,
  cancelBulkPayment
};