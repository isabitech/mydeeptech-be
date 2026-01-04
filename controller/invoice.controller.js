import invoiceService from '../services/invoice.service.js';
import { ResponseHandler } from '../utils/responseHandler.js';
import Joi from 'joi';

class InvoiceController {
  // Validation schema for creating invoices
  static createInvoiceSchema = Joi.object({
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

  /**
   * Admin function: Create invoice for DTUser
   * POST /api/admin/invoices
   */
  async createInvoice(req, res) {
    try {
      const { error, value } = InvoiceController.createInvoiceSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, { statusCode: 400, message: error.details[0].message });

      const adminId = req.admin?.userId || req.user?.userId;
      const invoice = await invoiceService.createInvoice(value, adminId);
      return ResponseHandler.success(res, { invoice, emailNotificationSent: invoice.emailSent }, "Invoice created successfully", 201);
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Admin function: Get all invoices with filtering and pagination
   * GET /api/admin/invoices
   */
  async getAllInvoices(req, res) {
    try {
      const data = await invoiceService.getAllInvoices(req.query);
      return ResponseHandler.success(res, data, "Invoices retrieved successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Admin function: Get specific invoice details
   * GET /api/admin/invoices/:invoiceId
   */
  async getInvoiceDetails(req, res) {
    try {
      const invoice = await invoiceService.getInvoiceDetails(req.params.invoiceId, null, true);
      return ResponseHandler.success(res, {
        invoice,
        computedFields: {
          daysOverdue: invoice.daysOverdue,
          amountDue: invoice.amountDue,
          formattedInvoiceNumber: invoice.formattedInvoiceNumber
        }
      }, "Invoice details retrieved successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Admin function: Update invoice payment status
   * PATCH /api/admin/invoices/:invoiceId/status
   */
  async updatePaymentStatus(req, res) {
    try {
      const data = await invoiceService.updatePaymentStatus(req.params.invoiceId, req.body);
      return ResponseHandler.success(res, data, `Invoice payment status updated to ${req.body.paymentStatus}`);
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Admin function: Send payment reminder
   * POST /api/admin/invoices/:invoiceId/reminder
   */
  async sendInvoiceReminder(req, res) {
    try {
      const data = await invoiceService.sendInvoiceReminder(req.params.invoiceId);
      return ResponseHandler.success(res, data, "Payment reminder sent successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Admin function: Delete invoice
   * DELETE /api/admin/invoices/:invoiceId
   */
  async deleteInvoice(req, res) {
    try {
      await invoiceService.deleteInvoice(req.params.invoiceId);
      return ResponseHandler.success(res, null, "Invoice deleted successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Admin function: Bulk authorize payment for all unpaid invoices
   * POST /api/admin/invoices/bulk-authorize
   */
  async bulkAuthorizePayment(req, res) {
    try {
      const adminEmail = req.admin?.email || req.user?.email;
      const data = await invoiceService.bulkAuthorizePayment(adminEmail);
      return ResponseHandler.success(res, data, "Bulk payment authorization completed");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Admin function: Generate Paystack CSV for selected invoices
   * GET /api/admin/invoices/export/paystack
   */
  async generatePaystackCSV(req, res) {
    try {
      const { invoiceIds } = req.query;
      const ids = Array.isArray(invoiceIds) ? invoiceIds : (invoiceIds ? [invoiceIds] : []);

      const data = await invoiceService.generatePaystackCSV(ids);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="paystack-bulk-transfer-${new Date().toISOString().split('T')[0]}.csv"`);

      return res.status(200).send(data.csvContent);
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Admin function: Generate MPESA CSV for selected invoices
   * GET /api/admin/invoices/export/mpesa
   */
  async generateMPESACSV(req, res) {
    try {
      const { invoiceIds } = req.query;
      const ids = Array.isArray(invoiceIds) ? invoiceIds : (invoiceIds ? [invoiceIds] : []);

      const data = await invoiceService.generateMPESACSV(ids);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="mpesa-bulk-transfer-${new Date().toISOString().split('T')[0]}.csv"`);

      return res.status(200).send(data.csvContent);
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }
}

export default new InvoiceController();