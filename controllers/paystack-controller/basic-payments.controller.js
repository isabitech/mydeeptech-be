const PaystackPaymentService = require("../../services/paystack-payment.service");
const ResponseClass = require("../../utils/response-handler");

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
      initiatedBy: req.user?.id || req.body.initiatedBy,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };

    const result = await PaystackPaymentService.initializePayment(payload);

    return ResponseClass.Success(res, { 
      message: "Payment initialized successfully", 
      data: result 
    });
  } catch (err) {
    next(err);
  }
};

// Verify payment
const verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return ResponseClass.Error(res, {
        message: "Payment reference is required", 
        statusCode: 400 
      });
    }

    const result = await PaystackPaymentService.verifyPayment(reference);

    return ResponseClass.Success(res, {  
      message: "Payment verified successfully", 
      data: result 
    });
  } catch (err) {
    next(err);
  }
};

// Get payment details by ID
const getPaymentDetails = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    
    if (!paymentId) {
      return ResponseClass.Error(res, { 
        message: "Payment ID is required", 
        statusCode: 400  
      });
    }

    const payment = await PaystackPaymentService.getPaymentDetails(paymentId);
    
    return ResponseClass.Success(res, {
      message: "Payment details retrieved successfully",
      data: payment
    });
  } catch (err) {
    next(err);
  }
};

// Get payment details by reference (for callback handling)
const getPaymentByReference = async (req, res, next) => {
  try {
    const { reference } = req.params;
    
    if (!reference) {
      return ResponseClass.Error(res, {
        message: "Payment reference is required", 
        statusCode: 400
      });
    }

    const result = await PaystackPaymentService.verifyPayment(reference);
    
    return ResponseClass.Success(res, {
      message: "Payment details retrieved successfully",
      data: result
    });
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
      return ResponseClass.Error(res, {
        message: "Payment ID is required",
        statusCode: 400
      });
    }

    const payment = await PaystackPaymentService.cancelPayment(paymentId, reason);
    
    return ResponseClass.Success(res, {
      message: "Payment cancelled successfully",
      data: payment
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  initializeFreelancerPayment,
  verifyPayment,
  getPaymentDetails,
  getPaymentByReference,
  cancelPayment
};