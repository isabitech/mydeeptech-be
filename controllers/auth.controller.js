const dtUserService = require("../services/dtUser.service");
class AuthController {
  // Option 1: Send email with timeout (current implementation)
  static async createDTUser(req, res) {
    try {
      const result = await dtUserService.createDTUser(req.body);

      if (result.status === 400) {
        return res.status(400).json({
          message: "User already exists with this email",
        });
      }

      const { newUser, emailPromise } = result;

      try {
        await emailPromise;
        return res.status(201).json({
          message: "User created successfully. Verification email sent.",
          user: newUser,
        });
      } catch (emailError) {
        console.error("Email sending failed:", emailError.message);
        return res.status(201).json({
          message:
            "User created successfully. However, there was an issue sending the verification email. Please contact support.",
          user: newUser,
          emailSent: false,
          emailError: emailError.message,
        });
      }
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
  // Option 2: Background email sending (recommended for production)
  static async createDTUserWithBackgroundEmail(req, res) {
    try {
      const result = await dtUserService.createDTUserWithBackgroundEmail(
        req.body,
      );

      if (result.status === 400) {
        return res.status(400).json({
          message: "User already exists with this email",
        });
      }

      res.status(201).json({
        message:
          "User created successfully. Verification email will be sent shortly.",
        user: result.newUser,
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }

  // Email verification function
  static async verifyEmail(req, res) {
    try {
      const result = await dtUserService.verifyEmail({
        id: req.params.id,
        email: req.query.email,
      });

      if (result.status === 404) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }
      if (result.status === 400) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid verification link" });
      }

      const { user, reason } = result;

      res.status(200).json({
        success: true,
        message:
          reason === "already_verified"
            ? "Email is already verified"
            : "Email verified successfully!",
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
        },
      });
    } catch (error) {
      console.error("Error verifying email:", error);
      res.status(500).json({
        success: false,
        message: "Server error during email verification",
        error: error.message,
      });
    }
  }

  // Password setup function (after email verification)
  static async setupPassword(req, res) {
    try {
      const result = await dtUserService.setupPassword({
        userId: req.body.userId,
        email: req.body.email,
        password: req.body.password,
        body: req.body,
      });

      if (result.status === 400) {
        if (result.reason === "email_mismatch")
          return res
            .status(400)
            .json({ success: false, message: "Invalid request" });
        if (result.reason === "not_verified")
          return res.status(400).json({
            success: false,
            message: "Email must be verified before setting up password",
          });
        if (result.reason === "already_set")
          return res.status(400).json({
            success: false,
            message: "Password has already been set. Use login instead.",
          });
        if (result.reason === "validation") {
          return res
            .status(400)
            .json({ success: false, message: result.message });
        }
      }
      if (result.status === 404) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const { user } = result;
      res.status(200).json({
        success: true,
        message: "Password set successfully! You can now login.",
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          domains: user.domains,
          socialsFollowed: user.socialsFollowed,
          isEmailVerified: user.isEmailVerified,
          hasSetPassword: user.hasSetPassword,
          annotatorStatus: user.annotatorStatus,
          microTaskerStatus: user.microTaskerStatus,
          qaStatus: user.qaStatus,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error setting up password:", error);
      res.status(500).json({
        success: false,
        message: "Server error during password setup",
        error: error.message,
      });
    }
  }

  // DTUser login function
  static async dtUserLogin(req, res) {
    try {
      const result = await dtUserService.dtUserLogin(req.body);

      if (result.status === 400) {
        if (result.reason === "verify_resend_success") {
          return res.status(400).json({
            success: false,
            message:
              "Please verify your email first. A new verification email has been sent to your inbox.",
            emailResent: true,
          });
        }
        if (result.reason === "verify_resend_fail") {
          return res.status(400).json({
            success: false,
            message:
              "Please verify your email first. Unable to resend verification email at this time.",
            emailResent: false,
          });
        }
        if (result.reason === "password_not_set") {
          return res.status(400).json({
            success: false,
            message: "Please set up your password first",
            requiresPasswordSetup: true,
            userId: result.userId,
          });
        }
        if (result.reason === "invalid_credentials") {
          return res
            .status(400)
            .json({ success: false, message: "Invalid credentials" });
        }
      }
      if (result.status === 404) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const { user, token } = result;
      res.status(200).json({
        success: true,
        message: "Login successful",
        _usrinfo: { data: token },
        token: token,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          domains: user.domains,
          socialsFollowed: user.socialsFollowed,
          consent: user.consent,
          isEmailVerified: user.isEmailVerified,
          hasSetPassword: user.hasSetPassword,
          annotatorStatus: user.annotatorStatus,
          microTaskerStatus: user.microTaskerStatus,
          qaStatus: user.qaStatus,
          resultLink: user.resultLink,
          isAssessmentSubmitted: !!user.assessmentSubmission,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error during DTUser login:", error);
      res.status(500).json({
        success: false,
        message: "Server error during login",
        error: error.message,
      });
    }
  }

  static async me(req, res) {
    try {
      const result = await dtUserService.me(req.user.email);

      if (result.status === 404) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const { user, token } = result;
      res.status(200).json({
        success: true,
        message: "User records fetched successfully",
        _usrinfo: { data: token },
        token: token,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          domains: user.domains,
          socialsFollowed: user.socialsFollowed,
          consent: user.consent,
          isEmailVerified: user.isEmailVerified,
          hasSetPassword: user.hasSetPassword,
          annotatorStatus: user.annotatorStatus,
          microTaskerStatus: user.microTaskerStatus,
          qaStatus: user.qaStatus,
          resultLink: user.resultLink,
          isAssessmentSubmitted: !!user.assessmentSubmission,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching user record",
        error: error.message,
      });
    }
  }

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
  static async sendVerificationEmailsToUnverifiedUsers(req, res) {
    try {
      const result =
        await dtUserService.sendVerificationEmailsToUnverifiedUsers();

      if (res) {
        res.status(200).json({
          success: true,
          message: `Bulk verification emails processed. ${result.emailsSent} sent, ${result.emailsFailed} failed.`,
          data: result,
        });
      }

      return result;
    } catch (error) {
      console.error("Error in bulk verification email process:", error);
      if (res) {
        res.status(500).json({
          success: false,
          message: "Server error during bulk verification email process",
          error: error.message,
        });
      }
      throw error;
    }
  }

  static async resetDTUserPassword(req, res) {
    try {
      const result = await dtUserService.resetDTUserPassword({
        userId: req.user.userId,
        body: req.body,
      });

      if (result.status === 400) {
        if (result.reason === "validation") {
          return res
            .status(400)
            .json({ success: false, message: result.message });
        }
        if (result.reason === "no_password") {
          return res.status(400).json({
            success: false,
            message:
              "No password is currently set. Please use the setup password endpoint instead.",
            requiresPasswordSetup: true,
          });
        }
        if (result.reason === "invalid_old_password") {
          return res
            .status(400)
            .json({ success: false, message: "Current password is incorrect" });
        }
        if (result.reason === "same_password") {
          return res.status(400).json({
            success: false,
            message: "New password must be different from current password",
          });
        }
      }

      if (result.status === 404) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const { user } = result;
      res.status(200).json({
        success: true,
        message: "Password reset successfully",
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          hasSetPassword: true,
          qaStatus: user.qaStatus,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error resetting DTUser password:", error);
      res.status(500).json({
        success: false,
        message: "Server error during password reset",
        error: error.message,
      });
    }
  }
}

module.exports = AuthController;
