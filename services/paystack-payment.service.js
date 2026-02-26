
const Paystack = require('paystack');
const FreelancerPaymentRepository = require("../repositories/freelancerPayment.repository");
const AppError = require("../utils/app-error");
const crypto = require('crypto');
const envConfig = require('../config/envConfig');

class PaystackPaymentService {
  
  constructor() {
    // Initialize Paystack with your secret key from environment variables
    this.paystack = Paystack(envConfig.paystack.PAYSTACK_SECRET_KEY);
  }

  static async initializePayment(payload) {
    try {
      const { 
        freelancerId, 
        projectId, 
        invoiceId,
        amount, 
        currency = 'NGN',
        customerEmail, 
        customerName,
        customerPhone,
        description = 'Freelancer service payment',
        metadata = {},
        initiatedBy,
        callbackUrl,
        channels = ['card', 'bank', 'ussd', 'qr', 'mobile_money'],
        ipAddress,
        userAgent
      } = payload;

      // Validate required fields
      if (!freelancerId || !amount || !customerEmail || !customerName || !initiatedBy) {
        throw new AppError({ 
          message: "Missing required fields: freelancerId, amount, customerEmail, customerName, initiatedBy", 
          statusCode: 400 
        });
      }

      // Validate amount
      if (amount <= 0) {
        throw new AppError({ message: "Amount must be greater than 0", statusCode: 400 });
      }

      // Create payment record in database first
      const paymentPayload = {
        freelancerId,
        projectId: projectId || null, // Make projectId optional
        invoiceId,
        amount: Math.round(amount * 100), // Convert to kobo/cents
        currency,
        customerEmail: customerEmail.toLowerCase(),
        customerName,
        customerPhone,
        description,
        paymentReference: `FLP_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`.toUpperCase(), // Explicitly generate reference
        metadata: {
          ...metadata,
          freelancerId,
          projectId: projectId || null,
          invoiceId
        },
        initiatedBy,
        ipAddress,
        userAgent,
        status: 'pending'
      };

      const payment = await FreelancerPaymentRepository.create(paymentPayload);

      // Initialize payment with Paystack
      const paystackService = new PaystackPaymentService();
      const paystackPayload = {
        email: customerEmail,
        amount: Math.round(amount * 100), // Paystack expects amount in kobo/cents
        currency,
        reference: payment.paymentReference,
        callback_url: callbackUrl || `${envConfig.FRONTEND_URL}/payment/callback`,
        metadata: {
          ...metadata,
          payment_id: payment._id.toString(),
          freelancer_id: freelancerId,
          project_id: projectId
        },
        channels
      };

      const paystackResponse = await paystackService.paystack.transaction.initialize(paystackPayload);

      if (!paystackResponse.status) {
        // Update payment status to failed
        await FreelancerPaymentRepository.markAsFailed(payment._id, paystackResponse.message);
        throw new AppError({ 
          message: `Payment initialization failed: ${paystackResponse.message}`, 
          statusCode: 400 
        });
      }

      // Update payment with Paystack response data
      const updatedPayment = await FreelancerPaymentRepository.updateById(payment._id, {
        paystackReference: paystackResponse.data.reference,
        paystackData: {
          authorization_url: paystackResponse.data.authorization_url,
          access_code: paystackResponse.data.access_code,
          transaction_id: paystackResponse.data.reference
        },
        status: 'processing'
      });

      return {
        payment: updatedPayment,
        paystack: paystackResponse.data
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError({ 
        message: `Payment initialization failed: ${error.message}`, 
        statusCode: 500 
      });
    }
  }

  static async verifyPayment(reference) {
    try {
      const paystackService = new PaystackPaymentService();
      
      // Verify with Paystack
      const paystackResponse = await paystackService.paystack.transaction.verify(reference);
      
      if (!paystackResponse.status) {
        throw new AppError({ 
          message: `Payment verification failed: ${paystackResponse.message}`, 
          statusCode: 400 
        });
      }

      // Find payment in database
      const payment = await FreelancerPaymentRepository.findByReference(reference);
      if (!payment) {
        throw new AppError({ 
          message: "Payment not found", 
          statusCode: 404 
        });
      }

      // Update payment based on Paystack response
      let updatedPayment;
      if (paystackResponse.data.status === 'success') {
        updatedPayment = await FreelancerPaymentRepository.updateById(payment._id, {
          status: 'success',
          completedAt: new Date(),
          paystackData: {
            ...payment.paystackData,
            gateway_response: paystackResponse.data.gateway_response,
            channel: paystackResponse.data.channel,
            card_type: paystackResponse.data.authorization?.card_type,
            bank: paystackResponse.data.authorization?.bank,
            fees: paystackResponse.data.fees,
            transaction_date: paystackResponse.data.transaction_date
          },
          webhookReceived: true
        });
      } else {
        updatedPayment = await FreelancerPaymentRepository.markAsFailed(
          payment._id, 
          paystackResponse.data.gateway_response || 'Payment verification failed'
        );
      }

      return {
        payment: updatedPayment,
        paystackData: paystackResponse.data
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError({ 
        message: `Payment verification failed: ${error.message}`, 
        statusCode: 500 
      });
    }
  }

  static async handleWebhook(payload, signature) {
    try {
      // Verify webhook signature
      const hash = crypto
        .createHmac('sha512', envConfig.paystack.PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (hash !== signature) {
        throw new AppError({ message: "Invalid webhook signature", statusCode: 400 });
      }

      const { event, data } = payload;

      if (event === 'charge.success') {
        const payment = await FreelancerPaymentRepository.findByReference(data.reference);
        
        if (payment) {
          await FreelancerPaymentRepository.updateById(payment._id, {
            status: 'success',
            completedAt: new Date(),
            paystackData: {
              ...payment.paystackData,
              gateway_response: data.gateway_response,
              channel: data.channel,
              card_type: data.authorization?.card_type,
              bank: data.authorization?.bank,
              fees: data.fees,
              transaction_date: data.transaction_date
            },
            webhookReceived: true
          });
        }
      } else if (event === 'charge.failed') {
        const payment = await FreelancerPaymentRepository.findByReference(data.reference);
        
        if (payment) {
          await FreelancerPaymentRepository.markAsFailed(
            payment._id,
            data.gateway_response || 'Payment failed'
          );
        }
      }

      return { success: true };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError({ 
        message: `Webhook processing failed: ${error.message}`, 
        statusCode: 500 
      });
    }
  }

  static async getPaymentDetails(paymentId) {
    try {
      const payment = await FreelancerPaymentRepository.findById(paymentId);
      
      if (!payment) {
        throw new AppError({ message: "Payment not found", statusCode: 404 });
      }

      return payment;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError({ 
        message: `Failed to get payment details: ${error.message}`, 
        statusCode: 500 
      });
    }
  }

  static async getFreelancerPayments(freelancerId, options = {}) {
    try {
      const { page = 1, limit = 10, status } = options;
      const skip = (page - 1) * limit;

      const payments = await FreelancerPaymentRepository.getFreelancerPayments(
        freelancerId, 
        status, 
        { skip, limit }
      );

      const total = await FreelancerPaymentRepository.countDocuments({ 
        freelancerId,
        ...(status && { status })
      });

      return {
        payments,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      throw new AppError({ 
        message: `Failed to get freelancer payments: ${error.message}`, 
        statusCode: 500 
      });
    }
  }

  static async getProjectPayments(projectId, options = {}) {
    try {
      const { page = 1, limit = 10, status } = options;
      const skip = (page - 1) * limit;

      const payments = await FreelancerPaymentRepository.getProjectPayments(
        projectId, 
        status, 
        { skip, limit }
      );

      const total = await FreelancerPaymentRepository.countDocuments({ 
        projectId,
        ...(status && { status })
      });

      return {
        payments,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      throw new AppError({ 
        message: `Failed to get project payments: ${error.message}`, 
        statusCode: 500 
      });
    }
  }

  static async getAllPayments(options = {}) {
    try {
      const { page = 1, limit = 10, status, search } = options;
      const skip = (page - 1) * limit;

      let payments;
      let total;

      if (search) {
        payments = await FreelancerPaymentRepository.searchPayments(search, { skip, limit });
        total = await FreelancerPaymentRepository.countDocuments({
          $or: [
            { paymentReference: new RegExp(search, 'i') },
            { paystackReference: new RegExp(search, 'i') },
            { customerEmail: new RegExp(search, 'i') },
            { customerName: new RegExp(search, 'i') }
          ]
        });
      } else {
        const query = status ? { status } : {};
        payments = await FreelancerPaymentRepository.findWithPagination(query, { skip, limit });
        total = await FreelancerPaymentRepository.countDocuments(query);
      }

      return {
        payments,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      throw new AppError({ 
        message: `Failed to get payments: ${error.message}`, 
        statusCode: 500 
      });
    }
  }

  static async getPaymentStats(filters = {}) {
    try {
      const { freelancerId, projectId, startDate, endDate } = filters;
      
      if (freelancerId) {
        return await FreelancerPaymentRepository.getFreelancerPaymentStats(freelancerId);
      }
      
      if (projectId) {
        return await FreelancerPaymentRepository.getProjectPaymentStats(projectId);
      }

      if (startDate && endDate) {
        return await FreelancerPaymentRepository.getDailyPaymentStats(startDate, endDate);
      }

      throw new AppError({ 
        message: "Please provide valid filters for payment stats", 
        statusCode: 400 
      });

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError({ 
        message: `Failed to get payment stats: ${error.message}`, 
        statusCode: 500 
      });
    }
  }

  static async cancelPayment(paymentId, reason = 'Payment cancelled by user') {
    try {
      const payment = await FreelancerPaymentRepository.findById(paymentId);
      
      if (!payment) {
        throw new AppError({ message: "Payment not found", statusCode: 404 });
      }

      if (payment.status === 'success') {
        throw new AppError({ 
          message: "Cannot cancel a successful payment", 
          statusCode: 400 
        });
      }

      const updatedPayment = await FreelancerPaymentRepository.updateById(paymentId, {
        status: 'cancelled',
        failureReason: reason,
        failedAt: new Date()
      });

      return updatedPayment;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError({ 
        message: `Failed to cancel payment: ${error.message}`, 
        statusCode: 500 
      });
    }
  }
}

module.exports = PaystackPaymentService;