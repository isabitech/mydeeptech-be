const dtUserService = require("../services/dtUser.service");
const annotationProjectService = require("../services/annotationProject.service");
class AdminController {
  // Admin function: Get all DTUsers
  static async getAllDTUsers(req, res) {
    try {
      const result = await dtUserService.getAllDTUsers({ query: req.query });

      res.status(200).json({
        success: true,
        message: "DTUsers retrieved successfully",
        data: {
          users: result.users,
          pagination: {
            currentPage: result.page,
            totalPages: result.totalPages,
            totalUsers: result.totalUsers,
            usersPerPage: result.limit,
            hasNextPage: result.page < result.totalPages,
            hasPreviousPage: result.page > 1,
          },
          summary: {
            totalUsers: result.totalUsers,
            statusBreakdown: result.statusBreakdown,
            filters: result.filter,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching all DTUsers:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching DTUsers",
        error: error.message,
      });
    }
  }
  // Admin function: Get all admin users
  static async getAllAdminUsers(req, res) {
    try {
      const result = await dtUserService.getAllAdminUsers({ query: req.query });

      res.status(200).json({
        success: true,
        message: `Retrieved ${result.adminUsers.length} admin users`,
        data: {
          adminUsers: result.adminUsers,
          pagination: {
            currentPage: result.page,
            totalPages: result.totalPages,
            totalAdminUsers: result.totalAdminUsers,
            hasNextPage: result.page < result.totalPages,
            hasPrevPage: result.page > 1,
            limit: result.limit,
          },
          summary: {
            totalAdminUsers: result.totalAdminUsers,
            roleSummary: result.roleSummary,
            filters: result.filter,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching admin users",
        error: error.message,
      });
    }
  }

  // Admin function: Get comprehensive admin dashboard overview
  static async getAdminDashboard(req, res) {
    try {
      const result = await dtUserService.getAdminDashboard();

      res.status(200).json({
        success: true,
        message: "Admin dashboard overview retrieved successfully",
        data: result.dashboardData,
      });
    } catch (error) {
      console.error("Error fetching admin dashboard overview:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching dashboard data",
        error: error.message,
      });
    }
  }

  // Admin function: Approve annotator
  static async approveAnnotator(req, res) {
    try {
      const result = await dtUserService.approveAnnotator({
        userId: req.params.userId,
        newStatus: req.body.newStatus || "approved",
      });

      if (result.status === 400) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${result.validStatuses.join(", ")}`,
          validStatuses: result.validStatuses,
        });
      }

      if (result.status === 404) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const { user, previousStatus, newStatus } = result;

      res.status(200).json({
        success: true,
        message: `Annotator status updated successfully from ${previousStatus} to ${newStatus}`,
        data: {
          userId: user._id,
          fullName: user.fullName,
          email: user.email,
          previousStatus: previousStatus,
          newStatus: newStatus,
          annotatorStatus: user.annotatorStatus,
          microTaskerStatus: user.microTaskerStatus,
          emailNotificationSent:
            newStatus === "approved" || newStatus === "rejected",
          updatedAt: user.updatedAt,
          updatedBy: req.admin.email,
        },
      });
    } catch (error) {
      console.error("Error approving annotator:", error);
      res.status(500).json({
        success: false,
        message: "Server error updating annotator status",
        error: error.message,
      });
    }
  }

  // Admin function: Get all QA users with their status
  static async getAllQAUsers(req, res) {
    try {
      const result = await dtUserService.getAllQAUsers({ query: req.query });

      res.status(200).json({
        success: true,
        message: `Retrieved ${result.qaUsers.length} QA users successfully`,
        data: {
          qaUsers: result.qaUsers,
          pagination: {
            currentPage: result.page,
            totalPages: Math.ceil(result.totalUsers / result.limit),
            totalUsers: result.totalUsers,
            usersPerPage: result.limit,
            hasNextPage: result.page * result.limit < result.totalUsers,
            hasPrevPage: result.page > 1,
          },
          statusCounts: result.counts,
          filters: {
            qaStatus: req.query.qaStatus || "all",
            search: req.query.search || null,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching QA users:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching QA users",
        error: error.message,
      });
    }
  }

  // Admin function: Approve user for QA status
  static async approveUserForQA(req, res) {
    try {
      const result = await dtUserService.approveUserForQA({
        userId: req.params.userId,
      });

      if (result.status === 400) {
        if (result.reason === "invalid_id") {
          return res
            .status(400)
            .json({ success: false, message: "Invalid user ID format" });
        }
        if (result.reason === "already_approved") {
          return res.status(400).json({
            success: false,
            message: "User is already approved for QA status",
            data: {
              userId: result.user._id,
              fullName: result.user.fullName,
              email: result.user.email,
              currentQAStatus: result.user.qaStatus,
            },
          });
        }
      }

      if (result.status === 404) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const { user, previousQAStatus } = result;

      res.status(200).json({
        success: true,
        message: `QA status approved successfully for ${user.fullName}`,
        data: {
          userId: user._id,
          fullName: user.fullName,
          email: user.email,
          previousQAStatus: previousQAStatus,
          newQAStatus: user.qaStatus,
          annotatorStatus: user.annotatorStatus,
          microTaskerStatus: user.microTaskerStatus,
          updatedAt: user.updatedAt,
          approvedBy: req.admin.email,
        },
      });
    } catch (error) {
      console.error("Error approving QA status:", error);
      res.status(500).json({
        success: false,
        message: "Server error updating QA status",
        error: error.message,
      });
    }
  }

  // Admin function: Reject user for QA status
  static async rejectUserForQA(req, res) {
    try {
      const result = await dtUserService.rejectUserForQA({
        userId: req.params.userId,
      });

      if (result.status === 400) {
        if (result.reason === "invalid_id") {
          return res
            .status(400)
            .json({ success: false, message: "Invalid user ID format" });
        }
        if (result.reason === "already_rejected") {
          return res.status(400).json({
            success: false,
            message: "User QA status is already rejected",
            data: {
              userId: result.user._id,
              fullName: result.user.fullName,
              email: result.user.email,
              currentQAStatus: result.user.qaStatus,
            },
          });
        }
      }

      if (result.status === 404) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const { user, previousQAStatus } = result;

      res.status(200).json({
        success: true,
        message: `QA status rejected for ${user.fullName}`,
        data: {
          userId: user._id,
          fullName: user.fullName,
          email: user.email,
          previousQAStatus: previousQAStatus,
          newQAStatus: user.qaStatus,
          annotatorStatus: user.annotatorStatus,
          microTaskerStatus: user.microTaskerStatus,
          updatedAt: user.updatedAt,
          rejectedBy: req.admin.email,
          reason: req.body.reason || null,
        },
      });
    } catch (error) {
      console.error("Error rejecting QA status:", error);
      res.status(500).json({
        success: false,
        message: "Server error updating QA status",
        error: error.message,
      });
    }
  }

  // Admin function: Reject annotator (dedicated endpoint)
  static async rejectAnnotator(req, res) {
    try {
      const result = await dtUserService.rejectAnnotator({
        userId: req.params.userId,
      });

      if (result.status === 404) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const { user, previousStatus } = result;

      res.status(200).json({
        success: true,
        message:
          "Annotator rejected successfully. User approved as micro tasker.",
        data: {
          userId: user._id,
          fullName: user.fullName,
          email: user.email,
          previousStatus: previousStatus,
          annotatorStatus: user.annotatorStatus,
          microTaskerStatus: user.microTaskerStatus,
          reason: req.body.reason || "No reason provided",
          emailNotificationSent: true,
          updatedAt: user.updatedAt,
          rejectedBy: req.admin.email,
        },
      });
    } catch (error) {
      console.error("Error rejecting annotator:", error);
      res.status(500).json({
        success: false,
        message: "Server error rejecting annotator",
        error: error.message,
      });
    }
  }

  // Admin function: Get single DTUser details
  static async getDTUserAdmin(req, res) {
    try {
      const result = await dtUserService.getDTUserAdmin(req.params.userId);

      if (result.status === 404) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      res.status(200).json({
        success: true,
        message: "User details retrieved successfully",
        data: {
          user: result.user,
        },
      });
    } catch (error) {
      console.error("Error fetching user details (admin):", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching user details",
        error: error.message,
      });
    }
  }

  // Admin function: Request admin verification (Step 1)
  static async requestAdminVerification(req, res) {
    try {
      const result = await dtUserService.requestAdminVerification(req.body);

      if (result.status === 400) {
        if (result.reason === "validation") {
          return res
            .status(400)
            .json({ success: false, message: result.message });
        }
        if (result.reason === "invalid_admin_email") {
          return res.status(400).json({
            success: false,
            message:
              "Invalid email domain",
            code: "INVALID_ADMIN_EMAIL",
          });
        }
      }

      if (result.status === 403) {
        return res.status(403).json({
          success: false,
          message: "Invalid admin creation key",
          code: "INVALID_ADMIN_KEY",
        });
      }

      if (result.status === 409) {
        return res.status(409).json({
          success: false,
          message: "Admin account already exists with this email",
          code: "ADMIN_EXISTS",
        });
      }

      if (result.status === 500) {
        return res.status(500).json({
          success: false,
          message: "Failed to send verification email. Please try again.",
          error: result.message,
        });
      }

      res.status(200).json({
        success: true,
        message: "Verification code sent to admin email",
        data: result.data,
      });
    } catch (error) {
      console.error("Error requesting admin verification:", error);
      res.status(500).json({
        success: false,
        message: "Server error requesting admin verification",
        error: error.message,
      });
    }
  }

  // Admin function: Confirm verification and create admin (Step 2)
  static async confirmAdminVerification(req, res) {
    try {
      const result = await dtUserService.confirmAdminVerification(req.body);

      if (result.status === 400) {
        if (result.reason === "validation") {
          return res
            .status(400)
            .json({ success: false, message: result.message });
        }
        if (result.reason === "verification_expired") {
          return res.status(400).json({
            success: false,
            message: "Verification code has expired. Please request a new one.",
            code: "VERIFICATION_EXPIRED",
          });
        }
        if (result.reason === "invalid_verification_code") {
          return res.status(400).json({
            success: false,
            message: "Invalid verification code",
            code: "INVALID_VERIFICATION_CODE",
            attemptsRemaining: result.attemptsRemaining,
          });
        }
      }

      if (result.status === 403) {
        return res.status(403).json({
          success: false,
          message: "Invalid admin creation key",
          code: "INVALID_ADMIN_KEY",
        });
      }

      if (result.status === 404) {
        return res.status(404).json({
          success: false,
          message: "No verification request found or verification expired",
          code: "VERIFICATION_NOT_FOUND",
        });
      }

      if (result.status === 429) {
        return res.status(429).json({
          success: false,
          message:
            "Too many verification attempts. Please request a new verification code.",
          code: "TOO_MANY_ATTEMPTS",
        });
      }

      const newAdmin = result.admin;

      res.status(201).json({
        success: true,
        message:
          "Admin account created successfully! Please check your email for the OTP code to verify your account.",
        otpVerificationRequired: true,
        admin: {
          id: newAdmin._id,
          fullName: newAdmin.fullName,
          email: newAdmin.email,
          phone: newAdmin.phone,
          domains: newAdmin.domains,
          isEmailVerified: newAdmin.isEmailVerified,
          hasSetPassword: newAdmin.hasSetPassword,
          annotatorStatus: newAdmin.annotatorStatus,
          microTaskerStatus: newAdmin.microTaskerStatus,
          createdAt: newAdmin.createdAt,
          isAdmin: true,
          role: newAdmin.role || "admin",
          role_permission: newAdmin.role_permission,
        },
      });
    } catch (error) {
      console.error("Error confirming admin verification:", error);
      res.status(500).json({
        success: false,
        message: "Server error creating admin account",
        error: error.message,
      });
    }
  }

  // Legacy admin creation function (kept for backward compatibility)
  static async createAdmin(req, res) {
    try {
      const result = await dtUserService.createAdmin(req.body, req);

      if (result.status === 400) {
        if (result.reason === "validation") {
          return res
            .status(400)
            .json({ success: false, message: result.message });
        }
        if (result.reason === "invalid_admin_email") {
          return res.status(400).json({
            success: false,
            message: "Invalid email domain",
            code: "INVALID_ADMIN_EMAIL",
          });
        }
      }

      if (result.status === 403) {
        return res.status(403).json({
          success: false,
          message: "Invalid admin creation key",
          code: "INVALID_ADMIN_KEY",
        });
      }

      if (result.status === 409) {
        return res.status(409).json({
          success: false,
          message: "Admin account already exists with this email",
          code: "ADMIN_EXISTS",
        });
      }

      const newAdmin = result.admin;

      res.status(201).json({
        success: true,
        message:
          "Admin account created successfully! Please check your email for the OTP code to verify your account.",
        otpVerificationRequired: true,
        admin: {
          id: newAdmin._id,
          fullName: newAdmin.fullName,
          email: newAdmin.email,
          phone: newAdmin.phone,
          domains: newAdmin.domains,
          isEmailVerified: newAdmin.isEmailVerified,
          hasSetPassword: newAdmin.hasSetPassword,
          annotatorStatus: newAdmin.annotatorStatus,
          microTaskerStatus: newAdmin.microTaskerStatus,
          createdAt: newAdmin.createdAt,
          isAdmin: true,
        },
      });
    } catch (error) {
      console.error("Error creating admin account:", error);
      res.status(500).json({
        success: false,
        message: "Server error creating admin account",
        error: error.message,
      });
    }
  }
  // Verify Admin Account with OTP
  static async verifyAdminOTP(req, res) {
    try {
      const result = await dtUserService.verifyAdminOTP(req.body);

      if (result.status === 400) {
        if (result.reason === "validation") {
          return res.status(400).json({
            success: false,
            message: "Validation error",
            errors: result.errors,
          });
        }
        if (result.reason === "otp_expired") {
          return res.status(400).json({
            success: false,
            message: "OTP has expired. Please request a new one.",
            code: "OTP_EXPIRED",
          });
        }
        if (result.reason === "invalid_otp") {
          return res.status(400).json({
            success: false,
            message: "Invalid OTP code",
            code: "INVALID_OTP",
            attemptsRemaining: result.attemptsRemaining,
          });
        }
      }

      if (result.status === 403) {
        return res.status(403).json({
          success: false,
          message: "Invalid admin creation key",
          code: "INVALID_ADMIN_KEY",
        });
      }

      if (result.status === 404) {
        if (result.reason === "otp_not_found") {
          return res.status(404).json({
            success: false,
            message: "No OTP verification request found or OTP expired",
            code: "OTP_NOT_FOUND",
          });
        }
        if (result.reason === "admin_not_found") {
          return res.status(404).json({
            success: false,
            message: "Admin account not found",
            code: "ADMIN_NOT_FOUND",
          });
        }
      }

      const { admin, token } = result;

      res.status(200).json({
        success: true,
        message: "Admin account verified successfully! You are now logged in.",
        _usrinfo: {
          data: token,
        },
        token: token,
        admin: {
          id: admin._id,
          fullName: admin.fullName,
          email: admin.email,
          phone: admin.phone,
          domains: admin.domains,
          isEmailVerified: admin.isEmailVerified,
          hasSetPassword: admin.hasSetPassword,
          annotatorStatus: admin.annotatorStatus,
          microTaskerStatus: admin.microTaskerStatus,
          qaStatus: admin.qaStatus,
          createdAt: admin.createdAt,
          isAdmin: true,
        },
      });
    } catch (error) {
      console.error("Error during admin OTP verification:", error);
      res.status(500).json({
        success: false,
        message: "Server error during OTP verification",
        error: error.message,
      });
    }
  }

  // Verify Existing Admin OTP (no admin key required)
  static async verifyExistingAdminOTP(req, res) {
    try {
      const result = await dtUserService.verifyExistingAdminOTP(req.body);

      if (result.status === 400) {
        if (result.reason === "validation") {
          return res.status(400).json({
            success: false,
            message: result.message,
            errors: result.errors,
          });
        }
        if (result.reason === "otp_expired") {
          return res.status(400).json({
            success: false,
            message: "OTP has expired. Please request a new one.",
            code: "OTP_EXPIRED",
          });
        }
        if (result.reason === "invalid_otp") {
          return res.status(400).json({
            success: false,
            message: "Invalid OTP code",
            code: "INVALID_OTP",
            attemptsRemaining: result.attemptsRemaining,
          });
        }
      }

      if (result.status === 404) {
        if (result.reason === "otp_not_found") {
          return res.status(404).json({
            success: false,
            message: "No OTP verification request found or OTP expired",
            code: "OTP_NOT_FOUND",
          });
        }
        if (result.reason === "admin_not_found") {
          return res.status(404).json({
            success: false,
            message: "Admin account not found",
            code: "ADMIN_NOT_FOUND",
          });
        }
      }

      const { admin, token } = result;

      res.status(200).json({
        success: true,
        message: "Admin account verified successfully! You are now logged in.",
        _usrinfo: {
          data: token,
        },
        token: token,
        admin: {
          id: admin._id,
          fullName: admin.fullName,
          email: admin.email,
          phone: admin.phone,
          domains: admin.domains,
          isEmailVerified: admin.isEmailVerified,
          hasSetPassword: admin.hasSetPassword,
          annotatorStatus: admin.annotatorStatus,
          microTaskerStatus: admin.microTaskerStatus,
          qaStatus: admin.qaStatus,
          createdAt: admin.createdAt,
          isAdmin: true,
          role: admin.role || "admin",
          role_permission: admin.role_permission,
        },
      });
    } catch (error) {
      console.error("Error verifying existing admin OTP:", error);
      res.status(500).json({
        success: false,
        message: "Server error verifying OTP",
        error: error.message,
      });
    }
  }

  // Admin Login
  static async adminLogin(req, res) {
    try {
      const result = await dtUserService.adminLogin(req.body);

      if (result.status === 400) {
        if (result.reason === "validation") {
          return res.status(400).json({
            success: false,
            message: result?.message || "Validation error",
            errors: result.errors,
          });
        }
        if (result.reason === "invalid_domain") {
          return res.status(400).json({
            success: false,
            message:  "Invalid credentials or account not verified",
          });
        }
      }

      if (result.status === 401) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials or account not verified",
        });
      }

      if (result.status === 403) {
        if (result.reason === "email_not_verified") {
          return res.status(403).json({
            success: false,
            message: "Email verification required to complete login",
            code: "EMAIL_NOT_VERIFIED",
            requiresOtpVerification: true,
            data: result.data,
          });
        }
      }

      if (result.status === 500) {
        console.error('Server error in adminLogin:', result.message);
        return res.status(500).json({
          success: false,
          message: "Server error during login",
          error: result.message,
        });
      }

      const { admin, token } = result;
      res.status(200).json({
        success: true,
        message: "Admin login successful",
        _usrinfo: {
          data: token,
        },
        token: token,
        admin: {
          id: admin._id,
          fullName: admin.fullName,
          email: admin.email,
          phone: admin.phone,
          domains: admin.domains,
          isEmailVerified: admin.isEmailVerified,
          hasSetPassword: admin.hasSetPassword,
          annotatorStatus: admin.annotatorStatus,
          microTaskerStatus: admin.microTaskerStatus,
          qaStatus: admin.qaStatus,
          createdAt: admin.createdAt,
          isAdmin: true,
          role: admin.role || "admin",
          role_permission: admin.role_permission,
        },
      });
    } catch (error) {
      console.error("Error during admin login:", error);
      res.status(500).json({
        success: false,
        message: "Server error during admin login",
        error: error.message,
      });
    }
  }
  // Resend verification email endpoint
  static async resendVerificationEmail(req, res) {
    try {
      if (!req.body.email) {
        return res
          .status(400)
          .json({ success: false, message: "Email is required" });
      }

      const result = await dtUserService.resendVerificationEmail(
        req.body.email,
      );

      if (result.status === 400) {
        if (result.reason === "already_verified")
          return res
            .status(400)
            .json({ success: false, message: "Email is already verified" });
      }
      if (result.status === 404) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const { emailPromise, user } = result;
      try {
        await emailPromise;
        res.status(200).json({
          success: true,
          message:
            "Verification email sent successfully. Please check your inbox.",
          emailSent: true,
        });
      } catch (emailError) {
        console.error(
          `Failed to resend verification email to ${user.email}:`,
          emailError.message,
        );
        res.status(500).json({
          success: false,
          message: "Failed to send verification email. Please try again later.",
          emailSent: false,
          error: emailError.message,
        });
      }
    } catch (error) {
      console.error("Error while resending verification email:", error);
      res.status(500).json({
        success: false,
        message: "Server error while resending verification email",
        error: error.message,
      });
    }
  }
  // Admin function: Manually add a user to a project (internal/admin use)
  static async manuallyAddUserToProject(req, res) {
    try {
      const { userId, projectId } = req.body;
      const adminId = req.admin.userId;

      const result = await annotationProjectService.manuallyAddUserToProject(
        projectId,
        userId,
        adminId,
      );

      res.status(200).json({
        success: true,
        message: "User successfully added and approved for the project",
        data: {
          application: result.application,
          project: {
            id: result.project._id,
            name: result.project.projectName,
            approvedAnnotators: result.project.approvedAnnotators,
          },
        },
      });
    } catch (error) {
      if (error.message === "user_not_found")
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      if (error.message === "project_not_found")
        return res
          .status(404)
          .json({ success: false, message: "Project not found" });
      if (error.message === "already_approved")
        return res.status(400).json({
          success: false,
          message: "User is already approved for this project",
        });

      console.error("Error manually adding user to project:", error);
      res.status(500).json({
        success: false,
        message: "Server error adding user to project",
        error: error.message,
      });
    }
  }
  static async markAssessmentSubmitted(req, res) {
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const result = await DTUser.updateMany(
        {
          createdAt: { $lte: oneMonthAgo },
          assessmentSubmission: { $ne: true },
        },
        {
          $set: { assessmentSubmission: true },
        },
      );

      res.status(200).json({
        success: true,
        message: `Successfully marked ${result.modifiedCount} users with assessmentSubmission: true`,
        data: {
          cutoffDate: oneMonthAgo,
          usersMatched: result.matchedCount,
          usersModified: result.modifiedCount,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Error marking assessment submission:", error);
      res.status(500).json({
        success: false,
        message: "Server error marking assessment submission",
        error: error.message,
      });
    }
  }

  // Resend Admin OTP
  static async resendAdminOTP(req, res) {
    try {
      const result = await dtUserService.resendAdminOTP(req.body);

      if (result.status === 400) {
        if (result.reason === "validation") {
          return res.status(400).json({
            success: false,
            message: "Validation error",
            errors: result.errors,
          });
        }
        if (result.reason === "already_verified") {
          return res.status(400).json({
            success: false,
            message: "Admin account is already verified",
            code: "ALREADY_VERIFIED",
          });
        }
      }

      if (result.status === 403) {
        return res.status(403).json({
          success: false,
          message: "Invalid admin creation key",
          code: "INVALID_ADMIN_KEY",
        });
      }

      if (result.status === 404) {
        if (result.reason === "no_pending_verification") {
          return res.status(404).json({
            success: false,
            message: "No pending verification found. Please start the registration process again.",
            code: "NO_PENDING_VERIFICATION",
          });
        }
        if (result.reason === "admin_not_found") {
          return res.status(404).json({
            success: false,
            message: "Admin account not found",
            code: "ADMIN_NOT_FOUND",
          });
        }
      }

      if (result.status === 500) {
        return res.status(500).json({
          success: false,
          message: "Failed to send new verification code. Please try again.",
          error: result.message,
        });
      }

      res.status(200).json({
        success: true,
        message: "New verification code sent to your email",
        data: result.data,
      });
    } catch (error) {
      console.error("Error resending admin OTP:", error);
      res.status(500).json({
        success: false,
        message: "Server error resending OTP",
        error: error.message,
      });
    }
  }

  // Resend Admin OTP for Existing Users (no admin key required)
  static async resendExistingAdminOTP(req, res) {
    try {
      const result = await dtUserService.resendExistingAdminOTP(req.body);

      if (result.status === 400) {
        if (result.reason === "validation") {
          return res.status(400).json({
            success: false,
            message: "Validation error",
            errors: result.errors,
          });
        }
        if (result.reason === "already_verified") {
          return res.status(400).json({
            success: false,
            message: "Account is already verified",
          });
        }
      }

      if (result.status === 404) {
        if (result.reason === "admin_not_found") {
          return res.status(404).json({
            success: false,
            message: "Admin account not found",
          });
        }
      }

      if (result.status === 500) {
        if (result.reason === "email_failed") {
          return res.status(500).json({
            success: false,
            message: "Failed to send verification email",
            error: result.message,
          });
        }
      }

      res.status(200).json({
        success: true,
        message: "Verification code resent successfully",
        data: result.data,
      });
    } catch (error) {
      console.error("Error resending existing admin OTP:", error);
      res.status(500).json({
        success: false,
        message: "Server error resending OTP",
        error: error.message,
      });
    }
  }

  // Get registration state for cross-device access
  static async getRegistrationState(req, res) {
    try {
      const { email } = req.params;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      const result = await dtUserService.getAdminRegistrationState(email);

      if (!result.success) {
        if (result.reason === 'no_state_found') {
          return res.status(404).json({
            success: false,
            message: "No active registration found for this email",
            code: "NO_REGISTRATION_STATE",
          });
        }
        
        return res.status(500).json({
          success: false,
          message: "Failed to retrieve registration state",
          error: result.error,
        });
      }

      res.status(200).json({
        success: true,
        message: "Registration state retrieved successfully",
        data: result.data,
      });
    } catch (error) {
      console.error("Error retrieving registration state:", error);
      res.status(500).json({
        success: false,
        message: "Server error retrieving registration state",
        error: error.message,
      });
    }
  }

  // Save/update registration state for cross-device access
  static async saveRegistrationState(req, res) {
    try {
      const { email, currentStep, formData, adminId } = req.body;

      if (!email || !currentStep || !formData) {
        return res.status(400).json({
          success: false,
          message: "Email, currentStep, and formData are required",
        });
      }

      const result = await dtUserService.saveAdminRegistrationState(
        email,
        currentStep,
        formData,
        adminId,
        req
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: "Failed to save registration state",
          error: result.error,
        });
      }

      res.status(200).json({
        success: true,
        message: "Registration state saved successfully",
      });
    } catch (error) {
      console.error("Error saving registration state:", error);
      res.status(500).json({
        success: false,
        message: "Server error saving registration state",
        error: error.message,
      });
    }
  }
}

module.exports = AdminController;
