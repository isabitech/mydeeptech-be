import Invoice from '../models/invoice.model.js';

class InvoiceRepository {
    async findByUserId(userId) {
        return await Invoice.find({ dtUserId: userId }).sort({ createdAt: -1 }).exec();
    }

    async findById(id) {
        return await Invoice.findById(id).exec();
    }

    async findByIdWithPopulate(id, populatePaths = []) {
        let query = Invoice.findById(id);
        populatePaths.forEach(path => {
            query = query.populate(path);
        });
        return await query.exec();
    }

    async find(filter = {}, sort = { createdAt: -1 }, skip = 0, limit = 0, populatePaths = []) {
        let query = Invoice.find(filter).sort(sort);
        if (skip > 0) query = query.skip(skip);
        if (limit > 0) query = query.limit(limit);
        populatePaths.forEach(path => {
            query = query.populate(path);
        });
        return await query.exec();
    }

    async count(filter = {}) {
        return await Invoice.countDocuments(filter).exec();
    }

    async create(data) {
        const invoice = new Invoice(data);
        return await invoice.save();
    }

    async update(id, data) {
        return await Invoice.findByIdAndUpdate(id, data, { new: true }).exec();
    }

    async delete(id) {
        return await Invoice.findByIdAndDelete(id).exec();
    }

    async aggregate(pipeline) {
        return await Invoice.aggregate(pipeline).exec();
    }

    async getInvoiceStats(userId = null) {
        return await Invoice.getInvoiceStats(userId);
    }
}

export default new InvoiceRepository();
