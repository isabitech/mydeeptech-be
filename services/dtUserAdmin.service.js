import dtUserRepository from '../repositories/dtUser.repository.js';
import DTUser from '../models/dtUser.model.js';
import AnnotationProject from '../models/annotationProject.model.js';
import ProjectApplication from '../models/projectApplication.model.js';
import Invoice from '../models/invoice.model.js';
import { NotFoundError } from '../utils/responseHandler.js';
import { sendAnnotatorApprovalEmail, sendAnnotatorRejectionEmail } from '../utils/annotatorMailer.js';
import mongoose from 'mongoose';

/**
 * Service handling administrative operations for DTUsers.
 * Includes user listing with filters, dashboard statistics, and manual status overrides.
 */
class DTUserAdminService {
    /**
     * Retrieves all non-admin users with advanced filtering and pagination.
     */
    async getAllUsers(query) {
        const { page = 1, limit = 20, status, verified, hasPassword, search } = query;

        // Build exclusion filter to hide internal admins from user management lists
        const filter = {
            $nor: [
                { email: { $regex: /@mydeeptech\.ng$/, $options: 'i' } },
                { domains: { $in: ['Administration', 'Management'] } }
            ]
        };

        // Apply dynamic conditional filters based on query parameters
        if (status) filter.annotatorStatus = status;
        if (verified !== undefined) filter.isEmailVerified = verified === 'true';
        if (hasPassword !== undefined) filter.hasSetPassword = hasPassword === 'true';

        // Implement full-text search across primary user identifier fields
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        // Execute paginated find with sensitivity-aware selection (no passwords)
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const users = await DTUser.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination metadata
        const total = await DTUser.countDocuments(filter);

        // Generate a real-time summary of user status distributions
        const statusSummary = await DTUser.aggregate([
            { $match: { $nor: [{ email: /@mydeeptech\.ng$/i }, { domains: { $in: ['Administration', 'Management'] } }] } },
            { $group: { _id: '$annotatorStatus', count: { $sum: 1 } } }
        ]);

        return {
            users,
            pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / limit), totalUsers: total },
            summary: { statusBreakdown: statusSummary.reduce((acc, i) => ({ ...acc, [i._id]: i.count }), {}) }
        };
    }

    async getAllAdminUsers(query) {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search } = query;
        const filter = {
            $or: [
                { email: /@mydeeptech\.ng$/i },
                { domains: { $in: ['Administration', 'Management'] } }
            ]
        };

        if (search) {
            const regex = new RegExp(search, 'i');
            filter.$and = [{ $or: [{ fullName: regex }, { email: regex }, { phone: regex }] }];
        }

        const skip = (page - 1) * limit;
        const users = await DTUser.find(filter)
            .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
            .skip(skip)
            .limit(limit)
            .select('-password')
            .lean();

        const total = await DTUser.countDocuments(filter);
        return { users, pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalAdminUsers: total } };
    }

    /**
     * Aggregates system-wide statistics for the administrative dashboard.
     * Combines data from Users, Projects, Applications, and Invoices.
     */
    async getAdminDashboard() {
        // Reference point for "recent" activity metrics
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Execute disparate metric aggregations in parallel for optimized dashboard loading
        const [dtUserStats, projectStats, applicationStats, invoiceStats] = await Promise.all([
            // User distribution metrics
            DTUser.aggregate([
                { $match: { $nor: [{ email: /@mydeeptech\.ng$/i }, { domains: { $in: ['Administration', 'Management'] } }] } },
                {
                    $group: {
                        _id: null,
                        totalUsers: { $sum: 1 },
                        pendingAnnotators: { $sum: { $cond: [{ $eq: ['$annotatorStatus', 'pending'] }, 1, 0] } },
                        approvedAnnotators: { $sum: { $cond: [{ $eq: ['$annotatorStatus', 'approved'] }, 1, 0] } },
                        verifiedEmails: { $sum: { $cond: ['$isEmailVerified', 1, 0] } }
                    }
                }
            ]),
            // Project pipeline status
            AnnotationProject.aggregate([{ $group: { _id: null, totalProjects: { $sum: 1 }, activeProjects: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } }]),
            // Application throughput metrics
            ProjectApplication.aggregate([{ $group: { _id: null, totalApplications: { $sum: 1 }, pendingApplications: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } } } }]),
            // Financial health overview
            Invoice.aggregate([{ $group: { _id: null, totalInvoices: { $sum: 1 }, paidAmount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$invoiceAmount', 0] } } } }])
        ]);

        return {
            dtUserStatistics: dtUserStats[0] || {},
            projectStatistics: projectStats[0] || {},
            applicationStatistics: applicationStats[0] || {},
            invoiceStatistics: invoiceStats[0] || {}
        };
    }

    async approveAnnotator(userId, newStatus = 'approved') {
        const user = await dtUserRepository.findById(userId);
        if (!user) throw new NotFoundError("User not found");

        // Apply new status and persist
        user.annotatorStatus = newStatus;
        await user.save();

        // Send confirmation email asynchronously if approved
        if (newStatus === 'approved') {
            try {
                await sendAnnotatorApprovalEmail(user.email, user.fullName);
            } catch (e) {
                console.error("Failed to send approval email", e);
            }
        }
        return user;
    }

    /**
     * Rejects an annotator and sends a notification email with the reason.
     */
    async rejectAnnotator(userId, reason) {
        const user = await dtUserRepository.findById(userId);
        if (!user) throw new NotFoundError("User not found");

        user.annotatorStatus = 'rejected';
        await user.save();

        try {
            await sendAnnotatorRejectionEmail(user.email, user.fullName, reason);
        } catch (e) {
            console.error("Failed to send rejection email", e);
        }
        return user;
    }

    async getQAUsers(filter, skip, limit) {
        return await DTUser.find({ ...filter, isEmailVerified: true })
            .select('fullName email annotatorStatus microTaskerStatus qaStatus createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
    }
}

const dtUserAdminService = new DTUserAdminService();
export default dtUserAdminService;
