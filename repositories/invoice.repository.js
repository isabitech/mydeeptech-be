const Invoice = require('../models/invoice.model');

class InvoiceRepository {
    async create(invoiceData) {
        const invoice = new Invoice(invoiceData);
        return await invoice.save();
    }

    async findById(invoiceId) {
        return await Invoice.findById(invoiceId)
            .populate('projectId', 'projectName projectDescription projectCategory')
            .populate('dtUserId', 'fullName email phone payment_info personal_info')
            .populate('createdBy', 'fullName email')
            .populate('approvedBy', 'fullName email');
    }

    async find(filter = {}) {
        return await Invoice.find(filter)
            .populate('dtUserId', 'fullName email personal_info payment_info')
            .populate('projectId', 'projectName');
    }

    async fetchAll(filter = {}, skip = 0, limit = 20) {
        return await Invoice.find(filter)
            .populate('projectId', 'projectName projectCategory')
            .populate('dtUserId', 'fullName email phone payment_info')
            .populate('createdBy', 'fullName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
    }

    async count(filter = {}) {
        return await Invoice.countDocuments(filter);
    }

    async getSummaryPattern(filter = {}) {
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
        return summary[0] || {
            totalAmount: 0,
            paidAmount: 0,
            unpaidAmount: 0,
            totalInvoices: 0,
            paidInvoices: 0,
            unpaidInvoices: 0,
            overdueInvoices: 0
        };
    }

    async delete(invoiceId) {
        return await Invoice.findByIdAndDelete(invoiceId);
    }
}

module.exports = new InvoiceRepository();
