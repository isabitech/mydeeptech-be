const PartnersInvoice = require('../models/partner-invoice.model');

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

}

module.exports = PartnerInvoiceRepository;