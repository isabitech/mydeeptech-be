const Invoice = require('../models/invoice.model');
const DTUser = require('../models/dtUser.model');
const AnnotationProject = require('../models/annotationProject.model');
const { sendInvoiceNotification, sendPaymentConfirmation, sendPaymentReminder } = require('../utils/paymentMailer');
const { convertUSDToNGN } = require('../utils/exchangeRateService');
const { getBankCode, validatePaymentInfo } = require('../utils/bankCodeMapping');
const Joi = require('joi');
const mongoose = require('mongoose');

// Validation schema for creating invoices
const createInvoiceSchema = Joi.object({
  projectId: Joi.string().required(),
  dtUserId: Joi.string().required(),
  invoiceAmount: Joi.number().min(0.01).required(),
  currency: Joi.string().valid("USD", "EUR", "GBP", "NGN", "KES", "GHS").default("USD"),
  invoiceDate: Joi.date().default(Date.now),
  dueDate: Joi.date().greater('now').required(),
  workPeriodStart: Joi.date().optional(),
  workPeriodEnd: Joi.date().optional(),
  description: Joi.string().trim().max(1000).optional(),
  workDescription: Joi.string().trim().max(2000).optional(),
  hoursWorked: Joi.number().min(0).optional(),
  tasksCompleted: Joi.number().min(0).optional(),
  qualityScore: Joi.number().min(0).max(100).optional(),
  invoiceType: Joi.string().valid("project_completion", "milestone", "hourly", "fixed_rate", "bonus").default("project_completion"),
  adminNotes: Joi.string().trim().max(1000).optional()
});

// Admin function: Create invoice for DTUser
const createInvoice = async (req, res) => {
  try {
    console.log(`💰 Admin ${req.admin.email} creating invoice`);

    // Validate request body
    const { error, value } = createInvoiceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map(detail => detail.message)
      });
    }

    const { projectId, dtUserId, invoiceAmount, dueDate } = value;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(dtUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID or user ID"
      });
    }

    // Verify project exists and admin has access
    const project = await AnnotationProject.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    // Verify DTUser exists and is approved
    const dtUser = await DTUser.findById(dtUserId);
    if (!dtUser) {
      return res.status(404).json({
        success: false,
        message: "DTUser not found"
      });
    }

    if (dtUser.annotatorStatus !== 'approved') {
      return res.status(400).json({
        success: false,
        message: "Can only create invoices for approved annotators"
      });
    }

    // Check if user worked on this project
    const userWorkedOnProject = await require('../models/projectApplication.model').findOne({
      projectId: projectId,
      applicantId: dtUserId,
      status: 'approved'
    });

    if (!userWorkedOnProject) {
      return res.status(400).json({
        success: false,
        message: "User has not worked on this project or application not approved"
      });
    }

    // Create invoice
    const invoiceData = {
      ...value,
      createdBy: req.admin.userId,
      status: 'sent' // Automatically mark as sent since we'll email it
    };

    const invoice = new Invoice(invoiceData);
    await invoice.save();

    // Populate invoice data for response and email
    await invoice.populate([
      { path: 'projectId', select: 'projectName projectDescription' },
      { path: 'dtUserId', select: 'fullName email' },
      { path: 'createdBy', select: 'fullName email' }
    ]);

    // Send email notification to DTUser
    let emailSent = false;
    try {
      await sendInvoiceNotification(
        dtUser.email,
        dtUser.fullName,
        {
          invoiceNumber: invoice.invoiceNumber,
          projectName: project.projectName,
          amount: invoice.invoiceAmount,
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          description: invoice.description
        }
      );
      
      // Update invoice to mark email as sent
      invoice.emailSent = true;
      invoice.emailSentAt = new Date();
      await invoice.save();
      emailSent = true;
      
    } catch (emailError) {
      console.error('Email notification error:', emailError);
    }

    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: {
        invoice: {
          _id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          formattedInvoiceNumber: invoice.formattedInvoiceNumber,
          project: invoice.projectId,
          dtUser: invoice.dtUserId,
          createdBy: invoice.createdBy,
          invoiceAmount: invoice.invoiceAmount,
          currency: invoice.currency,
          invoiceDate: invoice.invoiceDate,
          dueDate: invoice.dueDate,
          paymentStatus: invoice.paymentStatus,
          status: invoice.status,
          description: invoice.description,
          workDescription: invoice.workDescription,
          hoursWorked: invoice.hoursWorked,
          tasksCompleted: invoice.tasksCompleted,
          qualityScore: invoice.qualityScore,
          invoiceType: invoice.invoiceType,
          adminNotes: invoice.adminNotes,
          emailSent: invoice.emailSent,
          createdAt: invoice.createdAt
        },
        emailNotificationSent: emailSent
      }
    });

  } catch (error) {
    console.error("❌ Error creating invoice:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating invoice",
      error: error.message
    });
  }
};

// Admin function: Get all invoices with filtering and pagination
const getAllInvoices = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      paymentStatus, 
      projectId, 
      dtUserId,
      startDate,
      endDate,
      invoiceType
    } = req.query;

    // Build filter object
    const filter = {};
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (projectId) filter.projectId = projectId;
    if (dtUserId) filter.dtUserId = dtUserId;
    if (invoiceType) filter.invoiceType = invoiceType;

    // Date range filter
    if (startDate || endDate) {
      filter.invoiceDate = {};
      if (startDate) filter.invoiceDate.$gte = new Date(startDate);
      if (endDate) filter.invoiceDate.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get invoices with populated data
    const invoices = await Invoice.find(filter)
      .populate('projectId', 'projectName projectCategory')
      .populate('dtUserId', 'fullName email phone payment_info')
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalInvoices = await Invoice.countDocuments(filter);

    // Get summary statistics
    const summary = await Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$invoiceAmount' },
          paidAmount: { 
            $sum: { 
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$invoiceAmount', 0] 
            } 
          },
          unpaidAmount: { 
            $sum: { 
              $cond: [{ $ne: ['$paymentStatus', 'paid'] }, '$invoiceAmount', 0] 
            } 
          },
          totalInvoices: { $sum: 1 },
          paidInvoices: {
            $sum: { 
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] 
            }
          },
          unpaidInvoices: {
            $sum: { 
              $cond: [{ $ne: ['$paymentStatus', 'paid'] }, 1, 0] 
            }
          },
          overdueInvoices: {
            $sum: { 
              $cond: [{ $eq: ['$paymentStatus', 'overdue'] }, 1, 0] 
            }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        invoices,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalInvoices / limit),
          totalInvoices,
          invoicesPerPage: parseInt(limit)
        },
        summary: summary[0] || {
          totalAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          totalInvoices: 0,
          paidInvoices: 0,
          unpaidInvoices: 0,
          overdueInvoices: 0
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching invoices:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching invoices",
      error: error.message
    });
  }
};

// Admin function: Get specific invoice details
const getInvoiceDetails = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID"
      });
    }

    const invoice = await Invoice.findById(invoiceId)
      .populate('projectId', 'projectName projectDescription projectCategory')
      .populate('dtUserId', 'fullName email phone payment_info')
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        invoice,
        computedFields: {
          daysOverdue: invoice.daysOverdue,
          amountDue: invoice.amountDue,
          formattedInvoiceNumber: invoice.formattedInvoiceNumber
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching invoice details:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching invoice details",
      error: error.message
    });
  }
};

// Admin function: Update invoice payment status
const updatePaymentStatus = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { paymentStatus, paymentMethod, paymentReference, paymentNotes, paidAmount } = req.body;

    const validStatuses = ["unpaid", "paid", "overdue", "cancelled", "disputed"];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status"
      });
    }

    const invoice = await Invoice.findById(invoiceId)
      .populate('dtUserId', 'fullName email payment_info')
      .populate('projectId', 'projectName');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found"
      });
    }

    // Update payment details
    const updateData = { paymentStatus };
    
    if (paymentStatus === 'paid') {
      updateData.paidAt = new Date();
      updateData.paidAmount = paidAmount || invoice.invoiceAmount;
      updateData.status = 'paid';
      
      if (paymentMethod) updateData.paymentMethod = paymentMethod;
      if (paymentReference) updateData.paymentReference = paymentReference;
      if (paymentNotes) updateData.paymentNotes = paymentNotes;
    }

    Object.assign(invoice, updateData);
    await invoice.save();

    // Send payment confirmation email if marked as paid
    let emailSent = false;
    if (paymentStatus === 'paid') {
      try {
        await sendPaymentConfirmation(
          invoice.dtUserId.email,
          invoice.dtUserId.fullName,
          {
            invoiceNumber: invoice.invoiceNumber,
            projectName: invoice.projectId.projectName,
            amount: invoice.invoiceAmount,
            currency: invoice.currency,
            paidAt: invoice.paidAt
          },
          {
            paymentMethod: invoice.paymentMethod,
            paymentReference: invoice.paymentReference
          }
        );
        emailSent = true;
      } catch (emailError) {
        console.error('Payment confirmation email error:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: `Invoice payment status updated to ${paymentStatus}`,
      data: {
        invoice,
        emailNotificationSent: emailSent
      }
    });

  } catch (error) {
    console.error("❌ Error updating payment status:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating payment status",
      error: error.message
    });
  }
};

// Admin function: Send payment reminder
const sendInvoiceReminder = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findById(invoiceId)
      .populate('dtUserId', 'fullName email')
      .populate('projectId', 'projectName');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found"
      });
    }

    if (invoice.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: "Cannot send reminder for paid invoice"
      });
    }

    try {
      await sendPaymentReminder(
        invoice.dtUserId.email,
        invoice.dtUserId.fullName,
        {
          invoiceNumber: invoice.invoiceNumber,
          projectName: invoice.projectId.projectName,
          amount: invoice.invoiceAmount,
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          daysOverdue: invoice.daysOverdue
        }
      );

      // Update last reminder date
      invoice.lastEmailReminder = new Date();
      await invoice.save();

      res.status(200).json({
        success: true,
        message: "Payment reminder sent successfully",
        data: {
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          sentTo: invoice.dtUserId.email,
          sentAt: invoice.lastEmailReminder
        }
      });

    } catch (emailError) {
      res.status(500).json({
        success: false,
        message: "Failed to send payment reminder",
        error: emailError.message
      });
    }

  } catch (error) {
    console.error("❌ Error sending payment reminder:", error);
    res.status(500).json({
      success: false,
      message: "Server error sending payment reminder",
      error: error.message
    });
  }
};

// Admin function: Delete invoice (only if unpaid and recently created)
const deleteInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found"
      });
    }

    // Only allow deletion of unpaid invoices created within last 24 hours
    const hoursAgo = (new Date() - invoice.createdAt) / (1000 * 60 * 60);
    if (invoice.paymentStatus !== 'unpaid' || hoursAgo > 24) {
      return res.status(400).json({
        success: false,
        message: "Can only delete unpaid invoices created within the last 24 hours"
      });
    }

    await Invoice.findByIdAndDelete(invoiceId);

    res.status(200).json({
      success: true,
      message: "Invoice deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error deleting invoice:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting invoice",
      error: error.message
    });
  }
};

// Admin function: Bulk authorize payment for all unpaid invoices
const bulkAuthorizePayment = async (req, res) => {
  try {
    console.log(`💰 Admin ${req.admin.email} initiating bulk payment authorization`);

    // Get all unpaid invoices
    const unpaidInvoices = await Invoice.find({ 
      paymentStatus: { $in: ['unpaid', 'overdue'] }
    }).populate([
      { path: 'dtUserId', select: 'fullName email' },
      { path: 'projectId', select: 'projectName' }
    ]);

    if (unpaidInvoices.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No unpaid invoices found",
        data: {
          processedInvoices: 0,
          totalAmount: 0,
          emailsSent: 0,
          errors: []
        }
      });
    }

    console.log(`📊 Found ${unpaidInvoices.length} unpaid invoices to process`);

    const results = {
      processedInvoices: 0,
      totalAmount: 0,
      emailsSent: 0,
      errors: []
    };

    // Process each invoice
    for (const invoice of unpaidInvoices) {
      try {
        // Mark as paid
        await invoice.markAsPaid({
          paymentMethod: 'bulk_transfer',
          paymentReference: `BULK-${new Date().getTime()}`,
          paymentNotes: `Bulk payment authorization by ${req.admin.email}`
        });

        results.processedInvoices++;
        results.totalAmount += invoice.invoiceAmount;

        // Send payment confirmation email
        try {
          await sendPaymentConfirmation(
            invoice.dtUserId.email,
            invoice.dtUserId.fullName,
            {
              invoiceNumber: invoice.invoiceNumber,
              projectName: invoice.projectId.projectName,
              amount: invoice.invoiceAmount,
              currency: invoice.currency || 'USD',
              paidAt: new Date()
            }
          );
          results.emailsSent++;
        } catch (emailError) {
          console.error(`❌ Failed to send payment email for invoice ${invoice.invoiceNumber}:`, emailError);
          results.errors.push({
            invoiceNumber: invoice.invoiceNumber,
            error: 'Email sending failed',
            details: emailError.message
          });
        }

      } catch (invoiceError) {
        console.error(`❌ Failed to process invoice ${invoice.invoiceNumber}:`, invoiceError);
        results.errors.push({
          invoiceNumber: invoice.invoiceNumber,
          error: 'Payment processing failed',
          details: invoiceError.message
        });
      }
    }

    console.log(`✅ Bulk payment authorization completed. Processed: ${results.processedInvoices}, Emails sent: ${results.emailsSent}`);

    res.status(200).json({
      success: true,
      message: "Bulk payment authorization completed",
      data: results
    });

  } catch (error) {
    console.error("❌ Error in bulk payment authorization:", error);
    res.status(500).json({
      success: false,
      message: "Server error during bulk payment authorization",
      error: error.message
    });
  }
};

// Admin function: Generate Paystack CSV for Nigerian freelancers
const generatePaystackCSV = async (req, res) => {
  try {
    console.log(`📊 Admin ${req.admin.email} generating Paystack CSV`);

    // Get unpaid invoices for Nigerian users
    const unpaidInvoices = await Invoice.find({ 
      paymentStatus: { $in: ['unpaid', 'overdue'] }
    }).populate([
      { path: 'dtUserId', select: 'fullName email personal_info payment_info' },
      { path: 'projectId', select: 'projectName' }
    ]);

    if (unpaidInvoices.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No unpaid invoices found",
        data: {
          csvData: '',
          totalInvoices: 0,
          nigerianFreelancers: 0,
          totalAmount: 0,
          errors: []
        }
      });
    }

    // Test exchange rate API first to fail fast
    let exchangeRateError = null;
    try {
      await convertUSDToNGN(1); // Test conversion with $1
      console.log('✅ Exchange rate API is working');
    } catch (rateError) {
      exchangeRateError = rateError.message;
      console.error('❌ Exchange rate API failed:', exchangeRateError);
      
      return res.status(503).json({
        success: false,
        message: "Cannot generate CSV due to exchange rate service failure",
        error: "Exchange rate service unavailable",
        details: {
          exchangeRateError,
          totalInvoices: unpaidInvoices.length,
          message: "Please try again later or contact support if the issue persists"
        }
      });
    }

    const csvRows = [];
    const results = {
      totalInvoices: unpaidInvoices.length,
      nigerianFreelancers: 0,
      totalAmountUSD: 0,
      totalAmountNGN: 0,
      errors: []
    };

    // CSV Header
    csvRows.push([
      'Transfer Amount',
      'Transfer Note (Optional)',
      'Transfer Reference (Optional)',
      'Recipient Code (This overrides all other details if available)',
      'Bank Code or Slug',
      'Account Number',
      'Account Name (Optional)',
      'Email Address (Optional)'
    ]);

    // Process each invoice
    for (const invoice of unpaidInvoices) {
      try {
        const user = invoice.dtUserId;
        
        // Check if user is Nigerian (by country in personal_info)
        const isNigerian = user.personal_info?.country?.toLowerCase() === 'nigeria' ||
                          user.personal_info?.country?.toLowerCase() === 'ng';

        if (!isNigerian) {
          continue; // Skip non-Nigerian users
        }

        // Validate payment info
        const validation = validatePaymentInfo(user.payment_info);
        if (!validation.isValid) {
          results.errors.push({
            userId: user._id,
            userEmail: user.email,
            invoiceNumber: invoice.invoiceNumber,
            error: 'Invalid payment info',
            details: validation.errors.join(', ')
          });
          continue;
        }

        // Convert USD to NGN
        const amountNGN = await convertUSDToNGN(invoice.invoiceAmount);
        
        // Get bank code (try from user's bank_code field first, then map from bank_name)
        const bankCode = user.payment_info.bank_code || getBankCode(user.payment_info.bank_name);
        
        if (!bankCode) {
          results.errors.push({
            userId: user._id,
            userEmail: user.email,
            invoiceNumber: invoice.invoiceNumber,
            error: 'Bank code not found',
            details: `Unable to map bank: ${user.payment_info.bank_name}`
          });
          continue;
        }

        // Add CSV row
        csvRows.push([
          amountNGN.toFixed(2),
          `${invoice.description || 'Project completion payment'} for ${user.fullName}`,
          invoice.invoiceNumber,
          '', // Leave recipient code empty
          bankCode,
          user.payment_info.account_number,
          user.payment_info.account_name,
          user.email
        ]);

        results.nigerianFreelancers++;
        results.totalAmountUSD += invoice.invoiceAmount;
        results.totalAmountNGN += amountNGN;

      } catch (invoiceError) {
        console.error(`❌ Failed to process invoice ${invoice.invoiceNumber}:`, invoiceError);
        results.errors.push({
          invoiceNumber: invoice.invoiceNumber,
          error: 'Processing failed',
          details: invoiceError.message
        });
      }
    }

    // Convert rows to CSV string
    const csvContent = csvRows.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    console.log(`✅ Generated Paystack CSV for ${results.nigerianFreelancers} Nigerian freelancers`);
    console.log(`💰 Total: $${results.totalAmountUSD.toFixed(2)} USD / ₦${results.totalAmountNGN.toFixed(2)} NGN`);

    // Set CSV download headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="paystack-bulk-transfer-${new Date().toISOString().split('T')[0]}.csv"`);

    res.status(200).json({
      success: true,
      message: "Paystack CSV generated successfully",
      data: {
        csvContent,
        summary: results
      }
    });

  } catch (error) {
    console.error("❌ Error generating Paystack CSV:", error);
    res.status(500).json({
      success: false,
      message: "Server error generating CSV",
      error: error.message
    });
  }
};

module.exports = {
  createInvoice,
  getAllInvoices,
  getInvoiceDetails,
  updatePaymentStatus,
  sendInvoiceReminder,
  deleteInvoice,
  bulkAuthorizePayment,
  generatePaystackCSV
};