import Joi from 'joi';
import annotationProjectService from '../services/annotationProject.service.js';
import { ResponseHandler } from '../utils/responseHandler.js';

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
    try {
      const { error, value } = AnnotationProjectController.createProjectSchema.validate(req.body);
      if (error) {
        return ResponseHandler.error(res, { statusCode: 400, message: "Validation error", details: error.details.map(d => d.message) });
      }

      const project = await annotationProjectService.createProject(value, req.admin);
      return ResponseHandler.success(res, project, "Annotation project created successfully", 201);
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Get all annotation projects with pagination and filtering
   */
  async getAllAnnotationProjects(req, res) {
    try {
      const result = await annotationProjectService.getAllProjects(req.query);
      return ResponseHandler.success(res, result.projects, "Annotation projects retrieved successfully", 200, result.pagination);
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Get detailed information about a single project
   */
  async getAnnotationProjectDetails(req, res) {
    try {
      const { projectId } = req.params;
      const projectDetails = await annotationProjectService.getProjectDetails(projectId);
      return ResponseHandler.success(res, projectDetails, "Project details retrieved successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Update an annotation project
   */
  async updateAnnotationProject(req, res) {
    try {
      const { projectId } = req.params;
      const { error, value } = AnnotationProjectController.updateProjectSchema.validate(req.body);
      if (error) {
        return ResponseHandler.error(res, { statusCode: 400, message: "Validation error", details: error.details.map(d => d.message) });
      }

      const project = await annotationProjectService.updateProject(projectId, value);
      return ResponseHandler.success(res, project, "Annotation project updated successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Delete an annotation project (basic check)
   */
  async deleteAnnotationProject(req, res) {
    try {
      const { projectId } = req.params;
      await annotationProjectService.deleteProject(projectId, req.admin);
      return ResponseHandler.success(res, null, "Annotation project deleted successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Request OTP for sensitive deletion of project with active applications
   */
  async requestProjectDeletionOTP(req, res) {
    try {
      const { projectId } = req.params;
      const { reason } = req.body;
      const result = await annotationProjectService.requestDeletionOTP(projectId, req.admin, reason);
      return ResponseHandler.success(res, result, "Project deletion OTP requested and sent to Projects Officer");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Verify OTP and perform force deletion of project and its applications
   */
  async verifyOTPAndDeleteProject(req, res) {
    try {
      const { projectId } = req.params;
      const { otp, confirmationMessage } = req.body;
      const result = await annotationProjectService.verifyOTPAndDelete(projectId, req.admin, otp, confirmationMessage);
      return ResponseHandler.success(res, result, "Project and related applications deleted successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Get all applications for annotation projects with filtering
   */
  async getAnnotationProjectApplications(req, res) {
    try {
      const result = await annotationProjectService.getProjectApplications(req.query);
      return ResponseHandler.success(res, result.applications, "Applications retrieved successfully", 200, {
        ...result.pagination,
        summary: result.summary
      });
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Approve an application
   */
  async approveAnnotationProjectApplication(req, res) {
    try {
      const { applicationId } = req.params;
      const application = await annotationProjectService.approveApplication(applicationId, req.admin, req.body);
      return ResponseHandler.success(res, application, "Application approved successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Reject an application
   */
  async rejectAnnotationProjectApplication(req, res) {
    try {
      const { applicationId } = req.params;
      const application = await annotationProjectService.rejectApplication(applicationId, req.admin, req.body);
      return ResponseHandler.success(res, application, "Application rejected successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Remove an approved applicant from a project
   */
  async removeApprovedApplicant(req, res) {
    try {
      const { applicationId } = req.params;
      const { error, value } = AnnotationProjectController.removeApplicantSchema.validate(req.body);
      if (error) {
        return ResponseHandler.error(res, { statusCode: 400, message: "Validation error", details: error.details.map(d => d.message) });
      }

      const application = await annotationProjectService.removeApprovedApplicant(applicationId, req.admin, value);
      return ResponseHandler.success(res, application, "Approved applicant removed from project successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Get list of applicants that can be removed
   */
  async getRemovableApplicants(req, res) {
    try {
      const { projectId } = req.params;
      const result = await annotationProjectService.getRemovableApplicants(projectId);
      return ResponseHandler.success(res, result, "Removable applicants retrieved successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Attach an assessment to a project
   */
  async attachAssessmentToProject(req, res) {
    try {
      const { projectId } = req.params;
      const project = await annotationProjectService.attachAssessment(projectId, req.admin, req.body);
      return ResponseHandler.success(res, project, "Assessment attached to project successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Remove an assessment from a project
   */
  async removeAssessmentFromProject(req, res) {
    try {
      const { projectId } = req.params;
      const project = await annotationProjectService.removeAssessment(projectId);
      return ResponseHandler.success(res, project, "Assessment removed from project successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Get available assessments for attachment
   */
  async getAvailableAssessments(req, res) {
    try {
      const assessments = await annotationProjectService.getAvailableAssessments();
      return ResponseHandler.success(res, assessments, "Available assessments retrieved successfully");
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * Export approved annotators to CSV
   */
  async exportApprovedAnnotatorsCSV(req, res) {
    try {
      const { projectId } = req.params;
      const result = await annotationProjectService.getProjectDetails(projectId);
      const approvedAnnotators = result.annotators.approved;

      if (approvedAnnotators.length === 0) {
        return ResponseHandler.error(res, { statusCode: 404, message: "No approved annotators found for this project" });
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

      return res.status(200).send(csvContent);
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }
}

const annotationProjectController = new AnnotationProjectController();
export default annotationProjectController;