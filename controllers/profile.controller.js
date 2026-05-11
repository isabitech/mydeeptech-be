const dtUserService = require("../services/dtUser.service");
const DTUser = require("../models/dtUser.model");
class ProfileController {
  // Get DTUser profile by userId
  static async getDTUserProfile(req, res) {
    console.log("Fetching profile for userId:", req.params.userId);
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
        date_of_birth: user.date_of_birth ?? null,
        userDomains: user.userDomains || [], // New structured domain relationships
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
          nativeLanguages: user.language_proficiency?.native_languages || [],
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
          isAssessmentSubmitted: Boolean(user.assessmentSubmission || false),
        },
      };

      res.status(200).json({
        success: true,
        message: "Profile retrieved successfully",
        profile: profileData,
      });
    } catch (error) {
      console.error("Error fetching DTUser profile:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching profile",
        error: error.message,
      });
    }
  }
  // Update DTUser profile (PATCH endpoint)
  static async updateDTUserProfile(req, res) {
    try {
      const userResult = await dtUserService.getDTUserProfile(
        req.params.userId,
      );

      if (userResult.status === 404) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const result = await dtUserService.updateDTUserProfile({
        userId: req.params.userId,
        requesterId: req.user.userId,
        body: req.body,
        user: userResult.user,
      });

      if (result.status === 400) {
        return res
          .status(400)
          .json({ success: false, message: result.message });
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

      const user = result.updatedUser._doc; // Convert Mongoose document to plain object

        res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          date_of_birth: user.date_of_birth ?? null,
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
          isAssessmentSubmitted: Boolean(user.assessmentSubmission || false),
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });

    } catch (error) {
      console.error("Error updating DTUser profile:", error);
      res.status(500).json({
        success: false,
        message: "Server error updating profile",
        error: error.message,
      });
    }
  }
  // Get single DTUser (public endpoint)
  static async getDTUser(req, res) {
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
      console.error("Error fetching user:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
  static async uploadResume(req, res) {
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
      console.error("Error in resume upload:", error);
      res.status(500).json({
        success: false,
        message: "Server error during resume upload",
        error: error.message,
      });
    }
  }
  static async uploadIdDocument(req, res) {
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
      console.error("Error in ID document upload:", error);
      res.status(500).json({
        success: false,
        message: "Server error during ID document upload",
        error: error.message,
      });
    }
  }

  // SOP (Standard Operating Procedure) acceptance tracking
  
  /**
   * Check if user has accepted the SOP
   * GET /api/auth/sop-acceptance/status
   */
  static async getSopAcceptanceStatus(req, res) {
    try {
      const { userId } = req.user;

      const user = await DTUser.findById(userId).select(
        "sop_acceptance fullName email _id",
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          data: null,
        });
      }

      res.status(200).json({
        success: true,
        message: "SOP acceptance status retrieved successfully",
        data: {
          has_accepted: user.sop_acceptance?.has_accepted || false,
          accepted_at: user.sop_acceptance?.accepted_at || null,
          user: {
            userId: user._id,
            name: user.fullName,
            email: user.email,
          },
        },
      });
    } catch (error) {
      console.error("Error getting SOP acceptance status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get SOP acceptance status",
        error: error.message || "Unknown error",
        data: null,
      });
    }
  }

  /**
   * Record user's acceptance of the SOP
   * POST /api/auth/sop-acceptance
   */
  static async recordSopAcceptance(req, res) {
    try {
      const { userId } = req.user;

      const user = await DTUser.findByIdAndUpdate(
        userId,
        {
          $set: {
            "sop_acceptance.has_accepted": true,
            "sop_acceptance.accepted_at": new Date(),
          },
        },
        { new: true },
      ).select("sop_acceptance fullName email _id");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          data: null,
        });
      }

      res.status(200).json({
        success: true,
        message: "SOP acceptance recorded successfully",
        data: {
          has_accepted: user.sop_acceptance.has_accepted,
          accepted_at: user.sop_acceptance.accepted_at,
          user: {
            userId: user._id,
            name: user.fullName,
            email: user.email,
          },
        },
      });
    } catch (error) {
      console.error("Error recording SOP acceptance:", error);
      res.status(500).json({
        success: false,
        message: "Failed to record SOP acceptance",
        error: error.message || "Unknown error",
        data: null,
      });
    }
  }
}

module.exports = ProfileController;
