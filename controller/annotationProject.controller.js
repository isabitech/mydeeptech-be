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
  deadline: Joi.date().greater('now').required(),
  estimatedDuration: Joi.string().max(100).required(),
  difficultyLevel: Joi.string().valid("beginner", "intermediate", "advanced", "expert").required(),
  requiredSkills: Joi.array().items(Joi.string()).default([]),
  minimumExperience: Joi.string().valid("none", "beginner", "intermediate", "advanced").required(),
  languageRequirements: Joi.array().items(Joi.string()).default([]),
  tags: Joi.array().items(Joi.string()).default([]),
  applicationDeadline: Joi.date().greater('now').required(),
  // Project guidelines
  projectGuidelineLink: Joi.string().uri().allow('').optional().messages({
    'string.uri': 'Project guideline link must be a valid URL'
  }),
  projectGuidelineVideo: Joi.string().uri().allow('').optional().messages({
    'string.uri': 'Project guideline video must be a valid URL'
  }),
  projectCommunityLink: Joi.string().uri().allow('').optional().messages({
    'string.uri': 'Project community link must be a valid URL'
  }),
  projectTrackerLink: Joi.string().uri().allow('').optional().messages({
    'string.uri': 'Project tracker link must be a valid URL'
  }),
  
  // Project status
  isActive: Joi.boolean().default(true)
});

// Validation schema for removing approved applicants
const removeApplicantSchema = Joi.object({
  removalReason: Joi.string().valid(
    "performance_issues",
    "project_cancelled",
    "violates_guidelines",
    "unavailable",
    "quality_concerns",
    "admin_decision",
    "other"
  ).optional(),
  removalNotes: Joi.string().max(500).allow('').optional()
});

// Admin function: Create a new annotation project
const createAnnotationProject = async (req, res) => {
  try {

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

    const project = new AnnotationProject(projectData);
    await project.save();

    // Populate creator information
    await project.populate('createdBy', 'fullName email');
    await project.populate('assignedAdmins', 'fullName email');

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
    // Get query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const category = req.query.category;
    const search = req.query.search;
    const isActive = req.query.isActive; // "true", "false", or undefined (all)

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.projectCategory = category;
    
    // Add isActive filter
    if (isActive === 'true') {
      filter.isActive = true;
    } else if (isActive === 'false') {
      filter.isActive = false;
    }
    // If isActive is undefined, show all projects
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { projectName: searchRegex },
        { projectDescription: searchRegex },
        { tags: { $in: [searchRegex] } }
      ];
    }

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

    // Get approved annotators (approved applications with detailed info)
    const approvedAnnotators = await ProjectApplication.find({
      projectId: project._id,
      status: 'approved'
    })
      .populate({
        path: 'applicantId',
        select: 'fullName email phone annotatorStatus microTaskerStatus personal_info professional_background payment_info attachments profilePicture createdAt'
      })
      .populate('reviewedBy', 'fullName email')
      .sort({ reviewedAt: -1 });

    // Get rejected annotators (rejected applications with detailed info)
    const rejectedAnnotators = await ProjectApplication.find({
      projectId: project._id,
      status: 'rejected'
    })
      .populate({
        path: 'applicantId',
        select: 'fullName email phone annotatorStatus microTaskerStatus personal_info professional_background attachments profilePicture createdAt'
      })
      .populate('reviewedBy', 'fullName email')
      .sort({ reviewedAt: -1 });

    // Get pending annotators for completeness
    const pendingAnnotators = await ProjectApplication.find({
      projectId: project._id,
      status: 'pending'
    })
      .populate({
        path: 'applicantId',
        select: 'fullName email phone annotatorStatus microTaskerStatus personal_info professional_background attachments profilePicture createdAt'
      })
      .sort({ appliedAt: -1 });

    // Format annotators data with application details
    const formatAnnotatorData = (applications) => {
      return applications.map(app => ({
        applicationId: app._id,
        applicationStatus: app.status,
        appliedAt: app.appliedAt,
        reviewedAt: app.reviewedAt,
        reviewedBy: app.reviewedBy,
        reviewNotes: app.reviewNotes,
        rejectionReason: app.rejectionReason,
        coverLetter: app.coverLetter,
        workStartedAt: app.workStartedAt,
        annotator: {
          id: app.applicantId._id,
          fullName: app.applicantId.fullName,
          email: app.applicantId.email,
          phone: app.applicantId.phone,
          annotatorStatus: app.applicantId.annotatorStatus,
          microTaskerStatus: app.applicantId.microTaskerStatus,
          profilePicture: app.applicantId.profilePicture?.url || null,
          joinedDate: app.applicantId.createdAt,
          personalInfo: {
            country: app.applicantId.personal_info?.country || null,
            timeZone: app.applicantId.personal_info?.time_zone || null,
            availableHours: app.applicantId.personal_info?.available_hours_per_week || null,
            languages: app.applicantId.personal_info?.languages || []
          },
          professionalBackground: {
            educationField: app.applicantId.professional_background?.education_field || null,
            yearsOfExperience: app.applicantId.professional_background?.years_of_experience || null,
            previousProjects: app.applicantId.professional_background?.previous_annotation_projects || [],
            skills: app.applicantId.professional_background?.skills || []
          },
          paymentInfo: {
            hasPaymentInfo: !!(app.applicantId.payment_info?.account_name && app.applicantId.payment_info?.account_number),
            accountName: app.applicantId.payment_info?.account_name || null,
            bankName: app.applicantId.payment_info?.bank_name || null
          },
          attachments: {
            hasResume: !!(app.applicantId.attachments?.resume_url),
            hasIdDocument: !!(app.applicantId.attachments?.id_document_url),
            resumeUrl: app.applicantId.attachments?.resume_url || null,
            idDocumentUrl: app.applicantId.attachments?.id_document_url || null
          }
        }
      }));
    };

    // Calculate annotator statistics
    const annotatorStats = {
      total: approvedAnnotators.length + rejectedAnnotators.length + pendingAnnotators.length,
      approved: approvedAnnotators.length,
      rejected: rejectedAnnotators.length,
      pending: pendingAnnotators.length,
      approvalRate: (approvedAnnotators.length + rejectedAnnotators.length) > 0 ?
        Math.round((approvedAnnotators.length / (approvedAnnotators.length + rejectedAnnotators.length)) * 100) : 0
    };

    // Get annotator activity summary (recent reviews)
    const recentReviewActivity = await ProjectApplication.find({
      projectId: project._id,
      status: { $in: ['approved', 'rejected'] },
      reviewedAt: { $exists: true }
    })
      .populate('applicantId', 'fullName email')
      .populate('reviewedBy', 'fullName email')
      .sort({ reviewedAt: -1 })
      .limit(10)
      .select('status reviewedAt reviewedBy applicantId reviewNotes rejectionReason');


    res.status(200).json({
      success: true,
      message: "Annotation project details retrieved successfully",
      data: {
        project: project,
        applicationStats: applicationStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        annotatorStats: annotatorStats,
        recentApplications: recentApplications,
        annotators: {
          approved: formatAnnotatorData(approvedAnnotators),
          rejected: formatAnnotatorData(rejectedAnnotators),
          pending: formatAnnotatorData(pendingAnnotators)
        },
        recentReviewActivity: recentReviewActivity
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

// Admin function: Toggle project active status
const toggleProjectStatus = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await AnnotationProject.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Annotation project not found"
      });
    }

    // Toggle the isActive status
    project.isActive = !project.isActive;
    project.status = project.isActive ? 'active' : 'inactive';
    await project.save();

    res.status(200).json({
      success: true,
      message: `Project ${project.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        project: {
          _id: project._id,
          projectName: project.projectName,
          isActive: project.isActive,
          status: project.status
        }
      }
    });

  } catch (error) {
    console.error("❌ Error toggling project active status:", error);
    res.status(500).json({
      success: false,
      message: "Server error toggling project active status",
      error: error.message
    });
  }
};

// Admin function: Toggle project active status
const toggleProjectShowHide = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await AnnotationProject.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Annotation project not found"
      });
    }

    // Toggle the isActive status
    project.isActive = !project.isActive;
    project.status = project.isActive ? 'active' : 'inactive';
    await project.save();

    res.status(200).json({
      success: true,
      message: `Project ${project.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        project: {
          _id: project._id,
          projectName: project.projectName,
          isActive: project.isActive,
          status: project.status
        }
      }
    });

  } catch (error) {
    console.error("❌ Error toggling project active status:", error);
    res.status(500).json({
      success: false,
      message: "Server error toggling project active status",
      error: error.message
    });
  }
};

// Admin function: Delete annotation project
const deleteAnnotationProject = async (req, res) => {
  try {
    const { projectId } = req.params;

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
        message: `Cannot delete project with ${activeApplications} active applications. Please resolve all applications first or use force delete with OTP verification.`,
        data: {
          activeApplications: activeApplications,
          requiresOTP: true,
          projectName: project.projectName,
          projectId: projectId
        }
      });
    }

    // Delete the project and all its applications
    await AnnotationProject.findByIdAndDelete(projectId);
    await ProjectApplication.deleteMany({ projectId: projectId });

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

// Admin function: Request OTP for project deletion (Projects Officer authorization)
const requestProjectDeletionOTP = async (req, res) => {
  try {
    const { projectId } = req.params;

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

    const allApplications = await ProjectApplication.countDocuments({ projectId: projectId });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Store OTP in project document temporarily
    project.deletionOTP = {
      code: otp,
      expiresAt: otpExpiry,
      requestedBy: req.admin.userId,
      requestedAt: new Date(),
      verified: false
    };

    await project.save();

    // Send OTP to Projects Officer email
    const projectsOfficerEmail = 'projects@mydeeptech.ng';

    try {
      const { sendProjectDeletionOTP } = require('../utils/projectMailer');

      const deletionData = {
        projectName: project.projectName,
        projectId: projectId,
        projectCategory: project.projectCategory,
        requestedBy: req.admin.fullName || req.admin.email,
        requestedByEmail: req.admin.email,
        activeApplications: activeApplications,
        totalApplications: allApplications,
        otp: otp,
        expiryTime: otpExpiry.toLocaleString(),
        reason: req.body.reason || 'Administrative deletion'
      };

      await sendProjectDeletionOTP(projectsOfficerEmail, deletionData);

      res.status(200).json({
        success: true,
        message: "Deletion OTP sent to Projects Officer for approval",
        data: {
          projectName: project.projectName,
          projectId: projectId,
          activeApplications: activeApplications,
          totalApplications: allApplications,
          otpSentTo: projectsOfficerEmail,
          expiresAt: otpExpiry,
          requestedBy: req.admin.email,
          otpExpiryMinutes: 15
        }
      });

    } catch (emailError) {
      console.error(`❌ Failed to send deletion OTP:`, emailError.message);

      // Remove OTP from project if email failed
      project.deletionOTP = undefined;
      await project.save();

      return res.status(500).json({
        success: false,
        message: "Failed to send deletion OTP to Projects Officer",
        error: emailError.message
      });
    }

  } catch (error) {
    console.error("❌ Error requesting deletion OTP:", error);
    res.status(500).json({
      success: false,
      message: "Server error requesting deletion OTP",
      error: error.message
    });
  }
};

// Admin function: Verify OTP and force delete project with applications
const verifyOTPAndDeleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { otp, confirmationMessage } = req.body;

    // Validate input
    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "OTP code is required"
      });
    }

    const project = await AnnotationProject.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Annotation project not found"
      });
    }

    // Check if OTP exists and is valid
    if (!project.deletionOTP || !project.deletionOTP.code) {
      return res.status(400).json({
        success: false,
        message: "No deletion OTP found. Please request a new OTP first."
      });
    }

    // Check if OTP has expired
    if (new Date() > project.deletionOTP.expiresAt) {
      // Clear expired OTP
      project.deletionOTP = undefined;
      await project.save();

      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP."
      });
    }

    // Verify OTP
    if (project.deletionOTP.code !== otp.toString()) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP code. Please check and try again."
      });
    }

    // Check if OTP was already verified (prevent reuse)
    if (project.deletionOTP.verified) {
      return res.status(400).json({
        success: false,
        message: "OTP has already been used. Please request a new OTP."
      });
    }

    // Get application data before deletion for logging
    const activeApplications = await ProjectApplication.countDocuments({
      projectId: projectId,
      status: { $in: ['pending', 'approved'] }
    });

    const allApplications = await ProjectApplication.find({ projectId: projectId })
      .populate('applicantId', 'fullName email')
      .select('status applicantId appliedAt');

    // Mark OTP as verified
    project.deletionOTP.verified = true;
    project.deletionOTP.verifiedAt = new Date();
    project.deletionOTP.verifiedBy = req.admin.userId;
    await project.save();

    // FORCE DELETE: Delete the project and all its applications
    await AnnotationProject.findByIdAndDelete(projectId);
    await ProjectApplication.deleteMany({ projectId: projectId });

    // Send notification to Projects Officer about successful deletion
    try {
      const { sendProjectDeletionConfirmation } = require('../utils/projectMailer');

      const confirmationData = {
        projectName: project.projectName,
        projectId: projectId,
        deletedBy: req.admin.fullName || req.admin.email,
        deletedByEmail: req.admin.email,
        deletedAt: new Date(),
        applicationsDeleted: allApplications.length,
        activeApplicationsDeleted: activeApplications,
        confirmationMessage: confirmationMessage || 'Project deleted with all applications',
        deletedApplications: allApplications.map(app => ({
          applicantName: app.applicantId?.fullName || 'Unknown',
          applicantEmail: app.applicantId?.email || 'Unknown',
          status: app.status,
          appliedAt: app.appliedAt
        }))
      };

      await sendProjectDeletionConfirmation('projects@mydeeptech.ng', confirmationData);

    } catch (emailError) {
      console.warn(`⚠️ Failed to send deletion confirmation:`, emailError.message);
    }

    res.status(200).json({
      success: true,
      message: "Project deleted successfully with OTP verification",
      data: {
        deletedProject: {
          id: projectId,
          name: project.projectName,
          category: project.projectCategory
        },
        deletedApplications: {
          total: allApplications.length,
          active: activeApplications,
          applications: allApplications.map(app => ({
            applicantName: app.applicantId?.fullName || 'Unknown',
            status: app.status,
            appliedAt: app.appliedAt
          }))
        },
        deletedBy: req.admin.email,
        deletedAt: new Date(),
        otpVerified: true,
        confirmationSent: true
      }
    });

  } catch (error) {
    console.error("❌ Error verifying OTP and deleting project:", error);
    res.status(500).json({
      success: false,
      message: "Server error verifying OTP and deleting project",
      error: error.message
    });
  }
};

// Admin function: Get all applications for annotation projects
const getAnnotationProjectApplications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const projectId = req.query.projectId;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (projectId) filter.projectId = projectId;

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
        reviewNotes: reviewNotes || '',
        projectGuidelineLink: project.projectGuidelineLink,
        projectGuidelineVideo: project.projectGuidelineVideo,
        projectCommunityLink: project.projectCommunityLink,
        projectTrackerLink: project.projectTrackerLink
      };

      await sendProjectApprovalNotification(
        application.applicantId.email,
        application.applicantId.fullName,
        projectData
      );

    } catch (emailError) {
      console.error(`⚠️ Failed to send approval notification:`, emailError.message);
    }

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

    } catch (emailError) {
      console.error(`⚠️ Failed to send rejection notification:`, emailError.message);
    }

    // Create in-app notification for the rejected applicant
    try {
      await NotificationService.createApplicationStatusNotification(
        application.applicantId._id,
        'rejected',
        {
          _id: application.projectId._id,
          projectName: application.projectId.projectName,
          projectCategory: application.projectId.projectCategory
        },
        {
          _id: application._id
        }
      );
    } catch (notificationError) {
      console.error(`⚠️ Failed to create rejection notification:`, notificationError.message);
    }

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

// Admin function: Remove approved applicant from project
const removeApprovedApplicant = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { removalReason, removalNotes } = req.body;

    // Validate request body
    const { error, value } = removeApplicantSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map(detail => detail.message)
      });
    }

    // Find the application
    const application = await ProjectApplication.findById(applicationId)
      .populate({
        path: 'projectId',
        select: 'projectName projectCategory approvedAnnotators'
      })
      .populate('applicantId', 'fullName email phone');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found"
      });
    }

    // Check if application is approved
    if (application.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Cannot remove applicant. Application status is "${application.status}". Only approved applicants can be removed.`
      });
    }

    // Store original data for logging/email
    const originalData = {
      applicantName: application.applicantId.fullName,
      applicantEmail: application.applicantId.email,
      projectName: application.projectId.projectName,
      projectId: application.projectId._id,
      applicationId: application._id,
      approvedAt: application.reviewedAt,
      workStartedAt: application.workStartedAt
    };

    // Update application status to 'removed' with removal details
    application.status = 'removed';
    application.removedAt = new Date();
    application.removedBy = req.admin.userId;
    application.removalReason = removalReason || 'admin_decision';
    application.removalNotes = removalNotes || '';
    application.workEndedAt = new Date(); // Mark end of work period

    await application.save();

    // Update project's approved annotator count
    await AnnotationProject.findByIdAndUpdate(
      application.projectId._id,
      { $inc: { approvedAnnotators: -1 } }
    );

    // Send notification email to the removed applicant
    try {
      const { sendApplicantRemovalNotification } = require('../utils/projectMailer');
      await sendApplicantRemovalNotification(
        originalData.applicantEmail,
        originalData.applicantName,
        {
          projectName: originalData.projectName,
          projectId: originalData.projectId,
          removalReason: application.removalReason,
          removedBy: req.admin.email,
          removedAt: application.removedAt,
          workPeriod: {
            startedAt: originalData.workStartedAt,
            endedAt: application.workEndedAt
          }
        }
      );
    } catch (emailError) {
      console.error('❌ Failed to send removal notification email:', emailError);
      // Don't fail the request if email fails
    }

    // Send notification to project owner/admin
    try {
      const { sendProjectAnnotatorRemovedNotification } = require('../utils/projectMailer');
      await sendProjectAnnotatorRemovedNotification(
        req.admin.email,
        req.admin.fullName || 'Administrator',
        {
          projectName: originalData.projectName,
          projectId: originalData.projectId,
          removedApplicant: {
            name: originalData.applicantName,
            email: originalData.applicantEmail
          },
          removalReason: application.removalReason,
          removedAt: application.removedAt,
          workDuration: application.workEndedAt - originalData.workStartedAt
        }
      );
    } catch (emailError) {
      console.error('❌ Failed to send project notification email:', emailError);
    }

    // Prepare response with detailed information
    const response = {
      success: true,
      message: "Approved applicant successfully removed from project",
      data: {
        applicationId: application._id,
        applicant: {
          name: originalData.applicantName,
          email: originalData.applicantEmail
        },
        project: {
          id: originalData.projectId,
          name: originalData.projectName
        },
        removal: {
          removedAt: application.removedAt,
          removedBy: req.admin.email,
          reason: application.removalReason
        },
        workPeriod: {
          startedAt: originalData.workStartedAt,
          endedAt: application.workEndedAt,
          duration: application.workEndedAt - originalData.workStartedAt
        },
        previousStatus: 'approved',
        newStatus: 'removed'
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error removing approved applicant:', error);
    res.status(500).json({
      success: false,
      message: "Server error removing approved applicant",
      error: error.message
    });
  }
};

// Admin function: Get removable applicants for a project
const getRemovableApplicants = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Find the project
    const project = await AnnotationProject.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    // Find all approved applications for this project
    const approvedApplications = await ProjectApplication.find({
      projectId: projectId,
      status: 'approved'
    })
      .populate('applicantId', 'fullName email phone')
      .sort({ reviewedAt: -1 });

    // Format the data for easy removal management
    const removableApplicants = approvedApplications.map(app => ({
      applicationId: app._id,
      applicant: {
        id: app.applicantId._id,
        name: app.applicantId.fullName,
        email: app.applicantId.email,
        phone: app.applicantId.phone
      },
      applicationDetails: {
        appliedAt: app.appliedAt,
        approvedAt: app.reviewedAt,
        workStartedAt: app.workStartedAt,
        reviewedBy: app.reviewedBy,
        reviewNotes: app.reviewNotes
      },
      workDuration: app.workStartedAt ? Date.now() - app.workStartedAt.getTime() : 0
    }));

    res.status(200).json({
      success: true,
      message: "Removable applicants retrieved successfully",
      data: {
        project: {
          id: project._id,
          name: project.projectName,
          totalApprovedAnnotators: project.approvedAnnotators || 0,
          maxAnnotators: project.maxAnnotators
        },
        removableApplicants: removableApplicants,
        summary: {
          totalRemovableApplicants: removableApplicants.length,
          canRemoveAll: true, // Admins can remove any approved applicant
          projectStatus: project.status
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching removable applicants:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching removable applicants",
      error: error.message
    });
  }
};

// Admin function: Export approved annotators to CSV
const exportApprovedAnnotatorsCSV = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Find the project
    const project = await AnnotationProject.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    // Get all approved applications for this project
    const approvedApplications = await ProjectApplication.find({
      projectId: projectId,
      status: 'approved'
    })
      .populate({
        path: 'applicantId',
        select: 'fullName email phone personal_info'
      })
      .sort({ reviewedAt: -1 });

    if (approvedApplications.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No approved annotators found for this project"
      });
    }

    // Prepare CSV data
    const csvHeaders = ['Full Name', 'Country', 'Email'];
    const csvRows = [csvHeaders.join(',')];

    // Process each approved application
    approvedApplications.forEach(app => {
      const applicant = app.applicantId;
      const personalInfo = applicant.personal_info || {};

      const row = [
        `"${applicant.fullName || 'N/A'}"`,
        `"${personalInfo.country || 'N/A'}"`,
        `"${applicant.email || 'N/A'}"`
      ];

      csvRows.push(row.join(','));
    });

    // Generate CSV content
    const csvContent = csvRows.join('\n');

    // Create filename with project name and timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const sanitizedProjectName = project.projectName
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
    const filename = `${sanitizedProjectName}_approved_annotators_${timestamp}.csv`;

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // Send CSV content
    res.status(200).send(csvContent);

  } catch (error) {
    console.error('❌ Error exporting approved annotators:', error);
    res.status(500).json({
      success: false,
      message: "Server error exporting annotators",
      error: error.message
    });
  }
};

/**
 * Admin function: Attach or update multimedia assessment to project
 */
const attachAssessmentToProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { assessmentId, isRequired = true, assessmentInstructions = '' } = req.body;

    // Validate inputs
    if (!assessmentId) {
      return res.status(400).json({
        success: false,
        message: "Assessment ID is required"
      });
    }

    // Check if project exists
    const project = await AnnotationProject.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    // Check if assessment configuration exists
    const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');
    const assessmentConfig = await MultimediaAssessmentConfig.findById(assessmentId);
    if (!assessmentConfig) {
      return res.status(404).json({
        success: false,
        message: "Assessment configuration not found"
      });
    }

    // Update project with assessment configuration
    const adminId = req.admin?.userId || req.userId || req.admin?.userDoc?._id;

    project.assessment = {
      isRequired,
      assessmentId,
      assessmentInstructions,
      attachedAt: new Date(),
      attachedBy: adminId
    };

    await project.save();

    // Populate the assessment config for response
    await project.populate('assessment.assessmentId', 'title description numberOfTasks estimatedDuration');

    res.json({
      success: true,
      message: `Assessment "${assessmentConfig.title}" attached to project successfully`,
      data: {
        project: {
          id: project._id,
          name: project.projectName,
          assessment: project.assessment
        }
      }
    });
  } catch (error) {
    console.error('Error attaching assessment to project:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to attach assessment to project',
      error: error.message
    });
  }
};

/**
 * Admin function: Remove assessment from project
 */
const removeAssessmentFromProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Find and update project
    const project = await AnnotationProject.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    const wasRequired = project.assessment?.isRequired;

    // Clear assessment configuration
    project.assessment = {
      isRequired: false,
      assessmentId: null,
      assessmentInstructions: '',
      attachedAt: null,
      attachedBy: null
    };

    await project.save();

    res.json({
      success: true,
      message: "Assessment removed from project successfully",
      data: {
        project: {
          id: project._id,
          name: project.projectName,
          hadAssessment: wasRequired
        }
      }
    });
  } catch (error) {
    console.error('Error removing assessment from project:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove assessment from project',
      error: error.message
    });
  }
};

/**
 * Admin function: Get available assessment configurations
 */
const getAvailableAssessments = async (req, res) => {
  try {
    const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');

    const assessments = await MultimediaAssessmentConfig.find({ isActive: true })
      .populate('projectId', 'projectName')
      .sort({ createdAt: -1 })
      .lean();

    const formattedAssessments = assessments.map(assessment => ({
      id: assessment._id,
      title: assessment.title,
      description: assessment.description,
      numberOfTasks: assessment.numberOfTasks,
      estimatedDuration: assessment.estimatedDuration,
      maxRetries: assessment.maxRetries,
      isActive: assessment.isActive,
      createdAt: assessment.createdAt,
      // Usage statistics
      usageCount: assessment.statistics?.totalSubmissions || 0,
      approvalRate: assessment.statistics?.totalSubmissions > 0 ?
        (assessment.statistics.approvedSubmissions / assessment.statistics.totalSubmissions * 100).toFixed(1) : 0
    }));

    res.json({
      success: true,
      message: `Found ${formattedAssessments.length} available assessments`,
      data: {
        assessments: formattedAssessments
      }
    });
  } catch (error) {
    console.error('Error fetching available assessments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available assessments',
      error: error.message
    });
  }
};
const getApprovedApplicants = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw new ValidationError('Invalid project ID');
    }

    const project = await AnnotationProject.findById(projectId);
    if (!project) throw new NotFoundError('Project not found');

    const approvedApplications = await ProjectApplication.find({
      projectId,
      status: 'approved'
    })
      .populate('applicantId', 'fullName email phone')
      .sort({ reviewedAt: -1 });

    return res.json({
      success: true,
      total: approvedApplications.length,
      data: approvedApplications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get approved applicants',
      error: error.message
    });
  }
};

// Bulk reject pending applications
const rejectApplicationsBulk = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { applicationIds, admin, rejectionReason = 'other', reviewNotes = '' } = req.body;

    if (!admin || !admin.userId) throw new ValidationError('Admin information is required');

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      throw new ValidationError('No application IDs provided');
    }

    const validIds = applicationIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (!validIds.length) throw new ValidationError('No valid application IDs provided');

    // Fetch pending applications
    const applications = await ProjectApplication.find({
      _id: { $in: validIds },
      status: 'pending'
    })
      .populate('projectId', 'projectName projectCategory')
      .populate('applicantId', 'fullName email')
      .session(session);

    if (!applications.length) {
      throw new NotFoundError('No pending applications found with the provided IDs');
    }

    // Bulk update
    await ProjectApplication.updateMany(
      { _id: { $in: applications.map(app => app._id) } },
      {
        $set: {
          status: 'rejected',
          reviewedBy: admin.userId,
          reviewedAt: new Date(),
          rejectionReason,
          reviewNotes
        }
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Send notifications asynchronously (fault-tolerant)
    const notificationResults = await Promise.allSettled(
      applications.map(async application => {
        try {
          await sendProjectRejectionNotification(
            application.applicantId.email,
            application.applicantId.fullName,
            {
              projectName: application.projectId.projectName,
              projectCategory: application.projectId.projectCategory,
              adminName: admin.fullName,
              rejectionReason,
              reviewNotes
            }
          );

          await notificationService.createApplicationStatusNotification(
            application.applicantId._id,
            'rejected',
            application.projectId,
            application
          );

          return { id: application._id, status: 'success' };
        } catch (error) {
          console.error(`Notification failed for application ${application._id}:`, error.message);
          return { id: application._id, status: 'notification_failed', message: error.message };
        }
      })
    );

    const successCount = notificationResults.filter(
      r => r.status === 'fulfilled' && r.value.status === 'success'
    ).length;

    return res.status(200).json({
      totalRequested: applicationIds.length,
      processed: applications.length,
      rejected: applications.length,
      notificationSuccess: successCount,
      notificationFailed: applications.length - successCount
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      success: false,
      message: 'Bulk rejection failed',
      error: error.message
    });
  }
};

// Bulk approve applications
const bulkApproveApplications = async (req, res) => {
  try {
    const { applicationIds } = req.body;

    if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Application IDs are required and must be a non-empty array"
      });
    }

    const results = [];
    const errors = [];

    for (const applicationId of applicationIds) {
      try {
        // Find and update application
        const application = await ProjectApplication.findById(applicationId)
          .populate({
            path: 'projectId',
            select: 'projectName projectCategory payRate approvedAnnotators maxAnnotators'
          })
          .populate('applicantId', 'fullName email');

        if (!application) {
          errors.push({ applicationId, error: "Application not found" });
          continue;
        }

        if (application.status !== 'pending') {
          errors.push({ applicationId, error: `Application is already ${application.status}` });
          continue;
        }

        // Check if project has reached max annotators
        if (application.projectId.maxAnnotators && 
            application.projectId.approvedAnnotators && 
            application.projectId.approvedAnnotators.length >= application.projectId.maxAnnotators) {
          errors.push({ applicationId, error: "Project has reached maximum annotators" });
          continue;
        }

        // Update application status
        application.status = 'approved';
        application.reviewedAt = new Date();
        application.reviewedBy = req.admin._id;
        application.reviewNotes = 'Bulk approved by admin';

        await application.save();

        // Add annotator to project's approved list
        if (!application.projectId.approvedAnnotators.includes(application.applicantId._id)) {
          await AnnotationProject.findByIdAndUpdate(
            application.projectId._id,
            { $push: { approvedAnnotators: application.applicantId._id } }
          );
        }

        results.push({
          applicationId,
          applicantName: application.applicantId?.fullName || 'Unknown',
          projectName: application.projectId?.projectName || 'Unknown',
          status: 'approved'
        });

      } catch (error) {
        errors.push({ applicationId, error: error.message });
      }
    }

    const totalProcessed = results.length + errors.length;
    const successCount = results.length;
    const errorCount = errors.length;

    res.status(200).json({
      success: true,
      message: `Bulk approval completed: ${successCount} approved, ${errorCount} failed`,
      data: {
        totalProcessed,
        successCount,
        errorCount,
        approvedApplications: results,
        errors: errors
      }
    });

  } catch (error) {
    console.error("❌ Error bulk approving applications:", error);
    res.status(500).json({
      success: false,
      message: "Server error bulk approving applications",
      error: error.message
    });
  }
};

// Bulk reject applications
const bulkRejectApplications = async (req, res) => {
  try {
    const { applicationIds, rejectionReason = 'other', reviewNotes = 'Bulk rejected by admin' } = req.body;

    if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Application IDs are required and must be a non-empty array"
      });
    }

    const results = [];
    const errors = [];

    for (const applicationId of applicationIds) {
      try {
        // Find and update application
        const application = await ProjectApplication.findById(applicationId)
          .populate({
            path: 'projectId',
            select: 'projectName projectCategory'
          })
          .populate('applicantId', 'fullName email');

        if (!application) {
          errors.push({ applicationId, error: "Application not found" });
          continue;
        }

        if (application.status !== 'pending') {
          errors.push({ applicationId, error: `Application is already ${application.status}` });
          continue;
        }

        // Update application status
        application.status = 'rejected';
        application.reviewedAt = new Date();
        application.reviewedBy = req.admin._id;
        application.rejectionReason = rejectionReason;
        application.reviewNotes = reviewNotes;

        await application.save();

        results.push({
          applicationId,
          applicantName: application.applicantId?.fullName || 'Unknown',
          projectName: application.projectId?.projectName || 'Unknown',
          status: 'rejected'
        });

      } catch (error) {
        errors.push({ applicationId, error: error.message });
      }
    }

    const totalProcessed = results.length + errors.length;
    const successCount = results.length;
    const errorCount = errors.length;

    res.status(200).json({
      success: true,
      message: `Bulk rejection completed: ${successCount} rejected, ${errorCount} failed`,
      data: {
        totalProcessed,
        successCount,
        errorCount,
        rejectedApplications: results,
        errors: errors
      }
    });

  } catch (error) {
    console.error("❌ Error bulk rejecting applications:", error);
    res.status(500).json({
      success: false,
      message: "Server error bulk rejecting applications",
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
  requestProjectDeletionOTP,
  verifyOTPAndDeleteProject,
  getAnnotationProjectApplications,
  approveAnnotationProjectApplication,
  rejectAnnotationProjectApplication,
  removeApprovedApplicant,
  getRemovableApplicants,
  exportApprovedAnnotatorsCSV,
  attachAssessmentToProject,
  removeAssessmentFromProject,
  getAvailableAssessments,
  rejectApplicationsBulk,
  getApprovedApplicants,
  bulkApproveApplications,
  bulkRejectApplications,
  toggleProjectShowHide,
  toggleProjectStatus,
};