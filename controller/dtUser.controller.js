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
  async createDTUser(req, res, next) {
    try {
      const user = await dtUserAuthService.register(req.body);
      ResponseHandler.success(res, user, "User created successfully. Verification email sent.", 201);
    } catch (error) {
      next(error);
    }
  }

  // Option 2: Background email sending (recommended for production)
  async createDTUserWithBackgroundEmail(req, res, next) {
    try {
      const user = await dtUserAuthService.register(req.body);
      ResponseHandler.success(res, user, "User created successfully. Verification email queued for sending.", 201);
    } catch (error) {
      next(error);
    }
  }

  // Email verification function
  async verifyEmail(req, res, next) {
    try {
      const { id } = req.params;
      const { email } = req.query;

      const user = await dtUserAuthService.verifyEmail(id, email);
      ResponseHandler.success(res, {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        isEmailVerified: user.isEmailVerified
      }, "Email verified successfully!");
    } catch (error) {
      next(error);
    }
  }

  // Password setup function (after email verification)
  async setupPassword(req, res, next) {
    try {
      const { error } = dtUserPasswordSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const { userId, email, password } = req.body;

      // Manual checks can be moved to service, but here we keep the controller thin
      const user = await dtUserAuthService.setupPassword(userId, password);

      // Verify email matches if requested
      if (user.email !== email) throw new ValidationError("Invalid request");

      ResponseHandler.success(res, {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
        hasSetPassword: user.hasSetPassword
      }, "Password set successfully! You can now login.");
    } catch (error) {
      next(error);
    }
  }

  // DTUser login function
  async dtUserLogin(req, res, next) {
    try {
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
    } catch (error) {
      next(error);
    }
  }

  // Get DTUser profile by userId
  async getDTUserProfile(req, res, next) {
    try {
      const { userId } = req.params;
      const profile = await dtUserProfileService.getProfile(userId);
      ResponseHandler.success(res, { profile }, "Profile retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // Update DTUser profile (PATCH endpoint)
  async updateDTUserProfile(req, res, next) {
    try {
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
    } catch (error) {
      next(error);
    }
  }

  // DTUser password reset function (requires old password)
  async resetDTUserPassword(req, res, next) {
    try {
      const { error } = dtUserPasswordResetSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const { oldPassword, newPassword } = req.body;
      const userId = req.user.userId;

      await dtUserProfileService.resetPassword(userId, oldPassword, newPassword);
      ResponseHandler.success(res, null, "Password reset successfully");
    } catch (error) {
      next(error);
    }
  }

  // Get single DTUser (public endpoint)
  async getDTUser(req, res, next) {
    try {
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
    } catch (error) {
      next(error);
    }
  }

  // Admin function: Get all DTUsers
  async getAllDTUsers(req, res, next) {
    try {
      const data = await dtUserAdminService.getAllUsers(req.query);
      ResponseHandler.success(res, data, "DTUsers retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // Admin function: Get all admin users
  async getAllAdminUsers(req, res, next) {
    try {
      const data = await dtUserAdminService.getAllAdminUsers(req.query);
      ResponseHandler.success(res, data, "Admin users retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // Admin function: Get comprehensive admin dashboard overview
  async getAdminDashboard(req, res, next) {
    try {
      const data = await dtUserAdminService.getAdminDashboard();
      ResponseHandler.success(res, data, "Admin dashboard retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // Admin function: Approve annotator
  async approveAnnotator(req, res, next) {
    try {
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
    } catch (error) {
      next(error);
    }
  }

  // Admin function: Get all QA users with their status
  async getAllQAUsers(req, res, next) {
    try {
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
    } catch (error) {
      next(error);
    }
  }

  // Admin function: Approve user for QA status
  async approveUserForQA(req, res, next) {
    try {
      const { userId } = req.params;
      const user = await dtUserAdminService.approveQAStatus(userId);

      ResponseHandler.success(res, {
        userId: user._id,
        fullName: user.fullName,
        email: user.email,
        qaStatus: user.qaStatus
      }, "QA status approved successfully");
    } catch (error) {
      next(error);
    }
  }

  // Admin function: Reject user for QA status
  async rejectUserForQA(req, res, next) {
    try {
      const { userId } = req.params;
      const user = await dtUserAdminService.rejectQAStatus(userId);

      ResponseHandler.success(res, {
        userId: user._id,
        fullName: user.fullName,
        email: user.email,
        qaStatus: user.qaStatus
      }, "QA status rejected");
    } catch (error) {
      next(error);
    }
  }

  // Admin function: Reject annotator (dedicated endpoint)
  async rejectAnnotator(req, res, next) {
    try {
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
    } catch (error) {
      next(error);
    }
  }

  // Admin function: Get single DTUser details
  async getDTUserAdmin(req, res, next) {
    try {
      const { userId } = req.params;
      const user = await dtUserAdminService.getUserDetails(userId);

      ResponseHandler.success(res, { user }, "User details retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // Admin function: Request admin verification (Step 1)
  async requestAdminVerification(req, res, next) {
    try {
      const { error } = adminVerificationRequestSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const { fullName, email, phone, password, adminKey } = req.body;
      const data = await dtUserAuthService.requestAdminVerification({ fullName, email, phone, password }, adminKey);

      ResponseHandler.success(res, data, "Verification code sent to admin email");
    } catch (error) {
      next(error);
    }
  }

  // Admin function: Confirm verification and create admin (Step 2)
  async confirmAdminVerification(req, res, next) {
    try {
      const { error } = adminVerificationConfirmSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const { email, verificationCode, adminKey } = req.body;
      const admin = await dtUserAuthService.confirmAdminVerification(email, verificationCode, adminKey);

      ResponseHandler.success(res, admin, "Admin account created successfully! Please check your email for the OTP code.", 201);
    } catch (error) {
      next(error);
    }
  }

  // Legacy admin creation function (kept for backward compatibility)
  async createAdmin(req, res, next) {
    try {
      const { error } = adminCreateSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const { fullName, email, phone, password, adminKey } = req.body;
      // We can reuse the service method but it sends a different email
      const data = await dtUserAuthService.confirmAdminVerification(email, 'LEGACY', adminKey);
      ResponseHandler.success(res, data, "Admin created", 201);
    } catch (error) {
      next(error);
    }
  }

  // Verify Admin Account with OTP
  async verifyAdminOTP(req, res, next) {
    try {
      const { error } = adminVerificationConfirmSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const { email, verificationCode, adminKey } = req.body;
      const data = await dtUserAuthService.verifyAdminOTP(email, verificationCode, adminKey);

      ResponseHandler.success(res, data, "Admin account verified successfully");
    } catch (error) {
      next(error);
    }
  }

  // Admin Login
  async adminLogin(req, res, next) {
    try {
      const { error } = dtUserLoginSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const { email, password } = req.body;
      const data = await dtUserAuthService.adminLogin(email, password);

      ResponseHandler.success(res, data, "Admin login successful");
    } catch (error) {
      next(error);
    }
  }

  // Resend verification email endpoint
  async resendVerificationEmail(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) throw new ValidationError("Email is required");

      const data = await dtUserAuthService.resendVerificationEmail(email);
      ResponseHandler.success(res, data, "Verification email sent successfully");
    } catch (error) {
      next(error);
    }
  }

  // DTUser function: Get available projects (only for approved annotators)
  async getAvailableProjects(req, res, next) {
    try {
      const { projects, total } = await dtProjectService.getAvailableProjects(req.user.userId, req.query);
      ResponseHandler.success(res, { projects, total }, "Projects retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // DTUser function: Apply to a project
  async applyToProject(req, res, next) {
    try {
      const application = await dtProjectService.applyToProject(req.user.userId, req.params.projectId, req.body);
      ResponseHandler.success(res, application, "Application submitted successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  // DTUser function: Get user's active projects
  async getUserActiveProjects(req, res, next) {
    try {
      const data = await dtProjectService.getUserActiveProjects(req.user.userId);
      ResponseHandler.success(res, data, "User projects retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // DTUser function: Get all user invoices with statistics
  async getUserInvoices(req, res, next) {
    try {
      const data = await invoiceService.getUserInvoices(req.user.userId, req.query);
      ResponseHandler.success(res, data, "Invoices retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // DTUser function: Get unpaid invoices specifically
  async getUnpaidInvoices(req, res, next) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const data = await invoiceService.getUnpaidInvoices(req.user.userId, page, limit);
      ResponseHandler.success(res, data, "Unpaid invoices retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // DTUser function: Get paid invoices specifically  
  async getPaidInvoices(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const data = await invoiceService.getPaidInvoices(req.user.userId, page, limit);
      ResponseHandler.success(res, data, "Paid invoices retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // DTUser function: Get specific invoice details
  async getInvoiceDetails(req, res, next) {
    try {
      const invoice = await invoiceService.getInvoiceDetails(req.params.invoiceId, req.user.userId);
      ResponseHandler.success(res, { invoice }, "Invoice details retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // DTUser function: Get invoice dashboard summary
  async getInvoiceDashboard(req, res, next) {
    try {
      const data = await invoiceService.getInvoiceDashboard(req.user.userId);
      ResponseHandler.success(res, data, "Invoice dashboard retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // DTUser Dashboard - Personal overview for authenticated users
  async getDTUserDashboard(req, res, next) {
    try {
      const data = await dtDashboardService.getUserDashboard(req.user.userId);
      ResponseHandler.success(res, data, "User dashboard retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // Submit result file upload and store in Cloudinary
  async submitResultWithCloudinary(req, res, next) {
    try {
      const data = await dtResultService.submitResult(req.user.userId, req.body.projectId, req.body.notes, req.file);
      ResponseHandler.success(res, data, "Result file uploaded and stored successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  // Upload ID Document and store in user profile
  async uploadIdDocument(req, res, next) {
    try {
      const data = await dtResultService.uploadIdDocument(req.user.userId, req.file);
      ResponseHandler.success(res, data, "ID document uploaded successfully");
    } catch (error) {
      next(error);
    }
  }

  // Upload Resume and store in user profile
  async uploadResume(req, res, next) {
    try {
      const data = await dtResultService.uploadResume(req.user.userId, req.file);
      ResponseHandler.success(res, data, "Resume uploaded successfully");
    } catch (error) {
      next(error);
    }
  }

  // Get all result submissions for a user
  async getUserResultSubmissions(req, res, next) {
    try {
      const data = await dtResultService.getUserResultSubmissions(req.user.userId, req.query);
      ResponseHandler.success(res, data, "Result submissions retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // Get project guidelines for approved annotators only
  async getProjectGuidelines(req, res, next) {
    try {
      const data = await dtProjectService.getProjectGuidelines(req.params.projectId, req.user.userId);
      ResponseHandler.success(res, data, "Project guidelines retrieved successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const dtUserController = new DTUserController();
export default dtUserController;
