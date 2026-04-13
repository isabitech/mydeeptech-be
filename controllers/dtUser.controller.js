const dtUserService = require("../services/dtUser.service");
const AnnotationProjectService = require("../services/annotationProject.service");
const AnnotationProjectRepository = require("../repositories/annotationProject.repository");

const annotationProjectService = new AnnotationProjectService(
  new AnnotationProjectRepository(),
);

// Function to send verification emails to all unverified users
const sendVerificationEmailsToUnverifiedUsers = async (req, res) => {
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
    console.error("❌ Error in bulk verification email process:", error);
    if (res) {
      res.status(500).json({
        success: false,
        message: "Server error during bulk verification email process",
        error: error.message,
      });
    }
    throw error;
  }
};

// Option 1: Send email with timeout (current implementation)
const createDTUser = async (req, res) => {
  try {
    const result = await dtUserService.createDTUser(req.body);

    if (result.status === 400) {
      return res.status(400).json({ message: result.message });
    }

    if (result.emailSent === false) {
      return res.status(201).json({
        message:
          "User created successfully. However, there was an issue sending the verification email. Please contact support.",
        user: result.user,
        emailSent: false,
        emailError: result.emailError,
      });
    }

    res.status(201).json({
      message: "User created successfully. Verification email sent.",
      user: result.user,
    });
  } catch (error) {
    console.error("❌ Error creating user:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Option 2: Background email sending (recommended for production)
const createDTUserWithBackgroundEmail = async (req, res) => {
  try {
    const result = await dtUserService.createDTUserWithBackgroundEmail(
      req.body,
    );

    if (result.status === 400) {
      return res.status(400).json({ message: result.message });
    }

    res.status(201).json({
      message:
        "User created successfully. Verification email will be sent shortly.",
      user: result.user,
    });
  } catch (error) {
    console.error("❌ Error creating user:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Email verification function
const verifyEmail = async (req, res) => {
  try {
    const result = await dtUserService.verifyEmail(
      req.params.id,
      req.query.email,
    );

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
    console.error("❌ Error verifying email:", error);
    res.status(500).json({
      success: false,
      message: "Server error during email verification",
      error: error.message,
    });
  }
};

// Password setup function (after email verification)
const setupPassword = async (req, res) => {
  try {
    const result = await dtUserService.setupPassword(req.body);

    if (result.status === 400) {
      // if (result.reason === "validation") return res.status(400).json({ success: false, message: result.message });
      if (result.reason === "email_mismatch")
        return res
          .status(400)
          .json({ success: false, message: "Invalid request" });
      if (result.reason === "not_verified")
        return res
          .status(400)
          .json({
            success: false,
            message: "Email must be verified before setting up password",
          });
      if (result.reason === "already_set")
        return res
          .status(400)
          .json({
            success: false,
            message: "Password has already been set. Use login instead.",
          });
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
    console.error("❌ Error setting up password:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password setup",
      error: error.message,
    });
  }
};

// DTUser login function
const dtUserLogin = async (req, res) => {
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
    console.error("❌ Error during DTUser login:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message,
    });
  }
};

const me = async (req, res) => {
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
    console.error("❌ Error fetching current user:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching user record",
      error: error.message,
    });
  }
};

// Get DTUser profile by userId
const getDTUserProfile = async (req, res) => {
  try {
    const result = await dtUserService.getDTUserProfile(req.params.userId);

    if (result.status === 404) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const { user } = result;
    const profileData = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      domains: user.domains,
      consent: user.consent,
      annotatorStatus: user.annotatorStatus,
      microTaskerStatus: user.microTaskerStatus,
      qaStatus: user.qaStatus,
      isEmailVerified: user.isEmailVerified,
      hasSetPassword: user.hasSetPassword,
      resultLink: user.resultLink,
      personalInfo: {
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phone,
        country: user.personal_info?.country || "",
        timeZone: user.personal_info?.time_zone || "",
        availableHoursPerWeek:
          user.personal_info?.available_hours_per_week || 0,
        preferredCommunicationChannel:
          user.personal_info?.preferred_communication_channel || "",
      },
      paymentInfo: {
        accountName: user.payment_info?.account_name || "",
        accountNumber: user.payment_info?.account_number || "",
        bankName: user.payment_info?.bank_name || "",
        bankCode: user.payment_info?.bank_code || "",
        bank_slug: user.payment_info?.bank_slug || "",
        paymentMethod: user.payment_info?.payment_method || "",
        paymentCurrency: user.payment_info?.payment_currency || "",
      },
      professionalBackground: {
        educationField: user.professional_background?.education_field || "",
        yearsOfExperience:
          user.professional_background?.years_of_experience || 0,
        annotationExperienceTypes:
          user.professional_background?.annotation_experience_types || [],
      },
      toolExperience: user.tool_experience || [],
      annotationSkills: user.annotation_skills || [],
      languageProficiency: {
        primaryLanguage: user.language_proficiency?.primary_language || "",
        otherLanguages: user.language_proficiency?.other_languages || [],
        englishFluencyLevel:
          user.language_proficiency?.english_fluency_level || "",
      },
      systemInfo: {
        deviceType: user.system_info?.device_type || "",
        operatingSystem: user.system_info?.operating_system || "",
        internetSpeedMbps: user.system_info?.internet_speed_mbps || 0,
        powerBackup: user.system_info?.power_backup || false,
        hasWebcam: user.system_info?.has_webcam || false,
        hasMicrophone: user.system_info?.has_microphone || false,
      },
      projectPreferences: {
        domainsOfInterest:
          user.project_preferences?.domains_of_interest || user.domains || [],
        availabilityType: user.project_preferences?.availability_type || "",
        ndaSigned: user.project_preferences?.nda_signed || false,
      },
      attachments: {
        resumeUrl: user.attachments?.resume_url || "",
        idDocumentUrl: user.attachments?.id_document_url || "",
        workSamplesUrl: user.attachments?.work_samples_url || [],
      },
      accountMetadata: {
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        status: user.annotatorStatus,
        isEmailVerified: user.isEmailVerified,
        hasSetPassword: user.hasSetPassword,
      },
    };

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      profile: profileData,
    });
  } catch (error) {
    console.error("❌ Error fetching DTUser profile:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching profile",
      error: error.message,
    });
  }
};

// Update DTUser profile (PATCH endpoint)
const updateDTUserProfile = async (req, res) => {
  try {
    const result = await dtUserService.updateDTUserProfile({
      userId: req.params.userId,
      requesterId: req.user.userId,
      body: req.body,
    });

    if (result.status === 400) {
      return res.status(400).json({ success: false, message: result.message });
    }
    if (result.status === 403) {
      if (result.reason === "forbidden") {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only update your own profile.",
          code: "ACCESS_DENIED",
        });
      }
      if (result.reason === "not_verified") {
        return res.status(403).json({
          success: false,
          message: "Profile updates are only allowed for verified annotators",
          code: "NOT_VERIFIED",
          currentStatus: result.currentStatus,
        });
      }
    }
    if (result.status === 404) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile: result.updatedUser,
    });
  } catch (error) {
    console.error("❌ Error updating DTUser profile:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating profile",
      error: error.message,
    });
  }
};

// DTUser password reset function (requires old password)
const resetDTUserPassword = async (req, res) => {
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
        return res
          .status(400)
          .json({
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
    console.error("❌ Error resetting DTUser password:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password reset",
      error: error.message,
    });
  }
};

// Get single DTUser (public endpoint)
const getDTUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dtUserService.getDTUser(id);

    if (result.status === 404) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "User details retrieved successfully.",
      user: result.user,
    });
  } catch (error) {
    console.error("❌ Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Admin function: Get all DTUsers
const getAllDTUsers = async (req, res) => {
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
    console.error("❌ Error fetching all DTUsers:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching DTUsers",
      error: error.message,
    });
  }
};

// Admin function: Get all admin users
const getAllAdminUsers = async (req, res) => {
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
    console.error("❌ Error fetching admin users:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching admin users",
      error: error.message,
    });
  }
};

// Admin function: Get comprehensive admin dashboard overview
const getAdminDashboard = async (req, res) => {
  try {
    const result = await dtUserService.getAdminDashboard();

    res.status(200).json({
      success: true,
      message: "Admin dashboard overview retrieved successfully",
      data: result.dashboardData,
    });
  } catch (error) {
    console.error("❌ Error fetching admin dashboard overview:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching dashboard data",
      error: error.message,
    });
  }
};

// Admin function: Approve annotator
const approveAnnotator = async (req, res) => {
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
    console.error("❌ Error approving annotator:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating annotator status",
      error: error.message,
    });
  }
};

// Admin function: Get all QA users with their status
const getAllQAUsers = async (req, res) => {
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
    console.error("❌ Error fetching QA users:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching QA users",
      error: error.message,
    });
  }
};

// Admin function: Approve user for QA status
const approveUserForQA = async (req, res) => {
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
    console.error("❌ Error approving QA status:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating QA status",
      error: error.message,
    });
  }
};

// Admin function: Reject user for QA status
const rejectUserForQA = async (req, res) => {
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
    console.error("❌ Error rejecting QA status:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating QA status",
      error: error.message,
    });
  }
};

// Admin function: Reject annotator (dedicated endpoint)
const rejectAnnotator = async (req, res) => {
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
      message: `Annotator rejected successfully. User approved as micro tasker.`,
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
    console.error("❌ Error rejecting annotator:", error);
    res.status(500).json({
      success: false,
      message: "Server error rejecting annotator",
      error: error.message,
    });
  }
};

// Admin function: Get single DTUser details
const getDTUserAdmin = async (req, res) => {
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
    console.error("❌ Error fetching user details (admin):", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching user details",
      error: error.message,
    });
  }
};

// Admin function: Request admin verification (Step 1)
const requestAdminVerification = async (req, res) => {
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
            "Admin email must end with @mydeeptech.ng or be in approved admin list",
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
    console.error("❌ Error requesting admin verification:", error);
    res.status(500).json({
      success: false,
      message: "Server error requesting admin verification",
      error: error.message,
    });
  }
};

// Admin function: Confirm verification and create admin (Step 2)
const confirmAdminVerification = async (req, res) => {
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
      },
    });
  } catch (error) {
    console.error("❌ Error confirming admin verification:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating admin account",
      error: error.message,
    });
  }
};

// Legacy admin creation function (kept for backward compatibility)
const createAdmin = async (req, res) => {
  try {
    const result = await dtUserService.createAdmin(req.body);

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
            "Admin email must end with @mydeeptech.ng or be in approved admin list",
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
    console.error("❌ Error creating admin account:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating admin account",
      error: error.message,
    });
  }
};

// Verify Admin Account with OTP
const verifyAdminOTP = async (req, res) => {
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
    console.error("❌ Error during admin OTP verification:", error);
    res.status(500).json({
      success: false,
      message: "Server error during OTP verification",
      error: error.message,
    });
  }
};

// Admin Login
const adminLogin = async (req, res) => {
  try {
    const result = await dtUserService.adminLogin(req.body);

    if (result.status === 400) {
      if (result.reason === "validation") {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: result.errors,
        });
      }
      if (result.reason === "invalid_domain") {
        return res.status(400).json({
          success: false,
          message: "Invalid credentials or account not verified",
        });
      }
    }

    if (result.status === 401) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials or account not verified",
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
    console.error("❌ Error during admin login:", error);
    res.status(500).json({
      success: false,
      message: "Server error during admin login",
      error: error.message,
    });
  }
};

// Resend verification email endpoint
const resendVerificationEmail = async (req, res) => {
  try {
    const result = await dtUserService.resendVerificationEmail(req.body.email);

    if (result.status === 400) {
      if (result.reason === "email_required")
        return res
          .status(400)
          .json({ success: false, message: "Email is required" });
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
        `❌ Failed to resend verification email to ${user.email}:`,
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
    console.error("❌ Error while resending verification email:", error);
    res.status(500).json({
      success: false,
      message: "Server error while resending verification email",
      error: error.message,
    });
  }
};

// DTUser function: Get available projects (only for approved annotators)
const getAvailableProjects = async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await dtUserService.getAvailableProjects(userId, req.query);

    if (result.status === 404) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }
    if (result.status === 403) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Access denied. Only approved annotators can view projects.",
        });
    }
    res.status(200).json({
      success: true,
      message: `Found ${result.data.projects.length} projects`,
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Error fetching projects:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// DTUser function: Apply to a project
const applyToProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.userId || req.userId;
    const application = await annotationProjectService.applyToProject(
      userId,
      projectId,
      req.body,
    );
    let responseMessage = "Application submitted successfully";
    let additionalData = {};
    if (application.status === "assessment_required") {
      responseMessage =
        "Application submitted. Please check your email for assessment instructions.";
      additionalData = {
        assessmentRequired: true,
        assessmentStatus: "invitation_sent",
        message:
          "You must complete the multimedia assessment before your application can be reviewed.",
      };
    }
    res.status(201).json({
      success: true,
      message: responseMessage,
      data: {
        application,
        projectName: application.projectId?.projectName,
        ...additionalData,
      },
    });
  } catch (error) {
    if (error.message === "not_approved") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only approved annotators can apply to projects.",
      });
    }
    if (error.message === "resume_required") {
      return res.status(400).json({
        success: false,
        message: "Please upload your resume in your profile section",
        error: {
          code: "RESUME_REQUIRED",
          reason: "A resume is required to apply to projects",
          action: "Upload your resume in the profile section before applying",
        },
      });
    }
    if (error.message === "project_not_found") {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }
    if (error.message === "project_closed") {
      return res.status(400).json({
        success: false,
        message: "Project is not currently accepting applications",
      });
    }
    if (error.message === "duplicate") {
      return res.status(400).json({
        success: false,
        message: "You have already applied to this project",
        applicationStatus: error.applicationStatus,
      });
    }
    if (error.message === "project_full") {
      return res.status(400).json({
        success: false,
        message: "Project has reached maximum number of applicants",
      });
    }
    if (error.message === "assessment_cooldown") {
      return res.status(400).json({
        success: false,
        message: "Assessment retake cooldown active",
        error: {
          code: "ASSESSMENT_COOLDOWN_ACTIVE",
          cooldownEndsAt: error.cooldownEndsAt,
          hoursRemaining: error.hoursRemaining,
        },
      });
    }
    if (error.message === "assessment_config_missing") {
      return res.status(400).json({
        success: false,
        message: "Assessment configuration not available for this project",
      });
    }

    console.error("❌ Error applying to project:", error);
    res.status(500).json({
      success: false,
      message: "Server error while applying to project",
      error: error.message,
    });
  }
};

// DTUser function: Get user's active projects
const getUserActiveProjects = async (req, res) => {
  try {
    const result = await dtUserService.getUserActiveProjects({
      userId: req.params.userId || req.user.userId,
      requestingUser: req.user,
      isAdmin: !!req.admin,
    });

    if (result.status === 403) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view your own projects.",
      });
    }

    res.status(200).json({
      success: true,
      message: "User projects retrieved successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Error fetching user active projects:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching user projects",
      error: error.message,
    });
  }
};

// ===== INVOICE MANAGEMENT FUNCTIONS =====

// DTUser function: Get all invoices for the user
const getUserInvoices = async (req, res) => {
  try {
    const result = await dtUserService.getUserInvoices({
      userId: req.user.userId,
      query: req.query,
    });

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Error fetching user invoices:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching invoices",
      error: error.message,
    });
  }
};

// DTUser function: Get unpaid invoices specifically
const getUnpaidInvoices = async (req, res) => {
  try {
    const result = await dtUserService.getUnpaidInvoices({
      userId: req.user.userId,
      query: req.query,
    });

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Error fetching unpaid invoices:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching unpaid invoices",
      error: error.message,
    });
  }
};

// DTUser function: Get paid invoices specifically
const getPaidInvoices = async (req, res) => {
  try {
    const result = await dtUserService.getPaidInvoices({
      userId: req.user.userId,
      query: req.query,
    });

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Error fetching paid invoices:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching paid invoices",
      error: error.message,
    });
  }
};

// DTUser function: Get specific invoice details
const getInvoiceDetails = async (req, res) => {
  try {
    const result = await dtUserService.getInvoiceDetails({
      userId: req.user.userId,
      invoiceId: req.params.invoiceId,
    });

    if (result.status === 400) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid invoice ID" });
    }

    if (result.status === 404) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Invoice not found or access denied",
        });
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Error fetching invoice details:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching invoice details",
      error: error.message,
    });
  }
};

// DTUser function: Get invoice dashboard summary
const getInvoiceDashboard = async (req, res) => {
  try {
    const result = await dtUserService.getInvoiceDashboard(req.user.userId);

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Error fetching invoice dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching invoice dashboard",
      error: error.message,
    });
  }
};

// DTUser Dashboard - Personal overview for authenticated users
const getDTUserDashboard = async (req, res) => {
  try {
    console.log("📥 User", req.user.userId, "requesting dashboard");

    const result = await dtUserService.getDTUserDashboard({
      userId: req.user?.userId || req.userId,
      email: req.user?.email || req.email,
    });

    if (result.status === 404) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Error generating DTUser dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Server error generating user dashboard",
      error: error.message,
    });
  }
};

// Admin function: Manually add a user to a project (internal/admin use)
const manuallyAddUserToProject = async (req, res) => {
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
      return res
        .status(400)
        .json({
          success: false,
          message: "User is already approved for this project",
        });

    console.error("❌ Error manually adding user to project:", error);
    res.status(500).json({
      success: false,
      message: "Server error adding user to project",
      error: error.message,
    });
  }
};

// Submit result file upload and store in Cloudinary

const submitResultWithCloudinary = async (req, res) => {
  try {
    const result = await dtUserService.submitResultWithCloudinary({
      userId: req.user.userId,
      file: req.file,
      body: req.body,
    });

    if (result.status === 400) {
      if (result.reason === "file_required") {
        return res.status(400).json({
          success: false,
          message: "Result file is required. Please upload a file.",
        });
      }
    }

    if (result.status === 404) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Result file uploaded and stored successfully in Cloudinary",
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Error processing result upload:", error);
    res.status(500).json({
      success: false,
      message: "Server error processing result upload",
      error: error.message,
    });
  }
};

// Upload ID Document and store in user profile
const uploadIdDocument = async (req, res) => {
  try {
    const result = await dtUserService.uploadIdDocument({
      user: req.user,
      file: req.file,
    });

    if (result.status === 400) {
      return res.status(400).json({
        success: false,
        message: "ID document file is required. Please upload a file.",
      });
    }

    if (result.status === 404) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "ID document uploaded and stored successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Error in ID document upload:", error);
    res.status(500).json({
      success: false,
      message: "Server error during ID document upload",
      error: error.message,
    });
  }
};

// Upload Resume and store in user profile
const uploadResume = async (req, res) => {
  try {
    const result = await dtUserService.uploadResume({
      user: req.user,
      file: req.file,
    });

    if (result.status === 400) {
      return res.status(400).json({
        success: false,
        message: "Resume file is required. Please upload a file.",
      });
    }

    if (result.status === 404) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Resume uploaded and stored successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Error in resume upload:", error);
    res.status(500).json({
      success: false,
      message: "Server error during resume upload",
      error: error.message,
    });
  }
};

// Get all result submissions for a user
const getUserResultSubmissions = async (req, res) => {
  try {
    const result = await dtUserService.getUserResultSubmissions({
      userId: req.user.userId,
      query: req.query,
    });

    if (result.status === 404) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Result submissions retrieved successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Error getting result submissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving result submissions",
      error: error.message,
    });
  }
};

// Get project guidelines for approved annotators only
const getProjectGuidelines = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to access project guidelines",
      });
    }

    const result = await annotationProjectService.getProjectGuidelines(
      projectId,
      userId,
    );

    res.status(200).json({
      ...result,
    });
  } catch (error) {
    if (error.message === "project_not_found")
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });

    console.error("❌ Error getting project guidelines:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving project guidelines",
      error: error.message,
    });
  }
};

// Admin function: Get all users for role management
const getAllUsersForRoleManagement = async (req, res) => {
  try {
    const result = await dtUserService.getAllUsersForRoleManagement({
      query: req.query,
    });

    res.status(200).json({
      success: true,
      responseCode: result.responseCode,
      responseMessage: result.responseMessage,
      data: result.data,
      pagination: result.pagination,
      summary: result.summary,
    });
  } catch (error) {
    console.error("❌ Error in getAllUsersForRoleManagement:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching users for role management",
      error: error.message,
    });
  }
};

// Admin function: Update user role
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, reason } = req.body;

    const result = await dtUserService.updateUserRole({ userId, role, reason });

    if (result.status === 400) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid role specified" });
    }

    if (result.status === 404) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      responseCode: result.responseCode,
      responseMessage: result.responseMessage,
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Error in updateUserRole:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating user role",
      error: error.message,
    });
  }
};

module.exports = {
  me,
  createDTUser,
  createDTUserWithBackgroundEmail,
  verifyEmail,
  setupPassword,
  dtUserLogin,
  getDTUserProfile,
  updateDTUserProfile,
  resetDTUserPassword,
  resendVerificationEmail,
  sendVerificationEmailsToUnverifiedUsers,
  getDTUser,
  getAllDTUsers,
  getAllAdminUsers,
  getAdminDashboard,
  getDTUserDashboard,
  approveAnnotator,
  approveUserForQA,
  rejectUserForQA,
  getAllQAUsers,
  rejectAnnotator,
  getDTUserAdmin,
  requestAdminVerification,
  confirmAdminVerification,
  createAdmin,
  verifyAdminOTP,
  adminLogin,
  getAvailableProjects,
  applyToProject,
  getUserActiveProjects,
  getUserInvoices,
  getUnpaidInvoices,
  getPaidInvoices,
  getInvoiceDetails,
  getInvoiceDashboard,
  submitResultWithCloudinary,
  getUserResultSubmissions,
  uploadIdDocument,
  uploadResume,
  getProjectGuidelines,
  getAllUsersForRoleManagement,
  updateUserRole,
  manuallyAddUserToProject,
};
