const dtUserService = require("../services/dtUser.service");
const AnnotationProjectService = require("../services/annotationProject.service");
const AnnotationProjectRepository = require("../repositories/annotationProject.repository");
const DTUser = require("../models/dtUser.model");

const annotationProjectService = new AnnotationProjectService(
  new AnnotationProjectRepository(),
);

class DTUserController {
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

  // DTUser function: Get available projects (only for approved annotators)
  static async getAvailableProjects(req, res) {
    try {
      const userId = req.user.userId;
      const result = await dtUserService.getAvailableProjects(
        userId,
        req.query,
      );

      if (result.status === 404) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }
      if (result.status === 403) {
        return res.status(403).json({
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
      console.error("Error fetching projects:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }

  // DTUser function: Apply to a project
  static async applyToProject(req, res) {
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

      console.error("Error applying to project:", error);
      res.status(500).json({
        success: false,
        message: "Server error while applying to project",
        error: error.message,
      });
    }
  }

  // DTUser function: Get user's active projects
  static async getUserActiveProjects(req, res) {
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
      console.error("Error fetching user active projects:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching user projects",
        error: error.message,
      });
    }
  }

  // DTUser Dashboard - Personal overview for authenticated users
  static async getDTUserDashboard(req, res) {
    try {
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
      console.error("Error generating DTUser dashboard:", error);
      res.status(500).json({
        success: false,
        message: "Server error generating user dashboard",
        error: error.message,
      });
    }
  }

  // Submit result file upload and store in Cloudinary
  static async submitResultWithCloudinary(req, res) {
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
      console.error("Error processing result upload:", error);
      res.status(500).json({
        success: false,
        message: "Server error processing result upload",
        error: error.message,
      });
    }
  }

  // Get all result submissions for a user
  static async getUserResultSubmissions(req, res) {
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
      console.error("Error getting result submissions:", error);
      res.status(500).json({
        success: false,
        message: "Server error retrieving result submissions",
        error: error.message,
      });
    }
  }

  // Get project guidelines for approved annotators only
  static async getProjectGuidelines(req, res) {
    try {
      const { projectId } = req.params;
      const userId = req.user?.userId || req.userId;

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

      console.error("Error getting project guidelines:", error);
      res.status(500).json({
        success: false,
        message: "Server error retrieving project guidelines",
        error: error.message,
      });
    }
  }
}
module.exports = DTUserController;
