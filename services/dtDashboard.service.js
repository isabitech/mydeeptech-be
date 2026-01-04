const DTUser = require('../models/dtUser.model');
const ProjectApplication = require('../models/projectApplication.model');
const Invoice = require('../models/invoice.model');
const AnnotationProject = require('../models/annotationProject.model');
const mongoose = require('mongoose');
const { NotFoundError } = require('../utils/responseHandler');

class DTDashboardService {
    async getUserDashboard(userId) {
        const objectId = new mongoose.Types.ObjectId(userId);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const user = await DTUser.findById(userId).select('-password');
        if (!user) throw new NotFoundError('User not found');

        // Parallel execution for dashboard metrics
        const [applicationStats, invoiceStats, recentApplications, recentInvoices, availableProjects] = await Promise.all([
            // Project application stats
            ProjectApplication.aggregate([
                { $match: { applicantId: objectId } },
                {
                    $group: {
                        _id: null,
                        totalApplications: { $sum: 1 },
                        pendingApplications: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                        approvedApplications: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
                        rejectedApplications: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
                    }
                }
            ]),
            // Invoice stats
            Invoice.getInvoiceStats(objectId),
            // Recent applications
            ProjectApplication.find({ applicantId: userId })
                .populate('projectId', 'projectName status')
                .sort({ appliedAt: -1 })
                .limit(5),
            // Recent invoices
            Invoice.find({ dtUserId: userId })
                .populate('projectId', 'projectName')
                .sort({ createdAt: -1 })
                .limit(5),
            // Available opportunities
            AnnotationProject.find({ status: 'active' }).sort({ createdAt: -1 }).limit(5)
        ]);

        // Profile completion calculation logic moved here...
        const completion = this._calculateProfileCompletion(user);

        return {
            userProfile: this._mapUserProfile(user),
            profileCompletion: completion,
            applicationStatistics: applicationStats[0] || this._emptyAppStats(),
            financialSummary: invoiceStats,
            recentActivity: {
                recentApplications,
                recentInvoices
            },
            availableOpportunities: availableProjects,
            performanceMetrics: {
                profileCompletionPercentage: completion.percentage,
                accountStatus: {
                    annotatorStatus: user.annotatorStatus,
                    microTaskerStatus: user.microTaskerStatus,
                    isEmailVerified: user.isEmailVerified
                }
            }
        };
    }

    _calculateProfileCompletion(user) {
        const sections = {
            basicInfo: !!(user.fullName && user.email && user.phone),
            personalInfo: !!(user.personal_info?.country && user.personal_info?.available_hours_per_week),
            professionalBackground: !!(user.professional_background?.education_field),
            paymentInfo: !!(user.payment_info?.bank_name),
            attachments: !!(user.attachments?.resume_url)
        };
        const total = Object.keys(sections).length;
        const completed = Object.values(sections).filter(Boolean).length;
        return {
            percentage: Math.round((completed / total) * 100),
            sections
        };
    }

    _mapUserProfile(user) {
        return {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            annotatorStatus: user.annotatorStatus,
            isEmailVerified: user.isEmailVerified,
            joinedDate: user.createdAt
        };
    }

    _emptyAppStats() {
        return { totalApplications: 0, pendingApplications: 0, approvedApplications: 0, rejectedApplications: 0 };
    }
}

module.exports = new DTDashboardService();
