const PaystackPaymentService = require("../../services/paystack-payment.service");
const ResponseClass = require("../../utils/response-handler");

// Initialize payment for freelancer
const initializeFreelancerPayment = async (req, res) => {
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
};

// Verify payment
const verifyPayment = async (req, res) => {
  const { reference } = req.params;
    if (!reference) {
      return ResponseClass.Error({
        message: "Payment reference is required", 
        statusCode: 400 
      });
    }
    const result = await PaystackPaymentService.verifyPayment(reference);
    return ResponseClass.Success(res, {  
      message: "Payment verified successfully", 
      data: result 
    });
};

// Get payment details by ID
const getPaymentDetails = async (req, res) => {
const { paymentId } = req.params;
    if (!paymentId) {
      return ResponseClass.Error({ 
        message: "Payment ID is required", 
        statusCode: 400  
      });
    }

    const payment = await PaystackPaymentService.getPaymentDetails(paymentId);
    
    return ResponseClass.Success(res, {
      message: "Payment details retrieved successfully",
      data: payment
    });
};

// Get payment details by reference (for callback handling)
const getPaymentByReference = async (req, res) => {
  const { reference } = req.params;
    
    if (!reference) {
      return ResponseClass.Error({
        message: "Payment reference is required", 
        statusCode: 400
      });
    }

    const result = await PaystackPaymentService.verifyPayment(reference);
    
    return ResponseClass.Success(res, {
      message: "Payment details retrieved successfully",
      data: result
    });
};

// Cancel payment
const cancelPayment = async (req, res) => {
   const { paymentId } = req.params;
    const { reason } = req.body;

    if (!paymentId) {
      return ResponseClass.Error({
        message: "Payment ID is required",
        statusCode: 400
      });
    }

    const payment = await PaystackPaymentService.cancelPayment(paymentId, reason);
    
    return ResponseClass.Success(res, {
      message: "Payment cancelled successfully",
      data: payment,
    });
};

module.exports = {
  initializeFreelancerPayment,
  verifyPayment,
  getPaymentDetails,
  getPaymentByReference,
  cancelPayment
};