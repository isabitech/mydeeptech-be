const DtUserRepository = require("../repositories/dtUser.repository");
const AnnotationProjectRepository = require("../repositories/annotationProject.repository");
const DomainToUserServiceClass = require("../services/domain-to-user.service");
const AuthService = require("./dtuser-service/auth.service");
const AdminAuthService = require("./dtuser-service/admin-auth.service");
const DtuserInvoiceService = require("./dtuser-service/dtuser-invoice.service");
const DtuserUploadService = require("./dtuser-service/dtuser-upload.service");
const AdminService = require("./dtuser-service/admin.service");
const UserDashboardService = require("./dtuser-service/dtuserdashboard.service");

class DtUserService {
  constructor(
    repository = new DtUserRepository(),
    projectRepository = new AnnotationProjectRepository(),
    domainToUserService = new DomainToUserServiceClass(),
    authService = AuthService,
    adminAuthService = AdminAuthService,
    dtuserInvoiceService = DtuserInvoiceService,
    dtuserUploadService = DtuserUploadService,
    adminService = AdminService,
    userDashboardService = UserDashboardService,
  ) {
    this.repository = repository;
    this.projectRepository = projectRepository;
    this.domainToUserService = domainToUserService;
    this.authService = authService;
    this.adminAuthService = adminAuthService;
    this.dtuserInvoiceService = dtuserInvoiceService;
    this.dtuserUploadService = dtuserUploadService;
    this.resultSubmissionService = dtuserUploadService;
    this.adminService = adminService;
    this.AdminService = adminService;
    this.userDashboardService = userDashboardService;
  }

  /**
   * Send verification emails to all unverified users.
   */
  async sendVerificationEmailsToUnverifiedUsers() {
    return this.authService.sendVerificationEmailsToUnverifiedUsers();
  }

  /**
   * Create DTUser and send verification email with timeout.
   */
  async createDTUser(payload) {
    const { fullName, phone, email, domains, socialsFollowed, consent } =
      payload;
    return this.authService.createDTUser(
      fullName,
      phone,
      email,
      domains,
      socialsFollowed,
      consent,
    );
  }

  /**
   * Create DTUser and queue verification email.
   */
  async createDTUserWithBackgroundEmail(payload) {
    const { fullName, phone, email, domains, socialsFollowed, consent } =
      payload;
    return this.authService.createDTUserWithBackgroundEmail(
      fullName,
      phone,
      email,
      domains,
      socialsFollowed,
      consent,
    );
  }

  /**
   * Verify email by id and query email.
   */
  async verifyEmail({ id, email }) {
    const payload = { id, email };
    return this.authService.verifyEmail(payload);
  }

  /**
   * Setup password after verification.
   */
  async setupPassword({ userId, email, password, body }) {
    const payload = { userId, email, password, body };
    return this.authService.setupPassword(payload);
  }

  /**
   * Login DTUser.
   */
  async dtUserLogin(body) {
    return this.authService.dtUserLogin(body);
  }

  /**
   * Get current user info.
   */
  async me(email) {
    return this.authService.me(email);
  }

  /**
   * Get DTUser profile by id.
   */
  async getDTUserProfile(userId) {
    // Find user with populated userDomains (same as getAllDTUsers method)
    return this.authService.getDTUserProfile(userId);
  }

  /**
   * Update DTUser profile.
   */
  async updateDTUserProfile({ userId, requesterId, body, user }) {
    return this.authService.updateDTUserProfile({
      userId,
      requesterId,
      body,
      user,
    });
  }

  /**
   * Reset DTUser password with old password check.
   */
  async resetDTUserPassword({ userId, body }) {
    return this.authService.resetDTUserPassword({ userId, body });
  }

  /**
   * Resend verification email.
   */
  async resendVerificationEmail(email) {
    return this.authService.resendVerificationEmail(email);
  }

  /**
   * Get public DTUser by id.
   */
  async getDTUser(id) {
    const user = await this.repository.findById(id).select("-password");
    if (!user) {
      return { status: 404, reason: "not_found" };
    }
    return { user };
  }

  /**
   * Admin: Get all DTUsers with filters and pagination.
   */
  async getAllDTUsers({ query }) {
    return this.AdminService.getAllDTUsers({ query });
  }

  /**
   * Admin: Get all admin users.
   */
  async getAllAdminUsers({ query }) {
    return this.AdminService.getAllAdminUsers({ query });
  }

  /**
   * Admin: Dashboard overview.
   */
  async getAdminDashboard() {
    return this.AdminService.getAdminDashboard();
  }

  /**
   * Admin: Approve annotator.
   */
  async approveAnnotator({ userId, newStatus }) {
    return this.AdminService.approveAnnotator({ userId, newStatus });
  }

  /**
   * Admin: Get all QA users.
   */
  async getAllQAUsers({ query }) {
    return this.AdminService.getAllQAUsers({ query });
  }

  /**
   * Admin: Approve user for QA.
   */
  async approveUserForQA({ userId }) {
    return this.AdminService.approveUserForQA({ userId });
  }

  /**
   * Admin: Reject user for QA.
   */
  async rejectUserForQA({ userId }) {
    return this.AdminService.rejectUserForQA({ userId });
  }

  /**
   * Admin: Reject annotator.
   */
  async rejectAnnotator({ userId }) {
    return this.AdminService.rejectAnnotator({ userId });
  }

  /**
   * Admin: Get single DTUser details.
   */
  async getDTUserAdmin(userId) {
    const user = await this.repository.findByIdSelect(userId, "-password");
    if (!user) {
      return { status: 404, reason: "not_found" };
    }
    return { user };
  }

  /**
   * Admin: Request admin verification (step 1).
   */
  async requestAdminVerification(body) {
    return this.adminAuthService.requestAdminVerification(body);
  }

  /**
   * Admin: Confirm verification and create admin (step 2).
   */
  async confirmAdminVerification(body) {
    return this.adminAuthService.confirmAdminVerification(body);
  }

  /**
   * Admin: Legacy direct creation.
   */
  async createAdmin(body, req = null) {
    return this.adminAuthService.createAdmin(body, req);
  }

  /**
   * Admin: Verify admin OTP.
   */
  async verifyAdminOTP(body) {
    return this.adminAuthService.verifyAdminOTP(body);
  }

  /**
   * Admin: Verify existing admin OTP (no admin key required).
   */
  async verifyExistingAdminOTP(body) {
    return this.adminAuthService.verifyExistingAdminOTP(body);
  }

  /**
   * Admin: Resend admin OTP.
   */
  async resendAdminOTP(body) {
    return this.adminAuthService.resendAdminOTP(body);
  }

  /**
   * Admin: Resend admin OTP for existing users (no admin key required).
   */
  async resendExistingAdminOTP(body) {
    return this.adminAuthService.resendExistingAdminOTP(body);
  }

  /**
   * Admin: Save registration state for cross-device access.
   */
  async saveAdminRegistrationState(email, currentStep, formData, adminId, req) {
    return this.adminAuthService.saveRegistrationState(email, currentStep, formData, adminId, req);
  }

  /**
   * Admin: Get registration state for cross-device access.
   */
  async getAdminRegistrationState(email) {
    return this.adminAuthService.getRegistrationState(email);
  }

  /**
   * Admin: Complete registration and cleanup state.
   */
  async completeAdminRegistrationState(email) {
    return this.adminAuthService.completeRegistrationState(email);
  }

  /**
   * Admin: Login.
   */
  async adminLogin(body) {
    return this.adminAuthService.adminLogin(body);
  }

  /**
   * Invoices: list for user with filters.
   */
  async getUserInvoices({ userId, query }) {
    return this.dtuserInvoiceService.getUserInvoices({ userId, query });
  }

  async getUnpaidInvoices({ userId, query }) {
    return this.dtuserInvoiceService.getUnpaidInvoices({ userId, query });
  }

  async getPaidInvoices({ userId, query }) {
    return this.dtuserInvoiceService.getPaidInvoices({ userId, query });
  }

  async getInvoiceDetails({ userId, invoiceId }) {
    return this.dtuserInvoiceService.getInvoiceDetails({ userId, invoiceId });
  }

  async getInvoiceDashboard({ userId }) {
    return this.dtuserInvoiceService.getInvoiceDashboard({ userId });
  }

  /**
   * DTUser personal dashboard summary.
   */
  async getDTUserDashboard({ userId, email }) {
    return this.userDashboardService.getDTUserDashboard({ userId, email });
  }

  /**
   * Get available projects (only for approved annotators)
   */
  async getAvailableProjects(userId, query) {
    // 1️⃣ Fetch user
    const user = await this.repository.findById(userId);
    if (!user) return { status: 404, reason: "not_found" };
    if (user.annotatorStatus !== "approved")
      return { status: 403, reason: "forbidden" };

    // 2️⃣ Parse query params
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;
    const {
      category,
      search,
      minPayRate,
      maxPayRate,
      difficultyLevel,
      view = "available",
      status: applicationStatus,
    } = query;

    // 3️⃣ Base project filter
    const filter = { status: "active", isPublic: true };
    if (category) filter.projectCategory = category;
    if (difficultyLevel) filter.difficultyLevel = difficultyLevel;
    if (minPayRate || maxPayRate) {
      filter.payRate = {};
      if (minPayRate) filter.payRate.$gte = parseFloat(minPayRate);
      if (maxPayRate) filter.payRate.$lte = parseFloat(maxPayRate);
    }
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$and = [
        {
          $or: [
            { projectName: regex },
            { projectDescription: regex },
            { tags: { $in: [regex] } },
          ],
        },
      ];
    }

    // 4️⃣ Fetch user applications
    const userApplicationsQuery = { applicantId: userId };
    if (view === "applied" && applicationStatus)
      userApplicationsQuery.status = applicationStatus;

    const userApplications = await this.projectRepository.findApplications(
      userApplicationsQuery,
    );
    const allUserApplications = await this.projectRepository.findApplications({
      applicantId: userId,
    });

    const getId = (id) => id?._id?.toString?.() || id?.toString?.();

    const appliedProjectIds = userApplications
      .map((app) => getId(app.projectId))
      .filter(Boolean);
    const allAppliedProjectIds = allUserApplications
      .map((app) => getId(app.projectId))
      .filter(Boolean);

    const applicationMap = new Map();
    userApplications.forEach((app) => {
      const pid = getId(app.projectId);
      if (!pid) return;
      applicationMap.set(pid, {
        applicationId: app._id,
        status: app.status,
        appliedAt: app.appliedAt,
        approvedAt: app.approvedAt,
        rejectedAt: app.rejectedAt,
        rejectionReason: app.rejectionReason,
        reviewNotes: app.reviewNotes,
        coverLetter: app.coverLetter,
        availability: app.availability,
        aiInterviewSessionId: app.aiInterviewSessionId || null,
        aiInterviewTrackId: app.aiInterviewTrackId || "",
        aiInterviewStatus: app.aiInterviewStatus || "",
        aiInterviewScore: app.aiInterviewScore ?? null,
        aiInterviewSummary: app.aiInterviewSummary || "",
        aiInterviewCompletedAt: app.aiInterviewCompletedAt || null,
      });
    });

    // 5️⃣ Final filter based on view
    let finalFilter = { ...filter };
    if (view === "available" && allAppliedProjectIds.length > 0) {
      finalFilter._id = { $nin: allAppliedProjectIds };
    }
    if (view === "applied" && appliedProjectIds.length > 0) {
      finalFilter._id = { $in: appliedProjectIds };
    }

    // 6️⃣ Fetch projects
    const projects = await this.projectRepository.findAllProjects(finalFilter, {
      skip,
      limit,
      sort: { createdAt: -1 },
      populate: [{ path: "createdBy", select: "fullName email" }],
    });
    const totalProjects =
      await this.projectRepository.countProjects(finalFilter);

    // 7️⃣ Aggregate application counts (avoid N+1)
    const projectIds = projects.map((p) => getId(p));
    const applicationCounts =
      await this.projectRepository.aggregateApplications([
        {
          $match: {
            projectId: { $in: projectIds },
            status: { $in: ["ai_interview_required", "pending", "approved"] },
          },
        },
        { $group: { _id: "$projectId", count: { $sum: 1 } } },
      ]);
    const countMap = new Map(
      applicationCounts.map((item) => [item._id.toString(), item.count]),
    );

    // 8️⃣ Enrich projects with user data, slots, and deadlines
    const now = new Date();
    const enrichedProjects = projects.map((project) => {
      const proj = project.toObject ? project.toObject() : project;
      const appCount = countMap.get(proj._id.toString()) || 0;

      proj.currentApplications = appCount;
      proj.availableSlots = proj.maxAnnotators
        ? Math.max(0, proj.maxAnnotators - appCount)
        : null;
      proj.canApply = !proj.maxAnnotators || appCount < proj.maxAnnotators;

      const userApp = applicationMap.get(proj._id.toString());
      if (userApp) {
        proj.userApplication = userApp;
        proj.hasApplied = true;
        proj.canApply = false;
      } else {
        proj.hasApplied = false;
      }

      if (proj.applicationDeadline) {
        const deadline = new Date(proj.applicationDeadline);
        proj.applicationOpen = now < deadline;
        proj.daysUntilDeadline = Math.ceil(
          (deadline - now) / (1000 * 60 * 60 * 24),
        );
        if (!proj.applicationOpen) proj.canApply = false;
      } else {
        proj.applicationOpen = true;
        proj.daysUntilDeadline = null;
      }

      return proj;
    });

    const totalPages = Math.ceil(totalProjects / limit);

    // 9️⃣ Return structured data for frontend
    return {
      status: 200,
      data: {
        projects: enrichedProjects,
        pagination: {
          currentPage: page,
          totalPages,
          totalProjects,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit,
        },
        filters: { view, applicationStatus, category, difficultyLevel },
        userInfo: {
          annotatorStatus: user.annotatorStatus,
          appliedProjects: allUserApplications.length,
          totalApplications: allUserApplications.length,
          applicationStats: {
            aiInterviewRequired: allUserApplications.filter(
              (a) => a.status === "ai_interview_required",
            ).length,
            pending: allUserApplications.filter((a) => a.status === "pending")
              .length,
            approved: allUserApplications.filter((a) => a.status === "approved")
              .length,
            rejected: allUserApplications.filter((a) => a.status === "rejected")
              .length,
          },
        },
      },
    };
  }

  /**
   * Result upload via Cloudinary (already uploaded via middleware).
   */
  async submitResultWithCloudinary({ userId, file, body }) {
    return this.dtuserUploadService.submitResultWithCloudinary({
      userId,
      file,
      body,
    });
  }

  async uploadIdDocument({ user, file }) {
    return this.dtuserUploadService.uploadIdDocument({ user, file });
  }

  async uploadResume({ user, file }) {
    return this.dtuserUploadService.uploadResume({ user, file });
  }

  async getUserResultSubmissions({ userId, query }) {
    const { page = 1, limit = 10, status } = query;
    const user = await this.repository
      .findById(userId)
      .populate("resultSubmissions.projectId", "projectName projectCategory");

    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    let resultSubmissions = user.resultSubmissions || [];
    if (
      status &&
      ["pending", "processing", "stored", "failed"].includes(status)
    ) {
      resultSubmissions = resultSubmissions.filter(
        (submission) => submission.status === status,
      );
    }

    resultSubmissions.sort(
      (a, b) => new Date(b.submissionDate) - new Date(a.submissionDate),
    );

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit, 10);
    const paginatedResults = resultSubmissions.slice(startIndex, endIndex);

    const formattedResults = paginatedResults.map((submission) => ({
      id: submission._id,
      originalLink: submission.originalResultLink,
      cloudinaryData: submission.cloudinaryResultData,
      submissionDate: submission.submissionDate,
      projectInfo: submission.projectId
        ? {
            id: submission.projectId._id,
            name: submission.projectId.projectName,
            category: submission.projectId.projectCategory,
          }
        : null,
      status: submission.status,
      notes: submission.notes,
    }));

    const stats = {
      total: resultSubmissions.length,
      stored: resultSubmissions.filter((s) => s.status === "stored").length,
      failed: resultSubmissions.filter((s) => s.status === "failed").length,
      pending: resultSubmissions.filter((s) => s.status === "pending").length,
    };

    return {
      status: 200,
      data: {
        submissions: formattedResults,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(resultSubmissions.length / limit),
          totalSubmissions: resultSubmissions.length,
          hasMore: endIndex < resultSubmissions.length,
        },
        statistics: stats,
      },
    };
  }

  async getAllUsersForRoleManagement({ query }) {
    return this.AdminService.getAllUsersForRoleManagement({ query });
  }

  async updateDTUserProfilePicture({ userId, file }) {
    return this.dtuserUploadService.updateDTUserProfilePicture({
      userId,
      file,
    });
  }
}

module.exports = new DtUserService();
