const PartnersInvoice = require('../models/partners-invoice-model');

class PartnerInvoiceRepository {
    static async createInvoice(data) {
        const invoice = new PartnersInvoice(data);
        return await invoice.save();
    }
    static async getInvoiceById(id) {
        return await PartnersInvoice.findById(id);
    }
    static async getAllInvoices() {
        return await PartnersInvoice.find();
    }
    static async updateInvoice(id, data) {
        return await PartnersInvoice.findByIdAndUpdate(id, data, { new: true });
    }
    static async deleteInvoice(id) {
        return await PartnersInvoice.findByIdAndDelete(id);
    }
    static async deleteAllInvoices() {
        return await PartnersInvoice.deleteMany();
    }
    static async getAllInvoicesWithPagination(paginationOptions = {}) {
        const { page = 1, limit = 10, search = '' } = paginationOptions;
        const skip = (page - 1) * limit;
        const totalCount = await this.countDocuments();
        const invoices = await PartnersInvoice.find().skip(skip).limit(limit);
        return { invoices, pagination: { page, limit, totalCount } };
    }
    static async countDocuments() {
        return await PartnersInvoice.countDocuments();
    }
}

module.exports = PartnerInvoiceRepository;