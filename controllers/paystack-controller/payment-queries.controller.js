const PaystackPaymentService = require("../../services/paystack-payment.service");
const ResponseClass = require("../../utils/response-handler");

// Get payments for a specific freelancer
const getFreelancerPayments = async (req, res) => {
   const { freelancerId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    
    if (!freelancerId) {
      return ResponseClass.Error(res, {
        message: "Freelancer ID is required",
        statusCode: 400
      });
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    };

    const result = await PaystackPaymentService.getFreelancerPayments(freelancerId, options);
    
    return ResponseClass.Success(res, {
      message: "Freelancer payments retrieved successfully", 
      data: result 
    });
};

// Get payments for a specific project
const getProjectPayments = async (req, res) => {
   const { projectId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    
    if (!projectId) {
      return ResponseClass.Error(res, {
        message: "Project ID is required",
        statusCode: 400
      });
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    };

    const result = await PaystackPaymentService.getProjectPayments(projectId, options);
    
    return ResponseClass.Success(res, {
      message: "Project payments retrieved successfully", 
      data: result 
    });
};

// Get all payments with filters (admin function)
const getAllPayments = async (req, res) => {
    const { page = 1, limit = 10, status, search } = req.query;
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      search
    };

    const result = await PaystackPaymentService.getAllPayments(options);
    
    return ResponseClass.Success(res, {
      message: "Payments retrieved successfully", 
      data: result 
    });
};

// Get payment statistics
const getPaymentStats = async (req, res) => {
  const { freelancerId, projectId, startDate, endDate } = req.query;

    const filters = {
      freelancerId,
      projectId,
      startDate,
      endDate
    };

    const stats = await PaystackPaymentService.getPaymentStats(filters);
    
    return ResponseClass.Success(res, {
      message: "Payment statistics retrieved successfully", 
      data: stats 
    });
};

// Get pending payments (admin function)
const getPendingPayments = async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status: 'pending'
    };

    const result = await PaystackPaymentService.getAllPayments(options);
    
    return ResponseClass.Success(res, {
      message: "Pending payments retrieved successfully", 
      data: result 
    });
};

// Get failed payments (admin function)
const getFailedPayments = async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status: 'failed'
    };

    const result = await PaystackPaymentService.getAllPayments(options);
    
    return ResponseClass.Success(res, {
      message: "Failed payments retrieved successfully", 
      data: result 
    });
};

// Get successful payments (admin function)
const getSuccessfulPayments = async (req, res) => {

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status: 'success'
    };

    const result = await PaystackPaymentService.getAllPayments(options);
    
    return ResponseClass.Success(res, {
      message: "Successful payments retrieved successfully", 
      data: result 
    });
};

module.exports = {
  getFreelancerPayments,
  getProjectPayments,
  getAllPayments,
  getPaymentStats,
  getPendingPayments,
  getFailedPayments,
  getSuccessfulPayments
};