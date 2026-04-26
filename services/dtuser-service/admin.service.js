const mongoose = require("mongoose");
const DtUserRepository = require("../../repositories/dtUser.repository");
const AnnotationProjectRepository = require("../../repositories/annotationProject.repository");
const MailService = require("../../services/mail-service/mail-service");
const Assessment = require("../../models/assessment.model");
const Invoice = require("../../models/invoice.model");

const NON_ADMIN_FILTER = {
  $nor: [
    { email: { $regex: /@mydeeptech\.ng$/, $options: "i" } },
    { domains: { $in: ["Administration", "Management"] } },
  ],
};

const ADMIN_FILTER = {
  $or: [
    { email: /@mydeeptech\.ng$/i },
    { domains: { $in: ["Administration", "Management"] } },
  ],
};

class AdminService {
  constructor() {
    this.repository = new DtUserRepository();
    this.projectRepository = new AnnotationProjectRepository();
  }

  toInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  getNonAdminUserFilter() {
    return {
      $and: [NON_ADMIN_FILTER],
    };
  }

  getAdminUserFilter() {
    return {
      ...ADMIN_FILTER,
    };
  }

  buildUserDomains(userDomains = []) {
    return userDomains.map((domain) => ({
      _id: domain.domain_child._id,
      name: domain.domain_child.name,
      assignmentId: domain._id,
    }));
  }

  buildStatusBreakdown(statusSummary = []) {
    return statusSummary.reduce((accumulator, item) => {
      accumulator[item._id] = item.count;
      return accumulator;
    }, {});
  }

  buildSearchQuery(search, fields) {
    if (!search) {
      return {};
    }

    const searchRegex = new RegExp(search, "i");
    return {
      $or: fields.map((field) => ({ [field]: { $regex: searchRegex } })),
    };
  }

  async buildRoleManagementUser(dtUser) {
    const [activeShifts, activeSessions] = await Promise.all([
      HVNCShiftRepository.countDocuments({
        user_email: dtUser.email,
        status: "active",
        $or: [{ end_date: null }, { end_date: { $gte: new Date() } }],
      }),
      HVNCSessionRepository.countDocuments({
        user_email: dtUser.email,
        status: { $in: ["active", "idle"] },
      }),
    ]);

    const lastLogin = dtUser.lastLogin
      ? this._formatLastSeen(dtUser.lastLogin)
      : "Never";

    let status = "Active";
    if (dtUser.isLocked) {
      status = "Locked";
    } else if (!dtUser.isEmailVerified) {
      status = "Unverified";
    }

    return {
      _id: dtUser._id,
      userName: dtUser.fullName,
      firstname: dtUser.fullName ? dtUser.fullName.split(" ")[0] : "",
      lastname: dtUser.fullName
        ? dtUser.fullName.split(" ").slice(1).join(" ")
        : "",
      username: dtUser.email.split("@")[0],
      email: dtUser.email,
      phone: dtUser.phone,
      role: dtUser.role ?? "user",
      status,
      activeShifts,
      activeSessions,
      lastLogin,
      joinedDate: dtUser.createdAt,
      createdAt: dtUser.createdAt,
      updatedAt: dtUser.updatedAt,
    };
  }

  /**
   * Admin: Get all DTUsers with filters and pagination.
   */
  async getAllDTUsers({ query }) {
    const {
      page = 1,
      limit = 20,
      status,
      verified,
      hasPassword,
      search,
      country,
    } = query;

    const filter = this.getNonAdminUserFilter();

    if (status) {
      filter.annotatorStatus = status;
    }

    if (verified !== undefined) {
      filter.isEmailVerified = verified === "true";
    }

    if (hasPassword !== undefined) {
      filter.hasSetPassword = hasPassword === "true";
    }

    if (search) {
      filter.$or = this.buildSearchQuery(search, [
        "fullName",
        "email",
        "phone",
      ]).$or;
    }

    if (country && country !== 'all') {
      if (country.toLowerCase() === 'unknown') {
        // Filter for users with no country (null, undefined, empty, or field doesn't exist)
        filter.$or = [
          { 'personal_info.country': { $exists: false } },
          { 'personal_info.country': null },
          { 'personal_info.country': '' },
          { 'personal_info.country': /^\s*$/ } // Only whitespace
        ];
      } else {
        // Filter by country in personal_info.country field
        filter['personal_info.country'] = new RegExp(`^${country}$`, 'i'); // Case-insensitive exact match
      }
    }

    const pageNumber = this.toInt(page, 1);
    const pageSize = this.toInt(limit, 20);
    const skip = (pageNumber - 1) * pageSize;

    const [users, totalUsers, statusSummary] = await Promise.all([
      this.repository
        .find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate({
          path: "userDomains",
          match: { deleted_at: null },
          populate: {
            path: "domain_child",
            select: "name",
          },
        })
        .lean()
        .exec(),
      this.repository.countDocuments(filter),
      this.repository.aggregate([
        { $match: NON_ADMIN_FILTER },
        { $group: { _id: "$annotatorStatus", count: { $sum: 1 } } },
      ]),
    ]);

    const totalPages = Math.ceil(totalUsers / pageSize);

    return {
      users: users.map((user) => ({
        ...user,
        userDomains: this.buildUserDomains(user.userDomains),
      })),
      totalUsers,
      totalPages,
      page: pageNumber,
      limit: pageSize,
      statusBreakdown: this.buildStatusBreakdown(statusSummary),
      filter,
    };
  }

  /**
   * Admin: Get all admin users.
   */
  async getAllAdminUsers({ query }) {
    const filter = this.getAdminUserFilter();

    const page = this.toInt(query.page, 1);
    const limit = this.toInt(query.limit, 10);
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy || "createdAt";
    const sortOrder = query.sortOrder === "asc" ? 1 : -1;
    const search = query.search;

    if (search) {
      filter.$and = filter.$and || [];
      filter.$and.push(
        this.buildSearchQuery(search, ["fullName", "email", "phone"]),
      );
    }

    const [adminUsers, totalAdminUsers, roleSummary] = await Promise.all([
      this.repository
        .find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .select("-password")
        .lean(),
      this.repository.countDocuments(filter),
      this.repository.aggregate([
        {
          $group: {
            _id: {
              hasAdminDomains: {
                $cond: {
                  if: {
                    $setIsSubset: [
                      ["Administration", "Management"],
                      { $ifNull: ["$domains", []] },
                    ],
                  },
                  then: true,
                  else: false,
                },
              },
              emailDomain: {
                $substr: ["$email", { $indexOfCP: ["$email", "@"] }, -1],
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalPages = Math.ceil(totalAdminUsers / limit);

    return {
      adminUsers,
      totalAdminUsers,
      page,
      limit,
      totalPages,
      sortBy,
      sortOrder,
      roleSummary,
      filter,
    };
  }

  /**
   * Admin: Dashboard overview.
   */
  async getAdminDashboard() {
    const currentDate = new Date();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(currentDate.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(currentDate.getDate() - 7);

    const userFilter = {
      $nor: [
        { email: /@mydeeptech\.ng$/i },
        { domains: { $in: ["Administration", "Management"] } },
      ],
    };

    const [
      dtUserStats,
      fullyOnboardedStats,
      recentRegistrations,
      projectStats,
      applicationStats,
      invoiceStats,
      recentInvoiceActivity,
      topAnnotators,
      recentUsers,
      recentProjects,
      domainStats,
      assessmentStats,
    ] = await Promise.all([
      // User stats
      this.repository.aggregate([
        { $match: userFilter },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            pendingAnnotators: {
              $sum: { $cond: [{ $eq: ["$annotatorStatus", "pending"] }, 1, 0] },
            },
            submittedAnnotators: {
              $sum: {
                $cond: [{ $eq: ["$annotatorStatus", "submitted"] }, 1, 0],
              },
            },
            verifiedAnnotators: {
              $sum: {
                $cond: [{ $eq: ["$annotatorStatus", "verified"] }, 1, 0],
              },
            },
            approvedAnnotators: {
              $sum: {
                $cond: [{ $eq: ["$annotatorStatus", "approved"] }, 1, 0],
              },
            },
            rejectedAnnotators: {
              $sum: {
                $cond: [{ $eq: ["$annotatorStatus", "rejected"] }, 1, 0],
              },
            },
            pendingMicroTaskers: {
              $sum: {
                $cond: [{ $eq: ["$microTaskerStatus", "pending"] }, 1, 0],
              },
            },
            approvedMicroTaskers: {
              $sum: {
                $cond: [{ $eq: ["$microTaskerStatus", "approved"] }, 1, 0],
              },
            },
            verifiedEmails: {
              $sum: { $cond: ["$isEmailVerified", 1, 0] },
            },
            usersWithPasswords: {
              $sum: { $cond: ["$hasSetPassword", 1, 0] },
            },
            usersWithResults: {
              $sum: {
                $cond: [
                  {
                    $gt: [
                      { $size: { $ifNull: ["$resultSubmissions", []] } },
                      0,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      // Fully onboarded users
      Assessment.aggregate([
        {
          $match: {
            assessmentType: "annotator_qualification",
            $or: [
              { language: "en" },
              { language: { $exists: false } },
              { language: null },
            ],
            passed: true,
            completedAt: { $ne: null },
          },
        },
        { $group: { _id: "$userId" } },
        { $group: { _id: null, fullyOnboardedUsers: { $sum: 1 } } },
      ]),

      // Recent registrations
      this.repository.aggregate([
        { $match: { ...userFilter, createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]),

      // Project stats
      this.projectRepository.aggregateProjects([
        {
          $group: {
            _id: null,
            totalProjects: { $sum: 1 },
            activeProjects: {
              $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
            },
            completedProjects: {
              $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
            },
            pausedProjects: {
              $sum: { $cond: [{ $eq: ["$status", "paused"] }, 1, 0] },
            },
            totalBudget: { $sum: "$budget" },
            totalSpent: { $sum: "$spentBudget" },
          },
        },
      ]),

      // Application stats
      this.projectRepository.aggregateApplications([
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

      // Invoice stats
      Invoice.aggregate([
        {
          $group: {
            _id: null,
            totalInvoices: { $sum: 1 },
            totalAmount: { $sum: "$invoiceAmount" },
            paidAmount: {
              $sum: {
                $cond: [
                  { $eq: ["$paymentStatus", "paid"] },
                  "$invoiceAmount",
                  0,
                ],
              },
            },
            unpaidAmount: {
              $sum: {
                $cond: [
                  { $eq: ["$paymentStatus", "unpaid"] },
                  "$invoiceAmount",
                  0,
                ],
              },
            },
            overdueAmount: {
              $sum: {
                $cond: [
                  { $eq: ["$paymentStatus", "overdue"] },
                  "$invoiceAmount",
                  0,
                ],
              },
            },
            paidCount: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
            },
            unpaidCount: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", "unpaid"] }, 1, 0] },
            },
            overdueCount: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", "overdue"] }, 1, 0] },
            },
          },
        },
      ]),

      // Invoice activity
      Invoice.aggregate([
        {
          $match: {
            $or: [
              { createdAt: { $gte: sevenDaysAgo } },
              { paidAt: { $gte: sevenDaysAgo } },
            ],
          },
        },
        {
          $group: {
            _id: {
              year: { $year: { $ifNull: ["$paidAt", "$createdAt"] } },
              month: { $month: { $ifNull: ["$paidAt", "$createdAt"] } },
              day: { $dayOfMonth: { $ifNull: ["$paidAt", "$createdAt"] } },
            },
            invoicesCreated: {
              $sum: { $cond: [{ $gte: ["$createdAt", sevenDaysAgo] }, 1, 0] },
            },
            invoicesPaid: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$paidAt", sevenDaysAgo] },
                      { $ne: ["$paidAt", null] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            amountPaid: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$paidAt", sevenDaysAgo] },
                      { $ne: ["$paidAt", null] },
                    ],
                  },
                  "$invoiceAmount",
                  0,
                ],
              },
            },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]),

      // Top annotators
      this.repository.aggregate([
        {
          $match: {
            annotatorStatus: "approved",
            resultSubmissions: { $exists: true, $ne: [] },
          },
        },
        {
          $project: {
            fullName: 1,
            email: 1,
            submissionCount: { $size: "$resultSubmissions" },
            lastSubmission: { $max: "$resultSubmissions.submissionDate" },
          },
        },
        { $sort: { submissionCount: -1 } },
        { $limit: 10 },
      ]),

      // Recent users
      this.repository
        .find(userFilter)
        .sort({ createdAt: -1 })
        .limit(10)
        .select(
          "fullName email annotatorStatus microTaskerStatus qaStatus createdAt isEmailVerified",
        )
        .lean(),

      // Recent projects
      this.projectRepository.findAllProjects(
        {},
        {
          limit: 5,
          populate: [{ path: "createdBy", select: "fullName email" }],
          sort: { createdAt: -1 },
          lean: true,
        },
      ),

      // Domain distribution
      this.repository.aggregate([
        { $match: userFilter },
        { $unwind: "$domains" },
        { $group: { _id: "$domains", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Assessment stats
      Assessment.aggregate([
        { $match: { completedAt: { $ne: null } } },
        {
          $facet: {
            total: [
              {
                $group: {
                  _id: null,
                  totalCompleted: { $sum: 1 },
                  passedCount: { $sum: { $cond: ["$passed", 1, 0] } },
                  failedCount: { $sum: { $cond: ["$passed", 0, 1] } },
                  averageScore: { $avg: "$scorePercentage" },
                },
              },
            ],
            byType: [
              {
                $group: {
                  _id: "$assessmentType",
                  totalCompleted: { $sum: 1 },
                  passedCount: { $sum: { $cond: ["$passed", 1, 0] } },
                  failedCount: { $sum: { $cond: ["$passed", 0, 1] } },
                  averageScore: { $avg: "$scorePercentage" },
                },
              },
            ],
          },
        },
      ]),
    ]);

    const dashboardData = {
      overview: {
        totalUsers: dtUserStats[0]?.totalUsers || 0,
        totalProjects: projectStats[0]?.totalProjects || 0,
        totalInvoices: invoiceStats[0]?.totalInvoices || 0,
        totalRevenue: invoiceStats[0]?.paidAmount || 0,
        pendingApplications: applicationStats[0]?.pendingApplications || 0,
      },
      dtUserStatistics: {
        ...(dtUserStats[0] || {
          totalUsers: 0,
          pendingAnnotators: 0,
          submittedAnnotators: 0,
          verifiedAnnotators: 0,
          approvedAnnotators: 0,
          rejectedAnnotators: 0,
          pendingMicroTaskers: 0,
          approvedMicroTaskers: 0,
          verifiedEmails: 0,
          usersWithPasswords: 0,
          usersWithResults: 0,
        }),
        fullyOnboardedUsers: fullyOnboardedStats[0]?.fullyOnboardedUsers || 0,
      },
      projectStatistics: projectStats[0] || {},
      applicationStatistics: applicationStats[0] || {},
      invoiceStatistics: invoiceStats[0] || {},
      trends: {
        recentRegistrations,
        recentInvoiceActivity,
      },
      topPerformers: {
        topAnnotators,
      },
      recentActivities: {
        recentUsers,
        recentProjects,
      },
      insights: {
        domainDistribution: domainStats,
        assessmentStats,
      },
      generatedAt: new Date(),
      timeframe: {
        registrationData: "30 days",
        invoiceActivity: "7 days",
      },
    };

    return { dashboardData };
  }

  /**
   * Admin: Approve annotator.
   */
  async approveAnnotator({ userId, newStatus }) {
    const validStatuses = [
      "pending",
      "submitted",
      "verified",
      "approved",
      "rejected",
    ];
    if (!validStatuses.includes(newStatus)) {
      return { status: 400, reason: "invalid_status", validStatuses };
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    const previousStatus = user.annotatorStatus;

    if (newStatus === "approved") {
      user.annotatorStatus = "approved";
      user.microTaskerStatus = "approved";
    } else if (newStatus === "rejected") {
      user.annotatorStatus = "rejected";
      user.microTaskerStatus = "approved";
    } else {
      user.annotatorStatus = newStatus;
    }

    await this.repository.saveUser(user);

    try {
      if (newStatus === "approved") {
        await MailService.sendAnnotatorApprovalEmail(user.email, user.fullName);
      } else if (newStatus === "rejected") {
        await MailService.sendAnnotatorRejectionEmail(
          user.email,
          user.fullName,
        );
      }
    } catch (emailError) {
      // Log only; do not block
      console.error("Failed to send annotator status email:", emailError);
    }

    return { user, previousStatus, newStatus };
  }

  /**
   * Admin: Get all QA users.
   */
  async getAllQAUsers({ query }) {
    const { qaStatus, page = 1, limit = 50, search } = query;
    const pageNumber = this.toInt(page, 1);
    const pageSize = this.toInt(limit, 50);
    const skip = (pageNumber - 1) * pageSize;

    const filterQuery = {};

    if (qaStatus && ["pending", "approved", "rejected"].includes(qaStatus)) {
      filterQuery.qaStatus = qaStatus;
    }

    if (search) {
      filterQuery.$or = this.buildSearchQuery(search, [
        "fullName",
        "email",
      ]).$or;
    }

    const [totalUsers, qaUsers, statusCountsAgg] = await Promise.all([
      this.repository.countDocuments(filterQuery),
      this.repository
        .find(filterQuery)
        .select(
          "fullName email qaStatus annotatorStatus microTaskerStatus createdAt updatedAt phoneNumber country",
        )
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      this.repository.aggregate([
        { $match: search ? filterQuery : {} },
        { $group: { _id: "$qaStatus", count: { $sum: 1 } } },
      ]),
    ]);

    const counts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: totalUsers,
    };

    statusCountsAgg.forEach((item) => {
      counts[item._id] = item.count;
    });

    return {
      qaUsers,
      counts,
      totalUsers,
      page: pageNumber,
      limit: pageSize,
    };
  }

  /**
   * Admin: Approve user for QA.
   */
  async approveUserForQA({ userId }) {
    if (!this.repository.isValidObjectId(userId)) {
      return { status: 400, reason: "invalid_id" };
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    const previousQAStatus = user.qaStatus;

    if (user.qaStatus === "approved") {
      return { status: 400, reason: "already_approved", user };
    }

    user.qaStatus = "approved";
    await this.repository.saveUser(user);

    return { user, previousQAStatus };
  }

  /**
   * Admin: Reject user for QA.
   */
  async rejectUserForQA({ userId }) {
    if (!this.repository.isValidObjectId(userId)) {
      return { status: 400, reason: "invalid_id" };
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    const previousQAStatus = user.qaStatus;

    if (user.qaStatus === "rejected") {
      return { status: 400, reason: "already_rejected", user };
    }

    user.qaStatus = "rejected";
    await this.repository.saveUser(user);

    return { user, previousQAStatus };
  }

  /**
   * Admin: Reject annotator.
   */
  async rejectAnnotator({ userId }) {
    const user = await this.repository.findById(userId);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    const previousStatus = user.annotatorStatus;
    user.annotatorStatus = "rejected";
    user.microTaskerStatus = "approved";
    await this.repository.saveUser(user);

    try {
      await MailService.sendAnnotatorRejectionEmail(user.email, user.fullName);
    } catch (emailError) {
      console.error("Failed to send annotator rejection email:", emailError);
    }

    return { user, previousStatus };
  }

  /**
   * Admin: Get all users for role management with pagination, search, and status counts.
   */
  async getAllUsersForRoleManagement({ query }) {
    const requestedPage = query.page;
    const requestedLimit = query.limit;
    const searchTerm = query.search?.trim() || "";

    const page = Math.max(1, this.toInt(requestedPage, 1));
    const parsedLimit = parseInt(requestedLimit, 10);
    const limit = Number.isNaN(parsedLimit)
      ? 20
      : Math.min(Math.max(parsedLimit, 1), 20);
    const skip = (page - 1) * limit;

    let searchQuery = {};
    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm, "i");
      searchQuery = {
        $or: [
          { fullName: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { phone: { $regex: searchRegex } },
          { role: { $regex: searchRegex } },
        ],
      };
    }

    const [totalUsers, dtUsers, activeCount, lockedCount, unverifiedCount] =
      await Promise.all([
        this.repository.countDocuments(searchQuery),
        this.repository
          .find(searchQuery)
          .select("-password")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.repository.countDocuments({
          isLocked: false,
          isEmailVerified: true,
        }),
        this.repository.countDocuments({
          isLocked: true,
        }),
        this.repository.countDocuments({
          isEmailVerified: false,
        }),
      ]);

    const transformedDTUsers = await Promise.all(
      dtUsers.map((dtUser) => this.buildRoleManagementUser(dtUser)),
    );

    const totalPageCount = Math.ceil(totalUsers / limit);

    return {
      status: 200,
      responseCode: "200",
      responseMessage: searchTerm
        ? transformedDTUsers.length === 0
          ? `No users found matching "${searchTerm}"`
          : `Users matching "${searchTerm}" retrieved successfully`
        : "All users retrieved successfully",
      data: transformedDTUsers,
      pagination: {
        currentPage: page,
        totalPages: totalPageCount,
        totalUsers,
        limit,
        hasNextPage: page < totalPageCount,
        hasPrevPage: page > 1,
        usersOnCurrentPage: transformedDTUsers.length,
      },
      summary: {
        total: totalUsers,
        active: activeCount,
        locked: lockedCount,
        unverified: unverifiedCount,
      },
    };
  }

  // ===== Helper Methods =====
  _formatLastSeen(lastLoginTime) {
    const lastLoginMs = Date.now() - lastLoginTime.getTime();
    if (lastLoginMs < 60000) {
      return "Just now";
    } else if (lastLoginMs < 3600000) {
      const mins = Math.floor(lastLoginMs / 60000);
      return `${mins} min${mins > 1 ? "s" : ""} ago`;
    } else if (lastLoginMs < 86400000) {
      const hours = Math.floor(lastLoginMs / 3600000);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else {
      const days = Math.floor(lastLoginMs / 86400000);
      return `${days} day${days > 1 ? "s" : ""} ago`;
    }
  }
}

module.exports = new AdminService();
