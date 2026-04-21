const Joi = require("joi");
const mongoose = require("mongoose");
const InvoiceService = require("../services/invoice.service");
const dtUserService = require("../services/dtUser.service.js");

// Validation schema for creating invoices
const createInvoiceSchema = Joi.object({
  projectId: Joi.string().required(),
  dtUserId: Joi.string().required(),
  invoiceAmount: Joi.number().min(0.01).required(),
  currency: Joi.string()
    .valid("USD", "EUR", "GBP", "NGN", "KES", "GHS")
    .default("USD"),
  invoiceDate: Joi.date().default(Date.now),
  dueDate: Joi.date().greater("now").required(),
  workPeriodStart: Joi.date().optional(),
  workPeriodEnd: Joi.date().optional(),
  description: Joi.string().trim().max(1000).optional(),
  workDescription: Joi.string().trim().max(2000).optional(),
  hoursWorked: Joi.number().min(0).optional(),
  tasksCompleted: Joi.number().min(0).optional(),
  qualityScore: Joi.number().min(0).max(100).optional(),
  invoiceType: Joi.string()
    .valid("project_completion", "milestone", "hourly", "fixed_rate", "bonus")
    .default("project_completion"),
  adminNotes: Joi.string().trim().max(1000).optional(),
});

class InvoiceController {
  static async createInvoice(req, res) {
    try {
      const { error, value } = createInvoiceSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.details.map((detail) => detail.message),
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(value.projectId) ||
        !mongoose.Types.ObjectId.isValid(value.dtUserId)
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid project ID or user ID" });
      }

      const { invoice, emailNotificationSent } =
        await InvoiceService.createInvoice(value, req.admin.userId);

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
            createdAt: invoice.createdAt,
          },
          emailNotificationSent,
        },
      });
    } catch (error) {
      if (error.status) {
        return res
          .status(error.status)
          .json({ success: false, message: error.message });
      }
      console.error("❌ Error creating invoice:", error);
      res.status(500).json({
        success: false,
        message: "Server error creating invoice",
        error: error.message,
      });
    }
  }

  static async getAllInvoices(req, res) {
    try {
      const result = await InvoiceService.getAllInvoices(req.query);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error("❌ Error fetching invoices:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching invoices",
        error: error.message,
      });
    }
  }

  static async getInvoiceDetails(req, res) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.invoiceId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid invoice ID" });
      }
      const result = await InvoiceService.getInvoiceDetails(
        req.params.invoiceId,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      if (error.status) {
        return res
          .status(error.status)
          .json({ success: false, message: error.message });
      }
      console.error("❌ Error fetching invoice details:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching invoice details",
        error: error.message,
      });
    }
  }

  static async updatePaymentStatus(req, res) {
    try {
      const validStatuses = [
        "unpaid",
        "payment_initiated",
        "paid",
        "overdue",
        "cancelled",
        "disputed",
      ];
      if (!validStatuses.includes(req.body.paymentStatus)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid payment status" });
      }

      const { invoice, emailNotificationSent } =
        await InvoiceService.updatePaymentStatus(
          req.params.invoiceId,
          req.body,
        );
      res.status(200).json({
        success: true,
        message: `Invoice payment status updated to ${req.body.paymentStatus}`,
        data: { invoice, emailNotificationSent },
      });
    } catch (error) {
      if (error.status) {
        return res
          .status(error.status)
          .json({ success: false, message: error.message });
      }
      console.error("❌ Error updating payment status:", error);
      res.status(500).json({
        success: false,
        message: "Server error updating payment status",
        error: error.message,
      });
    }
  }

  static async sendInvoiceReminder(req, res) {
    try {
      const result = await InvoiceService.sendInvoiceReminder(
        req.params.invoiceId,
      );
      res.status(200).json({
        success: true,
        message: "Payment reminder sent successfully",
        data: result,
      });
    } catch (error) {
      if (error.status) {
        return res
          .status(error.status)
          .json({ success: false, message: error.message, error: error.error });
      }
      console.error("❌ Error sending payment reminder:", error);
      res.status(500).json({
        success: false,
        message: "Server error sending payment reminder",
        error: error.message,
      });
    }
  }

  static async deleteInvoice(req, res) {
    try {
      await InvoiceService.deleteInvoice(req.params.invoiceId);
      res
        .status(200)
        .json({ success: true, message: "Invoice deleted successfully" });
    } catch (error) {
      if (error.status) {
        return res
          .status(error.status)
          .json({ success: false, message: error.message });
      }
      console.error("❌ Error deleting invoice:", error);
      res.status(500).json({
        success: false,
        message: "Server error deleting invoice",
        error: error.message,
      });
    }
  }

  static async bulkAuthorizePayment(req, res) {
    try {
      const data = await InvoiceService.bulkAuthorizePayment(req.admin.email);
      if (data.totalAmount === 0 && data.processedInvoices === 0) {
        return res
          .status(200)
          .json({ success: true, message: "No unpaid invoices found", data });
      }
      res.status(200).json({
        success: true,
        message: "Bulk payment authorization completed",
        data,
      });
    } catch (error) {
      console.error("❌ Error in bulk payment authorization:", error);
      res.status(500).json({
        success: false,
        message: "Server error during bulk payment authorization",
        error: error.message,
      });
    }
  }

  static async generatePaystackCSV(req, res) {
    try {
      const data = await InvoiceService.generatePaystackCSV(
        req.query.invoiceIds,
      );
      if (data.csvContent === "") {
        return res.status(200).json({
          success: true,
          message: "No unpaid invoices found matching criteria",
          data,
        });
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="paystack-bulk-transfer-${new Date().toISOString().split("T")[0]}.csv"`,
      );
      res.status(200).json({
        success: true,
        message: "Paystack CSV generated successfully",
        data,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
          error: error.error,
          details: error.details,
        });
      }
      console.error("❌ Error generating Paystack CSV:", error);
      res.status(500).json({
        success: false,
        message: "Server error generating CSV",
        error: error.message,
      });
    }
  }

  static async generateMPESACSV(req, res) {
    try {
      const data = await InvoiceService.generateMPESACSV(req.query.invoiceIds);
      if (data.csvContent === "") {
        return res.status(200).json({
          success: true,
          message: "No unpaid invoices found matching criteria",
          data,
        });
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="mpesa-bulk-transfer-${new Date().toISOString().split("T")[0]}.csv"`,
      );
      res.status(200).json({
        success: true,
        message: "MPESA CSV generated successfully",
        data,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
          error: error.error,
          details: error.details,
        });
      }
      console.error("❌ Error generating MPESA CSV:", error);
      res.status(500).json({
        success: false,
        message: "Server error generating MPESA CSV",
        error: error.message,
      });
    }
  }

  //  ===== INVOICE MANAGEMENT FUNCTIONS =====

  // DTUser function: Get all invoices for the user
  static async getUserInvoices(req, res) {
    try {
      const result = await dtUserService.getUserInvoices({
        userId: req.user.userId,
        query: req.query,
      });

      res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error("Error fetching user invoices:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching invoices",
        error: error.message,
      });
    }
  }

  // DTUser function: Get unpaid invoices specifically
  static async getUnpaidInvoices(req, res) {
    try {
      const result = await dtUserService.getUnpaidInvoices({
        userId: req.user.userId,
        query: req.query,
      });

      res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error("Error fetching unpaid invoices:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching unpaid invoices",
        error: error.message,
      });
    }
  }

  // DTUser function: Get paid invoices specifically
  static async getPaidInvoices(req, res) {
    try {
      const result = await dtUserService.getPaidInvoices({
        userId: req.user.userId,
        query: req.query,
      });

      res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error("Error fetching paid invoices:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching paid invoices",
        error: error.message,
      });
    }
  }

  // DTUser function: Get specific invoice details
  static async getInvoiceDetails(req, res) {
    try {
      const result = await dtUserService.getInvoiceDetails({
        userId: req.user.userId,
        invoiceId: req.params.invoiceId,
      });

      if (result.status === 400) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid invoice ID" });
      }

      if (result.status === 404) {
        return res.status(404).json({
          success: false,
          message: "Invoice not found or access denied",
        });
      }

      res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error("Error fetching invoice details:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching invoice details",
        error: error.message,
      });
    }
  }

  // DTUser function: Get invoice dashboard summary
  static async getInvoiceDashboard(req, res) {
    try {
      const result = await dtUserService.getInvoiceDashboard(req.user.userId);

      res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error("Error fetching invoice dashboard:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching invoice dashboard",
        error: error.message,
      });
    }
  }
}
module.exports = InvoiceController;
