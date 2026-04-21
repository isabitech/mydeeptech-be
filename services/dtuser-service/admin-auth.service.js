const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const DtUserRepository = require("../../repositories/dtUser.repository");
const MailService = require("../../services/mail-service/mail-service");
const envConfig = require("../../config/envConfig");
const adminVerificationStore = require("../../utils/adminVerificationStore");
const Role = require("../../models/roles.model");
const {
  dtUserLoginSchema,
  adminCreateSchema,
  adminVerificationRequestSchema,
  adminVerificationConfirmSchema,
} = require("../../utils/authValidator.js");
const DTUser = mongoose.model("DTUser");

const DEFAULT_ADMIN_CREATION_KEY = "super-secret-admin-key-2024";
const ADMIN_EMAIL_DOMAIN = "@mydeeptech.ng";
const ADMIN_ACCOUNT_DOMAINS = ["Administration", "Management"];

class AdminAuthService {
  constructor() {
    this.repository = new DtUserRepository();
  }

  normalizeEmail(email) {
    return email.toLowerCase();
  }

  getVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  getAdminCreationKey() {
    return envConfig.admin.ADMIN_CREATION_KEY || DEFAULT_ADMIN_CREATION_KEY;
  }

  getAllowedAdminEmails() {
    return envConfig.admin.ADMIN_EMAILS
      ? envConfig.admin.ADMIN_EMAILS.split(",").map((email) =>
          email.trim().toLowerCase(),
        )
      : [];
  }

  isAllowedAdminEmail(email) {
    const normalizedEmail = this.normalizeEmail(email);
    return (
      normalizedEmail.endsWith(ADMIN_EMAIL_DOMAIN) ||
      this.getAllowedAdminEmails().includes(normalizedEmail)
    );
  }

  getAdminAccountPayload({ fullName, email, phone, password }) {
    return {
      fullName,
      phone,
      email: this.normalizeEmail(email),
      domains: ADMIN_ACCOUNT_DOMAINS,
      socialsFollowed: [],
      consent: true,
      password,
      hasSetPassword: true,
      isEmailVerified: false,
      annotatorStatus: "approved",
      microTaskerStatus: "approved",
      resultLink: "",
    };
  }

  buildAdminVerificationPayload(admin) {
    return {
      userId: admin._id,
      fullName: admin.fullName,
      email: admin.email,
      purpose: "email_verification",
    };
  }

  createAdminToken(admin) {
    return jwt.sign(
      {
        userId: admin._id,
        email: admin.email,
        isAdmin: true,
        role: admin.role || "admin",
      },
      envConfig.jwt.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" },
    );
  }

  async populateAdminWithRolePermission(adminId) {
    const populatedAdmin = await this.repository.findByIdSelect(
      adminId,
      "-password",
    );

    if (populatedAdmin?.populate) {
      await populatedAdmin.populate(this.getRolePermissionPopulateOptions());
    }

    return populatedAdmin;
  }

  buildValidationErrorResponse(error, includeErrors = false) {
    const response = {
      status: 400,
      reason: "validation",
      message: includeErrors ? "Validation error" : error.details[0].message,
    };

    if (includeErrors) {
      response.errors = error.details.map((detail) => detail.message);
    }

    return response;
  }

  async issueAdminVerificationCode({
    email,
    recipientName,
    verificationCode,
    payload,
    rollbackOnFailure = false,
  }) {
    await adminVerificationStore.setVerificationCode(
      email,
      verificationCode,
      payload,
    );

    try {
      await this.sendAdminVerificationEmail(
        email,
        recipientName,
        verificationCode,
      );
    } catch (error) {
      if (rollbackOnFailure) {
        await adminVerificationStore.removeVerificationCode(email);
      }
      throw error;
    }
  }

  async sendAdminVerificationEmail(email, recipientName, verificationCode) {
    return MailService.sendAdminVerificationEmail(
      email,
      recipientName,
      verificationCode,
    );
  }

  getRolePermissionPopulateOptions() {
    return {
      path: "role_permission",
      select: "name description permissions isActive -_id",
      populate: {
        path: "permissions",
        model: "Permission",
        select: "name resource action -_id",
      },
    };
  }

  /**
   * Admin: Request admin verification (step 1).
   */
  async requestAdminVerification(body) {
    const { error } = adminVerificationRequestSchema.validate(body);
    if (error) {
      return this.buildValidationErrorResponse(error);
    }

    const { fullName, email, phone, password, adminKey } = body;
    const normalizedEmail = this.normalizeEmail(email);

    if (adminKey !== this.getAdminCreationKey()) {
      return { status: 403, reason: "invalid_admin_key" };
    }

    if (!this.isAllowedAdminEmail(email)) {
      return { status: 400, reason: "invalid_admin_email" };
    }

    const existingAdmin = await this.repository.findByEmail(normalizedEmail);
    if (existingAdmin) {
      return { status: 409, reason: "admin_exists" };
    }

    const verificationCode = this.getVerificationCode();
    const adminData = {
      fullName,
      email: normalizedEmail,
      phone,
      password,
    };

    try {
      await this.issueAdminVerificationCode({
        email: normalizedEmail,
        recipientName: fullName,
        verificationCode,
        payload: adminData,
        rollbackOnFailure: true,
      });
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
      return {
        status: 500,
        reason: "email_failed",
        message: emailError.message,
      };
      oj;
    }
  }

  /**
   * Admin: Confirm verification and create admin (step 2).
   */
  async confirmAdminVerification(body) {
    const { error } = adminVerificationConfirmSchema.validate(body);
    if (error) {
      return this.buildValidationErrorResponse(error);
    }

    const { email, verificationCode, adminKey } = body;
    const normalizedEmail = this.normalizeEmail(email);

    if (adminKey !== this.getAdminCreationKey()) {
      return { status: 403, reason: "invalid_admin_key" };
    }

    const verificationData =
      await adminVerificationStore.getVerificationData(normalizedEmail);
    if (!verificationData) {
      return { status: 404, reason: "verification_not_found" };
    }

    if (Date.now() > verificationData.expiresAt) {
      await adminVerificationStore.removeVerificationCode(normalizedEmail);
      return { status: 400, reason: "verification_expired" };
    }

    if (verificationData.attempts >= 3) {
      await adminVerificationStore.removeVerificationCode(normalizedEmail);
      return { status: 429, reason: "too_many_attempts" };
    }

    if (verificationCode !== verificationData.code) {
      const attempts =
        await adminVerificationStore.incrementAttempts(normalizedEmail);
      return {
        status: 400,
        reason: "invalid_verification_code",
        attemptsRemaining: 3 - attempts,
      };
    }

    const { fullName, phone, password } = verificationData.adminData;
    const hashedPassword = await bcrypt.hash(password, 12);

    const newAdmin = await this.repository.createUser(
      this.getAdminAccountPayload({
        fullName,
        email: normalizedEmail,
        phone,
        password: hashedPassword,
      }),
    );

    const otpCode = this.getVerificationCode();

    try {
      await this.issueAdminVerificationCode({
        email: newAdmin.email,
        recipientName: newAdmin.fullName,
        verificationCode: otpCode,
        payload: this.buildAdminVerificationPayload(newAdmin),
      });
    } catch (emailError) {
      console.error("Failed to send admin OTP:", emailError);
    }

    await adminVerificationStore.removeVerificationCode(normalizedEmail);

    return { status: 201, admin: newAdmin };
  }

  /**
   * Admin: Legacy direct creation.
   */
  async createAdmin(body) {
    const { error } = adminCreateSchema.validate(body);
    if (error) {
      return this.buildValidationErrorResponse(error);
    }

    const { fullName, email, phone, password, adminKey } = body;
    const normalizedEmail = this.normalizeEmail(email);

    if (adminKey !== this.getAdminCreationKey()) {
      return { status: 403, reason: "invalid_admin_key" };
    }

    if (!this.isAllowedAdminEmail(email)) {
      return { status: 400, reason: "invalid_admin_email" };
    }

    const existingAdmin = await this.repository.findByEmail(normalizedEmail);
    if (existingAdmin) {
      return { status: 409, reason: "admin_exists" };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const session = await mongoose.startSession();
    let newAdmin;
    let assignedRole;

    try {
      await session.startTransaction();

      assignedRole = await Role.findOne({ name: "moderator" }).session(session);
      if (!assignedRole) {
        throw new Error('Role "moderator" not found');
      }

      newAdmin = new DTUser({
        ...this.getAdminAccountPayload({
          fullName,
          email: normalizedEmail,
          phone,
          password: hashedPassword,
        }),
        role_permission: assignedRole._id,
      });

      await newAdmin.save({ session });

      await session.commitTransaction();
    } catch (transactionError) {
      await session.abortTransaction();
      throw transactionError;
    } finally {
      await session.endSession();
    }

    const otpCode = this.getVerificationCode();

    try {
      await this.issueAdminVerificationCode({
        email: newAdmin.email,
        recipientName: newAdmin.fullName,
        verificationCode: otpCode,
        payload: this.buildAdminVerificationPayload(newAdmin),
      });
    } catch (emailError) {
      console.error("Failed to send admin OTP:", emailError);
    }

    const populatedAdmin = await this.populateAdminWithRolePermission(
      newAdmin._id,
    );

    return {
      status: 201,
      admin: populatedAdmin || newAdmin,
      role: assignedRole,
    };
  }

  /**
   * Admin: Verify admin OTP.
   */
  async verifyAdminOTP(body) {
    const { error } = adminVerificationConfirmSchema.validate(body);
    if (error) {
      return this.buildValidationErrorResponse(error, true);
    }

    const { email, verificationCode, adminKey } = body;
    const normalizedEmail = this.normalizeEmail(email);

    if (adminKey !== this.getAdminCreationKey()) {
      return { status: 403, reason: "invalid_admin_key" };
    }

    const verificationData =
      await adminVerificationStore.getVerificationData(normalizedEmail);
    if (!verificationData) {
      return { status: 404, reason: "otp_not_found" };
    }

    if (Date.now() > verificationData.expiresAt) {
      await adminVerificationStore.removeVerificationCode(normalizedEmail);
      return { status: 400, reason: "otp_expired" };
    }

    if (verificationCode !== verificationData.code) {
      const attempts =
        await adminVerificationStore.incrementAttempts(normalizedEmail);
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

    await adminVerificationStore.removeVerificationCode(normalizedEmail);

    const token = this.createAdminToken(admin);

    return { admin, token };
  }

  /**
   * Admin: Login.
   */
  async adminLogin(body) {
    const { error } = dtUserLoginSchema.validate(body);
    if (error) {
      return this.buildValidationErrorResponse(error, true);
    }

    const { email, password } = body;
    const normalizedEmail = this.normalizeEmail(email);

    if (!normalizedEmail.endsWith(ADMIN_EMAIL_DOMAIN)) {
      return { status: 400, reason: "invalid_domain" };
    }

    const admin = await this.repository.findByEmail(normalizedEmail);

    if (!admin || !admin.isEmailVerified || !admin.hasSetPassword) {
      return { status: 401, reason: "invalid_credentials_or_unverified" };
    }

    await admin.populate({
      ...this.getRolePermissionPopulateOptions(),
    });

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return { status: 401, reason: "invalid_credentials" };
    }

    const token = this.createAdminToken(admin);

    return { admin, token };
  }
}

module.exports = new AdminAuthService();
