import Joi from 'joi';
import annotationProjectService from '../services/annotationProject.service.js';
import { ResponseHandler, ValidationError, NotFoundError } from '../utils/responseHandler.js';

class AnnotationProjectController {
  /**
   * Joi validation schemas
   */
  static createProjectSchema = Joi.object({
    projectName: Joi.string().required().trim(),
    projectDescription: Joi.string().required().trim(),
    projectCategory: Joi.string().required(),
    payRate: Joi.number().required().min(0),
    status: Joi.string().valid('open', 'closed', 'in_progress', 'completed').default('open'),
    maxAnnotators: Joi.number().integer().min(1),
    requirements: Joi.array().items(Joi.string()),
    tags: Joi.array().items(Joi.string()),
    projectGuidelineLink: Joi.string().uri().allow(''),
    projectGuidelineVideo: Joi.string().uri().allow(''),
    projectCommunityLink: Joi.string().uri().allow(''),
    projectTrackerLink: Joi.string().uri().allow(''),
    estimatedDuration: Joi.string().allow('')
  });

  static updateProjectSchema = Joi.object({
    projectName: Joi.string().trim(),
    projectDescription: Joi.string().trim(),
    projectCategory: Joi.string(),
    payRate: Joi.number().min(0),
    status: Joi.string().valid('open', 'closed', 'in_progress', 'completed'),
    maxAnnotators: Joi.number().integer().min(1),
    requirements: Joi.array().items(Joi.string()),
    tags: Joi.array().items(Joi.string()),
    projectGuidelineLink: Joi.string().uri().allow(''),
    projectGuidelineVideo: Joi.string().uri().allow(''),
    projectCommunityLink: Joi.string().uri().allow(''),
    projectTrackerLink: Joi.string().uri().allow(''),
    estimatedDuration: Joi.string().allow('')
  });

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
    const result = await annotationProjectService.getProjectDetails(projectId);
    const approvedAnnotators = result.annotators.approved;

    if (approvedAnnotators.length === 0) {
      throw new NotFoundError("No approved annotators found for this project");
    }

    const csvHeaders = ['Full Name', 'Country', 'Email'];
    const csvRows = [csvHeaders.join(',')];

    approvedAnnotators.forEach(item => {
      const annotator = item.annotator;
      csvRows.push([
        `"${annotator.fullName || 'N/A'}"`,
        `"${annotator.personalInfo.country || 'N/A'}"`,
        `"${annotator.email || 'N/A'}"`
      ].join(','));
    });

    const csvContent = csvRows.join('\n');
    const filename = `${result.project.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_annotators.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    res.status(200).send(csvContent);
  }
}

const annotationProjectController = new AnnotationProjectController();
export default annotationProjectController;