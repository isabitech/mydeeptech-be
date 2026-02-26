const PartnerInvoiceService = require('../services/partner-invoice.service');
const ResponseClass = require('../utils/response-handler');

class PartnerInvoiceController {
    static async createInvoice(req, res, next) {
        try {
            const { name, amount, duration, email, due_date, description } = req.body;
            const invoicePayload = {
                ...(name && { name }),
                ...(amount && { amount }),
                ...(duration && { duration }),
                ...(due_date && { due_date }),
                ...(description && { description }),
                ...(email && { email }),
            }
            const invoice = await PartnerInvoiceService.createInvoice(invoicePayload);
            return ResponseClass.Success(res, { message: "Invoice created successfully", data: invoice });
        } catch (err) {
            next(err);
        }
    }
    static async fetchAllInvoices(req, res, next) {
        try {
            const invoices = await PartnerInvoiceService.fetchAllInvoices();
            return ResponseClass.Success(res, { message: "Invoices retrieved successfully", data: invoices });
        } catch (err) {
            next(err);
        }
    }
    static async fetchInvoiceById(req, res, next) {
        try {
            const id = req.params.id;
            const invoice = await PartnerInvoiceService.fetchInvoiceById(id);
            return ResponseClass.Success(res, { message: "Invoice retrieved successfully", data: invoice });
        } catch (err) {
            next(err);
        }
    }
    static async updateInvoice(req, res, next) {
        try {
            const id = req.params.id;
            const { name, amount, duration, email, due_date, description } = req.body;
            const invoicePayload = {
                ...(name && { name }),
                ...(duration && { duration }),
                ...(due_date && { due_date }),
                ...(amount && { amount }),
                ...(description && { description }),
                ...(email && { email }),
            }
            const invoice = await PartnerInvoiceService.updateInvoice(id, invoicePayload);
            return ResponseClass.Success(res, { message: "Invoice updated successfully", data: invoice });
        } catch (err) {
            next(err);
        }
    }
    static async deleteInvoice(req, res, next) {
        try {
            const id = req.params.id;
            await PartnerInvoiceService.deleteInvoice(id);
            return ResponseClass.Success(res, { message: "Invoice deleted successfully" });
        } catch (err) {
            next(err);
        }
    }
    static async deleteAllInvoices(req, res, next) {
        try {
            await PartnerInvoiceService.deleteAllInvoices();
            return ResponseClass.Success(res, { message: "All invoices deleted successfully" });
        } catch (err) {
            next(err);
        }
    }
    static async fetchAllInvoicesWithPagination(req, res, next) {
        try {
            const { page = 1, limit = 10, search = '' } = req.query;
            const invoices = await PartnerInvoiceService.fetchAllInvoicesWithPagination({ page, limit, search });
            return ResponseClass.Success(res, { message: "Invoices retrieved successfully", data: invoices });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = PartnerInvoiceController;