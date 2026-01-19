import Joi from 'joi';
import annotationProjectService from '../services/annotationProject.service.js';
import { ResponseHandler, ValidationError } from '../utils/responseHandler.js';

/**
 * Controller for managing all aspects of annotation projects.
 * Provides endpoints for project lifecycle, applicant management, and administrative security (OTP flow).
 */
class AnnotationProjectController {
  /**
   * Joi validation schemas
   */
  static createProjectSchema = Joi.object({
    // Basic project info
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
        "Other"
      )
      .required(),

    payRate: Joi.number().min(0).required(),

    payRateCurrency: Joi.string()
      .valid("USD", "EUR", "GBP", "NGN", "KES", "GHS")
      .default("USD"),

    payRateType: Joi.string()
      .valid("per_task", "per_hour", "per_project", "per_annotation")
      .default("per_task"),

    // Project settings
    status: Joi.string()
      .valid("draft", "active", "paused", "completed", "cancelled")
      .default("active"),

    maxAnnotators: Joi.number().integer().min(1).allow(null),

    deadline: Joi.date().greater("now").allow(null),

    estimatedDuration: Joi.string().allow(null, ""),

    difficultyLevel: Joi.string()
      .valid("beginner", "intermediate", "advanced", "expert")
      .default("intermediate"),

    // Requirements
    requiredSkills: Joi.array().items(Joi.string()).default([]),

    minimumExperience: Joi.string()
      .valid("none", "beginner", "intermediate", "advanced")
      .default("none"),

    languageRequirements: Joi.array().items(Joi.string()).default([]),

    // Project visibility & metadata
    tags: Joi.array().items(Joi.string()).default([]),

    isPublic: Joi.boolean().default(true),

    applicationDeadline: Joi.date().greater("now").allow(null),

    // Guideline & resource links
    projectGuidelineLink: Joi.string().uri().required(),

    projectGuidelineVideo: Joi.string().uri().allow(null, ""),

    projectCommunityLink: Joi.string().uri().allow(null, ""),

    projectTrackerLink: Joi.string().uri().allow(null, ""),

    // Assessment config (optional)
    assessment: Joi.object({
      isRequired: Joi.boolean().default(false),

      assessmentId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .allow(null),

      assessmentInstructions: Joi.string().max(1000).allow("", null),

      attachedAt: Joi.date().allow(null),

      attachedBy: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .allow(null)
    }).optional()
  });

  static updateProjectSchema = Joi.object({
    // Basic project info
    projectName: Joi.string().trim().max(200),

    projectDescription: Joi.string().trim().max(2000),

    projectCategory: Joi.string().valid(
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
      "Other"
    ),

    payRate: Joi.number().min(0),

    payRateCurrency: Joi.string().valid("USD", "EUR", "GBP", "NGN", "KES", "GHS"),

    payRateType: Joi.string().valid(
      "per_task",
      "per_hour",
      "per_project",
      "per_annotation"
    ),

    // Project settings
    status: Joi.string().valid(
      "draft",
      "active",
      "paused",
      "completed",
      "cancelled"
    ),

    maxAnnotators: Joi.number().integer().min(1).allow(null),

    deadline: Joi.date().greater("now").allow(null),

    estimatedDuration: Joi.string().allow(null, ""),

    difficultyLevel: Joi.string().valid(
      "beginner",
      "intermediate",
      "advanced",
      "expert"
    ),

    // Requirements
    requiredSkills: Joi.array().items(Joi.string()),

    minimumExperience: Joi.string().valid(
      "none",
      "beginner",
      "intermediate",
      "advanced"
    ),

    languageRequirements: Joi.array().items(Joi.string()),

    // Metadata & visibility
    tags: Joi.array().items(Joi.string()),

    isPublic: Joi.boolean(),

    applicationDeadline: Joi.date().greater("now").allow(null),

    // Guideline & resource links
    projectGuidelineLink: Joi.string().uri().allow(null, ""),

    projectGuidelineVideo: Joi.string().uri().allow(null, ""),

    projectCommunityLink: Joi.string().uri().allow(null, ""),

    projectTrackerLink: Joi.string().uri().allow(null, ""),

    // Assessment update (optional)
    assessment: Joi.object({
      isRequired: Joi.boolean(),

      assessmentId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .allow(null),

      assessmentInstructions: Joi.string().max(1000).allow("", null),

      attachedAt: Joi.date().allow(null),

      attachedBy: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .allow(null)
    }).optional()
  })
    .min(1);

  static removeApplicantSchema = Joi.object({
    removalReason: Joi.string().required().valid(
      'performance_issues',
      'project_cancelled',
      'violates_guidelines',
      'unavailable',
      'quality_concerns',
      'admin_decision',
      'other'
    ),
    removalNotes: Joi.string().allow('').max(500)
  });

  /**
   * Create a new annotation project
   */
  async createAnnotationProject(req, res) {
    const { error, value } = AnnotationProjectController.createProjectSchema.validate(req.body);
    if (error) {
      throw new ValidationError("Validation error", error.details.map(d => d.message));
    }

    const project = await annotationProjectService.createProject(value, req.admin);
    ResponseHandler.success(res, project, "Annotation project created successfully", 201);
  }

  /**
   * Get all annotation projects with pagination and filtering
   */
  async getAllAnnotationProjects(req, res) {
    const result = await annotationProjectService.getAllProjects(req.query);
    ResponseHandler.success(res, result.projects, "Annotation projects retrieved successfully", 200, result.pagination);
  }

  /**
   * Get detailed information about a single project
   */
  async getAnnotationProjectDetails(req, res) {
    const { projectId } = req.params;
    const projectDetails = await annotationProjectService.getProjectDetails(projectId);
    ResponseHandler.success(res, projectDetails, "Project details retrieved successfully");
  }

  /**
   * Update an annotation project
   */
  async updateAnnotationProject(req, res) {
    const { projectId } = req.params;
    const { error, value } = AnnotationProjectController.updateProjectSchema.validate(req.body);
    if (error) {
      throw new ValidationError("Validation error", error.details.map(d => d.message));
    }

    const project = await annotationProjectService.updateProject(projectId, value);
    ResponseHandler.success(res, project, "Annotation project updated successfully");
  }

  /**
   * Delete an annotation project (basic check)
   */
  async deleteAnnotationProject(req, res) {
    const { projectId } = req.params;
    await annotationProjectService.deleteProject(projectId, req.admin);
    ResponseHandler.success(res, null, "Annotation project deleted successfully");
  }

  /**
   * Request OTP for sensitive deletion of project with active applications
   */
  /**
   * Request an OTP for destructive operations (deleting projects with active applicants).
   * Ensures high-risk deletions are intentional and authorized.
   */
  async requestProjectDeletionOTP(req, res) {
    const { projectId } = req.params;
    const { reason } = req.body;
    const result = await annotationProjectService.requestDeletionOTP(projectId, req.admin, reason);
    ResponseHandler.success(res, result, "Project deletion OTP requested and sent to Projects Officer");
  }

  /**
   * Verify OTP and perform force deletion of project and its applications
   */
  async verifyOTPAndDeleteProject(req, res) {
    const { projectId } = req.params;
    const { otp, confirmationMessage } = req.body;
    const result = await annotationProjectService.verifyOTPAndDelete(projectId, req.admin, otp, confirmationMessage);
    ResponseHandler.success(res, result, "Project and related applications deleted successfully");
  }

  /**
   * Get all applications for annotation projects with filtering
   */
  async getAnnotationProjectApplications(req, res) {
    const result = await annotationProjectService.getProjectApplications(req.query);
    ResponseHandler.success(res, result.applications, "Applications retrieved successfully", 200, {
      ...result.pagination,
      summary: result.summary
    });
  }

  /**
   * Approve an application
   */
  async approveAnnotationProjectApplication(req, res) {
    const { applicationId } = req.params;
    const application = await annotationProjectService.approveApplication(applicationId, req.admin, req.body);
    ResponseHandler.success(res, application, "Application approved successfully");
  }

  /**
   * Reject an application
   */
  async rejectAnnotationProjectApplication(req, res) {
    const { applicationId } = req.params;
    const application = await annotationProjectService.rejectApplication(applicationId, req.admin, req.body);
    ResponseHandler.success(res, application, "Application rejected successfully");
  }

  /**
   * Reject multiple applications in bulk
   */
  async rejectAnnotationProjectApplicationsBulk(req, res) {
    const { applicationIds, rejectionReason, reviewNotes } = req.body;
    const result = await annotationProjectService.rejectApplicationsBulk(
      applicationIds,
      req.admin,
      { rejectionReason, reviewNotes }
    );
    ResponseHandler.success(res, result, "Applications processed for rejection");
  }

  /**
   * Remove an approved applicant from a project
   */
  async removeApprovedApplicant(req, res) {
    const { applicationId } = req.params;
    const { error, value } = AnnotationProjectController.removeApplicantSchema.validate(req.body);
    if (error) {
      throw new ValidationError("Validation error", error.details.map(d => d.message));
    }

    const application = await annotationProjectService.removeApprovedApplicant(applicationId, req.admin, value);
    ResponseHandler.success(res, application, "Approved applicant removed from project successfully");
  }

  /**
   * Get list of applicants that can be removed
   */
  async getRemovableApplicants(req, res) {
    const { projectId } = req.params;
    const result = await annotationProjectService.getRemovableApplicants(projectId);
    ResponseHandler.success(res, result, "Removable applicants retrieved successfully");
  }

  /**
   * Get all approved applicants for a project
   */
  async getApprovedApplicants(req, res) {
    const { projectId } = req.params;
    const result = await annotationProjectService.getApprovedApplicants(projectId);
    ResponseHandler.success(res, result, "Approved applicants retrieved successfully");
  }

  /**
   * Attach an assessment to a project
   */
  async attachAssessmentToProject(req, res) {
    const { projectId } = req.params;
    const project = await annotationProjectService.attachAssessment(projectId, req.admin, req.body);
    ResponseHandler.success(res, project, "Assessment attached to project successfully");
  }

  /**
   * Remove an assessment from a project
   */
  async removeAssessmentFromProject(req, res) {
    const { projectId } = req.params;
    const project = await annotationProjectService.removeAssessment(projectId);
    ResponseHandler.success(res, project, "Assessment removed from project successfully");
  }

  /**
   * Get available assessments for attachment
   */
  async getAvailableAssessments(req, res) {
    const assessments = await annotationProjectService.getAvailableAssessments();
    ResponseHandler.success(res, assessments, "Available assessments retrieved successfully");
  }

  /**
   * Export approved annotators to CSV
   */
  async exportApprovedAnnotatorsCSV(req, res) {
    const { projectId } = req.params;
    const { filename, csvContent } = await annotationProjectService.exportApprovedAnnotatorsCSV(projectId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.status(200).send(csvContent);
  }
}

const annotationProjectController = new AnnotationProjectController();
export default annotationProjectController;