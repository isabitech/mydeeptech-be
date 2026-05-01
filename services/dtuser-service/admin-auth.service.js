const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const DtUserRepository = require("../../repositories/dtUser.repository");
const MailService = require("../../services/mail-service/mail-service");
const envConfig = require("../../config/envConfig");
const adminVerificationStore = require("../../utils/adminVerificationStore");
const Role = require("../../models/roles.model");
const AdminRegistrationState = require("../../models/adminRegistrationState.model");
const { RoleType } = require("../../utils/role");
const {
  dtUserLoginSchema,
  adminCreateSchema,
  adminVerificationRequestSchema,
  adminVerificationConfirmSchema,
  existingAdminVerificationSchema,
  adminResendOTPSchema,
  existingAdminResendOTPSchema,
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
      role: RoleType.ADMIN, // Set admin role using enum
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
    const firstErrorMessage = error.details[0]?.message || "Validation error";
    const response = {
      status: 400,
      reason: "validation",
      message: firstErrorMessage, // Always use the actual error message
    };

    if (includeErrors) {
      response.errors = error.details.map((detail) => detail.message);
    }

    return response;
  }

  /**
   * Cross-device registration state management
   */
  
  // Extract device information from request
  getDeviceInfo(req) {
    return {
      userAgent: req?.get('User-Agent') || 'Unknown',
      ipAddress: req?.ip || req?.connection?.remoteAddress || 'Unknown',
      lastDeviceType: this.detectDeviceType(req?.get('User-Agent'))
    };
  }

  // Simple device type detection based on user agent
  detectDeviceType(userAgent) {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    }
    return 'desktop';
  }

  // Save registration state for cross-device access
  async saveRegistrationState(email, currentStep, formData, adminId = null, req = null) {
    try {
      const deviceInfo = req ? this.getDeviceInfo(req) : null;
      
      await AdminRegistrationState.saveRegistrationState({
        email: this.normalizeEmail(email),
        currentStep,
        formData,
        adminId,
        deviceInfo
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error saving registration state:', error);
      return { success: false, error: error.message };
    }
  }

  // Retrieve registration state for cross-device access
  async getRegistrationState(email) {
    try {
      const state = await AdminRegistrationState.findActiveByEmail(email);
      
      if (!state) {
        return { success: false, reason: 'no_state_found' };
      }
      
      return {
        success: true,
        data: {
          currentStep: state.currentStep,
          formData: state.formData,
          adminId: state.adminId,
          deviceInfo: state.deviceInfo,
          lastUpdated: state.updatedAt
        }
      };
    } catch (error) {
      console.error('Error retrieving registration state:', error);
      return { success: false, error: error.message };
    }
  }

  // Complete registration and cleanup state
  async completeRegistrationState(email) {
    try {
      await AdminRegistrationState.completeRegistration(email);
      return { success: true };
    } catch (error) {
      console.error('Error completing registration state:', error);
      return { success: false, error: error.message };
    }
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
  async createAdmin(body, req = null) {
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
      console.log("Admin account already exists with this email");
      return { status: 409, reason: "admin_exists" };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const session = await mongoose.startSession();
    let newAdmin;
    let assignedRole;

    try {
      await session.startTransaction();

      assignedRole = await Role.findOne({ name: "admin" }).session(session);
      if (!assignedRole) {
        // Fallback to moderator if admin role doesn't exist
        assignedRole = await Role.findOne({ name: "moderator" }).session(session);
        if (!assignedRole) {
          throw new Error('Neither "admin" nor "moderator" role found');
        }
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

    // Save registration state for cross-device access
    await this.saveRegistrationState(
      normalizedEmail, 
      'verify-otp', 
      { fullName, email: normalizedEmail, phone, password, confirmPassword: password, adminKey },
      newAdmin._id,
      req
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
    admin.role = RoleType.ADMIN; // Ensure role is set to admin upon verification
    await this.repository.saveUser(admin);

    await adminVerificationStore.removeVerificationCode(normalizedEmail);

    // Complete registration state (cleanup cross-device data)
    await this.completeRegistrationState(normalizedEmail);

    const token = this.createAdminToken(admin);

    return { admin, token };
  }

  /**
   * Verify OTP for existing admin (coming from login) - no admin key required
   */
  async verifyExistingAdminOTP(body) {
    const { error } = existingAdminVerificationSchema.validate(body);
    if (error) {
      return this.buildValidationErrorResponse(error, true);
    }

    const { email, verificationCode } = body;
    const normalizedEmail = this.normalizeEmail(email);

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

    // For existing users, find the admin by email instead of using verification data
    const admin = await this.repository.findByEmail(normalizedEmail);
    if (!admin) {
      return { status: 404, reason: "admin_not_found" };
    }

    admin.isEmailVerified = true;
    admin.role = RoleType.ADMIN; // Ensure role is set to admin upon verification
    await this.repository.saveUser(admin);

    await adminVerificationStore.removeVerificationCode(normalizedEmail);

    // Complete registration state (cleanup cross-device data)
    await this.completeRegistrationState(normalizedEmail);

    const token = this.createAdminToken(admin);

    return { admin, token };
  }

  /**
   * Admin: Resend OTP for email verification.
   */
  async resendAdminOTP(body) {
    const { error } = adminResendOTPSchema.validate(body);
    if (error) {
      return this.buildValidationErrorResponse(error, true);
    }

    const { email, adminKey } = body;
    const normalizedEmail = this.normalizeEmail(email);

    if (adminKey !== this.getAdminCreationKey()) {
      return { status: 403, reason: "invalid_admin_key" };
    }

    // Check if there's an existing verification request
    const existingVerificationData = await adminVerificationStore.getVerificationData(normalizedEmail);
    if (!existingVerificationData) {
      return { status: 404, reason: "no_pending_verification" };
    }

    // Check if admin exists
    const admin = await this.repository.findById(existingVerificationData.adminData.userId);
    if (!admin) {
      return { status: 404, reason: "admin_not_found" };
    }

    // Check if admin is already verified
    if (admin.isEmailVerified) {
      return { status: 400, reason: "already_verified" };
    }

    // Generate new OTP and update verification data
    const newVerificationCode = this.getVerificationCode();
    
    try {
      await this.issueAdminVerificationCode({
        email: normalizedEmail,
        recipientName: admin.fullName,
        verificationCode: newVerificationCode,
        payload: existingVerificationData.adminData, // Reuse existing admin data
        rollbackOnFailure: true,
      });

      return {
        status: 200,
        data: {
          email: normalizedEmail,
          expiresIn: "15 minutes",
          message: "New verification code sent to your email",
        },
      };
    } catch (emailError) {
      return {
        status: 500,
        reason: "email_failed",
        message: emailError.message,
      };
    }
  }

  /**
   * Resend OTP for existing admin (coming from login) - no admin key required
   */
  async resendExistingAdminOTP(body) {
    const { error } = existingAdminResendOTPSchema.validate(body);
    if (error) {
      return this.buildValidationErrorResponse(error, true);
    }

    const { email } = body;
    const normalizedEmail = this.normalizeEmail(email);

    // Check if admin exists and is not yet verified
    const admin = await this.repository.findByEmail(normalizedEmail);
    if (!admin) {
      return { status: 404, reason: "admin_not_found" };
    }

    // Check if admin is already verified
    if (admin.isEmailVerified) {
      return { status: 400, reason: "already_verified" };
    }

    // Generate new OTP
    const newVerificationCode = this.getVerificationCode();
    
    try {
      await this.issueAdminVerificationCode({
        email: normalizedEmail,
        recipientName: admin.fullName,
        verificationCode: newVerificationCode,
        payload: {
          userId: admin._id,
          fullName: admin.fullName,
          email: normalizedEmail,
        },
      });

      return {
        status: 200,
        data: {
          email: normalizedEmail,
          expiresIn: "15 minutes",
          message: "New verification code sent to your email",
        },
      };
    } catch (emailError) {
      return {
        status: 500,
        reason: "email_failed",
        message: emailError.message,
      };
    }
  }

  /**
   * Admin: Login.
   */
  async adminLogin(body) {
    try {
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

      if (!admin) {
        console.log('Admin not found for email:', normalizedEmail);
        return { status: 401, reason: "invalid_credentials" };
      }

      // Check password first
      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        return { status: 401, reason: "invalid_credentials" };
      }

      // Check if password is set
      if (!admin.hasSetPassword) {
        return { status: 401, reason: "password_not_set" };
      }

      // Check if email is verified - this is where we redirect to OTP verification
      if (!admin.isEmailVerified) {
        // Get registration state for cross-device support
        const registrationState = await this.getRegistrationState(normalizedEmail);
        
        return { 
          status: 403, 
          reason: "email_not_verified",
          data: {
            email: normalizedEmail,
            fullName: admin.fullName,
            requiresOtpVerification: true,
            registrationState: registrationState.success ? registrationState.data : null
          }
        };
      }

      await admin.populate({
        ...this.getRolePermissionPopulateOptions(),
      });

      const token = this.createAdminToken(admin);

      return { admin, token };
    } catch (error) {
      console.error('Error in adminLogin service:', error);
      return { status: 500, reason: "server_error", message: error.message };
    }
  }
}

module.exports = new AdminAuthService();
