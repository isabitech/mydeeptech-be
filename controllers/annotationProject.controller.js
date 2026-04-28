const Joi = require("joi");
const AnnotationProjectService = require("../services/annotationProject.service");
const AnnotationProjectRepository = require("../repositories/annotationProject.repository");

const createProjectSchema = Joi.object({
  projectName: Joi.string().trim().max(200).required(),
  projectDescription: Joi.string().trim().max(2000).required(),
  projectCategory: Joi.string()
    .valid(
      "Text Annotation",
      "Image Annotation",
      "Audio Annotation",
      "Video Annotation",
      "Data Labeling",
      "Content Moderation",
      "Transcription",
      "Translation",
      "Sentiment Analysis",
      "Entity Recognition",
      "Classification",
      "Object Detection",
      "Semantic Segmentation",
      "Survey Research",
      "Data Entry",
      "Quality Assurance",
      "Other",
    )
    .required(),
  payRate: Joi.number().min(0).required(),
  payRateCurrency: Joi.string()
    .valid("USD", "EUR", "GBP", "NGN", "KES", "GHS")
    .default("USD"),
  payRateType: Joi.string()
    .valid("per_task", "per_hour", "per_project", "per_annotation")
    .default("per_task"),
  aiInterviewRequired: Joi.boolean().optional(),
  maxAnnotators: Joi.number().min(1).allow(null).optional(),
  deadline: Joi.date()
    .greater("now")
    .default(() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d;
    }),
  estimatedDuration: Joi.string().max(100).required(),
  applicationDuration: Joi.number()
    .valid(1, 2, 3, 4)
    .optional()
    .messages({
      "any.only": "Application duration must be 1, 2, 3, or 4 weeks",
    }),
  difficultyLevel: Joi.string()
    .valid("beginner", "intermediate", "advanced", "expert")
    .required(),
  requiredSkills: Joi.array().items(Joi.string()).default([]),
  minimumExperience: Joi.string()
    .valid("none", "beginner", "intermediate", "advanced")
    .required(),
  languageRequirements: Joi.array().items(Joi.string()).default([]),
  tags: Joi.array().items(Joi.string()).default([]),
  applicationDeadline: Joi.date()
    .greater("now")
    .default(() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d;
    }),
  projectGuidelineLink: Joi.string()
    .uri()
    .allow("")
    .optional()
    .messages({ "string.uri": "Project guideline link must be a valid URL" }),
  projectGuidelineVideo: Joi.string()
    .uri()
    .allow("")
    .optional()
    .messages({ "string.uri": "Project guideline video must be a valid URL" }),
  projectCommunityLink: Joi.string()
    .uri()
    .allow("")
    .optional()
    .messages({ "string.uri": "Project community link must be a valid URL" }),
  projectTrackerLink: Joi.string()
    .uri()
    .allow("")
    .optional()
    .messages({ "string.uri": "Project tracker link must be a valid URL" }),
  isActive: Joi.boolean().default(true),
});

const removeApplicantSchema = Joi.object({
  removalReason: Joi.string()
    .valid(
      "performance_issues",
      "project_cancelled",
      "violates_guidelines",
      "unavailable",
      "quality_concerns",
      "admin_decision",
      "other",
    )
    .optional(),
  removalNotes: Joi.string().max(500).allow("").optional(),
});

const approveRejectedApplicantSchema = Joi.object({
  projectId: Joi.string().required(),
  applicantId: Joi.string().required(),
  reviewNotes: Joi.string().max(500).allow("").optional(),
});

class AnnotationProjectController {
  constructor() {
    this.service = new AnnotationProjectService(
      new AnnotationProjectRepository(),
    );
    // bind all methods so they work directly as route handlers
    const methods = Object.getOwnPropertyNames(
      AnnotationProjectController.prototype,
    ).filter((m) => m !== "constructor");
    methods.forEach((m) => {
      this[m] = this[m].bind(this);
    });
  }

  _getAdmin(req) {
    return {
      userId:
        req.admin?.userId ||
        req.userId ||
        req.admin?.userDoc?._id ||
        req.admin?._id,
      fullName: req.admin?.fullName || "Administrator",
      email: req.admin?.email || "admin@mydeeptech.ng",
      ...req.admin,
    };
  }

  _validate(schema, body) {
    return schema.validate(body);
  }

  async createAnnotationProject(req, res) {
    try {
      const { error, value } = this._validate(createProjectSchema, req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.details.map((d) => d.message),
        });
      }
      const admin = this._getAdmin(req);
      if (!admin.userId) {
        return res.status(400).json({
          success: false,
          message: "Admin identification required to create project",
        });
      }
      const project = await this.service.createProject(value, admin);
      res.status(201).json({
        success: true,
        message: "Annotation project created successfully",
        data: { project },
      });
    } catch (error) {
      if (error.message === "Admin identification required") {
        return res.status(400).json({
          success: false,
          message: "Admin identification required to create project",
        });
      }
      console.error("Error creating annotation project:", error);
      res.status(500).json({
        success: false,
        message: "Server error creating annotation project",
        error: error.message,
      });
    }
  }

  async getAllAnnotationProjects(req, res) {
    try {
      const data = await this.service.getAllProjects(req.query);
      res.status(200).json({
        success: true,
        message: `Retrieved ${data.projects.length} annotation projects`,
        data,
      });
    } catch (error) {
      console.error("Error fetching annotation projects:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching annotation projects",
        error: error.message,
      });
    }
  }

  async getAnnotationProjectDetails(req, res) {
    try {
      const data = await this.service.getProjectDetails(
        req.params.projectId,
        req.query.search,
      );
      res.status(200).json({
        success: true,
        message: req.query.search
          ? `Annotation project details retrieved successfully with search filter: "${req.query.search}"`
          : "Annotation project details retrieved successfully",
        data,
      });
    } catch (error) {
      if (error.message === "Project not found") {
        return res
          .status(404)
          .json({ success: false, message: "Annotation project not found" });
      }
      console.error("Error fetching annotation project details:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching annotation project details",
        error: error.message,
      });
    }
  }

  async updateAnnotationProject(req, res) {
    try {
      const updateSchema = createProjectSchema.fork(
        Object.keys(createProjectSchema.describe().keys),
        (schema) => schema.optional(),
      );
      const { error, value } = this._validate(updateSchema, req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.details.map((d) => d.message),
        });
      }
      const project = await this.service.updateProject(
        req.params.projectId,
        value,
      );
      res.status(200).json({
        success: true,
        message: "Annotation project updated successfully",
        data: { project },
      });
    } catch (error) {
      if (error.message === "Project not found") {
        return res
          .status(404)
          .json({ success: false, message: "Annotation project not found" });
      }
      console.error("Error updating annotation project:", error);
      res.status(500).json({
        success: false,
        message: "Server error updating annotation project",
        error: error.message,
      });
    }
  }
  
    async approveRejectedProjectApplicant(req, res) {
    try {
      const { error, value } = this._validate(approveRejectedApplicantSchema, req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.details.map((d) => d.message),
        });
      }

      const admin = this._getAdmin(req);
      const result = await this.service.approveRejectedApplicant(
        value.projectId,
        value.applicantId,
        admin,
        value.reviewNotes
      );

      res.status(200).json({
        success: true,
        message: "Applicant approved successfully",
        data: result,
      });
    } catch (error) {
      if (error.message === "Project not found") {
        return res.status(404).json({ 
          success: false, 
          message: "Project not found" 
        });
      }
      if (error.message === "Application not found") {
        return res.status(404).json({ 
          success: false, 
          message: "Application not found" 
        });
      }
      if (error.message === "Only rejected or removed applicants can be re-approved") {
        return res.status(400).json({ 
          success: false, 
          message: "Only rejected or removed applicants can be re-approved" 
        });
      }
      if (error.message === "Project is not active") {
        return res.status(400).json({ 
          success: false, 
          message: "Cannot approve applicants for inactive projects" 
        });
      }
      if (error.message.includes("maximum annotators")) {
        return res.status(400).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      console.error("Error approving rejected applicant:", error);
      res.status(500).json({
        success: false,
        message: "Server error approving rejected applicant",
        error: error.message,
      });
    }
  }

  async toggleProjectStatus(req, res) {
    try {
      const project = await this.service.toggleProjectStatus(
        req.params.projectId,
      );
      res.status(200).json({
        success: true,
        message: `Project ${project.isActive ? "activated" : "deactivated"} successfully`,
        data: {
          project: {
            _id: project._id,
            projectName: project.projectName,
            isActive: project.isActive,
            status: project.status,
            openCloseStatus: project.openCloseStatus,
          },
        },
      });
    } catch (error) {
      if (error.message === "Project not found") {
        return res
          .status(404)
          .json({ success: false, message: "Annotation project not found" });
      }
      console.error("Error toggling project active status:", error);
      res.status(500).json({
        success: false,
        message: `Server error toggling project active status: ${error.message}`,
        error: error.message,
      });
    }
  }

  async toggleProjectVisibility(req, res) {
    try {
      const project = await this.service.toggleProjectVisibility(
        req.params.projectId,
      );
      res.status(200).json({
        success: true,
        message: `Project ${project.openCloseStatus === "open" ? "opened" : "closed"} successfully`,
        data: {
          project: {
            _id: project._id,
            projectName: project.projectName,
            isActive: project.isActive,
            status: project.status,
            openCloseStatus: project.openCloseStatus,
          },
        },
      });
    } catch (error) {
      if (error.message === "Project not found") {
        return res
          .status(404)
          .json({ success: false, message: "Annotation project not found" });
      }
      console.error("Error toggling project visibility status:", error);
      res.status(500).json({
        success: false,
        message: "Server error toggling project active status",
        error: error.message,
      });
    }
  }

  async deleteAnnotationProject(req, res) {
    try {
      const result = await this.service.deleteProject(req.params.projectId);
      if (result.requiresOTP) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete project with ${result.activeApplications} active applications. Please resolve all applications first or use force delete with OTP verification.`,
          data: {
            activeApplications: result.activeApplications,
            requiresOTP: true,
            projectName: result.projectName,
            projectId: result.projectId,
          },
        });
      }
      res.status(200).json({
        success: true,
        message: "Annotation project deleted successfully",
      });
    } catch (error) {
      if (error.message === "Project not found") {
        return res
          .status(404)
          .json({ success: false, message: "Annotation project not found" });
      }
      console.error("Error deleting annotation project:", error);
      res.status(500).json({
        success: false,
        message: "Server error deleting annotation project",
        error: error.message,
      });
    }
  }

  async requestProjectDeletionOTP(req, res) {
    try {
      const admin = this._getAdmin(req);
      const result = await this.service.requestDeletionOTP(
        req.params.projectId,
        admin,
        req.body.reason,
      );
      res.status(200).json({
        success: true,
        message: "Deletion OTP sent to Projects Officer for approval",
        data: result,
      });
    } catch (error) {
      if (error.message === "Project not found") {
        return res
          .status(404)
          .json({ success: false, message: "Annotation project not found" });
      }
      console.error("Error requesting deletion OTP:", error);
      res.status(500).json({
        success: false,
        message: "Server error requesting deletion OTP",
        error: error.message,
      });
    }
  }

  async verifyOTPAndDeleteProject(req, res) {
    try {
      const { otp, confirmationMessage } = req.body;
      if (!otp) {
        return res
          .status(400)
          .json({ success: false, message: "OTP code is required" });
      }
      const admin = this._getAdmin(req);
      const result = await this.service.verifyOTPAndDelete(
        req.params.projectId,
        otp,
        admin,
        confirmationMessage,
      );
      res.status(200).json({
        success: true,
        message: "Project and all applications deleted successfully",
        data: result,
      });
    } catch (error) {
      if (error.message === "Project not found") {
        return res
          .status(404)
          .json({ success: false, message: "Annotation project not found" });
      }
      if (error.message.includes("OTP")) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error("Error verifying OTP and deleting project:", error);
      res.status(500).json({
        success: false,
        message: "Server error verifying OTP",
        error: error.message,
      });
    }
  }

  async getAnnotationProjectApplications(req, res) {
    try {
      const data = await this.service.getApplications(req.query);
      res.status(200).json({
        success: true,
        message: `Retrieved ${data.applications.length} applications`,
        data,
      });
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching applications",
        error: error.message,
      });
    }
  }

  async approveAnnotationProjectApplication(req, res) {
    try {
      const admin = this._getAdmin(req);
      const result = await this.service.approveApplication(
        req.params.applicationId,
        admin,
        req.body.reviewNotes,
      );
      res.status(200).json({
        success: true,
        message: "Application approved successfully",
        data: result,
      });
    } catch (error) {
      if (error.message === "Application not found") {
        return res
          .status(404)
          .json({ success: false, message: "Application not found" });
      }
      if (
        error.message.includes("already") ||
        error.message.includes("maximum")
      ) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error("Error approving application:", error);
      res.status(500).json({
        success: false,
        message: "Server error approving application",
        error: error.message,
      });
    }
  }

  async rejectAnnotationProjectApplication(req, res) {
    try {
      const admin = this._getAdmin(req);
      const result = await this.service.rejectApplication(
        req.params.applicationId,
        admin,
        req.body.rejectionReason,
        req.body.reviewNotes,
      );
      res.status(200).json({
        success: true,
        message: "Application rejected successfully",
        data: result,
      });
    } catch (error) {
      if (error.message === "Application not found") {
        return res
          .status(404)
          .json({ success: false, message: "Application not found" });
      }
      if (error.message.includes("already")) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error("Error rejecting application:", error);
      res.status(500).json({
        success: false,
        message: "Server error rejecting application",
        error: error.message,
      });
    }
  }

  async removeApprovedApplicant(req, res) {
    try {
      const { error, value } = this._validate(removeApplicantSchema, req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.details.map((d) => d.message),
        });
      }
      const admin = this._getAdmin(req);
      const result = await this.service.removeApprovedApplicant(
        req.params.applicationId,
        admin,
        value.removalReason,
        value.removalNotes,
      );
      res.status(200).json({
        success: true,
        message: "Applicant removed successfully",
        data: result,
      });
    } catch (error) {
      if (error.message === "Application not found") {
        return res
          .status(404)
          .json({ success: false, message: "Application not found" });
      }
      if (error.message.includes("Only approved applicants")) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error("Error removing applicant:", error);
      res.status(500).json({
        success: false,
        message: "Server error removing applicant",
        error: error.message,
      });
    }
  }

  async getRemovableApplicants(req, res) {
    try {
      const result = await this.service.getRemovableApplicants(
        req.params.projectId,
      );
      res.status(200).json({
        success: true,
        message: `Retrieved ${result.removableApplicants.length} removable applicants`,
        data: result,
      });
    } catch (error) {
      if (error.message === "Project not found") {
        return res
          .status(404)
          .json({ success: false, message: "Annotation project not found" });
      }
      console.error("Error fetching removable applicants:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching removable applicants",
        error: error.message,
      });
    }
  }

  async exportApprovedAnnotatorsCSV(req, res) {
    try {
      const { csvContent, filename } = await this.service.exportAnnotatorsCSV(
        req.params.projectId,
      );
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
      res.status(200).send(csvContent);
    } catch (error) {
      if (error.message === "Project not found") {
        return res
          .status(404)
          .json({ success: false, message: "Project not found" });
      }
      if (error.message === "No approved annotators found") {
        return res.status(404).json({
          success: false,
          message: "No approved annotators found to export",
        });
      }
      console.error("Error exporting approved annotators:", error);
      res.status(500).json({
        success: false,
        message: "Server error exporting annotators",
        error: error.message,
      });
    }
  }

  async attachAssessmentToProject(req, res) {
    try {
      const admin = this._getAdmin(req);
      const result = await this.service.attachAssessment(
        req.params.projectId,
        req.body,
        admin,
      );
      res.json({
        success: true,
        message: "Assessment attached to project successfully",
        data: {
          project: {
            id: result._id,
            name: result.projectName,
            assessment: result.assessment,
          },
        },
      });
    } catch (error) {
      if (error.message === "Assessment ID is required") {
        return res.status(400).json({ success: false, message: error.message });
      }
      if (
        error.message === "Project not found" ||
        error.message === "Assessment configuration not found"
      ) {
        return res.status(404).json({ success: false, message: error.message });
      }
      console.error("Error attaching assessment to project:", error);
      res.status(500).json({
        success: false,
        message: "Failed to attach assessment to project",
        error: error.message,
      });
    }
  }

  async removeAssessmentFromProject(req, res) {
    try {
      const result = await this.service.removeAssessment(req.params.projectId);
      res.json({
        success: true,
        message: "Assessment removed from project successfully",
        data: { project: result },
      });
    } catch (error) {
      if (error.message === "Project not found") {
        return res
          .status(404)
          .json({ success: false, message: "Project not found" });
      }
      console.error("Error removing assessment from project:", error);
      res.status(500).json({
        success: false,
        message: "Failed to remove assessment from project",
        error: error.message,
      });
    }
  }

  async getAvailableAssessments(req, res) {
    try {
      const assessments = await this.service.getAvailableAssessments();
      res.json({
        success: true,
        message: `Found ${assessments.length} available assessments`,
        data: { assessments },
      });
    } catch (error) {
      console.error("Error fetching available assessments:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch available assessments",
        error: error.message,
      });
    }
  }

  async getApprovedApplicants(req, res) {
    try {
      const applicants = await this.service.getApprovedApplicants(
        req.params.projectId,
      );
      res.json({ success: true, total: applicants.length, data: applicants });
    } catch (error) {
      if (error.message === "Invalid project ID") {
        return res
          .status(400)
          .json({ success: false, message: "Invalid project ID" });
      }
      if (error.message === "Project not found") {
        return res
          .status(404)
          .json({ success: false, message: "Project not found" });
      }
      res.status(500).json({
        success: false,
        message: "Failed to get approved applicants",
        error: error.message,
      });
    }
  }

  async rejectApplicationsBulk(req, res) {
    try {
      if (!req.body.admin) {
        req.body.admin = this._getAdmin(req);
      }
      const result = await this.service.rejectApplicationsBulk(req.body);
      res.status(200).json(result);
    } catch (error) {
      if (
        error.message === "Admin information is required" ||
        error.message.includes("No valid application IDs")
      ) {
        return res.status(400).json({ success: false, message: error.message });
      }
      if (error.message.includes("No pending applications")) {
        return res.status(404).json({ success: false, message: error.message });
      }
      console.error("Error during bulk rejection:", error);
      res.status(500).json({
        success: false,
        message: "Bulk rejection failed",
        error: error.message,
      });
    }
  }

  async bulkApproveApplications(req, res) {
    try {
      const admin = this._getAdmin(req);
      const result = await this.service.bulkApproveApplications(
        req.body,
        admin,
      );
      res.status(200).json({
        success: true,
        message: "Bulk approval completed",
        data: result,
      });
    } catch (error) {
      if (error.message === "applicationIds must be a non-empty array") {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error("Error during bulk approval:", error);
      res.status(500).json({
        success: false,
        message: "Server error during bulk approval",
        error: error.message,
      });
    }
  }

  async bulkRejectApplications(req, res) {
    try {
      const admin = this._getAdmin(req);
      const result = await this.service.bulkRejectApplications(req.body, admin);
      res.status(200).json({
        success: true,
        message: "Bulk rejection completed",
        data: result,
      });
    } catch (error) {
      if (error.message === "applicationIds must be a non-empty array") {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error("Error during bulk rejection:", error);
      res.status(500).json({
        success: false,
        message: "Server error during bulk rejection",
        error: error.message,
      });
    }
  }
}

module.exports = new AnnotationProjectController();
