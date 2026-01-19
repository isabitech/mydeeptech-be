import invoiceService from '../services/invoice.service.js';
import { ResponseHandler, ValidationError } from '../utils/responseHandler.js';
import Joi from 'joi';

/**
 * Controller handling all invoicing and payment-related API endpoints.
 * Provides administrative tools for payroll management and user vistas of their earnings.
 */
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
    const { error, value } = InvoiceController.createInvoiceSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);
    const adminId = req.admin?.userId || req.user?.userId;
    const invoice = await invoiceService.createInvoice(value, adminId);
    ResponseHandler.success(res, { invoice, emailNotificationSent: invoice.emailSent }, "Invoice created successfully", 201);
  }

  /**
   * Admin function: Get all invoices with filtering and pagination
   * GET /api/admin/invoices
   */
  async getAllInvoices(req, res) {
    const data = await invoiceService.getAllInvoices(req.query);
    ResponseHandler.success(res, data, "Invoices retrieved successfully");
  }

  /**
   * Admin function: Get specific invoice details
   * GET /api/admin/invoices/:invoiceId
   */
  async getInvoiceDetails(req, res) {
    const invoice = await invoiceService.getInvoiceDetails(req.params.invoiceId, null, true);
    ResponseHandler.success(res, {
      invoice,
      computedFields: {
        daysOverdue: invoice.daysOverdue,
        amountDue: invoice.amountDue,
        formattedInvoiceNumber: invoice.formattedInvoiceNumber
      }
    }, "Invoice details retrieved successfully");
  }

  /**
   * Admin function: Update invoice payment status
   * PATCH /api/admin/invoices/:invoiceId/status
   */
  async updatePaymentStatus(req, res) {
    const data = await invoiceService.updatePaymentStatus(req.params.invoiceId, req.body);
    ResponseHandler.success(res, data, `Invoice payment status updated to ${req.body.paymentStatus}`);
  }

  /**
   * Admin function: Send payment reminder
   * POST /api/admin/invoices/:invoiceId/reminder
   */
  async sendInvoiceReminder(req, res) {
    const data = await invoiceService.sendInvoiceReminder(req.params.invoiceId);
    ResponseHandler.success(res, data, "Payment reminder sent successfully");
  }

  /**
   * Admin function: Delete invoice
   * DELETE /api/admin/invoices/:invoiceId
   */
  async deleteInvoice(req, res) {
    await invoiceService.deleteInvoice(req.params.invoiceId);
    ResponseHandler.success(res, null, "Invoice deleted successfully");
  }

  /**
   * Admin function: Bulk authorize payment for all unpaid invoices
   * POST /api/admin/invoices/bulk-authorize
   */
  async bulkAuthorizePayment(req, res) {
    const adminEmail = req.admin?.email || req.user?.email;
    const data = await invoiceService.bulkAuthorizePayment(adminEmail);
    ResponseHandler.success(res, data, "Bulk payment authorization completed");
  }

  /**
   * Admin function: Generate Paystack CSV for selected invoices
   * GET /api/admin/invoices/export/paystack
   */
  /**
   * Generates a Paystack-compatible CSV for bulk payouts in Nigerian Naira.
   */
  async generatePaystackCSV(req, res) {
    const { invoiceIds } = req.query;
    const ids = Array.isArray(invoiceIds) ? invoiceIds : (invoiceIds ? [invoiceIds] : []);

    const data = await invoiceService.generatePaystackCSV(ids);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="paystack-bulk-transfer-${new Date().toISOString().split('T')[0]}.csv"`);

    res.status(200).send(data.csvContent);
  }

  /**
   * Admin function: Generate MPESA CSV for selected invoices
   * GET /api/admin/invoices/export/mpesa
   */
  async generateMPESACSV(req, res) {
    const { invoiceIds } = req.query;
    const ids = Array.isArray(invoiceIds) ? invoiceIds : (invoiceIds ? [invoiceIds] : []);

    const data = await invoiceService.generateMPESACSV(ids);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="mpesa-bulk-transfer-${new Date().toISOString().split('T')[0]}.csv"`);

    res.status(200).send(data.csvContent);
  }
}

export default new InvoiceController();