const PartnerInvoiceRepository = require('../repositories/partner-invoice.repository');
const AppError = require('../utils/app-error');
const PartnerInvoiceMailer = require('../utils/partner-invoice-malier');

class PartnerInvoiceService {
    static async createInvoice(payload) {
        try {
            const { name, amount, duration, email, due_date, description } = payload;
            const invoicePayload = {
                ...(name && { name }),
                ...(amount && { amount }),
                ...(duration && { duration }),
                ...(due_date && { due_date }),
                ...(description && { description }),
                ...(email && { email }),
            }
            const createdInvoice = await PartnerInvoiceRepository.createInvoice(invoicePayload);
            if (!createdInvoice) {
                throw new AppError({ message: "Failed to create partner invoice", statusCode: 500 });
            }
            await PartnerInvoiceMailer.sendInvoiceEmail(createdInvoice);
            return createdInvoice;
        } catch (err) {
            throw new AppError({ message: `Failed to create invoice: ${err.message}`, statusCode: 500 });
        }
    }
    static async fetchAllInvoices() {
        const invoices = await PartnerInvoiceRepository.getAllInvoices();
        return invoices;
    }
    static async fetchAllInvoicesWithPagination(paginationOptions = {}) {
        const { page = 1, limit = 10, search = '' } = paginationOptions;
        paginationOptions.page = parseInt(page, 10);
        paginationOptions.limit = parseInt(limit, 10);
        paginationOptions.search = search.trim();
        const invoices = await PartnerInvoiceRepository.getAllInvoicesWithPagination(paginationOptions);
        return invoices;
    }
    static async fetchInvoiceById(id) {
        if (!id) {
            throw new AppError({ message: "Invoice ID is required", statusCode: 400 });
        }
        const invoice = await PartnerInvoiceRepository.getInvoiceById(id);
        if (!invoice) {
            throw new AppError({ message: "Invoice not found", statusCode: 404 });
        }
        return invoice;
    }
    static async updateInvoice(id, payload) {
        if (!id) {
            throw new AppError({ message: "Invoice ID is required", statusCode: 400 });
        }
        const { name, amount, duration, email, due_date } = payload;
        const invoicePayload = {
            ...(name && { name }),
            ...(amount && { amount }),
            ...(duration && { duration }),
            ...(due_date && { due_date }),
            ...(email && { email }),
        }
        const updatedInvoice = await PartnerInvoiceRepository.updateInvoice(id, invoicePayload);
        if (!updatedInvoice) {
            throw new AppError({ message: "Invoice not found", statusCode: 404 });
        }
        return updatedInvoice;
    }
    static async deleteInvoice(id) {
        if (!id) {
            throw new AppError({ message: "Invoice ID is required", statusCode: 400 });
        }
        const deletedInvoice = await PartnerInvoiceRepository.deleteInvoice(id);
        if (!deletedInvoice) {
            throw new AppError({ message: "Invoice not found", statusCode: 404 });
        }
        return deletedInvoice;
    }
}

module.exports = PartnerInvoiceService;
