import dtUserAuthService from "../services/dtUserAuth.service.js";
import dtUserProfileService from "../services/dtUserProfile.service.js";
import dtUserAdminService from "../services/dtUserAdmin.service.js";
import invoiceService from "../services/invoice.service.js";
import dtProjectService from "../services/dtProject.service.js";
import dtDashboardService from "../services/dtDashboard.service.js";
import dtResultService from "../services/dtResult.service.js";
import dtUserRepository from "../repositories/dtUser.repository.js";
import { ResponseHandler, ValidationError, NotFoundError, AuthenticationError } from "../utils/responseHandler.js";

import {
  dtUserPasswordSchema,
  dtUserLoginSchema,
  dtUserProfileUpdateSchema,
  adminCreateSchema,
  adminVerificationRequestSchema,
  adminVerificationConfirmSchema,
  dtUserPasswordResetSchema
} from "../utils/authValidator.js";

class DTUserController {
  // Option 1: Send email with timeout (current implementation)
  async createDTUser(req, res) {
    const user = await dtUserAuthService.register(req.body);
    ResponseHandler.success(res, user, "User created successfully. Verification email sent.", 201);
  }

  // Option 2: Background email sending (recommended for production)
  async createDTUserWithBackgroundEmail(req, res) {
    const user = await dtUserAuthService.register(req.body);
    ResponseHandler.success(res, user, "User created successfully. Verification email queued for sending.", 201);
  }

  // Email verification function
  async verifyEmail(req, res) {
    const { id } = req.params;
    const { email } = req.query;

    const user = await dtUserAuthService.verifyEmail(id, email);
    ResponseHandler.success(res, {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      isEmailVerified: user.isEmailVerified
    }, "Email verified successfully!");
  }

  // Password setup function (after email verification)
  async setupPassword(req, res) {
    const { error } = dtUserPasswordSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);

    const { userId, email, password } = req.body;

    const user = await dtUserAuthService.setupPassword(userId, password);

    if (user.email !== email) throw new ValidationError("Invalid request");

    ResponseHandler.success(res, {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      hasSetPassword: user.hasSetPassword
    }, "Password set successfully! You can now login.");
  }

  // DTUser login function
  async dtUserLogin(req, res) {
    const { error } = dtUserLoginSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);

    const { email, password } = req.body;
    const result = await dtUserAuthService.login(email, password);

    ResponseHandler.success(res, {
      message: "Login successful",
      _usrinfo: { data: result.token },
      token: result.token,
      user: result.user
    }, "Login successful");
  }

  // Get DTUser profile by userId
  async getDTUserProfile(req, res) {
    const { userId } = req.params;
    const profile = await dtUserProfileService.getProfile(userId);
    ResponseHandler.success(res, { profile }, "Profile retrieved successfully");
  }

  // Update DTUser profile (PATCH endpoint)
  async updateDTUserProfile(req, res) {
    const { userId } = req.params;
    const { error } = dtUserProfileUpdateSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);

    // Authorization check
    if (req.user.userId !== userId) {
      throw new AuthenticationError("Access denied. You can only update your own profile.");
    }

    const updatedProfile = await dtUserProfileService.updateProfile(userId, req.body);
    ResponseHandler.success(res, {
      profile: updatedProfile,
      fieldsUpdated: Object.keys(req.body)
    }, "Profile updated successfully");
  }

  // DTUser password reset function (requires old password)
  async resetDTUserPassword(req, res) {
    const { error } = dtUserPasswordResetSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);

    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId;

    await dtUserProfileService.resetPassword(userId, oldPassword, newPassword);
    ResponseHandler.success(res, null, "Password reset successfully");
  }

  // Get single DTUser (public endpoint)
  async getDTUser(req, res) {
    const { id } = req.params;
    const user = await dtUserRepository.findById(id);
    if (!user) throw new NotFoundError("User not found");

    ResponseHandler.success(res, {
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        domains: user.domains,
        consent: user.consent,
        annotatorStatus: user.annotatorStatus,
        microTaskerStatus: user.microTaskerStatus,
        isEmailVerified: user.isEmailVerified,
        hasSetPassword: user.hasSetPassword,
        resultLink: user.resultLink,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    }, "User details retrieved successfully");
  }

  // Admin function: Get all DTUsers
  async getAllDTUsers(req, res) {
    const data = await dtUserAdminService.getAllUsers(req.query);
    ResponseHandler.success(res, data, "DTUsers retrieved successfully");
  }

  // Admin function: Get all admin users
  async getAllAdminUsers(req, res) {
    const data = await dtUserAdminService.getAllAdminUsers(req.query);
    ResponseHandler.success(res, data, "Admin users retrieved successfully");
  }

  // Admin function: Get comprehensive admin dashboard overview
  async getAdminDashboard(req, res) {
    const data = await dtUserAdminService.getAdminDashboard();
    ResponseHandler.success(res, data, "Admin dashboard retrieved successfully");
  }

  // Admin function: Approve annotator
  async approveAnnotator(req, res) {
    const { userId } = req.params;
    const { newStatus = 'approved' } = req.body;

    const user = await dtUserAdminService.approveAnnotator(userId, newStatus);
    ResponseHandler.success(res, {
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
      newStatus: user.annotatorStatus,
      updatedAt: user.updatedAt
    }, "Annotator status updated successfully");
  }

  // Admin function: Get all QA users with their status
  async getAllQAUsers(req, res) {
    const { qaStatus, page = 1, limit = 50, search } = req.query;
    const skip = (page - 1) * limit;

    let filterQuery = {};
    if (qaStatus && ['pending', 'approved', 'rejected'].includes(qaStatus)) {
      filterQuery.qaStatus = qaStatus;
    }
    if (search) {
      filterQuery.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const totalUsers = await dtUserRepository.count(filterQuery);
    const qaUsers = await dtUserAdminService.getQAUsers(filterQuery, skip, parseInt(limit));

    ResponseHandler.success(res, {
      qaUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNextPage: page * limit < totalUsers
      }
    }, "QA users retrieved successfully");
  }

  // Admin function: Approve user for QA status
  async approveUserForQA(req, res) {
    const { userId } = req.params;
    const user = await dtUserAdminService.approveQAStatus(userId);

    ResponseHandler.success(res, {
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
      qaStatus: user.qaStatus
    }, "QA status approved successfully");
  }

  // Admin function: Reject user for QA status
  async rejectUserForQA(req, res) {
    const { userId } = req.params;
    const user = await dtUserAdminService.rejectQAStatus(userId);
    ResponseHandler.success(res, {
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
      qaStatus: user.qaStatus
    }, "QA status rejected");
  }

  async rejectAnnotator(req, res) {
    const { userId } = req.params;
    const { reason = '' } = req.body;
    const user = await dtUserAdminService.rejectAnnotator(userId, reason);
    ResponseHandler.success(res, {
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
      annotatorStatus: user.annotatorStatus,
      microTaskerStatus: user.microTaskerStatus
    }, "Annotator rejected successfully");
  }

  // Admin function: Get single DTUser details
  async getDTUserAdmin(req, res) {
    const { userId } = req.params;
    const user = await dtUserAdminService.getUserDetails(userId);
    ResponseHandler.success(res, { user }, "User details retrieved successfully");
  }

  // Admin function: Request admin verification (Step 1)
  async requestAdminVerification(req, res) {
    const { error } = adminVerificationRequestSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);
    const { fullName, email, phone, password, adminKey } = req.body;
    const data = await dtUserAuthService.requestAdminVerification({ fullName, email, phone, password }, adminKey);
    ResponseHandler.success(res, data, "Verification code sent to admin email");
  }

  // Admin function: Confirm verification and create admin (Step 2)
  async confirmAdminVerification(req, res) {
    const { error } = adminVerificationConfirmSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);
    const { email, verificationCode, adminKey } = req.body;
    const admin = await dtUserAuthService.confirmAdminVerification(email, verificationCode, adminKey);
    ResponseHandler.success(res, admin, "Admin account created successfully! Please check your email for the OTP code.", 201);
  }

  async createAdmin(req, res) {
    const { error } = adminCreateSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);
    const { fullName, email, phone, password, adminKey } = req.body;
    // We can reuse the service method but it sends a different email
    const data = await dtUserAuthService.confirmAdminVerification(email, 'LEGACY', adminKey);
    ResponseHandler.success(res, data, "Admin created", 201);
  }

  // Verify Admin Account with OTP
  async verifyAdminOTP(req, res) {
    const { error } = adminVerificationConfirmSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);
    const { email, verificationCode, adminKey } = req.body;
    const data = await dtUserAuthService.verifyAdminOTP(email, verificationCode, adminKey);
    ResponseHandler.success(res, data, "Admin account verified successfully");
  }

  // Admin Login
  async adminLogin(req, res) {
    const { error } = dtUserLoginSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);
    const { email, password } = req.body;
    const data = await dtUserAuthService.adminLogin(email, password);
    ResponseHandler.success(res, data, "Admin login successful");
  }

  // Resend verification email endpoint
  async resendVerificationEmail(req, res) {
    const { email } = req.body;
    if (!email) throw new ValidationError("Email is required");
    const data = await dtUserAuthService.resendVerificationEmail(email);
    ResponseHandler.success(res, data, "Verification email sent successfully");
  }

  // DTUser function: Get available projects (only for approved annotators)
  async getAvailableProjects(req, res) {
    const { projects, total } = await dtProjectService.getAvailableProjects(req.user.userId, req.query);
    ResponseHandler.success(res, { projects, total }, "Projects retrieved successfully");
  }

  // DTUser function: Apply to a project
  async applyToProject(req, res) {
    const application = await dtProjectService.applyToProject(req.user.userId, req.params.projectId, req.body);
    ResponseHandler.success(res, application, "Application submitted successfully", 201);
  }

  // DTUser function: Get user's active projects
  async getUserActiveProjects(req, res) {
    const data = await dtProjectService.getUserActiveProjects(req.user.userId);
    ResponseHandler.success(res, data, "User projects retrieved successfully");
  }

  // DTUser function: Get all user invoices with statistics
  async getUserInvoices(req, res) {
    const data = await invoiceService.getUserInvoices(req.user.userId, req.query);
    ResponseHandler.success(res, data, "Invoices retrieved successfully");
  }

  // DTUser function: Get unpaid invoices specifically
  async getUnpaidInvoices(req, res) {
    const { page = 1, limit = 10 } = req.query;
    const data = await invoiceService.getUnpaidInvoices(req.user.userId, page, limit);
    ResponseHandler.success(res, data, "Unpaid invoices retrieved successfully");
  }

  // DTUser function: Get paid invoices specifically  
  async getPaidInvoices(req, res) {
    const { page = 1, limit = 20 } = req.query;
    const data = await invoiceService.getPaidInvoices(req.user.userId, page, limit);
    ResponseHandler.success(res, data, "Paid invoices retrieved successfully");
  }

  // DTUser function: Get specific invoice details
  async getInvoiceDetails(req, res) {
    const invoice = await invoiceService.getInvoiceDetails(req.params.invoiceId, req.user.userId);
    ResponseHandler.success(res, { invoice }, "Invoice details retrieved successfully");
  }

  // DTUser function: Get invoice dashboard summary
  async getInvoiceDashboard(req, res) {
    const data = await invoiceService.getInvoiceDashboard(req.user.userId);
    ResponseHandler.success(res, data, "Invoice dashboard retrieved successfully");
  }

  // DTUser Dashboard - Personal overview for authenticated users
  async getDTUserDashboard(req, res) {
    const data = await dtDashboardService.getUserDashboard(req.user.userId);
    ResponseHandler.success(res, data, "User dashboard retrieved successfully");
  }

  async submitResultWithCloudinary(req, res) {
    const data = await dtResultService.submitResult(req.user.userId, req.body.projectId, req.body.notes, req.file);
    ResponseHandler.success(res, data, "Result file uploaded and stored successfully", 200);
  }

  // Upload ID Document and store in user profile
  async uploadIdDocument(req, res) {
    const data = await dtResultService.uploadIdDocument(req.user.userId, req.file);
    ResponseHandler.success(res, data, "ID document uploaded successfully");
  }

  // Upload Resume and store in user profile
  async uploadResume(req, res) {
    const data = await dtResultService.uploadResume(req.user.userId, req.file);
    ResponseHandler.success(res, data, "Resume uploaded successfully");
  }

  // Get all result submissions for a user
  async getUserResultSubmissions(req, res) {
    const data = await dtResultService.getUserResultSubmissions(req.user.userId, req.query);
    ResponseHandler.success(res, data, "Result submissions retrieved successfully");
  }

  // Get project guidelines for approved annotators only
  async getProjectGuidelines(req, res) {
    const data = await dtProjectService.getProjectGuidelines(req.params.projectId, req.user.userId);
    ResponseHandler.success(res, data, "Project guidelines retrieved successfully");
  }
}

export const dtUserController = new DTUserController();
export default dtUserController;
