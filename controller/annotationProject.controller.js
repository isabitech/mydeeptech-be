const AnnotationProject = require('../models/annotationProject.model');
const ProjectApplication = require('../models/projectApplication.model');
const DTUser = require('../models/dtUser.model');
const Joi = require('joi');

// Validation schema for creating projects
const createProjectSchema = Joi.object({
  projectName: Joi.string().trim().max(200).required(),
  projectDescription: Joi.string().trim().max(2000).required(),
  projectCategory: Joi.string().valid(
    "Text Annotation", "Image Annotation", "Audio Annotation", "Video Annotation",
    "Data Labeling", "Content Moderation", "Transcription", "Translation",
    "Sentiment Analysis", "Entity Recognition", "Classification", "Object Detection",
    "Semantic Segmentation", "Survey Research", "Data Entry", "Quality Assurance", "Other"
  ).required(),
  payRate: Joi.number().min(0).required(),
  payRateCurrency: Joi.string().valid("USD", "EUR", "GBP", "NGN", "KES", "GHS").default("USD"),
  payRateType: Joi.string().valid("per_task", "per_hour", "per_project", "per_annotation").default("per_task"),
  maxAnnotators: Joi.number().min(1).allow(null).optional(),
  deadline: Joi.date().greater('now').allow(null).optional(),
  estimatedDuration: Joi.string().max(100).allow('').optional(),
  difficultyLevel: Joi.string().valid("beginner", "intermediate", "advanced", "expert").default("intermediate"),
  requiredSkills: Joi.array().items(Joi.string()).default([]),
  minimumExperience: Joi.string().valid("none", "beginner", "intermediate", "advanced").default("none"),
  languageRequirements: Joi.array().items(Joi.string()).default([]),
  tags: Joi.array().items(Joi.string()).default([]),
  applicationDeadline: Joi.date().greater('now').allow(null).optional()
});

// Admin function: Create a new annotation project
const createAnnotationProject = async (req, res) => {
  try {
    console.log(`🏗️ Admin creating new annotation project`);
    console.log('🔍 Debug - req.admin:', req.admin);
    console.log('🔍 Debug - req.userId:', req.userId);

    // Validate request body
    const { error, value } = createProjectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map(detail => detail.message)
      });
    }

    // Create project with admin as creator
    const adminId = req.admin?.userId || req.userId || req.admin?.userDoc?._id;
    
    if (!adminId) {
      console.log('❌ No admin ID found in request');
      return res.status(400).json({
        success: false,
        message: "Admin identification required to create project"
      });
    }

    const projectData = {
      ...value,
      createdBy: adminId,
      assignedAdmins: [adminId]
    };

    console.log('🔍 Debug - projectData.createdBy:', projectData.createdBy);

    const project = new AnnotationProject(projectData);
    await project.save();

    // Populate creator information
    await project.populate('createdBy', 'fullName email');
    await project.populate('assignedAdmins', 'fullName email');

    console.log(`✅ Annotation project created successfully: ${project.projectName} (ID: ${project._id})`);

    res.status(201).json({
      success: true,
      message: "Annotation project created successfully",
      data: {
        project: project
      }
    });

  } catch (error) {
    console.error("❌ Error creating annotation project:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating annotation project",
      error: error.message
    });
  }
};

// Admin function: Get all annotation projects
const getAllAnnotationProjects = async (req, res) => {
  try {
    console.log(`🔍 Admin ${req.admin.email} requesting annotation projects list`);

    // Get query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const category = req.query.category;
    const search = req.query.search;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.projectCategory = category;
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { projectName: searchRegex },
        { projectDescription: searchRegex },
        { tags: { $in: [searchRegex] } }
      ];
    }

    console.log('🔍 Annotation projects filter:', JSON.stringify(filter, null, 2));

    // Get projects with pagination
    const projects = await AnnotationProject.find(filter)
      .populate('createdBy', 'fullName email')
      .populate('assignedAdmins', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const totalProjects = await AnnotationProject.countDocuments(filter);

    // Get projects summary
    const statusSummary = await AnnotationProject.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const categorySummary = await AnnotationProject.aggregate([
      { $group: { _id: '$projectCategory', count: { $sum: 1 } } }
    ]);

    console.log(`✅ Found ${projects.length} annotation projects (${totalProjects} total)`);

    // Calculate pagination info
    const totalPages = Math.ceil(totalProjects / limit);

    res.status(200).json({
      success: true,
      message: `Retrieved ${projects.length} annotation projects`,
      data: {
        projects: projects,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalProjects: totalProjects,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit: limit
        },
        summary: {
          totalProjects: totalProjects,
          statusBreakdown: statusSummary.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          categoryBreakdown: categorySummary.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          filters: filter
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching annotation projects:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching annotation projects",
      error: error.message
    });
  }
};

// Admin function: Get specific annotation project details
const getAnnotationProjectDetails = async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log(`🔍 Admin ${req.admin.email} requesting annotation project details: ${projectId}`);

    const project = await AnnotationProject.findById(projectId)
      .populate('createdBy', 'fullName email phone')
      .populate('assignedAdmins', 'fullName email phone');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Annotation project not found"
      });
    }

    // Get application statistics
    const applicationStats = await ProjectApplication.aggregate([
      { $match: { projectId: project._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Get recent applications
    const recentApplications = await ProjectApplication.find({ projectId: project._id })
      .populate('applicantId', 'fullName email annotatorStatus')
      .sort({ appliedAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      message: "Annotation project details retrieved successfully",
      data: {
        project: project,
        applicationStats: applicationStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recentApplications: recentApplications
      }
    });

  } catch (error) {
    console.error("❌ Error fetching annotation project details:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching annotation project details",
      error: error.message
    });
  }
};

// Admin function: Update annotation project
const updateAnnotationProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log(`🔄 Admin ${req.admin.email} updating annotation project: ${projectId}`);

    // Validate request body (allow partial updates)
    const updateSchema = createProjectSchema.fork(Object.keys(createProjectSchema.describe().keys), (schema) => schema.optional());
    const { error, value } = updateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map(detail => detail.message)
      });
    }

    const project = await AnnotationProject.findByIdAndUpdate(
      projectId,
      { ...value, updatedAt: new Date() },
      { new: true }
    ).populate('createdBy', 'fullName email')
     .populate('assignedAdmins', 'fullName email');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Annotation project not found"
      });
    }

    console.log(`✅ Annotation project updated successfully: ${project.projectName}`);

    res.status(200).json({
      success: true,
      message: "Annotation project updated successfully",
      data: {
        project: project
      }
    });

  } catch (error) {
    console.error("❌ Error updating annotation project:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating annotation project",
      error: error.message
    });
  }
};

// Admin function: Delete annotation project
const deleteAnnotationProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log(`🗑️ Admin ${req.admin.email} deleting annotation project: ${projectId}`);

    const project = await AnnotationProject.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Annotation project not found"
      });
    }

    // Check if project has active applications
    const activeApplications = await ProjectApplication.countDocuments({
      projectId: projectId,
      status: { $in: ['pending', 'approved'] }
    });

    if (activeApplications > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete project with ${activeApplications} active applications. Please resolve all applications first.`
      });
    }

    // Delete the project and all its applications
    await AnnotationProject.findByIdAndDelete(projectId);
    await ProjectApplication.deleteMany({ projectId: projectId });

    console.log(`✅ Annotation project deleted successfully: ${project.projectName}`);

    res.status(200).json({
      success: true,
      message: "Annotation project deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error deleting annotation project:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting annotation project",
      error: error.message
    });
  }
};

// Admin function: Get all applications for annotation projects
const getAnnotationProjectApplications = async (req, res) => {
  try {
    console.log(`🔍 Admin ${req.admin.email} requesting annotation project applications`);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const projectId = req.query.projectId;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (projectId) filter.projectId = projectId;

    console.log('🔍 Applications filter:', JSON.stringify(filter, null, 2));

    // Get applications with populated data
    const applications = await ProjectApplication.find(filter)
      .populate({
        path: 'projectId',
        select: 'projectName projectCategory payRate status createdBy',
        populate: {
          path: 'createdBy',
          select: 'fullName email'
        }
      })
      .populate('applicantId', 'fullName email phone annotatorStatus')
      .populate('reviewedBy', 'fullName email')
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const totalApplications = await ProjectApplication.countDocuments(filter);

    // Get applications summary
    const statusSummary = await ProjectApplication.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    console.log(`✅ Found ${applications.length} applications (${totalApplications} total)`);

    // Calculate pagination info
    const totalPages = Math.ceil(totalApplications / limit);

    res.status(200).json({
      success: true,
      message: `Retrieved ${applications.length} applications`,
      data: {
        applications: applications,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalApplications: totalApplications,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit: limit
        },
        summary: {
          totalApplications: totalApplications,
          statusBreakdown: statusSummary.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          filters: filter
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching annotation project applications:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching applications",
      error: error.message
    });
  }
};

// Admin function: Approve annotation project application
const approveAnnotationProjectApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { reviewNotes } = req.body;
    
    console.log(`✅ Admin ${req.admin.email} approving application: ${applicationId}`);

    // Find and update application
    const application = await ProjectApplication.findById(applicationId)
      .populate({
        path: 'projectId',
        select: 'projectName projectCategory payRate approvedAnnotators maxAnnotators'
      })
      .populate('applicantId', 'fullName email');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found"
      });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Application is already ${application.status}`
      });
    }

    // Check if project is full
    const project = application.projectId;
    if (project.maxAnnotators && project.approvedAnnotators >= project.maxAnnotators) {
      return res.status(400).json({
        success: false,
        message: "Project has reached maximum number of annotators"
      });
    }

    // Update application status
    application.status = 'approved';
    application.reviewedBy = req.admin.userId;
    application.reviewedAt = new Date();
    application.reviewNotes = reviewNotes || '';
    application.workStartedAt = new Date();

    await application.save();

    // Update project approved annotators count
    await AnnotationProject.findByIdAndUpdate(project._id, {
      $inc: { approvedAnnotators: 1 }
    });

    // Send approval email to applicant
    try {
      const { sendProjectApprovalNotification } = require('../utils/projectMailer');
      
      const projectData = {
        projectName: project.projectName,
        projectCategory: project.projectCategory,
        payRate: project.payRate,
        adminName: req.admin.fullName,
        reviewNotes: reviewNotes || ''
      };

      await sendProjectApprovalNotification(
        application.applicantId.email,
        application.applicantId.fullName,
        projectData
      );

      console.log(`✅ Approval notification sent to: ${application.applicantId.email}`);

    } catch (emailError) {
      console.error(`⚠️ Failed to send approval notification:`, emailError.message);
    }

    console.log(`✅ Application approved successfully for project: ${project.projectName}`);

    res.status(200).json({
      success: true,
      message: "Application approved successfully",
      data: {
        application: application,
        projectName: project.projectName,
        applicantName: application.applicantId.fullName,
        emailNotificationSent: true
      }
    });

  } catch (error) {
    console.error("❌ Error approving application:", error);
    res.status(500).json({
      success: false,
      message: "Server error approving application",
      error: error.message
    });
  }
};

// Admin function: Reject annotation project application
const rejectAnnotationProjectApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { rejectionReason, reviewNotes } = req.body;
    
    console.log(`❌ Admin ${req.admin.email} rejecting application: ${applicationId}`);

    // Find and update application
    const application = await ProjectApplication.findById(applicationId)
      .populate({
        path: 'projectId',
        select: 'projectName projectCategory'
      })
      .populate('applicantId', 'fullName email');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found"
      });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Application is already ${application.status}`
      });
    }

    // Update application status
    application.status = 'rejected';
    application.reviewedBy = req.admin.userId;
    application.reviewedAt = new Date();
    application.rejectionReason = rejectionReason || 'other';
    application.reviewNotes = reviewNotes || '';

    await application.save();

    // Send rejection email to applicant
    try {
      const { sendProjectRejectionNotification } = require('../utils/projectMailer');
      
      const projectData = {
        projectName: application.projectId.projectName,
        projectCategory: application.projectId.projectCategory,
        adminName: req.admin.fullName,
        rejectionReason: rejectionReason || 'other',
        reviewNotes: reviewNotes || ''
      };

      await sendProjectRejectionNotification(
        application.applicantId.email,
        application.applicantId.fullName,
        projectData
      );

      console.log(`✅ Rejection notification sent to: ${application.applicantId.email}`);

    } catch (emailError) {
      console.error(`⚠️ Failed to send rejection notification:`, emailError.message);
    }

    console.log(`✅ Application rejected successfully for project: ${application.projectId.projectName}`);

    res.status(200).json({
      success: true,
      message: "Application rejected successfully",
      data: {
        application: application,
        projectName: application.projectId.projectName,
        applicantName: application.applicantId.fullName,
        emailNotificationSent: true
      }
    });

  } catch (error) {
    console.error("❌ Error rejecting application:", error);
    res.status(500).json({
      success: false,
      message: "Server error rejecting application",
      error: error.message
    });
  }
};

module.exports = {
  createAnnotationProject,
  getAllAnnotationProjects,
  getAnnotationProjectDetails,
  updateAnnotationProject,
  deleteAnnotationProject,
  getAnnotationProjectApplications,
  approveAnnotationProjectApplication,
  rejectAnnotationProjectApplication
};