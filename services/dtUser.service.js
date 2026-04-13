const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const DtUserRepository = require("../repositories/dtUser.repository");
const { emailQueue } = require("../utils/emailQueue");
const {
  dtUserPasswordSchema,
  dtUserLoginSchema,
  dtUserProfileUpdateSchema,
  adminCreateSchema,
  adminVerificationRequestSchema,
  adminVerificationConfirmSchema,
  dtUserPasswordResetSchema,
} = require("../utils/authValidator");
const envConfig = require("../config/envConfig");
const MailService = require("../services/mail-service/mail-service");
const AnnotationProjectRepository = require("../repositories/annotationProject.repository");
const HVNCShiftRepository = require("../repositories/hvnc-shift.repository");
const HVNCSessionRepository = require("../repositories/hvnc-session.repository");
const { uploadToCloudinary } = require("../config/cloudinary");
const Invoice = require("../models/invoice.model");
const Assessment = require("../models/assessment.model");
const Role = require("../models/roles.model");
const Permission = require("../models/permissions.model");
const adminVerificationStore = require("../utils/adminVerificationStore");
const { RoleType } = require("../utils/role");
const {
  generateOptimizedUrl,
  generateThumbnail,
  deleteCloudinaryFile,
} = require("../config/cloudinary");

class DtUserService {
  constructor(
    repository = new DtUserRepository(),
    projectRepository = new AnnotationProjectRepository()
  ) {
    this.repository = repository;
    this.projectRepository = projectRepository;
  }

  /**
   * Send verification emails to all unverified users.
   */
  async sendVerificationEmailsToUnverifiedUsers() {
    const unverifiedUsers = await this.repository.findUnverifiedUsers();

    if (unverifiedUsers.length === 0) {
      return {
        totalProcessed: 0,
        emailsSent: 0,
        emailsFailed: 0,
        users: [],
      };
    }

    let emailsSent = 0;
    let emailsFailed = 0;
    const processedUsers = [];

    for (const user of unverifiedUsers) {
      try {
        const emailPromise = Promise.race([
          MailService.sendVerificationEmail(
            user.email,
            user.fullName,
            user._id.toString(),
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Email sending timeout")), 10000),
          ),
        ]);

        await emailPromise;
        emailsSent++;

        processedUsers.push({
          name: user.fullName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          emailSent: true,
        });
      } catch (emailError) {
        emailsFailed++;
        processedUsers.push({
          name: user.fullName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          emailSent: false,
          error: emailError.message,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      totalProcessed: unverifiedUsers.length,
      emailsSent,
      emailsFailed,
      users: processedUsers,
    };
  }

  /**
   * Create DTUser and send verification email with timeout.
   */
  async createDTUser(payload) {
    const { fullName, phone, email, domains, socialsFollowed, consent } =
      payload;

    const existing = await this.repository.findByEmail(email);
    if (existing) {
      return { status: 400, reason: "exists" };
    }

    const newUser = await this.repository.createUser({
      fullName,
      phone,
      email,
      domains,
      socialsFollowed,
      consent,
    });

    const emailPromise = Promise.race([
      MailService.sendVerificationEmail(
        newUser.email,
        newUser.fullName,
        newUser._id.toString(),
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Email sending timeout")), 15000),
      ),
    ]);

    return { newUser, emailPromise };
  }

  /**
   * Create DTUser and queue verification email.
   */
  async createDTUserWithBackgroundEmail(payload) {
    const { fullName, phone, email, domains, socialsFollowed, consent } =
      payload;

    const existing = await this.repository.findByEmail(email);
    if (existing) {
      return { status: 400, reason: "exists" };
    }

    const newUser = await this.repository.createUser({
      fullName,
      phone,
      email,
      domains,
      socialsFollowed,
      consent,
    });

    emailQueue.addEmail(newUser.email, newUser.fullName);

    return { newUser };
  }

  /**
   * Verify email by id and query email.
   */
  async verifyEmail({ id, email }) {
    const user = await this.repository.findById(id);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    if (user.email !== email) {
      return {
        status: 400,
        reason: "email_mismatch",
        expectedEmail: user.email,
      };
    }

    if (user.isEmailVerified) {
      return { status: 200, reason: "already_verified", user };
    }

    user.isEmailVerified = true;
    await this.repository.saveUser(user);
    return { status: 200, user };
  }

  /**
   * Setup password after verification.
   */
  async setupPassword({ userId, email, password, body }) {
    const { error } = dtUserPasswordSchema.validate(body);
    if (error) {
      return {
        status: 400,
        reason: "validation",
        message: error.details[0].message,
      };
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    if (user.email !== email) {
      return { status: 400, reason: "email_mismatch" };
    }

    if (!user.isEmailVerified) {
      return { status: 400, reason: "not_verified" };
    }

    if (user.hasSetPassword) {
      return { status: 400, reason: "already_set" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.hasSetPassword = true;
    await this.repository.saveUser(user);

    return { user };
  }

  /**
   * Login DTUser.
   */
  async dtUserLogin(body) {
    const { email, password } = body;
    const user = await this.repository.findByEmail(email);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    if (!user.isEmailVerified) {
      try {
        const emailPromise = Promise.race([
          MailService.sendVerificationEmail(
            user.email,
            user.fullName,
            user._id.toString(),
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Email sending timeout")), 10000),
          ),
        ]);
        await emailPromise;
        return { status: 400, reason: "verify_resend_success" };
      } catch (emailError) {
        return { status: 400, reason: "verify_resend_fail" };
      }
    }

    if (!user.hasSetPassword || !user.password) {
      return { status: 400, reason: "password_not_set", userId: user._id };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return { status: 400, reason: "invalid_credentials" };
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        fullName: user.fullName,
      },
      envConfig.jwt.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" },
    );

    return { user, token };
  }

  /**
   * Get current user info.
   */
  async me(email) {
    const user = await this.repository.findByEmail(email);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        fullName: user.fullName,
      },
      envConfig.jwt.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" },
    );

    return { user, token };
  }

  /**
   * Get DTUser profile by id.
   */
  async getDTUserProfile(userId) {
    const user = await this.repository.findById(userId);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }
    return { user };
  }

  /**
   * Update DTUser profile.
   */
  async updateDTUserProfile({ userId, requesterId, body, user }) {
    if (requesterId !== userId) {
      return { status: 403, reason: "forbidden" };
    }

    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    if (
      user.annotatorStatus !== "verified" &&
      user.annotatorStatus !== "approved"
    ) {
      return {
        status: 403,
        reason: "not_verified",
        currentStatus: user.annotatorStatus,
      };
    }

    const updateData = {};

    if (body.personalInfo) {
      updateData.personal_info = {
        ...user.personal_info?.toObject(),
        country:
          body.personalInfo.country !== undefined
            ? body.personalInfo.country
            : user.personal_info?.country,
        time_zone:
          body.personalInfo.timeZone !== undefined
            ? body.personalInfo.timeZone
            : user.personal_info?.time_zone,
        available_hours_per_week:
          body.personalInfo.availableHoursPerWeek !== undefined
            ? body.personalInfo.availableHoursPerWeek
            : user.personal_info?.available_hours_per_week,
        preferred_communication_channel:
          body.personalInfo.preferredCommunicationChannel !== undefined
            ? body.personalInfo.preferredCommunicationChannel
            : user.personal_info?.preferred_communication_channel,
      };
    }

    if (body.paymentInfo) {
      updateData.payment_info = {
        ...user.payment_info?.toObject(),
        account_name:
          body.paymentInfo.accountName !== undefined
            ? body.paymentInfo.accountName
            : user.payment_info?.account_name,
        account_number:
          body.paymentInfo.accountNumber !== undefined
            ? body.paymentInfo.accountNumber
            : user.payment_info?.account_number,
        bank_name:
          body.paymentInfo.bankName !== undefined
            ? body.paymentInfo.bankName
            : user.payment_info?.bank_name,
        bank_code:
          body.paymentInfo.bankCode !== undefined
            ? body.paymentInfo.bankCode
            : user.payment_info?.bank_code,
        bank_slug:
          body.paymentInfo.bank_slug !== undefined
            ? body.paymentInfo.bank_slug
            : user.payment_info?.bank_slug,
        payment_method:
          body.paymentInfo.paymentMethod !== undefined
            ? body.paymentInfo.paymentMethod
            : user.payment_info?.payment_method,
        payment_currency:
          body.paymentInfo.paymentCurrency !== undefined
            ? body.paymentInfo.paymentCurrency
            : user.payment_info?.payment_currency,
      };
    }

    if (body.professionalBackground) {
      updateData.professional_background = {
        ...user.professional_background?.toObject(),
        education_field:
          body.professionalBackground.educationField !== undefined
            ? body.professionalBackground.educationField
            : user.professional_background?.education_field,
        years_of_experience:
          body.professionalBackground.yearsOfExperience !== undefined
            ? body.professionalBackground.yearsOfExperience
            : user.professional_background?.years_of_experience,
        annotation_experience_types:
          body.professionalBackground.annotationExperienceTypes !== undefined
            ? body.professionalBackground.annotationExperienceTypes
            : user.professional_background?.annotation_experience_types,
      };
    }

    if (body.toolExperience !== undefined) {
      updateData.tool_experience = body.toolExperience;
    }

    if (body.annotationSkills !== undefined) {
      updateData.annotation_skills = body.annotationSkills;
    }

    if (body.languageProficiency) {
      updateData.language_proficiency = {
        ...user.language_proficiency?.toObject(),
        primary_language:
          body.languageProficiency.primaryLanguage !== undefined
            ? body.languageProficiency.primaryLanguage
            : user.language_proficiency?.primary_language,
        other_languages:
          body.languageProficiency.otherLanguages !== undefined
            ? body.languageProficiency.otherLanguages
            : user.language_proficiency?.other_languages,
        english_fluency_level:
          body.languageProficiency.englishFluencyLevel !== undefined
            ? body.languageProficiency.englishFluencyLevel
            : user.language_proficiency?.english_fluency_level,
      };
    }

    if (body.systemInfo) {
      updateData.system_info = {
        ...user.system_info?.toObject(),
        device_type:
          body.systemInfo.deviceType !== undefined
            ? body.systemInfo.deviceType
            : user.system_info?.device_type,
        operating_system:
          body.systemInfo.operatingSystem !== undefined
            ? body.systemInfo.operatingSystem
            : user.system_info?.operating_system,
        internet_speed_mbps:
          body.systemInfo.internetSpeedMbps !== undefined
            ? body.systemInfo.internetSpeedMbps
            : user.system_info?.internet_speed_mbps,
        power_backup:
          body.systemInfo.powerBackup !== undefined
            ? body.systemInfo.powerBackup
            : user.system_info?.power_backup,
        has_webcam:
          body.systemInfo.hasWebcam !== undefined
            ? body.systemInfo.hasWebcam
            : user.system_info?.has_webcam,
        has_microphone:
          body.systemInfo.hasMicrophone !== undefined
            ? body.systemInfo.hasMicrophone
            : user.system_info?.has_microphone,
      };
    }

    if (body.projectPreferences) {
      updateData.project_preferences = {
        ...user.project_preferences?.toObject(),
        domains_of_interest:
          body.projectPreferences.domainsOfInterest !== undefined
            ? body.projectPreferences.domainsOfInterest
            : user.project_preferences?.domains_of_interest,
        availability_type:
          body.projectPreferences.availabilityType !== undefined
            ? body.projectPreferences.availabilityType
            : user.project_preferences?.availability_type,
        nda_signed:
          body.projectPreferences.ndaSigned !== undefined
            ? body.projectPreferences.ndaSigned
            : user.project_preferences?.nda_signed,
      };
    }

    if (body.attachments) {
      updateData.attachments = {
        ...user.attachments?.toObject(),
        resume_url:
          body.attachments.resumeUrl !== undefined
            ? body.attachments.resumeUrl
            : user.attachments?.resume_url,
        id_document_url:
          body.attachments.idDocumentUrl !== undefined
            ? body.attachments.idDocumentUrl
            : user.attachments?.id_document_url,
        work_samples_url:
          body.attachments.workSamplesUrl !== undefined
            ? body.attachments.workSamplesUrl
            : user.attachments?.work_samples_url,
      };
    }

    const updatedUser = await this.repository.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    return { updatedUser };
  }

  /**
   * Reset DTUser password with old password check.
   */
  async resetDTUserPassword({ userId, body }) {
    const { error } = dtUserPasswordResetSchema.validate(body);
    if (error) {
      return {
        status: 400,
        reason: "validation",
        message: error.details[0].message,
      };
    }

    const { oldPassword, newPassword } = body;
    const user = await this.repository.findById(userId);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    if (!user.hasSetPassword || !user.password) {
      return { status: 400, reason: "no_password" };
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      return { status: 400, reason: "invalid_old_password" };
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return { status: 400, reason: "same_password" };
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedNewPassword;
    await this.repository.saveUser(user);

    return { user };
  }

  /**
   * Resend verification email.
   */
  async resendVerificationEmail(email) {

    const user = await this.repository.findByEmail(email);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    if (user.isEmailVerified) {
      return { status: 400, reason: "already_verified" };
    }

    const emailPromise = Promise.race([
      sendVerificationEmail(user.email, user.fullName, user._id),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Email sending timeout")), 15000),
      ),
    ]);

    return { user, emailPromise };
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
    const {
      page = 1,
      limit = 20,
      status,
      verified,
      hasPassword,
      search,
    } = query;

    const filter = {
      $and: [
        {
          $nor: [
            { email: { $regex: /@mydeeptech\.ng$/, $options: "i" } },
            { domains: { $in: ["Administration", "Management"] } },
          ],
        },
      ],
    };

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
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const users = await this.repository
      .find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const totalUsers = await this.repository.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / parseInt(limit, 10));

    const statusSummary = await this.repository.aggregate([
      {
        $match: {
          $nor: [
            { email: { $regex: /@mydeeptech\.ng$/, $options: "i" } },
            { domains: { $in: ["Administration", "Management"] } },
          ],
        },
      },
      { $group: { _id: "$annotatorStatus", count: { $sum: 1 } } },
    ]);

    const statusBreakdown = statusSummary.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    return {
      users,
      totalUsers,
      totalPages,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      statusBreakdown,
      filter,
    };
  }

  /**
   * Admin: Get all admin users.
   */
  async getAllAdminUsers({ query }) {
    const filter = {
      $or: [
        { email: /@mydeeptech\.ng$/i },
        { domains: { $in: ["Administration", "Management"] } },
      ],
    };

    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy || "createdAt";
    const sortOrder = query.sortOrder === "asc" ? 1 : -1;
    const search = query.search;

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { fullName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ],
      });
    }

    const adminUsers = await this.repository
      .find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .select("-password")
      .lean();

    const totalAdminUsers = await this.repository.countDocuments(filter);

    const roleSummary = await this.repository.aggregate([
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
      this.projectRepository.findAllProjects({}, {
        limit: 5,
        populate: [{ path: 'createdBy', select: 'fullName email' }],
        sort: { createdAt: -1 },
        lean: true
      }),

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
    const skip = (page - 1) * limit;

    const filterQuery = {};

    if (qaStatus && ["pending", "approved", "rejected"].includes(qaStatus)) {
      filterQuery.qaStatus = qaStatus;
    }

    if (search) {
      filterQuery.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const totalUsers = await this.repository.countDocuments(filterQuery);

    const qaUsers = await this.repository
      .find(filterQuery)
      .select(
        "fullName email qaStatus annotatorStatus microTaskerStatus createdAt updatedAt phoneNumber country",
      )
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const statusCountsAgg = await this.repository.aggregate([
      { $match: search ? filterQuery : {} },
      { $group: { _id: "$qaStatus", count: { $sum: 1 } } },
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
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
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
    const { error } = adminVerificationRequestSchema.validate(body);
    if (error) {
      return {
        status: 400,
        reason: "validation",
        message: error.details[0].message,
      };
    }

    const { fullName, email, phone, password, adminKey } = body;

    const validAdminKey =
      envConfig.admin.ADMIN_CREATION_KEY || "super-secret-admin-key-2024";
    if (adminKey !== validAdminKey) {
      return { status: 403, reason: "invalid_admin_key" };
    }

    const adminEmails = envConfig.admin.ADMIN_EMAILS
      ? envConfig.admin.ADMIN_EMAILS.split(",").map((e) =>
        e.trim().toLowerCase(),
      )
      : [];
    const isValidAdminEmail =
      email.toLowerCase().endsWith("@mydeeptech.ng") ||
      adminEmails.includes(email.toLowerCase());

    if (!isValidAdminEmail) {
      return { status: 400, reason: "invalid_admin_email" };
    }

    const existingAdmin = await this.repository.findByEmail(
      email.toLowerCase(),
    );
    if (existingAdmin) {
      return { status: 409, reason: "admin_exists" };
    }

    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const adminData = { fullName, email, phone, password };

    await adminVerificationStore.setVerificationCode(
      email,
      verificationCode,
      adminData,
    );

    try {
      await MailService.sendAdminVerificationEmail(
        email,
        verificationCode,
        fullName,
      );
      return {
        status: 200,
        data: {
          email,
          expiresIn: "15 minutes",
          nextStep:
            "Use the verification code from your email to complete admin account creation",
        },
      };
    } catch (emailError) {
      await adminVerificationStore.removeVerificationCode(email);
      return {
        status: 500,
        reason: "email_failed",
        message: emailError.message,
      };
    }
  }

  /**
   * Admin: Confirm verification and create admin (step 2).
   */
  async confirmAdminVerification(body) {
    const { error } = adminVerificationConfirmSchema.validate(body);
    if (error) {
      return {
        status: 400,
        reason: "validation",
        message: error.details[0].message,
      };
    }

    const { email, verificationCode, adminKey } = body;

    const validAdminKey =
      envConfig.admin.ADMIN_CREATION_KEY || "super-secret-admin-key-2024";
    if (adminKey !== validAdminKey) {
      return { status: 403, reason: "invalid_admin_key" };
    }

    const verificationData =
      await adminVerificationStore.getVerificationData(email);
    if (!verificationData) {
      return { status: 404, reason: "verification_not_found" };
    }

    if (Date.now() > verificationData.expiresAt) {
      adminVerificationStore.removeVerificationCode(email);
      return { status: 400, reason: "verification_expired" };
    }

    if (verificationData.attempts >= 3) {
      adminVerificationStore.removeVerificationCode(email);
      return { status: 429, reason: "too_many_attempts" };
    }

    if (verificationCode !== verificationData.code) {
      const attempts = adminVerificationStore.incrementAttempts(email);
      return {
        status: 400,
        reason: "invalid_verification_code",
        attemptsRemaining: 3 - attempts,
      };
    }

    const { fullName, phone, password } = verificationData.adminData;
    const hashedPassword = await bcrypt.hash(password, 12);

    const newAdmin = await this.repository.createUser({
      fullName,
      phone,
      email: email.toLowerCase(),
      domains: ["Administration", "Management"],
      socialsFollowed: [],
      consent: true,
      password: hashedPassword,
      hasSetPassword: true,
      isEmailVerified: false,
      annotatorStatus: "approved",
      microTaskerStatus: "approved",
      resultLink: "",
    });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      await adminVerificationStore.setVerificationCode(
        newAdmin.email,
        otpCode,
        {
          userId: newAdmin._id,
          fullName: newAdmin.fullName,
          email: newAdmin.email,
          purpose: "email_verification",
        },
      );

      await MailService.sendAdminVerificationEmail(
        newAdmin.email,
        otpCode,
        newAdmin.fullName,
      );
    } catch (emailError) {
      console.error("Failed to send admin OTP:", emailError);
    }

    adminVerificationStore.removeVerificationCode(email);

    return { status: 201, admin: newAdmin };
  }

  /**
   * Admin: Legacy direct creation.
   */
  async createAdmin(body) {
    const { error } = adminCreateSchema.validate(body);
    if (error) {
      return {
        status: 400,
        reason: "validation",
        message: error.details[0].message,
      };
    }

    const { fullName, email, phone, password, adminKey } = body;

    const validAdminKey =
      envConfig.admin.ADMIN_CREATION_KEY || "super-secret-admin-key-2024";
    if (adminKey !== validAdminKey) {
      return { status: 403, reason: "invalid_admin_key" };
    }

    const adminEmails = envConfig.admin.ADMIN_EMAILS
      ? envConfig.admin.ADMIN_EMAILS.split(",").map((e) =>
        e.trim().toLowerCase(),
      )
      : [];
    const isValidAdminEmail =
      email.toLowerCase().endsWith("@mydeeptech.ng") ||
      adminEmails.includes(email.toLowerCase());

    if (!isValidAdminEmail) {
      return { status: 400, reason: "invalid_admin_email" };
    }

    const existingAdmin = await this.repository.findByEmail(
      email.toLowerCase(),
    );
    if (existingAdmin) {
      return { status: 409, reason: "admin_exists" };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newAdmin = await this.repository.createUser({
      fullName,
      phone,
      email: email.toLowerCase(),
      domains: ["Administration", "Management"],
      socialsFollowed: [],
      consent: true,
      password: hashedPassword,
      hasSetPassword: true,
      isEmailVerified: false,
      annotatorStatus: "approved",
      microTaskerStatus: "approved",
      resultLink: "",
    });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      await adminVerificationStore.setVerificationCode(
        newAdmin.email,
        otpCode,
        {
          userId: newAdmin._id,
          fullName: newAdmin.fullName,
          email: newAdmin.email,
          purpose: "email_verification",
        },
      );

      await MailService.sendAdminVerificationEmail(
        newAdmin.email,
        otpCode,
        newAdmin.fullName,
      );
    } catch (emailError) {
      console.error("Failed to send admin OTP:", emailError);
    }

    return { status: 201, admin: newAdmin };
  }

  /**
   * Admin: Verify admin OTP.
   */
  async verifyAdminOTP(body) {
    const { error } = adminVerificationConfirmSchema.validate(body);
    if (error) {
      return {
        status: 400,
        reason: "validation",
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
      };
    }

    const { email, verificationCode, adminKey } = body;

    const validAdminKey =
      envConfig.admin.ADMIN_CREATION_KEY || "super-secret-admin-key-2024";
    if (adminKey !== validAdminKey) {
      return { status: 403, reason: "invalid_admin_key" };
    }

    const verificationData =
      await adminVerificationStore.getVerificationData(email);
    if (!verificationData) {
      return { status: 404, reason: "otp_not_found" };
    }

    if (Date.now() > verificationData.expiresAt) {
      await adminVerificationStore.removeVerificationCode(email);
      return { status: 400, reason: "otp_expired" };
    }

    if (verificationCode !== verificationData.code) {
      const attempts = await adminVerificationStore.incrementAttempts(email);
      return {
        status: 400,
        reason: "invalid_otp",
        attemptsRemaining: 3 - attempts,
      };
    }

    const admin = await this.repository.findById(
      verificationData.adminData.userId,
    );
    if (!admin) {
      return { status: 404, reason: "admin_not_found" };
    }

    admin.isEmailVerified = true;
    await this.repository.saveUser(admin);

    await adminVerificationStore.removeVerificationCode(email);

    const token = jwt.sign(
      {
        userId: admin._id,
        email: admin.email,
        isAdmin: true,
        role: admin.role || "admin",
      },
      envConfig.jwt.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" },
    );

    return { admin, token };
  }

  /**
   * Admin: Login.
   */
  async adminLogin(body) {
    const { error } = dtUserLoginSchema.validate(body);
    if (error) {
      return {
        status: 400,
        reason: "validation",
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
      };
    }

    const { email, password } = body;

    if (!email.endsWith("@mydeeptech.ng")) {
      return { status: 400, reason: "invalid_domain" };
    }

    const admin = await this.repository.findByEmail(email.toLowerCase());

    if (!admin || !admin.isEmailVerified || !admin.hasSetPassword) {
      return { status: 401, reason: "invalid_credentials_or_unverified" };
    }

    await admin.populate({
      path: "role_permission",
      select: "name description permissions isActive -_id",
      populate: {
        path: "permissions",
        model: "Permission",
        select: "name resource action -_id",
      },
    });

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return { status: 401, reason: "invalid_credentials" };
    }

    const token = jwt.sign(
      {
        userId: admin._id,
        email: admin.email,
        isAdmin: true,
        role: admin.role || "admin",
      },
      envConfig.jwt.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" },
    );

    return { admin, token };
  }





  /**
   * Invoices: list for user with filters.
   */
  async getUserInvoices({ userId, query }) {
    const {
      page = 1,
      limit = 20,
      paymentStatus,
      projectId,
      startDate,
      endDate,
    } = query;
    const filter = { dtUserId: userId };
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (projectId) filter.projectId = projectId;
    if (startDate || endDate) {
      filter.invoiceDate = {};
      if (startDate) filter.invoiceDate.$gte = new Date(startDate);
      if (endDate) filter.invoiceDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const invoices = await Invoice.find(filter)
      .populate("projectId", "projectName projectCategory payRate")
      .populate("createdBy", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const totalInvoices = await Invoice.countDocuments(filter);
    const stats = await Invoice.getInvoiceStats(userId);

    return {
      status: 200,
      data: {
        invoices,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(totalInvoices / limit),
          totalInvoices,
          invoicesPerPage: parseInt(limit, 10),
        },
        statistics: {
          totalInvoices: stats.totalInvoices,
          totalEarnings: stats.totalAmount,
          paidAmount: stats.paidAmount,
          unpaidAmount: stats.unpaidAmount,
          overdueAmount: stats.overdueAmount,
          unpaidCount: stats.unpaidCount,
          paidCount: stats.paidCount,
          overdueCount: stats.overdueCount,
        },
      },
    };
  }

  async getUnpaidInvoices({ userId, query }) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const unpaidInvoices = await Invoice.find({
      dtUserId: userId,
      paymentStatus: { $in: ["unpaid", "overdue"] },
    })
      .populate("projectId", "projectName projectCategory")
      .populate("createdBy", "fullName email")
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const totalUnpaid = await Invoice.countDocuments({
      dtUserId: userId,
      paymentStatus: { $in: ["unpaid", "overdue"] },
    });

    const totalAmountDue = await Invoice.aggregate([
      {
        $match: {
          dtUserId: new mongoose.Types.ObjectId(userId),
          paymentStatus: { $in: ["unpaid", "overdue"] },
        },
      },
      {
        $group: {
          _id: null,
          totalDue: { $sum: "$invoiceAmount" },
          overdueAmount: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "overdue"] },
                "$invoiceAmount",
                0,
              ],
            },
          },
        },
      },
    ]);

    const amountSummary = totalAmountDue[0] || {
      totalDue: 0,
      overdueAmount: 0,
    };

    return {
      status: 200,
      data: {
        unpaidInvoices,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(totalUnpaid / limit),
          totalUnpaidInvoices: totalUnpaid,
          invoicesPerPage: parseInt(limit, 10),
        },
        summary: {
          totalAmountDue: amountSummary.totalDue,
          overdueAmount: amountSummary.overdueAmount,
          unpaidCount: totalUnpaid,
        },
      },
    };
  }

  async getPaidInvoices({ userId, query }) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const paidInvoices = await Invoice.find({
      dtUserId: userId,
      paymentStatus: "paid",
    })
      .populate("projectId", "projectName projectCategory")
      .populate("createdBy", "fullName email")
      .sort({ paidAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const totalPaid = await Invoice.countDocuments({
      dtUserId: userId,
      paymentStatus: "paid",
    });

    const totalEarnings = await Invoice.aggregate([
      {
        $match: {
          dtUserId: new mongoose.Types.ObjectId(userId),
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$invoiceAmount" },
        },
      },
    ]);

    const earnings = totalEarnings[0]?.totalEarnings || 0;

    return {
      status: 200,
      data: {
        paidInvoices,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(totalPaid / limit),
          totalPaidInvoices: totalPaid,
          invoicesPerPage: parseInt(limit, 10),
        },
        summary: {
          totalEarnings: earnings,
          paidCount: totalPaid,
        },
      },
    };
  }

  async getInvoiceDetails({ userId, invoiceId }) {
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return { status: 400, reason: "invalid_id" };
    }

    const invoice = await Invoice.findOne({ _id: invoiceId, dtUserId: userId })
      .populate("projectId", "projectName projectDescription projectCategory")
      .populate("createdBy", "fullName email")
      .populate("approvedBy", "fullName email");

    if (!invoice) {
      return { status: 404, reason: "not_found" };
    }

    if (!invoice.emailViewedAt) {
      invoice.emailViewedAt = new Date();
      await invoice.save();
    }

    return {
      status: 200,
      data: {
        invoice,
        computedFields: {
          daysOverdue: invoice.daysOverdue,
          amountDue: invoice.amountDue,
          formattedInvoiceNumber: invoice.formattedInvoiceNumber,
        },
      },
    };
  }

  async getInvoiceDashboard({ userId }) {
    const objectId = new mongoose.Types.ObjectId(userId);

    const totalInvoices = await Invoice.countDocuments({ dtUserId: objectId });
    const stats = await Invoice.getInvoiceStats(objectId);
    const recentInvoices = await Invoice.find({ dtUserId: objectId })
      .populate("projectId", "projectName")
      .sort({ createdAt: -1 })
      .limit(5);

    const overdueInvoices = await Invoice.find({
      dtUserId: objectId,
      paymentStatus: "overdue",
    })
      .populate("projectId", "projectName")
      .sort({ dueDate: 1 });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyEarnings = await Invoice.aggregate([
      {
        $match: {
          dtUserId: objectId,
          paymentStatus: "paid",
          paidAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } },
          totalEarnings: { $sum: "$invoiceAmount" },
          invoiceCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    return {
      status: 200,
      data: {
        statistics: stats,
        recentInvoices,
        overdueInvoices,
        monthlyEarnings,
        summary: {
          totalEarned: stats.paidAmount,
          pendingPayments: stats.unpaidAmount,
          overduePayments: stats.overdueAmount,
          totalInvoices: stats.totalInvoices,
          unpaidCount: stats.unpaidCount,
          overdueCount: stats.overdueCount,
        },
        debug: {
          totalInvoicesInDb: totalInvoices,
        },
      },
    };
  }

  /**
   * DTUser personal dashboard summary.
   */
  async getDTUserDashboard({ userId, email }) {
    const currentDate = new Date();
    const thirtyDaysAgo = new Date(currentDate);
    thirtyDaysAgo.setDate(currentDate.getDate() - 30);
    const sevenDaysAgo = new Date(currentDate);
    sevenDaysAgo.setDate(currentDate.getDate() - 7);

    const user = await this.repository.findByIdSelect(userId, "-password");
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    const profileCompletion = {
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

    const completionSections = Object.values(profileCompletion);
    const completedSections = completionSections.filter(
      (section) => section.completed,
    ).length;
    const completionPercentage = Math.round(
      (completedSections / completionSections.length) * 100,
    );

    const applicationStats = await this.projectRepository.aggregateApplications([
      { $match: { applicantId: new mongoose.Types.ObjectId(userId) } },
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
    ]);

    const recentApplications = await this.projectRepository.findApplications({
      applicantId: userId,
    }, {
      populate: [{ path: "projectId", select: "projectName budget timeline status" }],
      sort: { appliedAt: -1 },
      limit: 5,
      select: "status appliedAt projectId"
    });

    const invoiceStats = await Invoice.aggregate([
      { $match: { dtUserId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalEarnings: { $sum: "$invoiceAmount" },
          paidEarnings: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$invoiceAmount", 0],
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
    ]);

    const recentPayments = await Invoice.aggregate([
      {
        $match: {
          dtUserId: new mongoose.Types.ObjectId(userId),
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
    ]);

    const recentInvoices = await Invoice.find({ dtUserId: userId })
      .populate("projectId", "projectName")
      .sort({ createdAt: -1 })
      .limit(5)
      .select("invoiceAmount paymentStatus dueDate paidAt createdAt projectId");

    const resultSubmissions = {
      totalSubmissions: user.resultSubmissions?.length || 0,
      recentSubmissions: user.resultSubmissions?.slice(-5) || [],
      lastSubmissionDate:
        user.resultSubmissions?.length > 0
          ? Math.max(
            ...user.resultSubmissions.map(
              (sub) => new Date(sub.submissionDate),
            ),
          )
          : null,
    };

    const availableProjects = await this.projectRepository.findAllProjects({
      status: "active",
      isActive: true, // Matching new standard
    }, {
      select: "projectName description budget timeline requirements status",
      sort: { createdAt: -1 },
      limit: 5
    });

    const userApplications = await this.projectRepository.findApplications({
      applicantId: userId,
    }, {
      select: "projectId status"
    });
    const appliedProjectIds = userApplications.map((app) =>
      app.projectId.toString(),
    );

    // const availableProjectsWithStatus = availableProjects.map((project) => ({
    //   ...project.toObject(),
    //   hasApplied: appliedProjectIds.includes(project._id.toString()),
    //   applicationStatus:
    //     userApplications.find(
    //       (app) => app.projectId.toString() === project._id.toString(),
    //     )?.status || null,
    // }));
    const availableProjectsWithStatus = availableProjects.map((project) => {
      const proj = project.toObject ? project.toObject() : project;

      return {
        ...proj,
        hasApplied: appliedProjectIds.includes(proj._id.toString()),
        applicationStatus:
          userApplications.find(
            (app) =>
              app.projectId &&
              app.projectId.toString() === proj._id.toString(),
          )?.status || null,
      };
    });
    const performanceMetrics = {
      profileCompletionPercentage: completionPercentage,
      applicationSuccessRate:
        (applicationStats[0]?.totalApplications || 0) > 0
          ? Math.round(
            ((applicationStats[0]?.approvedApplications || 0) /
              applicationStats[0].totalApplications) *
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
    if (
      user.annotatorStatus === "approved" &&
      (applicationStats[0]?.totalApplications || 0) === 0
    ) {
      nextSteps.push({
        priority: "medium",
        action: "apply_projects",
        title: "Apply to Projects",
        description: "Browse and apply to available annotation projects",
      });
    }

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

  /**
   * Get available projects (only for approved annotators)
   */
  async getAvailableProjects(userId, query) {
    // 1️⃣ Fetch user
    const user = await this.repository.findById(userId);
    if (!user) return { status: 404, reason: "not_found" };
    if (user.annotatorStatus !== "approved") return { status: 403, reason: "forbidden" };

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
            { tags: { $in: [regex] } }
          ]
        }
      ];
    }

    // 4️⃣ Fetch user applications
    const userApplicationsQuery = { applicantId: userId };
    if (view === "applied" && applicationStatus) userApplicationsQuery.status = applicationStatus;

    const userApplications = await this.projectRepository.findApplications(userApplicationsQuery);
    const allUserApplications = await this.projectRepository.findApplications({ applicantId: userId });

    const getId = (id) => id?._id?.toString?.() || id?.toString?.();

    const appliedProjectIds = userApplications.map(app => getId(app.projectId)).filter(Boolean);
    const allAppliedProjectIds = allUserApplications.map(app => getId(app.projectId)).filter(Boolean);

    const applicationMap = new Map();
    userApplications.forEach(app => {
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
      populate: [{ path: "createdBy", select: "fullName email" }]
    });
    const totalProjects = await this.projectRepository.countProjects(finalFilter);

    // 7️⃣ Aggregate application counts (avoid N+1)
    const projectIds = projects.map(p => getId(p));
    const applicationCounts = await this.projectRepository.aggregateApplications([
      { $match: { projectId: { $in: projectIds }, status: { $in: ["pending", "approved"] } } },
      { $group: { _id: "$projectId", count: { $sum: 1 } } }
    ]);
    const countMap = new Map(applicationCounts.map(item => [item._id.toString(), item.count]));

    // 8️⃣ Enrich projects with user data, slots, and deadlines
    const now = new Date();
    const enrichedProjects = projects.map(project => {
      const proj = project.toObject ? project.toObject() : project;
      const appCount = countMap.get(proj._id.toString()) || 0;

      proj.currentApplications = appCount;
      proj.availableSlots = proj.maxAnnotators ? Math.max(0, proj.maxAnnotators - appCount) : null;
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
        proj.daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
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
        pagination: { currentPage: page, totalPages, totalProjects, hasNextPage: page < totalPages, hasPrevPage: page > 1, limit },
        filters: { view, applicationStatus, category, difficultyLevel },
        userInfo: {
          annotatorStatus: user.annotatorStatus,
          appliedProjects: allUserApplications.length,
          totalApplications: allUserApplications.length,
          applicationStats: {
            pending: allUserApplications.filter(a => a.status === "pending").length,
            approved: allUserApplications.filter(a => a.status === "approved").length,
            rejected: allUserApplications.filter(a => a.status === "rejected").length,
          },
        },
      },
    };
  }

  /**
   * Result upload via Cloudinary (already uploaded via middleware).
   */
  async submitResultWithCloudinary({ userId, file, body }) {
    if (!file) {
      return { status: 400, reason: "file_required" };
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    const { projectId, notes } = body || {};

    let optimizedUrl = file.path;
    let thumbnailUrl = null;
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      optimizedUrl = generateOptimizedUrl(file.filename, {
        width: 1200,
        height: 800,
        crop: "limit",
        quality: "auto",
      });
      thumbnailUrl = generateThumbnail(file.filename, 300);
    }

    const resultSubmission = {
      originalResultLink: "",
      cloudinaryResultData: {
        publicId: file.filename,
        url: file.path,
        optimizedUrl,
        thumbnailUrl,
        originalName: file.originalname,
        size: file.size,
        format: file.format || file.filename.split(".").pop(),
      },
      submissionDate: new Date(),
      projectId: projectId || null,
      status: "stored",
      notes: notes || "",
      uploadMethod: "direct_upload",
    };

    if (!user.resultSubmissions) user.resultSubmissions = [];
    user.resultSubmissions.push(resultSubmission);
    user.resultLink = file.path;

    if (
      user.annotatorStatus === "pending" ||
      user.annotatorStatus === "verified"
    ) {
      user.annotatorStatus = "submitted";
    }

    await this.repository.saveUser(user);

    const submissionResponse = {
      id: user.resultSubmissions[user.resultSubmissions.length - 1]._id,
      originalFileName: file.originalname,
      cloudinaryUrl: file.path,
      optimizedUrl,
      thumbnailUrl,
      submissionDate: resultSubmission.submissionDate,
      status: "stored",
      fileSize: file.size,
      fileFormat: resultSubmission.cloudinaryResultData.format,
    };

    return {
      status: 200,
      data: {
        resultSubmission: submissionResponse,
        totalResultSubmissions: user.resultSubmissions.length,
        updatedResultLink: user.resultLink,
        updatedAnnotatorStatus: user.annotatorStatus,
      },
    };
  }

  async uploadIdDocument({ user, file }) {
    if (!file) {
      return { status: 400, reason: "file_required" };
    }

    const dtUser = await this.repository.findWithLean({
      email: user.email,
      _id: user.userId,
    });

    if (!dtUser) {
      return { status: 404, reason: "not_found" };
    }

    const updated = await this.repository.findByIdAndUpdate(
      user.userId,
      { $set: { "attachments.id_document_url": file.path } },
      { new: true },
    );

    return {
      status: 200,
      data: {
        id_document_url: updated.attachments.id_document_url,
        cloudinaryData: {
          url: file.path,
          publicId: file.filename,
          originalName: file.originalname,
          fileSize: file.size,
          format: file.format || file.mimetype,
        },
      },
    };
  }

  async uploadResume({ user, file }) {
    if (!file) {
      return { status: 400, reason: "file_required" };
    }

    const dtUser = await this.repository.findWithLean({
      email: user.email,
      _id: user.userId,
    });

    if (!dtUser) {
      return { status: 404, reason: "not_found" };
    }

    const updated = await this.repository.findByIdAndUpdate(
      user.userId,
      { $set: { "attachments.resume_url": file.path } },
      { new: true },
    );

    return {
      status: 200,
      data: {
        resume_url: updated.attachments.resume_url,
        cloudinaryData: {
          url: file.path,
          publicId: file.filename,
          originalName: file.originalname,
          fileSize: file.size,
          format: file.format || file.mimetype,
        },
      },
    };
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
    const requestedPage = query.page;
    const requestedLimit = query.limit;
    const searchTerm = query.search?.trim() || "";

    const page = Math.max(1, parseInt(requestedPage, 10) || 1);
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

    const totalUsers = await this.repository.countDocuments(searchQuery);

    const dtUsers = await this.repository
      .find(searchQuery)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const transformedDTUsers = await Promise.all(
      dtUsers.map(async (dtUser) => {
        // Count active shifts
        const activeShifts = await HVNCShiftRepository.countDocuments({
          user_email: dtUser.email,
          status: "active",
          $or: [{ end_date: null }, { end_date: { $gte: new Date() } }],
        });

        // Count active sessions
        const activeSessions = await HVNCSessionRepository.countDocuments({
          user_email: dtUser.email,
          status: { $in: ["active", "idle"] },
        });

        // Get last login time
        const lastLogin = dtUser.lastLogin
          ? this._formatLastSeen(dtUser.lastLogin)
          : "Never";

        // Calculate status
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
          status: status,
          activeShifts: activeShifts,
          activeSessions: activeSessions,
          lastLogin: lastLogin,
          joinedDate: dtUser.createdAt,
          createdAt: dtUser.createdAt,
          updatedAt: dtUser.updatedAt,
        };
      }),
    );

    const totalPageCount = Math.ceil(totalUsers / limit);
    const activeCount = await this.repository.countDocuments({ isLocked: false, isEmailVerified: true });
    const lockedCount = await this.repository.countDocuments({ isLocked: true });
    const unverifiedCount = await this.repository.countDocuments({ isEmailVerified: false });

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

  async updateUserRole({ userId, role, reason }) {
    if (!Object.values(RoleType).includes(role?.toLowerCase())) {
      return { status: 400, reason: "invalid_role" };
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    const previousRole = user.role;
    user.role = role.toLowerCase();
    await this.repository.saveUser(user);

    const userResponse = {
      _id: user._id,
      firstname: user.fullName ? user.fullName.split(" ")[0] : "",
      lastname: user.fullName
        ? user.fullName.split(" ").slice(1).join(" ")
        : "",
      username: user.email.split("@")[0],
      email: user.email,
      phone: user.phone,
      role: user.role ?? "user",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      status: 200,
      responseCode: "200",
      responseMessage: `User role updated successfully from ${previousRole} to ${role}`,
      data: {
        user: userResponse,
        previousRole,
        newRole: role,
        reason: reason || null,
      },
    };
  }
  async updateDTUserProfilePicture({ userId, file }) {
    if (!file) {
      return { status: 400, reason: "file_required" };
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    // Delete old image if it exists in Cloudinary
    if (user.profilePicture && user.profilePicture.publicId) {
      try {
        await deleteCloudinaryFile(user.profilePicture.publicId);
      } catch (cloudinaryErr) {
        console.error("Cloudinary error during replacement:", cloudinaryErr);
        // Continue anyway to update with the new picture
      }
    }

    // Update user with new picture data
    user.profilePicture = {
      url: file.path,
      publicId: file.filename,
    };
    user.updatedAt = new Date();

    await this.repository.saveUser(user);

    return {
      status: 200,
      data: {
        message: "Profile picture updated successfully",
        profilePicture: user.profilePicture,
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

module.exports = new DtUserService();
