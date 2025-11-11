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

    console.log(`✅ Found project with ${annotatorStats.total} total annotators (${annotatorStats.approved} approved, ${annotatorStats.rejected} rejected, ${annotatorStats.pending} pending)`);

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

// Admin function: Request OTP for project deletion (Projects Officer authorization)
const requestProjectDeletionOTP = async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log(`🔐 Admin ${req.admin.email} requesting deletion OTP for project: ${projectId}`);

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
      
      console.log(`✅ Deletion OTP sent to Projects Officer: ${projectsOfficerEmail}`);

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
    
    console.log(`🔐 Admin ${req.admin.email} verifying deletion OTP for project: ${projectId}`);

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

    console.log(`✅ Project FORCE DELETED with OTP verification: ${project.projectName}`);
    console.log(`📊 Deleted ${allApplications.length} applications (${activeApplications} were active)`);

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
      
      console.log(`✅ Deletion confirmation sent to Projects Officer`);

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
  requestProjectDeletionOTP,
  verifyOTPAndDeleteProject,
  getAnnotationProjectApplications,
  approveAnnotationProjectApplication,
  rejectAnnotationProjectApplication
};