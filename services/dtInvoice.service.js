import invoiceRepository from '../repositories/invoice.repository.js';
import { NotFoundError } from '../utils/responseHandler.js';
import Invoice from '../models/invoice.model.js';
import mongoose from 'mongoose';

class DTInvoiceService {
    async getUserInvoices(userId, query) {
        const { paymentStatus, projectId, startDate, endDate, page = 1, limit = 10 } = query;
        const skip = (page - 1) * limit;

        const filter = { dtUserId: userId };
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (projectId) filter.projectId = projectId;
        if (startDate || endDate) {
            filter.invoiceDate = {};
            if (startDate) filter.invoiceDate.$gte = new Date(startDate);
            if (endDate) filter.invoiceDate.$lte = new Date(endDate);
        }

        const invoices = await Invoice.find(filter)
            .populate('projectId', 'projectName projectCategory payRate')
            .populate('createdBy', 'fullName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalInvoices = await Invoice.countDocuments(filter);
        const stats = await Invoice.getInvoiceStats(userId);

        return {
            invoices,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalInvoices / limit),
                totalInvoices
            },
            statistics: stats
        };
    }

    async getUnpaidInvoices(userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const filter = { dtUserId: userId, paymentStatus: { $in: ['unpaid', 'overdue'] } };

        const invoices = await Invoice.find(filter)
            .populate('projectId', 'projectName projectCategory')
            .populate('createdBy', 'fullName email')
            .sort({ dueDate: 1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Invoice.countDocuments(filter);

        const summary = await Invoice.aggregate([
            { $match: { dtUserId: new mongoose.Types.ObjectId(userId), paymentStatus: { $in: ['unpaid', 'overdue'] } } },
            { $group: { _id: null, totalDue: { $sum: '$invoiceAmount' }, overdueAmount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'overdue'] }, '$invoiceAmount', 0] } } } }
        ]);

        return {
            invoices,
            pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / limit), totalUnpaid: total },
            summary: summary[0] || { totalDue: 0, overdueAmount: 0 }
        };
    }

    async getPaidInvoices(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const filter = { dtUserId: userId, paymentStatus: 'paid' };

        const invoices = await Invoice.find(filter)
            .populate('projectId', 'projectName projectCategory')
            .populate('createdBy', 'fullName email')
            .sort({ paidAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Invoice.countDocuments(filter);
        const totalEarnings = await Invoice.aggregate([
            { $match: { dtUserId: new mongoose.Types.ObjectId(userId), paymentStatus: 'paid' } },
            { $group: { _id: null, totalEarnings: { $sum: '$invoiceAmount' } } }
        ]);

        return {
            invoices,
            pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / limit), totalPaid: total },
            summary: { totalEarnings: totalEarnings[0]?.totalEarnings || 0, paidCount: total }
        };
    }

    async getInvoiceDetails(invoiceId, userId) {
        const invoice = await Invoice.findOne({ _id: invoiceId, dtUserId: userId })
            .populate('projectId', 'projectName projectDescription projectCategory')
            .populate('createdBy', 'fullName email')
            .populate('approvedBy', 'fullName email');

        if (!invoice) throw new NotFoundError("Invoice not found or access denied");

        if (!invoice.emailViewedAt) {
            invoice.emailViewedAt = new Date();
            await invoice.save();
        }

        return invoice;
    }

    async getInvoiceDashboard(userId) {
        const objectId = new mongoose.Types.ObjectId(userId);
        const stats = await Invoice.getInvoiceStats(objectId);
        const recentInvoices = await Invoice.find({ dtUserId: objectId })
            .populate('projectId', 'projectName')
            .sort({ createdAt: -1 })
            .limit(5);

        const overdueInvoices = await Invoice.find({ dtUserId: objectId, paymentStatus: 'overdue' })
            .populate('projectId', 'projectName')
            .sort({ dueDate: 1 });

        return { statistics: stats, recentInvoices, overdueInvoices };
    }
}

export default new DTInvoiceService();
