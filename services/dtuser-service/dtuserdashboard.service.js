const Invoice = require("../../models/invoice.model");
const AnnotationProjectRepository = require("../../repositories/annotationProject.repository");
const DtUserRepository = require("../../repositories/dtUser.repository");
const mongoose = require("mongoose");
class UserDashboardService {
  constructor() {
    this.projectRepository = new AnnotationProjectRepository();
    this.dtuserrepository = new DtUserRepository();
  }

  buildProfileCompletion(user) {
    return {
      basicInfo: {
        completed: !!(user.fullName && user.email && user.phone),
        fields: ["fullName", "email", "phone"],
      },
      personalInfo: {
        completed: !!(
          user.personal_info?.country &&
          user.personal_info?.time_zone &&
          user.personal_info?.available_hours_per_week
        ),
        fields: ["country", "time_zone", "available_hours_per_week"],
      },
      professionalBackground: {
        completed: !!(
          user.professional_background?.education_field &&
          user.professional_background?.years_of_experience
        ),
        fields: ["education_field", "years_of_experience"],
      },
      paymentInfo: {
        completed: !!(
          user.payment_info?.account_name &&
          user.payment_info?.account_number &&
          user.payment_info?.bank_name
        ),
        fields: ["account_name", "account_number", "bank_name"],
      },
      attachments: {
        completed: !!(
          user.attachments?.resume_url && user.attachments?.id_document_url
        ),
        fields: ["resume_url", "id_document_url"],
      },
      profilePicture: {
        completed: !!user.profilePicture?.url,
        fields: ["profile_picture"],
      },
    };
  }

  buildDashboardNextSteps({ user, completionPercentage, totalApplications }) {
    const nextSteps = [];

    if (!user.isEmailVerified) {
      nextSteps.push({
        priority: "high",
        action: "verify_email",
        title: "Verify Your Email",
        description: "Complete email verification to unlock all features",
      });
    }
    if (!user.hasSetPassword) {
      nextSteps.push({
        priority: "high",
        action: "setup_password",
        title: "Set Up Password",
        description: "Create a secure password for your account",
      });
    }
    if (completionPercentage < 80) {
      nextSteps.push({
        priority: "medium",
        action: "complete_profile",
        title: "Complete Your Profile",
        description: `Your profile is ${completionPercentage}% complete. Add missing information to improve your chances of approval.`,
      });
    }
    if (!user.attachments?.resume_url) {
      nextSteps.push({
        priority: "medium",
        action: "upload_resume",
        title: "Upload Resume",
        description: "Upload your resume to showcase your experience",
      });
    }
    if (!user.attachments?.id_document_url) {
      nextSteps.push({
        priority: "medium",
        action: "upload_id",
        title: "Upload ID Document",
        description: "Upload a valid ID document for verification",
      });
    }
    if (user.annotatorStatus === "pending" && !user.resultLink) {
      nextSteps.push({
        priority: "high",
        action: "submit_result",
        title: "Submit Work Sample",
        description: "Upload a work sample to demonstrate your skills",
      });
    }
    if (user.annotatorStatus === "approved" && totalApplications === 0) {
      nextSteps.push({
        priority: "medium",
        action: "apply_projects",
        title: "Apply to Projects",
        description: "Browse and apply to available annotation projects",
      });
    }

    return nextSteps;
  }

  async getDTUserDashboard({ userId, email }) {
    const currentDate = new Date();
    const thirtyDaysAgo = new Date(currentDate);
    thirtyDaysAgo.setDate(currentDate.getDate() - 30);

    const user = await this.dtuserrepository.findByIdSelect(
      userId,
      "-password",
    );
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    const profileCompletion = this.buildProfileCompletion(user);

    const completionSections = Object.values(profileCompletion);
    const completedSections = completionSections.filter(
      (section) => section.completed,
    ).length;
    const completionPercentage = Math.round(
      (completedSections / completionSections.length) * 100,
    );

    const objectId = new mongoose.Types.ObjectId(userId);
    const [
      applicationStats,
      recentApplications,
      invoiceStats,
      recentPayments,
      recentInvoices,
      availableProjects,
      userApplications,
    ] = await Promise.all([
      this.projectRepository.aggregateApplications([
        { $match: { applicantId: objectId } },
        {
          $group: {
            _id: null,
            totalApplications: { $sum: 1 },
            pendingApplications: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
            approvedApplications: {
              $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
            },
            rejectedApplications: {
              $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
            },
          },
        },
      ]),
      this.projectRepository.findApplications(
        { applicantId: userId },
        {
          populate: [
            { path: "projectId", select: "projectName budget timeline status" },
          ],
          sort: { appliedAt: -1 },
          limit: 5,
          select: "status appliedAt projectId",
        },
      ),
      Invoice.aggregate([
        { $match: { dtUserId: objectId } },
        {
          $group: {
            _id: null,
            totalInvoices: { $sum: 1 },
            totalEarnings: { $sum: "$invoiceAmount" },
            paidEarnings: {
              $sum: {
                $cond: [
                  { $eq: ["$paymentStatus", "paid"] },
                  "$invoiceAmount",
                  0,
                ],
              },
            },
            pendingEarnings: {
              $sum: {
                $cond: [
                  { $eq: ["$paymentStatus", "unpaid"] },
                  "$invoiceAmount",
                  0,
                ],
              },
            },
            overdueEarnings: {
              $sum: {
                $cond: [
                  { $eq: ["$paymentStatus", "overdue"] },
                  "$invoiceAmount",
                  0,
                ],
              },
            },
            paidInvoices: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
            },
            pendingInvoices: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", "unpaid"] }, 1, 0] },
            },
            overdueInvoices: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", "overdue"] }, 1, 0] },
            },
          },
        },
      ]),
      Invoice.aggregate([
        {
          $match: {
            dtUserId: objectId,
            paymentStatus: "paid",
            paidAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$paidAt" },
              month: { $month: "$paidAt" },
              day: { $dayOfMonth: "$paidAt" },
            },
            dailyEarnings: { $sum: "$invoiceAmount" },
            invoiceCount: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]),
      Invoice.find({ dtUserId: objectId })
        .populate("projectId", "projectName")
        .sort({ createdAt: -1 })
        .limit(5)
        .select(
          "invoiceAmount paymentStatus dueDate paidAt createdAt projectId",
        ),
      this.projectRepository.findAllProjects(
        { status: "active", isActive: true },
        {
          select: "projectName description budget timeline requirements status",
          sort: { createdAt: -1 },
          limit: 5,
        },
      ),
      this.projectRepository.findApplications(
        { applicantId: userId },
        { select: "projectId status" },
      ),
    ]);

    const resultSubmissions = (() => {
      const submissions = user.resultSubmissions;
      if (!submissions?.length) {
        return {
          totalSubmissions: 0,
          recentSubmissions: [],
          lastSubmissionDate: null,
        };
      }

      let latest = null;
      for (const sub of submissions) {
        const d = new Date(sub.submissionDate);
        if (!latest || d > latest) latest = d;
      }

      return {
        totalSubmissions: submissions.length,
        recentSubmissions: submissions.slice(-5),
        lastSubmissionDate: latest,
      };
    })();

    const appliedProjectIds = new Set(
      userApplications.map((app) => app.projectId.toString()),
    );
    const availableProjectsWithStatus = availableProjects.map((project) => {
      const proj = project.toObject ? project.toObject() : project;
      return {
        ...proj,
        hasApplied: appliedProjectIds.has(proj._id.toString()),
        applicationStatus:
          userApplications.find(
            (app) => app.projectId?.toString() === proj._id.toString(),
          )?.status || null,
      };
    });

    const totalApplications = applicationStats[0]?.totalApplications || 0;
    const performanceMetrics = {
      profileCompletionPercentage: completionPercentage,
      applicationSuccessRate:
        totalApplications > 0
          ? Math.round(
              ((applicationStats[0]?.approvedApplications || 0) /
                totalApplications) *
                100,
            )
          : 0,
      paymentRate:
        (invoiceStats[0]?.totalInvoices || 0) > 0
          ? Math.round(
              ((invoiceStats[0]?.paidInvoices || 0) /
                invoiceStats[0].totalInvoices) *
                100,
            )
          : 0,
      avgEarningsPerInvoice:
        (invoiceStats[0]?.totalInvoices || 0) > 0
          ? Math.round(
              (invoiceStats[0]?.totalEarnings || 0) /
                invoiceStats[0].totalInvoices,
            )
          : 0,
      accountStatus: {
        annotatorStatus: user.annotatorStatus,
        microTaskerStatus: user.microTaskerStatus,
        isEmailVerified: user.isEmailVerified,
        hasSetPassword: user.hasSetPassword,
      },
    };

    const nextSteps = this.buildDashboardNextSteps({
      user,
      completionPercentage,
      totalApplications,
    });

    const dashboardData = {
      userProfile: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        annotatorStatus: user.annotatorStatus,
        microTaskerStatus: user.microTaskerStatus,
        isEmailVerified: user.isEmailVerified,
        hasSetPassword: user.hasSetPassword,
        joinedDate: user.createdAt,
        profilePicture: user.profilePicture?.url || null,
      },
      profileCompletion: {
        percentage: completionPercentage,
        sections: profileCompletion,
        completedSections,
        totalSections: completionSections.length,
      },
      applicationStatistics: applicationStats[0] || {
        totalApplications: 0,
        pendingApplications: 0,
        approvedApplications: 0,
        rejectedApplications: 0,
      },
      financialSummary: invoiceStats[0] || {
        totalInvoices: 0,
        totalEarnings: 0,
        paidEarnings: 0,
        pendingEarnings: 0,
        overdueEarnings: 0,
        paidInvoices: 0,
        pendingInvoices: 0,
        overdueInvoices: 0,
      },
      resultSubmissions,
      recentActivity: {
        recentApplications,
        recentInvoices,
        recentPayments,
      },
      availableOpportunities: {
        availableProjects: availableProjectsWithStatus,
        projectCount: availableProjectsWithStatus.length,
      },
      performanceMetrics,
      recommendations: {
        nextSteps,
        priorityActions: nextSteps.filter((step) => step.priority === "high")
          .length,
      },
      generatedAt: new Date(),
      timeframe: {
        recentActivity: "30 days",
        availableProjects: "current active projects",
      },
    };

    return { status: 200, data: dashboardData };
  }
}

module.exports = new UserDashboardService();
