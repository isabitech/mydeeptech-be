import invoiceRepository from '../repositories/invoice.repository.js';
import dtUserRepository from '../repositories/dtUser.repository.js';
import annotationProjectRepository from '../repositories/annotationProject.repository.js';
import ProjectApplication from '../models/projectApplication.model.js';
import AnnotationProject from '../models/annotationProject.model.js';
import { sendInvoiceNotification, sendPaymentConfirmation, sendPaymentReminder } from '../utils/paymentMailer.js';
import { convertUSDToNGN } from '../utils/exchangeRateService.js';
import { getBankCode, validatePaymentInfo } from '../utils/bankCodeMapping.js';
import { ValidationError, NotFoundError } from '../utils/responseHandler.js';
import mongoose from 'mongoose';

class InvoiceService {
    /** Admin: Create invoice */
    async createInvoice(data, adminId) {
        const { projectId, dtUserId, invoiceAmount } = data;

        // Verify project
        const project = await AnnotationProject.findById(projectId);
        if (!project) throw new NotFoundError("Project not found");

        // Verify user
        const dtUser = await dtUserRepository.findById(dtUserId);
        if (!dtUser) throw new NotFoundError("DTUser not found");
        if (dtUser.annotatorStatus !== 'approved') {
            throw new ValidationError("Can only create invoices for approved annotators");
        }

        // Verify user worked on project
        const userWorkedOnProject = await ProjectApplication.findOne({
            projectId,
            applicantId: dtUserId,
            status: 'approved'
        });
        if (!userWorkedOnProject) {
            throw new ValidationError("User has not worked on this project or application not approved");
        }

        const invoiceData = {
            ...data,
            createdBy: adminId,
            status: 'sent'
        };

        const invoice = await invoiceRepository.create(invoiceData);
        await invoice.populate([
            { path: 'projectId', select: 'projectName projectDescription' },
            { path: 'dtUserId', select: 'fullName email' },
            { path: 'createdBy', select: 'fullName email' }
        ]);

        // Send notification
        try {
            await sendInvoiceNotification(dtUser.email, dtUser.fullName, {
                invoiceNumber: invoice.invoiceNumber,
                projectName: project.projectName,
                amount: invoice.invoiceAmount,
                currency: invoice.currency,
                dueDate: invoice.dueDate,
                description: invoice.description
            });
            invoice.emailSent = true;
            invoice.emailSentAt = new Date();
            await invoice.save();
        } catch (error) {
            console.error('Invoice notification email error:', error);
        }

        return invoice;
    }

    /** Admin: Get all invoices with filters and stats */
    async getAllInvoices(query) {
        const { page = 1, limit = 20, paymentStatus, projectId, dtUserId, startDate, endDate, invoiceType } = query;
        const filter = {};
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (projectId) filter.projectId = projectId;
        if (dtUserId) filter.dtUserId = dtUserId;
        if (invoiceType) filter.invoiceType = invoiceType;

        if (startDate || endDate) {
            filter.invoiceDate = {};
            if (startDate) filter.invoiceDate.$gte = new Date(startDate);
            if (endDate) filter.invoiceDate.$lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;
        const invoices = await invoiceRepository.find(filter, { createdAt: -1 }, skip, parseInt(limit), [
            { path: 'projectId', select: 'projectName projectCategory' },
            { path: 'dtUserId', select: 'fullName email phone payment_info' },
            { path: 'createdBy', select: 'fullName email' }
        ]);

        const totalInvoices = await invoiceRepository.count(filter);

        const summaryPipeline = [
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$invoiceAmount' },
                    paidAmount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$invoiceAmount', 0] } },
                    unpaidAmount: { $sum: { $cond: [{ $ne: ['$paymentStatus', 'paid'] }, '$invoiceAmount', 0] } },
                    totalInvoices: { $sum: 1 },
                    paidInvoices: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } },
                    unpaidInvoices: { $sum: { $cond: [{ $ne: ['$paymentStatus', 'paid'] }, 1, 0] } },
                    overdueInvoices: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'overdue'] }, 1, 0] } }
                }
            }
        ];
        const summary = await invoiceRepository.aggregate(summaryPipeline);

        return {
            invoices,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalInvoices / limit),
                totalInvoices,
                invoicesPerPage: parseInt(limit)
            },
            summary: summary[0] || {
                totalAmount: 0,
                paidAmount: 0,
                unpaidAmount: 0,
                totalInvoices: 0,
                paidInvoices: 0,
                unpaidInvoices: 0,
                overdueInvoices: 0
            }
        };
    }

    /** Get specific invoice details */
    async getInvoiceDetails(invoiceId, userId = null, isAdmin = false) {
        const invoice = await invoiceRepository.findByIdWithPopulate(invoiceId, [
            { path: 'projectId', select: 'projectName projectDescription projectCategory' },
            { path: 'dtUserId', select: 'fullName email phone payment_info' },
            { path: 'createdBy', select: 'fullName email' },
            { path: 'approvedBy', select: 'fullName email' }
        ]);

        if (!invoice) throw new NotFoundError("Invoice not found or access denied");

        // Security check for non-admins
        if (!isAdmin && userId && invoice.dtUserId._id.toString() !== userId.toString()) {
            throw new NotFoundError("Invoice not found or access denied");
        }

        if (!isAdmin && !invoice.emailViewedAt) {
            invoice.emailViewedAt = new Date();
            await invoice.save();
        }

        return invoice;
    }

    /** Admin: Update payment status */
    async updatePaymentStatus(invoiceId, updateData) {
        const { paymentStatus, paymentMethod, paymentReference, paymentNotes, paidAmount } = updateData;
        const invoice = await invoiceRepository.findByIdWithPopulate(invoiceId, [
            { path: 'dtUserId', select: 'fullName email payment_info' },
            { path: 'projectId', select: 'projectName' }
        ]);

        if (!invoice) throw new NotFoundError("Invoice not found");

        const patch = { paymentStatus };
        if (paymentStatus === 'paid') {
            patch.paidAt = new Date();
            patch.paidAmount = paidAmount || invoice.invoiceAmount;
            patch.status = 'paid';
            if (paymentMethod) patch.paymentMethod = paymentMethod;
            if (paymentReference) patch.paymentReference = paymentReference;
            if (paymentNotes) patch.paymentNotes = paymentNotes;
        }

        const updated = await invoiceRepository.update(invoiceId, patch);

        let emailSent = false;
        if (paymentStatus === 'paid') {
            try {
                await sendPaymentConfirmation(invoice.dtUserId.email, invoice.dtUserId.fullName, {
                    invoiceNumber: invoice.invoiceNumber,
                    projectName: invoice.projectId.projectName,
                    amount: invoice.invoiceAmount,
                    currency: invoice.currency,
                    paidAt: patch.paidAt
                }, {
                    paymentMethod: patch.paymentMethod,
                    paymentReference: patch.paymentReference
                });
                emailSent = true;
            } catch (error) {
                console.error('Payment confirmation email error:', error);
            }
        }

        return { invoice: updated, emailNotificationSent: emailSent };
    }

    /** Admin: Send reminder */
    async sendInvoiceReminder(invoiceId) {
        const invoice = await invoiceRepository.findByIdWithPopulate(invoiceId, [
            { path: 'dtUserId', select: 'fullName email' },
            { path: 'projectId', select: 'projectName' }
        ]);

        if (!invoice) throw new NotFoundError("Invoice not found");
        if (invoice.paymentStatus === 'paid') {
            throw new ValidationError("Cannot send reminder for paid invoice");
        }

        await sendPaymentReminder(invoice.dtUserId.email, invoice.dtUserId.fullName, {
            invoiceNumber: invoice.invoiceNumber,
            projectName: invoice.projectId.projectName,
            amount: invoice.invoiceAmount,
            currency: invoice.currency,
            dueDate: invoice.dueDate,
            daysOverdue: invoice.daysOverdue
        });

        invoice.lastEmailReminder = new Date();
        await invoice.save();

        return {
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            sentTo: invoice.dtUserId.email,
            sentAt: invoice.lastEmailReminder
        };
    }

    /** Admin: Delete invoice */
    async deleteInvoice(invoiceId) {
        const invoice = await invoiceRepository.findById(invoiceId);
        if (!invoice) throw new NotFoundError("Invoice not found");

        const hoursAgo = (new Date() - invoice.createdAt) / (1000 * 60 * 60);
        if (invoice.paymentStatus !== 'unpaid' || hoursAgo > 24) {
            throw new ValidationError("Can only delete unpaid invoices created within the last 24 hours");
        }

        return await invoiceRepository.delete(invoiceId);
    }

    /** Admin: Bulk authorize payment */
    async bulkAuthorizePayment(adminEmail) {
        const unpaidInvoices = await invoiceRepository.find(
            { paymentStatus: { $in: ['unpaid', 'overdue'] } },
            { createdAt: 1 }, 0, 0,
            [{ path: 'dtUserId', select: 'fullName email' }, { path: 'projectId', select: 'projectName' }]
        );

        if (unpaidInvoices.length === 0) {
            return { processedInvoices: 0, totalAmount: 0, emailsSent: 0, errors: [] };
        }

        const results = { processedInvoices: 0, totalAmount: 0, emailsSent: 0, errors: [] };

        for (const invoice of unpaidInvoices) {
            try {
                // Assuming markAsPaid is a method on the Invoice model
                await invoice.markAsPaid({
                    paymentMethod: 'bulk_transfer',
                    paymentReference: `BULK-${new Date().getTime()}`,
                    paymentNotes: `Bulk payment authorization by ${adminEmail}`
                });

                results.processedInvoices++;
                results.totalAmount += invoice.invoiceAmount;

                try {
                    await sendPaymentConfirmation(invoice.dtUserId.email, invoice.dtUserId.fullName, {
                        invoiceNumber: invoice.invoiceNumber,
                        projectName: invoice.projectId.projectName,
                        amount: invoice.invoiceAmount,
                        currency: invoice.currency || 'USD',
                        paidAt: new Date()
                    }, {
                        paymentMethod: 'bulk_transfer',
                        paymentReference: `BULK-${new Date().getTime()}`
                    });
                    results.emailsSent++;
                } catch (emailError) {
                    results.errors.push({ invoiceNumber: invoice.invoiceNumber, error: 'Email failed', details: emailError.message });
                }
            } catch (err) {
                results.errors.push({ invoiceNumber: invoice.invoiceNumber, error: 'Processing failed', details: err.message });
            }
        }
        return results;
    }

    /** Admin: Generate Paystack CSV */
    async generatePaystackCSV(invoiceIdsArray) {
        let filter = { paymentStatus: { $in: ['unpaid', 'overdue'] } };
        if (invoiceIdsArray && invoiceIdsArray.length > 0) {
            filter._id = { $in: invoiceIdsArray.map(id => new mongoose.Types.ObjectId(id)) };
        }

        const invoices = await invoiceRepository.find(filter, { createdAt: 1 }, 0, 0, [
            { path: 'dtUserId', select: 'fullName email personal_info payment_info' },
            { path: 'projectId', select: 'projectName' }
        ]);

        if (invoices.length === 0) return { csvContent: '', summary: { totalInvoices: 0, processedInvoices: 0, totalAmountUSD: 0, totalAmountNGN: 0, errors: [] } };

        // Check exchange rate
        try { await convertUSDToNGN(1); } catch (e) { throw new Error("Exchange rate service unavailable"); }

        const csvRows = [['Transfer Amount', 'Transfer Note (Optional)', 'Transfer Reference (Optional)', 'Recipient Code', 'Bank Code or Slug', 'Account Number', 'Account Name (Optional)', 'Email Address (Optional)']];
        const results = { totalInvoices: invoices.length, processedInvoices: 0, totalAmountUSD: 0, totalAmountNGN: 0, errors: [] };

        for (const invoice of invoices) {
            try {
                const user = invoice.dtUserId;
                const validation = validatePaymentInfo(user.payment_info);
                if (!validation.isValid) {
                    results.errors.push({ invoiceNumber: invoice.invoiceNumber, error: 'Invalid payment info', details: validation.errors.join(', ') });
                    continue;
                }

                const amountNGN = await convertUSDToNGN(invoice.invoiceAmount);
                const bankCode = user.payment_info.bank_code || getBankCode(user.payment_info.bank_name);
                if (!bankCode) {
                    results.errors.push({ invoiceNumber: invoice.invoiceNumber, error: 'Bank code not found' });
                    continue;
                }

                csvRows.push([
                    amountNGN.toFixed(2),
                    `${invoice.description || 'Project completion payment'} for ${user.fullName}`,
                    invoice.invoiceNumber,
                    '',
                    bankCode,
                    user.payment_info.account_number,
                    user.payment_info.account_name,
                    user.email
                ]);
                results.processedInvoices++;
                results.totalAmountUSD += invoice.invoiceAmount;
                results.totalAmountNGN += amountNGN;
            } catch (err) {
                results.errors.push({ invoiceNumber: invoice.invoiceNumber, error: 'Processing failed', details: err.message });
            }
        }

        const csvContent = csvRows.map(row => row.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',')).join('\n');
        return { csvContent, summary: results };
    }

    /** Admin: Generate MPESA CSV */
    async generateMPESACSV(invoiceIdsArray) {
        let filter = { paymentStatus: { $in: ['unpaid', 'overdue'] } };
        if (invoiceIdsArray && invoiceIdsArray.length > 0) {
            filter._id = { $in: invoiceIdsArray.map(id => new mongoose.Types.ObjectId(id)) };
        }

        const invoices = await invoiceRepository.find(filter, { createdAt: 1 }, 0, 0, [
            { path: 'dtUserId', select: 'fullName email personal_info payment_info' },
            { path: 'projectId', select: 'projectName' }
        ]);

        if (invoices.length === 0) return { csvContent: '', summary: { totalInvoices: 0, processedInvoices: 0, totalAmountUSD: 0, errors: [] } };

        const csvRows = [['Transfer Amount(USD)', 'Transfer Note (Optional)', 'Transfer Reference (Optional)', 'MPESA Account Number', 'Account Name', 'Email Address']];
        const results = { totalInvoices: invoices.length, processedInvoices: 0, totalAmountUSD: 0, errors: [] };

        for (const invoice of invoices) {
            try {
                const user = invoice.dtUserId;
                if (!user.payment_info?.account_number || !user.payment_info?.account_name) {
                    results.errors.push({ invoiceNumber: invoice.invoiceNumber, error: 'Missing MPESA info' });
                    continue;
                }

                csvRows.push([
                    invoice.invoiceAmount.toFixed(2),
                    `${invoice.description || 'Payment'} for ${user.fullName}`,
                    invoice.invoiceNumber,
                    user.payment_info.account_number,
                    user.payment_info.account_name,
                    user.email
                ]);
                results.processedInvoices++;
                results.totalAmountUSD += invoice.invoiceAmount;
            } catch (err) {
                results.errors.push({ invoiceNumber: invoice.invoiceNumber, error: 'Processing failed', details: err.message });
            }
        }

        const csvContent = csvRows.map(row => row.map(c => `"${c}"`).join(',')).join('\n');
        return { csvContent, summary: results };
    }

    /** User: Get invoices for specific user */
    async getUserInvoices(userId, query) {
        const { paymentStatus, projectId, startDate, endDate, page = 1, limit = 10 } = query;
        const filter = { dtUserId: userId };
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (projectId) filter.projectId = projectId;
        if (startDate || endDate) {
            filter.invoiceDate = {};
            if (startDate) filter.invoiceDate.$gte = new Date(startDate);
            if (endDate) filter.invoiceDate.$lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;
        const invoices = await invoiceRepository.find(filter, { createdAt: -1 }, skip, parseInt(limit), [
            { path: 'projectId', select: 'projectName projectCategory payRate' },
            { path: 'createdBy', select: 'fullName email' }
        ]);

        const totalInvoices = await invoiceRepository.count(filter);
        const stats = await invoiceRepository.getInvoiceStats(userId);

        return {
            invoices,
            pagination: { currentPage: parseInt(page), totalPages: Math.ceil(totalInvoices / limit), totalInvoices },
            statistics: stats
        };
    }

    /** User: Get unpaid invoices specifically */
    async getUnpaidInvoices(userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const filter = { dtUserId: userId, paymentStatus: { $in: ['unpaid', 'overdue'] } };

        const invoices = await invoiceRepository.find(filter, { dueDate: 1 }, skip, parseInt(limit), [
            { path: 'projectId', select: 'projectName projectCategory' },
            { path: 'createdBy', select: 'fullName email' }
        ]);

        const total = await invoiceRepository.count(filter);
        const summary = await invoiceRepository.aggregate([
            { $match: { dtUserId: new mongoose.Types.ObjectId(userId), paymentStatus: { $in: ['unpaid', 'overdue'] } } },
            { $group: { _id: null, totalDue: { $sum: '$invoiceAmount' }, overdueAmount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'overdue'] }, '$invoiceAmount', 0] } } } }
        ]);

        return {
            invoices,
            pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / limit), totalUnpaid: total },
            summary: summary[0] || { totalDue: 0, overdueAmount: 0 }
        };
    }

    /** User: Get paid invoices specifically */
    async getPaidInvoices(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const filter = { dtUserId: userId, paymentStatus: 'paid' };

        const invoices = await invoiceRepository.find(filter, { paidAt: -1 }, skip, parseInt(limit), [
            { path: 'projectId', select: 'projectName projectCategory' },
            { path: 'createdBy', select: 'fullName email' }
        ]);

        const total = await invoiceRepository.count(filter);
        const totalEarnings = await invoiceRepository.aggregate([
            { $match: { dtUserId: new mongoose.Types.ObjectId(userId), paymentStatus: 'paid' } },
            { $group: { _id: null, totalEarnings: { $sum: '$invoiceAmount' } } }
        ]);

        return {
            invoices,
            pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / limit), totalPaid: total },
            summary: { totalEarnings: totalEarnings[0]?.totalEarnings || 0, paidCount: total }
        };
    }

    /** User: Get invoice dashboard summary */
    async getInvoiceDashboard(userId) {
        const objectId = new mongoose.Types.ObjectId(userId);
        const stats = await invoiceRepository.getInvoiceStats(objectId);
        const recentInvoices = await invoiceRepository.find({ dtUserId: objectId }, { createdAt: -1 }, 0, 5, [{ path: 'projectId', select: 'projectName' }]);
        const overdueInvoices = await invoiceRepository.find({ dtUserId: objectId, paymentStatus: 'overdue' }, { dueDate: 1 }, 0, 0, [{ path: 'projectId', select: 'projectName' }]);

        return { statistics: stats, recentInvoices, overdueInvoices };
    }
}

export default new InvoiceService();
