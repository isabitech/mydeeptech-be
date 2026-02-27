const PaystackPaymentService = require("../../services/paystack-payment.service");
const ResponseClass = require("../../utils/response-handler");

// Handle Paystack webhooks
const handleWebhook = async (req, res, next) => {
   const signature = req.get('x-paystack-signature');
    const payload = req.body;

    if (!signature) {
      return ResponseClass.Error({ 
        message: "Missing webhook signature", 
        statusCode: 400 
      });
    }

    await PaystackPaymentService.handleWebhook(payload, signature);
    
    return res.status(200).json({ status: 'success' });
};

module.exports = {
  handleWebhook
};