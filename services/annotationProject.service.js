const mongoose = require("mongoose");
const MailService = require("./mail-service/mail-service");
const NotificationService = require("./notification.service");
const MultimediaAssessmentConfig = require("../models/multimediaAssessmentConfig.model");
const UserRepository = require("../repositories/user.repository");

class AnnotationProjectService {
  constructor(repository) {
    this.repository = repository;
    this.userRepository = new UserRepository();
  }

  // Project methods
  createProject = async (projectData, admin) => {
    const adminId = admin.userId || admin.userDoc?._id;
    if (!adminId) {
      throw new Error("Admin identification required");
    }

    const data = {
      ...projectData,
      createdBy: adminId,
      assignedAdmins: [adminId],
    };

    const project = await this.repository.createProject(data);
    return await this.repository.findProjectByIdWithPopulate(project._id, [
      { path: "createdBy", select: "fullName email" },
      { path: "assignedAdmins", select: "fullName email" },
    ]);
  };

  getAllProjects = async (query) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status, category, search, isActive, openCloseStatus } = query;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.projectCategory = category;
    if (openCloseStatus) filter.openCloseStatus = openCloseStatus;

    if (isActive === "true") {
      filter.isActive = true;
    } else if (isActive === "false") {
      filter.isActive = false;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { projectName: searchRegex },
        { projectDescription: searchRegex },
        { tags: { $in: [searchRegex] } },
      ];
    }

    const [
      projects,
      totalProjects,
      activeProjects,
      completedProjects,
      pausedProjects,
      statusSummary,
      categorySummary,
    ] = await Promise.all([
      this.repository.findAllProjects(filter, skip, limit),
      this.repository.countProjects(filter),
      this.repository.countProjects({ ...filter, isActive: true }),
      this.repository.countProjects({ ...filter, status: "completed" }),
      this.repository.countProjects({ ...filter, status: "paused" }),
      this.repository.aggregateProjects([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      this.repository.aggregateProjects([
        { $group: { _id: "$projectCategory", count: { $sum: 1 } } },
      ]),
    ]);

    const totalPages = Math.ceil(totalProjects / limit);

    return {
      projects,
      pagination: {
        currentPage: page,
        totalPages,
        totalProjects,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit,
      },
      summary: {
        totalProjects,
        activeProjects,
        completedProjects,
        pausedProjects,
        statusBreakdown: statusSummary.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        categoryBreakdown: categorySummary.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        filters: { ...filter, ...(search && { search }) },
      },
    };
  };

  getProjectDetails = async (projectId, search) => {
    const project = await this.repository.findProjectByIdWithPopulate(
      projectId,
      [
        { path: "createdBy", select: "fullName email phone" },
        { path: "assignedAdmins", select: "fullName email phone" },
      ],
    );

    if (!project) {
      throw new Error("Project not found");
    }

    const buildApplicantLookupStages = () => [
      {
        $lookup: {
          from: "dtusers",
          localField: "applicantId",
          foreignField: "_id",
          as: "applicantId",
        },
      },
      { $unwind: { path: "$applicantId", preserveNullAndEmptyArrays: true } },
    ];

    const buildReviewedByLookupStages = () => [
      {
        $lookup: {
          from: "dtusers",
          localField: "reviewedBy",
          foreignField: "_id",
          as: "reviewedBy",
        },
      },
      { $unwind: { path: "$reviewedBy", preserveNullAndEmptyArrays: true } },
    ];

    const buildSearchPipeline = (status, sortField = "appliedAt") => {
      const pipeline = [
        { $match: { projectId: project._id, status: status } },
        ...buildApplicantLookupStages(),
      ];

      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { "applicantId.fullName": { $regex: search, $options: "i" } },
              { "applicantId.email": { $regex: search, $options: "i" } },
              { status: { $regex: search, $options: "i" } },
              {
                "applicantId.annotatorStatus": {
                  $regex: search,
                  $options: "i",
                },
              },
            ],
          },
        });
      }

      pipeline.push(...buildReviewedByLookupStages());

      const sortOrder =
        status === "approved" || status === "rejected"
          ? { reviewedAt: -1 }
          : { [sortField]: -1 };
      pipeline.push({ $sort: sortOrder });

      return pipeline;
    };

    const recentApplicationsPipeline = [
      { $match: { projectId: project._id } },
      ...buildApplicantLookupStages(),
    ];

    if (search) {
      recentApplicationsPipeline.push({
        $match: {
          $or: [
            { "applicantId.fullName": { $regex: search, $options: "i" } },
            { "applicantId.email": { $regex: search, $options: "i" } },
            { status: { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    recentApplicationsPipeline.push(
      ...buildReviewedByLookupStages(),
      { $sort: { appliedAt: -1 } },
      { $limit: 50 },
    );

    const [
      applicationStats,
      recentApplications,
      approvedAnnotators,
      rejectedAnnotators,
      pendingAnnotators,
      removedAnnotators,
      recentReviewActivity,
    ] = await Promise.all([
      this.repository.aggregateApplications([
        { $match: { projectId: project._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      this.repository.aggregateApplications(recentApplicationsPipeline),
      this.repository.aggregateApplications(
        buildSearchPipeline("approved", "reviewedAt"),
      ),
      this.repository.aggregateApplications(
        buildSearchPipeline("rejected", "reviewedAt"),
      ),
      this.repository.aggregateApplications(
        buildSearchPipeline("pending", "appliedAt"),
      ),
      this.repository.aggregateApplications(
        buildSearchPipeline("removed", "removedAt"),
      ),
      this.repository.aggregateApplications([
        {
          $match: {
            projectId: project._id,
            status: { $in: ["approved", "rejected"] },
            reviewedAt: { $exists: true },
          },
        },
        {
          $lookup: {
            from: "dtusers",
            localField: "applicantId",
            foreignField: "_id",
            as: "applicantId",
          },
        },
        {
          $lookup: {
            from: "dtusers",
            localField: "reviewedBy",
            foreignField: "_id",
            as: "reviewedBy",
          },
        },
        { $unwind: { path: "$applicantId", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$reviewedBy", preserveNullAndEmptyArrays: true } },
        { $sort: { reviewedAt: -1 } },
        { $limit: 10 },
        {
          $project: {
            status: 1,
            reviewedAt: 1,
            reviewedBy: { fullName: 1, email: 1 },
            applicantId: { fullName: 1, email: 1 },
            reviewNotes: 1,
            rejectionReason: 1,
          },
        },
      ]),
    ]);

    const formatAnnotatorData = (applications) => {
      return applications.map((app) => ({
        _id: app._id, // Application unique ID for table rowKey
        applicationId: app._id, // Alternative key for consistency
        applicantId: {
          _id: app.applicantId?._id, // Applicant's user ID
          fullName: app.applicantId?.fullName || "N/A",
          email: app.applicantId?.email || "N/A",
          annotatorStatus: app.applicantId?.annotatorStatus || "pending",
        },
        applicationStatus: app.status,
        appliedAt: app.appliedAt,
        reviewedAt: app.reviewedAt,
        reviewedBy: app.reviewedBy
          ? {
              _id: app.reviewedBy._id,
              fullName: app.reviewedBy.fullName,
              email: app.reviewedBy.email,
            }
          : null,
        reviewNotes: app.reviewNotes,
        rejectionReason: app.rejectionReason,
        coverLetter: app.coverLetter,
        workStartedAt: app.workStartedAt,
        availability: app.availability,
        status: app.status,
        tasksCompleted: app.tasksCompleted || 0,
        estimatedCompletionTime: app.estimatedCompletionTime,
        proposedRate: app.proposedRate,
        annotator: {
          id: app.applicantId?._id,
          fullName: app.applicantId?.fullName || "N/A",
          email: app.applicantId?.email || "N/A",
          phone: app.applicantId?.phone,
          annotatorStatus: app.applicantId?.annotatorStatus,
          microTaskerStatus: app.applicantId?.microTaskerStatus,
          profilePicture: app.applicantId?.profilePicture?.url || null,
          joinedDate: app.applicantId?.createdAt,
          personalInfo: {
            country: app.applicantId?.personal_info?.country || null,
            timeZone: app.applicantId?.personal_info?.time_zone || null,
            availableHours:
              app.applicantId?.personal_info?.available_hours_per_week || null,
            languages: app.applicantId?.personal_info?.languages || [],
          },
          professionalBackground: {
            educationField:
              app.applicantId?.professional_background?.education_field || null,
            yearsOfExperience:
              app.applicantId?.professional_background?.years_of_experience ||
              null,
            previousProjects:
              app.applicantId?.professional_background
                ?.previous_annotation_projects || [],
            skills: app.applicantId?.professional_background?.skills || [],
          },
          paymentInfo: {
            hasPaymentInfo: !!(
              app.applicantId?.payment_info?.account_name &&
              app.applicantId?.payment_info?.account_number
            ),
            accountName: app.applicantId?.payment_info?.account_name || null,
            bankName: app.applicantId?.payment_info?.bank_name || null,
          },
          attachments: {
            hasResume: !!app.applicantId?.attachments?.resume_url,
            hasIdDocument: !!app.applicantId?.attachments?.id_document_url,
            resumeUrl: app.applicantId?.attachments?.resume_url || null,
            idDocumentUrl:
              app.applicantId?.attachments?.id_document_url || null,
          },
        },
      }));
    };

    const annotatorStats = {
      total:
        approvedAnnotators.length +
        rejectedAnnotators.length +
        pendingAnnotators.length +
        removedAnnotators.length,
      approved: approvedAnnotators.length,
      rejected: rejectedAnnotators.length,
      pending: pendingAnnotators.length,
      removed: removedAnnotators.length,
      approvalRate:
        approvedAnnotators.length + rejectedAnnotators.length > 0
          ? Math.round(
              (approvedAnnotators.length /
                (approvedAnnotators.length + rejectedAnnotators.length)) *
                100,
            )
          : 0,
    };

    const formattedRecentApplications = recentApplications.map((app) => ({
      _id: app._id,
      projectId: app.projectId,
      applicantId: {
        _id: app.applicantId?._id,
        fullName: app.applicantId?.fullName || "N/A",
        email: app.applicantId?.email || "N/A",
        annotatorStatus: app.applicantId?.annotatorStatus || "pending",
      },
      status: app.status,
      reviewedAt: app.reviewedAt,
      reviewedBy: app.reviewedBy
        ? {
            _id: app.reviewedBy._id,
            fullName: app.reviewedBy.fullName,
            email: app.reviewedBy.email,
          }
        : null,
      coverLetter: app.coverLetter,
      proposedRate: app.proposedRate,
      availability: app.availability,
      estimatedCompletionTime: app.estimatedCompletionTime,
      reviewNotes: app.reviewNotes,
      rejectionReason: app.rejectionReason,
      applicantNotified: app.applicantNotified || false,
      adminNotified: app.adminNotified || false,
      workStartedAt: app.workStartedAt,
      workCompletedAt: app.workCompletedAt,
      tasksCompleted: app.tasksCompleted || 0,
      qualityScore: app.qualityScore,
      appliedAt: app.appliedAt,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      __v: app.__v || 0,
      id: app._id,
    }));

    return {
      project,
      applicationStats: applicationStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      annotatorStats,
      recentApplications: formattedRecentApplications,
      annotators: {
        approved: formatAnnotatorData(approvedAnnotators),
        rejected: formatAnnotatorData(rejectedAnnotators),
        pending: formatAnnotatorData(pendingAnnotators),
        removed: formatAnnotatorData(removedAnnotators),
      },
      recentReviewActivity,
      searchFilter: search || null,
      filteredCounts: {
        approved: approvedAnnotators.length,
        rejected: rejectedAnnotators.length,
        pending: pendingAnnotators.length,
        removed: removedAnnotators.length,
        total:
          approvedAnnotators.length +
          rejectedAnnotators.length +
          pendingAnnotators.length +
          removedAnnotators.length,
      },
    };
  };

  updateProject = async (projectId, updateData) => {
    const project = await this.repository.updateProject(projectId, {
      ...updateData,
      updatedAt: new Date(),
    });
    if (!project) throw new Error("Project not found");
    return await this.repository.findProjectByIdWithPopulate(project._id, [
      { path: "createdBy", select: "fullName email" },
      { path: "assignedAdmins", select: "fullName email" },
    ]);
  };

  toggleProjectStatus = async (projectId) => {
    const project = await this.repository.findProjectById(projectId);
    if (!project) throw new Error("Project not found");

    project.isActive = !project.isActive;
    project.status = project.isActive ? "active" : "inactive";
    await project.save();
    return project;
  };

    approveProjectApplicant = async (projectId, updateData) => {
    const project = await this.repository.updateProject(projectId, {
      ...updateData,
      updatedAt: new Date(),
    });
    if (!project) throw new Error("Project not found");
    return await this.repository.findProjectByIdWithPopulate(project._id, [
      { path: "createdBy", select: "fullName email" },
      { path: "assignedAdmins", select: "fullName email" },
    ]);
  };

  approveAnnotationProject = async (projectId, applicantId) => {
    const project = await this.repository.findProjectById(projectId);
    if (!project) throw new Error("Project not found");

    project.isActive = !project.isActive;
    project.status = project.isActive ? "active" : "inactive";
    await project.save();
    return project;
  };

  toggleProjectVisibility = async (projectId) => {
    const project = await this.repository.findProjectById(projectId);
    if (!project) throw new Error("Project not found");

    project.openCloseStatus =
      project.openCloseStatus === "open" ? "close" : "open";
    await project.save();
    return project;
  };

  deleteProject = async (projectId) => {
    const project = await this.repository.findProjectById(projectId);
    if (!project) throw new Error("Project not found");

    const activeApplications = await this.repository.countApplications({
      projectId,
      status: { $in: ["pending", "approved"] },
    });

    if (activeApplications > 0) {
      return {
        requiresOTP: true,
        projectName: project.projectName,
        projectId,
        activeApplications,
      };
    }

    await this.repository.deleteProject(projectId);
    await this.repository.deleteApplicationsMany({ projectId });
    return { success: true };
  };

  requestDeletionOTP = async (projectId, admin, reason) => {
    const project = await this.repository.findProjectById(projectId);
    if (!project) throw new Error("Project not found");

    const activeApplications = await this.repository.countApplications({
      projectId,
      status: { $in: ["pending", "approved"] },
    });
    const allApplicationsCount = await this.repository.countApplications({
      projectId,
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    project.deletionOTP = {
      code: otp,
      expiresAt: otpExpiry,
      requestedBy: admin.userId,
      requestedAt: new Date(),
      verified: false,
    };

    await project.save();

    const projectsOfficerEmail = "projects@mydeeptech.ng";
    const deletionData = {
      projectName: project.projectName,
      projectId,
      projectCategory: project.projectCategory,
      requestedBy: admin.fullName || admin.email,
      requestedByEmail: admin.email,
      activeApplications,
      totalApplications: allApplicationsCount,
      otp,
      expiryTime: otpExpiry,
      reason: reason || "Administrative deletion",
    };

    await MailService.sendProjectDeletionOTP(
      projectsOfficerEmail,
      "Projects Officer",
      deletionData,
    );

    return {
      projectName: project.projectName,
      projectId,
      activeApplications,
      totalApplications: allApplicationsCount,
      otpSentTo: projectsOfficerEmail,
      expiresAt: otpExpiry,
      requestedBy: admin.email,
      otpExpiryMinutes: 15,
    };
  };

  verifyOTPAndDelete = async (projectId, otp, admin, confirmationMessage) => {
    const project = await this.repository.findProjectById(projectId);
    if (!project) throw new Error("Project not found");

    if (!project.deletionOTP || !project.deletionOTP.code) {
      throw new Error("No deletion OTP found. Please request a new OTP first.");
    }

    if (new Date() > project.deletionOTP.expiresAt) {
      project.deletionOTP = undefined;
      await project.save();
      throw new Error("OTP has expired. Please request a new OTP.");
    }

    if (project.deletionOTP.code !== otp.toString()) {
      throw new Error("Invalid OTP code. Please check and try again.");
    }

    if (project.deletionOTP.verified) {
      throw new Error("OTP has already been used. Please request a new OTP.");
    }

    const activeApplicationsCount = await this.repository.countApplications({
      projectId,
      status: { $in: ["pending", "approved"] },
    });

    const allApplications = await this.repository.findApplications({
      projectId,
    });

    project.deletionOTP.verified = true;
    project.deletionOTP.verifiedAt = new Date();
    project.deletionOTP.verifiedBy = admin.userId;
    await project.save();

    await this.repository.deleteProject(projectId);
    await this.repository.deleteApplicationsMany({ projectId });

    try {
      const confirmationData = {
        projectName: project.projectName,
        projectId,
        deletedBy: admin.fullName || admin.email,
        deletedByEmail: admin.email,
        deletedAt: new Date(),
        applicationsDeleted: allApplications.length,
        activeApplicationsDeleted: activeApplicationsCount,
        confirmationMessage:
          confirmationMessage || "Project deleted with all applications",
        deletedApplications: allApplications.map((app) => ({
          applicantName: app.applicantId?.fullName || "Unknown",
          applicantEmail: app.applicantId?.email || "Unknown",
          status: app.status,
          appliedAt: app.appliedAt,
        })),
      };
      // Note: Use static method from projectMailer or MailService if updated
      const {
        sendProjectDeletionConfirmation,
      } = require("../utils/projectMailer");
      await sendProjectDeletionConfirmation(
        "projects@mydeeptech.ng",
        confirmationData,
      );
    } catch (emailError) {
      console.warn(
        `⚠️ Failed to send deletion confirmation:`,
        emailError.message,
      );
    }

    return {
      deletedProject: {
        id: projectId,
        name: project.projectName,
        category: project.projectCategory,
      },
      deletedApplications: {
        total: allApplications.length,
        active: activeApplicationsCount,
        applications: allApplications.map((app) => ({
          applicantName: app.applicantId?.fullName || "Unknown",
          status: app.status,
          appliedAt: app.appliedAt,
        })),
      },
      deletedBy: admin.email,
      deletedAt: new Date(),
      otpVerified: true,
      confirmationSent: true,
    };
  };

  getApplications = async (query) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status, projectId, search } = query;

    const filter = {};
    if (status) filter.status = status;
    if (projectId) {
      if (this.repository.isValidObjectId(projectId)) {
        filter.projectId = this.repository.toObjectId(projectId);
      } else {
        throw new Error("Invalid project ID format");
      }
    }

    const buildApplicationLookupStages = () => [
      {
        $lookup: {
          from: "dtusers",
          localField: "applicantId",
          foreignField: "_id",
          as: "applicantId",
        },
      },
      {
        $lookup: {
          from: "annotationprojects",
          localField: "projectId",
          foreignField: "_id",
          as: "projectId",
          pipeline: [
            {
              $lookup: {
                from: "dtusers",
                localField: "createdBy",
                foreignField: "_id",
                as: "createdBy",
                pipeline: [{ $project: { fullName: 1, email: 1 } }],
              },
            },
            {
              $unwind: {
                path: "$createdBy",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                projectName: 1,
                projectCategory: 1,
                payRate: 1,
                status: 1,
                createdBy: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "dtusers",
          localField: "reviewedBy",
          foreignField: "_id",
          as: "reviewedBy",
          pipeline: [{ $project: { fullName: 1, email: 1 } }],
        },
      },
      { $unwind: { path: "$applicantId", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$projectId", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$reviewedBy", preserveNullAndEmptyArrays: true } },
    ];

    const buildApplicationSearchFilter = () => {
      if (!search) return [];

      return [
        {
          $match: {
            $or: [
              { "applicantId.fullName": { $regex: search, $options: "i" } },
              { "applicantId.email": { $regex: search, $options: "i" } },
              { status: { $regex: search, $options: "i" } },
            ],
          },
        },
      ];
    };

    const buildSummaryPipeline = () => [
      { $match: filter },
      {
        $lookup: {
          from: "dtusers",
          localField: "applicantId",
          foreignField: "_id",
          as: "applicantId",
        },
      },
      { $unwind: { path: "$applicantId", preserveNullAndEmptyArrays: true } },
      ...buildApplicationSearchFilter(),
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ];

    const basePipeline = [
      { $match: filter },
      ...buildApplicationLookupStages(),
    ];
    const searchFilter = buildApplicationSearchFilter();
    const dataPipeline = [
      ...basePipeline,
      ...searchFilter,
      { $sort: { appliedAt: -1 } },
    ];

    const [totalResult, applications, statusSummary] = await Promise.all([
      this.repository.aggregateApplications([
        ...dataPipeline,
        { $count: "total" },
      ]),
      this.repository.aggregateApplications([
        ...dataPipeline,
        { $skip: skip },
        { $limit: limit },
      ]),
      this.repository.aggregateApplications(buildSummaryPipeline()),
    ]);

    const totalApplications = totalResult.length > 0 ? totalResult[0].total : 0;
    const totalPages = Math.ceil(totalApplications / limit);

    return {
      applications,
      pagination: {
        currentPage: page,
        totalPages,
        totalApplications,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit,
      },
      summary: {
        totalApplications,
        statusBreakdown: statusSummary.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        filters: { ...filter, ...(search && { search }) },
      },
    };
  };

  approveApplication = async (applicationId, admin, reviewNotes) => {
    const application = await this.repository.findApplicationByIdWithPopulate(
      applicationId,
      [
        {
          path: "projectId",
          select:
            "projectName projectCategory payRate approvedAnnotators maxAnnotators projectGuidelineLink projectGuidelineVideo projectCommunityLink projectTrackerLink",
        },
        { path: "applicantId", select: "fullName email" },
      ],
    );

    if (!application) throw new Error("Application not found");
    if (application.status !== "pending")
      throw new Error(`Application is already ${application.status}`);

    const project = application.projectId;
    if (
      project.maxAnnotators &&
      project.approvedAnnotators >= project.maxAnnotators
    ) {
      throw new Error("Project has reached maximum number of annotators");
    }

    application.status = "approved";
    application.reviewedBy = admin.userId;
    application.reviewedAt = new Date();
    application.reviewNotes = reviewNotes || "";
    application.workStartedAt = new Date();

    await application.save();

    await this.repository.updateProject(project._id, {
      $inc: { approvedAnnotators: 1 },
    });

    try {
      const projectData = {
        projectName: project.projectName,
        projectCategory: project.projectCategory,
        payRate: project.payRate,
        adminName: admin.fullName,
        reviewNotes: reviewNotes || "",
        projectGuidelineLink: project.projectGuidelineLink,
        projectGuidelineVideo: project.projectGuidelineVideo,
        projectCommunityLink: project.projectCommunityLink,
        projectTrackerLink: project.projectTrackerLink,
      };
      await MailService.sendProjectApprovalNotification(
        application.applicantId.email,
        application.applicantId.fullName,
        projectData,
      );
    } catch (emailError) {
      console.error(
        `⚠️ Failed to send approval notification:`,
        emailError.message,
      );
    }

    return {
      application,
      projectName: project.projectName,
      applicantName: application.applicantId.fullName,
      emailNotificationSent: true,
    };
  };

  rejectApplication = async (
    applicationId,
    admin,
    rejectionReason,
    reviewNotes,
  ) => {
    const application = await this.repository.findApplicationByIdWithPopulate(
      applicationId,
      [
        { path: "projectId", select: "projectName projectCategory" },
        { path: "applicantId", select: "fullName email" },
      ],
    );

    if (!application) throw new Error("Application not found");
    if (application.status !== "pending")
      throw new Error(`Application is already ${application.status}`);

    application.status = "rejected";
    application.reviewedBy = admin.userId;
    application.reviewedAt = new Date();
    application.rejectionReason = rejectionReason || "other";
    application.reviewNotes = reviewNotes || "";

    await application.save();

    try {
      const projectData = {
        projectName: application.projectId.projectName,
        projectCategory: application.projectId.projectCategory,
        adminName: admin.fullName,
        rejectionReason: application.rejectionReason,
        reviewNotes: reviewNotes || "",
      };
      await MailService.sendProjectRejectionNotification(
        application.applicantId.email,
        application.applicantId.fullName,
        projectData,
      );
    } catch (emailError) {
      console.error(
        `⚠️ Failed to send rejection notification:`,
        emailError.message,
      );
    }

    try {
      await NotificationService.createApplicationStatusNotification(
        application.applicantId._id,
        "rejected",
        {
          _id: application.projectId._id,
          projectName: application.projectId.projectName,
          projectCategory: application.projectId.projectCategory,
        },
        { _id: application._id },
      );
    } catch (notificationError) {
      console.error(
        `⚠️ Failed to create rejection notification:`,
        notificationError.message,
      );
    }

    return {
      application,
      projectName: application.projectId.projectName,
      applicantName: application.applicantId.fullName,
      emailNotificationSent: true,
    };
  };

  approveRejectedApplicant = async (projectId, applicantId, admin, reviewNotes) => {
    // Find the application by project and applicant ID
    const application = await this.repository.findOneApplication(
      { projectId, applicantId },
      {
        populate: [
          {
            path: "projectId",
            select:
              "projectName projectCategory payRate approvedAnnotators maxAnnotators projectGuidelineLink projectGuidelineVideo projectCommunityLink projectTrackerLink isActive status",
          },
          { path: "applicantId", select: "fullName email" },
        ],
        lean: false,
      }
    );

    if (!application) throw new Error("Application not found");
    
    // Check if the project exists and is active
    const project = application.projectId;
    if (!project) throw new Error("Project not found");
    if (!project.isActive) throw new Error("Project is not active");

    // Validate that the applicant was previously rejected or removed
    if (application.status !== "rejected" && application.status !== "removed") {
      throw new Error("Only rejected or removed applicants can be re-approved");
    }

    // Check if project has reached maximum annotators
    if (
      project.maxAnnotators &&
      project.approvedAnnotators >= project.maxAnnotators
    ) {
      throw new Error("Project has reached maximum number of annotators");
    }

    // Update application status back to approved
    application.status = "approved";
    application.reviewedBy = admin.userId;
    application.reviewedAt = new Date();
    application.reviewNotes = reviewNotes || "";
    application.workStartedAt = new Date(); // Reset work start time
    
    // Clear rejection-related fields
    if (application.rejectionReason) {
      application.rejectionReason = undefined;
    }
    
    // Clear removal-related fields if this was a removed applicant
    if (application.removedAt) {
      application.removedAt = undefined;
      application.removedBy = undefined;
      application.removalReason = undefined;
      application.removalNotes = undefined;
      application.workEndedAt = undefined;
    }

    await application.save();

    // Increment approved annotators count
    await this.repository.updateProject(project._id, {
      $inc: { approvedAnnotators: 1 },
    });

    try {
      // Send approval notification email
      const projectData = {
        projectName: project.projectName,
        projectCategory: project.projectCategory,
        payRate: project.payRate,
        adminName: admin.fullName,
        reviewNotes: reviewNotes || "",
        projectGuidelineLink: project.projectGuidelineLink,
        projectGuidelineVideo: project.projectGuidelineVideo,
        projectCommunityLink: project.projectCommunityLink,
        projectTrackerLink: project.projectTrackerLink,
        isReapproval: true, // Flag to indicate this is a re-approval
      };
      await MailService.sendProjectApprovalNotification(
        application.applicantId.email,
        application.applicantId.fullName,
        projectData,
      );
    } catch (emailError) {
      console.error(
        `⚠️ Failed to send re-approval notification:`,
        emailError.message,
      );
    }

    try {
      // Create notification for the applicant
      await NotificationService.createApplicationStatusNotification(
        application.applicantId._id,
        "approved",
        {
          _id: application.projectId._id,
          projectName: application.projectId.projectName,
          projectCategory: application.projectId.projectCategory,
        },
        { _id: application._id },
      );
    } catch (notificationError) {
      console.error(
        `⚠️ Failed to create re-approval notification:`,
        notificationError.message,
      );
    }

    return {
      application,
      projectName: project.projectName,
      applicantName: application.applicantId.fullName,
      emailNotificationSent: true,
      message: "Applicant successfully re-approved",
    };
  };

  removeApprovedApplicant = async (
    applicationId,
    admin,
    removalReason,
    removalNotes,
  ) => {
    const application = await this.repository.findApplicationByIdWithPopulate(
      applicationId,
      [
        {
          path: "projectId",
          select: "projectName projectCategory approvedAnnotators",
        },
        { path: "applicantId", select: "fullName email phone" },
      ],
    );

    if (!application) throw new Error("Application not found");
    if (application.status !== "approved")
      throw new Error(
        `Only approved applicants can be removed (Current: ${application.status})`,
      );

    const originalData = {
      applicantName: application.applicantId.fullName,
      applicantEmail: application.applicantId.email,
      projectName: application.projectId.projectName,
      projectId: application.projectId._id,
      workStartedAt: application.workStartedAt,
    };

    application.status = "removed";
    if (!application.resumeUrl) application.resumeUrl = "No resume provided";
    application.removedAt = new Date();
    application.removedBy = admin.userId;
    application.removalReason = removalReason || "admin_decision";
    application.removalNotes = removalNotes || "";
    application.workEndedAt = new Date();

    await application.save();

    await this.repository.updateProject(application.projectId._id, {
      $inc: { approvedAnnotators: -1 },
    });

    try {
      await MailService.sendApplicantRemovalNotification(
        originalData.applicantEmail,
        originalData.applicantName,
        {
          projectName: originalData.projectName,
          projectId: originalData.projectId,
          removalReason: application.removalReason,
          removedBy: admin.email,
          removedAt: application.removedAt,
          workPeriod: {
            startedAt: originalData.workStartedAt,
            endedAt: application.workEndedAt,
          },
        },
      );

      await MailService.sendProjectAnnotatorRemovedNotification(
        admin.email,
        admin.fullName || "Administrator",
        {
          projectName: originalData.projectName,
          projectId: originalData.projectId,
          removedApplicant: {
            name: originalData.applicantName,
            email: originalData.applicantEmail,
          },
          removalReason: application.removalReason,
          removedAt: application.removedAt,
          workDuration: application.workEndedAt - originalData.workStartedAt,
        },
      );
    } catch (emailError) {
      console.error("❌ Failed to send removal notifications:", emailError);
    }

    return {
      applicationId: application._id,
      applicant: {
        name: originalData.applicantName,
        email: originalData.applicantEmail,
      },
      project: { id: originalData.projectId, name: originalData.projectName },
      removal: {
        removedAt: application.removedAt,
        removedBy: admin.email,
        reason: application.removalReason,
      },
      workPeriod: {
        startedAt: originalData.workStartedAt,
        endedAt: application.workEndedAt,
        duration: application.workEndedAt - originalData.workStartedAt,
      },
      previousStatus: "approved",
      newStatus: "removed",
    };
  };

  getRemovableApplicants = async (projectId) => {
    const project = await this.repository.findProjectById(projectId);
    if (!project) throw new Error("Project not found");

    const approvedApplications = await this.repository.findApplications(
      { projectId, status: "approved" },
      { reviewedAt: -1 },
    );

    const removableApplicants = approvedApplications.map((app) => ({
      applicationId: app._id,
      applicant: {
        id: app.applicantId._id,
        name: app.applicantId.fullName,
        email: app.applicantId.email,
        phone: app.applicantId.phone,
      },
      applicationDetails: {
        appliedAt: app.appliedAt,
        approvedAt: app.reviewedAt,
        workStartedAt: app.workStartedAt,
        reviewedBy: app.reviewedBy,
        reviewNotes: app.reviewNotes,
      },
      workDuration: app.workStartedAt
        ? Date.now() - app.workStartedAt.getTime()
        : 0,
    }));

    return {
      project: {
        id: project._id,
        name: project.projectName,
        totalApprovedAnnotators: project.approvedAnnotators || 0,
        maxAnnotators: project.maxAnnotators,
      },
      removableApplicants,
      summary: {
        totalRemovableApplicants: removableApplicants.length,
        canRemoveAll: true,
        projectStatus: project.status,
      },
    };
  };

  exportAnnotatorsCSV = async (projectId) => {
    const project = await this.repository.findProjectById(projectId);
    if (!project) throw new Error("Project not found");

    const approvedApplications = await this.repository.findApplications(
      { projectId, status: "approved" },
      { reviewedAt: -1 },
    );
    if (approvedApplications.length === 0)
      throw new Error("No approved annotators found");

    const csvHeaders = ["Full Name", "Country", "Email"];
    const csvRows = [csvHeaders.join(",")];

    approvedApplications.forEach((app) => {
      const applicant = app.applicantId;
      const personalInfo = applicant.personal_info || {};
      const row = [
        `"${applicant.fullName || "N/A"}"`,
        `"${personalInfo.country || "N/A"}"`,
        `"${applicant.email || "N/A"}"`,
      ];
      csvRows.push(row.join(","));
    });

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `${project.projectName
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .toLowerCase()}_approved_annotators_${timestamp}.csv`;

    return { csvContent: csvRows.join("\n"), filename };
  };

  attachAssessment = async (projectId, body, admin) => {
    const {
      assessmentId,
      isRequired = true,
      assessmentInstructions = "",
    } = body;
    if (!assessmentId) throw new Error("Assessment ID is required");

    const project = await this.repository.findProjectById(projectId);
    if (!project) throw new Error("Project not found");

    const assessmentConfig =
      await MultimediaAssessmentConfig.findById(assessmentId);
    if (!assessmentConfig)
      throw new Error("Assessment configuration not found");

    const adminId = admin.userId || admin.userDoc?._id;

    project.assessment = {
      isRequired,
      assessmentId,
      assessmentInstructions,
      attachedAt: new Date(),
      attachedBy: adminId,
    };
    await project.save();
    return await this.repository.findProjectByIdWithPopulate(project._id, [
      {
        path: "assessment.assessmentId",
        select: "title description numberOfTasks estimatedDuration",
      },
    ]);
  };

  removeAssessment = async (projectId) => {
    const project = await this.repository.findProjectById(projectId);
    if (!project) throw new Error("Project not found");

    const wasRequired = project.assessment?.isRequired;
    project.assessment = {
      isRequired: false,
      assessmentId: null,
      assessmentInstructions: "",
      attachedAt: null,
      attachedBy: null,
    };
    await project.save();
    return {
      id: project._id,
      name: project.projectName,
      hadAssessment: wasRequired,
    };
  };

  getAvailableAssessments = async () => {
    const assessments = await MultimediaAssessmentConfig.find({
      isActive: true,
    })
      .populate("projectId", "projectName")
      .sort({ createdAt: -1 })
      .lean();
    return assessments.map((assessment) => ({
      id: assessment._id,
      title: assessment.title,
      description: assessment.description,
      numberOfTasks: assessment.numberOfTasks,
      estimatedDuration: assessment.estimatedDuration,
      maxRetries: assessment.maxRetries,
      isActive: assessment.isActive,
      createdAt: assessment.createdAt,
      usageCount: assessment.statistics?.totalSubmissions || 0,
      approvalRate:
        assessment.statistics?.totalSubmissions > 0
          ? (
              (assessment.statistics.approvedSubmissions /
                assessment.statistics.totalSubmissions) *
              100
            ).toFixed(1)
          : 0,
    }));
  };

  getApprovedApplicants = async (projectId) => {
    if (!this.repository.isValidObjectId(projectId))
      throw new Error("Invalid project ID");
    const project = await this.repository.findProjectById(projectId);
    if (!project) throw new Error("Project not found");

    return await this.repository.findApplications(
      { projectId, status: "approved" },
      { reviewedAt: -1 },
    );
  };

  rejectApplicationsBulk = async (body) => {
    const {
      applicationIds,
      admin,
      rejectionReason = "other",
      reviewNotes = "",
    } = body;
    if (!admin || !admin.userId)
      throw new Error("Admin information is required");
    if (!Array.isArray(applicationIds) || applicationIds.length === 0)
      throw new Error("No application IDs provided");

    const validIds = applicationIds.filter((id) =>
      this.repository.isValidObjectId(id),
    );
    if (!validIds.length) throw new Error("No valid application IDs provided");

    const applications = await this.repository.findApplications({
      _id: { $in: validIds },
      status: "pending",
    });
    if (!applications.length) throw new Error("No pending applications found");

    await this.repository.updateApplicationsMany(
      { _id: { $in: applications.map((app) => app._id) } },
      {
        $set: {
          status: "rejected",
          reviewedBy: admin.userId,
          reviewedAt: new Date(),
          rejectionReason,
          reviewNotes,
        },
      },
    );

    const notificationResults = await Promise.allSettled(
      applications.map(async (application) => {
        try {
          await MailService.sendProjectRejectionNotification(
            application.applicantId.email,
            application.applicantId.fullName,
            {
              projectName: application.projectId.projectName,
              projectCategory: application.projectId.projectCategory,
              adminName: admin.fullName,
              rejectionReason,
              reviewNotes,
            },
          );
          await NotificationService.createApplicationStatusNotification(
            application.applicantId._id,
            "rejected",
            application.projectId,
            application,
          );
          return { id: application._id, status: "success" };
        } catch (error) {
          return {
            id: application._id,
            status: "notification_failed",
            message: error.message,
          };
        }
      }),
    );

    const successCount = notificationResults.filter(
      (r) => r.status === "fulfilled" && r.value.status === "success",
    ).length;
    return {
      totalRequested: applicationIds.length,
      processed: applications.length,
      rejected: applications.length,
      notificationSuccess: successCount,
      notificationFailed: applications.length - successCount,
    };
  };

  bulkApproveApplications = async (body, admin) => {
    const { applicationIds, reviewNotes } = body;
    if (!Array.isArray(applicationIds) || applicationIds.length === 0)
      throw new Error("applicationIds must be a non-empty array");

    const approved = [];
    const failed = [];

    for (const applicationId of applicationIds) {
      try {
        const application =
          await this.repository.findApplicationByIdWithPopulate(applicationId, [
            {
              path: "projectId",
              select:
                "projectName projectCategory payRate approvedAnnotators maxAnnotators projectGuidelineLink projectGuidelineVideo projectCommunityLink projectTrackerLink",
            },
            { path: "applicantId", select: "fullName email" },
          ]);

        if (!application) {
          failed.push({ applicationId, reason: "Application not found" });
          continue;
        }

        if (application.status !== "pending") {
          failed.push({
            applicationId,
            reason: `Application already ${application.status}`,
          });
          continue;
        }

        const project = application.projectId;
        // Atomic check and increment
        const updatedProject = await this.repository.updateProject(
          {
            _id: project._id,
            ...(project.maxAnnotators && {
              approvedAnnotators: { $lt: project.maxAnnotators },
            }),
          },
          { $inc: { approvedAnnotators: 1 } },
          { new: true },
        );

        if (!updatedProject) {
          failed.push({
            applicationId,
            reason: "Project has reached maximum number of annotators",
          });
          continue;
        }

        application.status = "approved";
        application.reviewedBy = admin.userId;
        application.reviewedAt = new Date();
        application.reviewNotes = reviewNotes || "";
        application.workStartedAt = new Date();
        await application.save();

        try {
          await MailService.sendProjectApprovalNotification(
            application.applicantId.email,
            application.applicantId.fullName,
            {
              projectName: project.projectName,
              projectCategory: project.projectCategory,
              payRate: project.payRate,
              adminName: admin.fullName,
              reviewNotes: reviewNotes || "",
              projectGuidelineLink: project.projectGuidelineLink,
              projectGuidelineVideo: project.projectGuidelineVideo,
              projectCommunityLink: project.projectCommunityLink,
              projectTrackerLink: project.projectTrackerLink,
            },
          );
        } catch (e) {}

        approved.push({
          applicationId,
          applicantName: application.applicantId.fullName,
          projectName: project.projectName,
        });
      } catch (e) {
        failed.push({ applicationId, reason: e.message });
      }
    }

    return {
      totalRequested: applicationIds.length,
      approvedCount: approved.length,
      failedCount: failed.length,
      approved,
      failed,
    };
  };

  bulkRejectApplications = async (body, admin) => {
    const { applicationIds, rejectionReason, reviewNotes } = body;
    if (!Array.isArray(applicationIds) || applicationIds.length === 0)
      throw new Error("applicationIds must be a non-empty array");

    const rejected = [];
    const failed = [];

    for (const applicationId of applicationIds) {
      try {
        const application =
          await this.repository.findApplicationByIdWithPopulate(applicationId, [
            { path: "projectId", select: "projectName projectCategory" },
            { path: "applicantId", select: "fullName email" },
          ]);

        if (!application) {
          failed.push({ applicationId, reason: "Application not found" });
          continue;
        }

        if (application.status !== "pending") {
          failed.push({
            applicationId,
            reason: `Application already ${application.status}`,
          });
          continue;
        }

        application.status = "rejected";
        application.reviewedBy = admin.userId;
        application.reviewedAt = new Date();
        application.rejectionReason = rejectionReason || "other";
        application.reviewNotes = reviewNotes || "";
        await application.save();

        try {
          await MailService.sendProjectRejectionNotification(
            application.applicantId.email,
            application.applicantId.fullName,
            {
              projectName: application.projectId.projectName,
              projectCategory: application.projectId.projectCategory,
              adminName: admin.fullName,
              rejectionReason: application.rejectionReason,
              reviewNotes: reviewNotes || "",
            },
          );
          await NotificationService.createApplicationStatusNotification(
            application.applicantId._id,
            "rejected",
            {
              _id: application.projectId._id,
              projectName: application.projectId.projectName,
              projectCategory: application.projectId.projectCategory,
            },
            { _id: application._id },
          );
        } catch (e) {}

        rejected.push({
          applicationId,
          applicantName: application.applicantId.fullName,
          projectName: application.projectId.projectName,
        });
      } catch (e) {
        failed.push({ applicationId, reason: e.message });
      }
    }

    return {
      totalRequested: applicationIds.length,
      rejectedCount: rejected.length,
      failedCount: failed.length,
      rejected,
      failed,
    };
  };

  /**
   * Annotator: Get available, applied, or all projects for the user.
   */
  getAvailableProjects = async (userId, query, user) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;
    const {
      view = "available",
      category,
      difficultyLevel,
      applicationStatus,
      search,
      payRateMin,
      payRateMax,
    } = query;

    const filter = { isActive: true, status: "active", isPublic: true };
    if (category) filter.projectCategory = category;
    if (difficultyLevel) filter.difficultyLevel = difficultyLevel;

    if (search) {
      filter.projectName = { $regex: search, $options: "i" };
    }

    if (payRateMin || payRateMax) {
      filter.payRate = {};
      if (payRateMin) filter.payRate.$gte = parseFloat(payRateMin);
      if (payRateMax) filter.payRate.$lte = parseFloat(payRateMax);
    }

    // Get all user applications to filter projects
    const allUserApplications = await this.repository.findApplications({
      applicantId: userId,
    });
    const applicationMap = new Map(
      allUserApplications.map((app) => [
        app.projectId.toString(),
        {
          applicationId: app._id,
          status: app.status,
          appliedAt: app.appliedAt,
          reviewedAt: app.reviewedAt,
          rejectionReason: app.rejectionReason,
          reviewNotes: app.reviewNotes,
          coverLetter: app.coverLetter,
          availability: app.availability,
        },
      ]),
    );

    const appliedProjectIds = allUserApplications.map((app) =>
      app.projectId.toString(),
    );

    let finalFilter = { ...filter };
    if (view === "available") {
      if (appliedProjectIds.length > 0) {
        finalFilter._id = {
          $nin: appliedProjectIds.map((id) => this.repository.toObjectId(id)),
        };
      }
    } else if (view === "applied") {
      if (appliedProjectIds.length === 0) {
        return {
          projects: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalProjects: 0,
            hasNext: false,
            hasPrev: false,
            limit,
          },
          filters: { view, category, difficultyLevel, applicationStatus },
          userInfo: this._formatUserInfo(user, allUserApplications),
        };
      }
      finalFilter._id = {
        $in: appliedProjectIds.map((id) => this.repository.toObjectId(id)),
      };
      if (applicationStatus) {
        // Filter applications first by status
        const filteredAppIds = allUserApplications
          .filter((app) => app.status === applicationStatus)
          .map((app) => app.projectId.toString());
        finalFilter._id = {
          $in: filteredAppIds.map((id) => this.repository.toObjectId(id)),
        };
      }
    }

    const projects = await this.repository.findAllProjects(finalFilter, {
      skip,
      limit,
      populate: [{ path: "createdBy", select: "fullName email" }],
      select: "-assignedAdmins",
      sort: { createdAt: -1 },
    });

    const totalProjects = await this.repository.countProjects(finalFilter);
    const totalPages = Math.ceil(totalProjects / limit);
    const projectIds = projects.map((project) => project._id);
    const currentTime = new Date();

    const applicationCounts = projectIds.length
      ? await this.repository.aggregateApplications([
          {
            $match: {
              projectId: { $in: projectIds },
              status: { $in: ["pending", "approved"] },
            },
          },
          { $group: { _id: "$projectId", count: { $sum: 1 } } },
        ])
      : [];
    const applicationCountMap = new Map(
      applicationCounts.map((item) => [item._id.toString(), item.count]),
    );

    // Enrich projects with application info
    for (const project of projects) {
      const appCount = applicationCountMap.get(project._id.toString()) || 0;

      project.currentApplications = appCount;
      project.availableSlots = project.maxAnnotators
        ? Math.max(0, project.maxAnnotators - appCount)
        : null;
      project.canApply =
        !project.maxAnnotators || appCount < project.maxAnnotators;

      const userApp = applicationMap.get(project._id.toString());
      if (userApp) {
        project.userApplication = userApp;
        project.hasApplied = true;
        project.canApply = false;
      } else {
        project.hasApplied = false;
      }

      if (project.applicationDeadline) {
        const deadline = new Date(project.applicationDeadline);
        project.applicationOpen = currentTime < deadline;
        project.daysUntilDeadline = Math.ceil(
          (deadline - currentTime) / (1000 * 60 * 60 * 24),
        );
        if (!project.applicationOpen) project.canApply = false;
      } else {
        project.applicationOpen = true;
        project.daysUntilDeadline = null;
      }
    }

    return {
      projects,
      pagination: {
        currentPage: page,
        totalPages,
        totalProjects,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit,
      },
      filters: {
        view,
        applicationStatus,
        category,
        difficultyLevel,
        search,
        payRateMin,
        payRateMax,
      },
      userInfo: this._formatUserInfo(user, allUserApplications),
    };
  };

  /**
   * Annotator: Apply to a project.
   */
  applyToProject = async (userId, projectId, body) => {
    const user = await this.userRepository.findByIdWithoutPassword(userId);
    if (!user || user.annotatorStatus !== "approved") {
      throw new Error("not_approved");
    }

    if (
      !user.attachments?.resume_url ||
      user.attachments.resume_url.trim() === ""
    ) {
      throw new Error("resume_required");
    }

    const project = await this.repository.findProjectById(projectId);
    if (!project) throw new Error("project_not_found");
    if (project.status !== "active") throw new Error("project_closed");

    const existingApplication = await this.repository.findOneApplication({
      projectId,
      applicantId: userId,
    });

    if (existingApplication) {
      const err = new Error("duplicate");
      err.applicationStatus = existingApplication.status;
      throw err;
    }

    if (project.maxAnnotators) {
      const currentApplications = await this.repository.countApplications({
        projectId,
        status: { $in: ["pending", "approved"] },
      });

      if (currentApplications >= project.maxAnnotators) {
        throw new Error("project_full");
      }
    }

    const { coverLetter, proposedRate, availability, estimatedCompletionTime } =
      body || {};

    // Assessment logic
    const requiresAssessment =
      project.assessment?.isRequired && project.assessment?.assessmentId;
    let assessmentTriggered = false;

    if (requiresAssessment) {
      if (user.multimediaAssessmentStatus === "failed") {
        const cooldownHours = 24;
        const lastFailedAt =
          user.multimediaAssessmentLastFailedAt || new Date(0);
        const cooldownEnd = new Date(
          lastFailedAt.getTime() + cooldownHours * 60 * 60 * 1000,
        );
        if (Date.now() < cooldownEnd.getTime()) {
          const err = new Error("assessment_cooldown");
          err.cooldownEndsAt = cooldownEnd;
          err.hoursRemaining = Math.ceil(
            (cooldownEnd - new Date()) / (60 * 60 * 1000),
          );
          throw err;
        }
      }

      if (user.multimediaAssessmentStatus !== "approved") {
        const assessmentConfig = await MultimediaAssessmentConfig.findById(
          project.assessment.assessmentId,
        ).populate("projectId", "projectName");
        if (!assessmentConfig || !assessmentConfig.isActive) {
          throw new Error("assessment_config_missing");
        }

        user.multimediaAssessmentStatus = "pending";
        await user.save();

        await MailService.sendAssessmentInvitationEmail(
          user.email,
          user.fullName,
          {
            title: assessmentConfig.title,
            timeLimit: assessmentConfig.estimatedDuration || "60 minutes",
            description: `Complete assessment for ${project.projectName}`,
          },
        );

        assessmentTriggered = true;
      }
    }

    let applicationStatus = "pending";
    if (requiresAssessment && user.multimediaAssessmentStatus !== "approved") {
      applicationStatus = "assessment_required";
    }

    const application = await this.repository.createApplication({
      projectId,
      applicantId: userId,
      coverLetter: coverLetter || "",
      resumeUrl: user.attachments.resume_url,
      proposedRate: proposedRate || project.payRate,
      availability: availability || "flexible",
      estimatedCompletionTime: estimatedCompletionTime || "",
      status: applicationStatus,
    });

    await this.repository.updateProject(projectId, {
      $inc: { totalApplications: 1 },
    });

    // Send project application notification to admins
    if (!assessmentTriggered) {
      try {
        const projectWithAdmins =
          await this.repository.findProjectByIdWithPopulate(projectId, [
            { path: "createdBy", select: "fullName email" },
            { path: "assignedAdmins", select: "fullName email" },
          ]);

        const adminEmails = [projectWithAdmins.createdBy.email];
        if (projectWithAdmins.assignedAdmins) {
          projectWithAdmins.assignedAdmins.forEach((adm) => {
            if (!adminEmails.includes(adm.email)) adminEmails.push(adm.email);
          });
        }

        const notificationData = {
          applicantName: user.fullName,
          projectName: project.projectName,
          appliedAt: application.appliedAt,
        };

        for (const email of adminEmails) {
          await MailService.sendProjectApplicationNotification(
            email,
            "Project Admin",
            notificationData,
          );
        }
      } catch (err) {
        console.error(
          "⚠️ Failed to notify admins of application:",
          err.message,
        );
      }
    }

    return await this.repository.findApplicationByIdWithPopulate(
      application._id,
      [{ path: "projectId", select: "projectName projectCategory payRate" }],
    );
  };

  /**
   * Annotator: Get project guidelines.
   */
  getProjectGuidelines = async (projectId, userId) => {
    const project = await this.repository.findProjectById(projectId);
    if (!project) throw new Error("project_not_found");

    const application = await this.repository.findOneApplication({
      projectId,
      applicantId: userId,
    });

    const user = await this.userRepository.findByIdWithoutPassword(userId);

    const guidelinesData = {
      projectInfo: {
        id: project._id,
        name: project.projectName,
        description: project.projectDescription,
        category: project.projectCategory,
        payRate: project.payRate,
        payRateCurrency: project.payRateCurrency,
        payRateType: project.payRateType,
        difficultyLevel: project.difficultyLevel,
        deadline: project.deadline,
      },
      guidelines: {
        documentLink: project.projectGuidelineLink,
        videoLink: project.projectGuidelineVideo || null,
        communityLink: project.projectCommunityLink || null,
        trackerLink: project.projectTrackerLink || null,
      },
      userApplication: application
        ? {
            appliedAt: application.appliedAt,
            approvedAt: application.reviewedAt,
            workStartedAt: application.workStartedAt,
            status: application.status,
          }
        : null,
      accessInfo: {
        accessGrantedAt: new Date(),
        accessType: "approved_annotator",
        userRole: "annotator",
      },
    };

    return {
      success: true,
      message: "Project guidelines retrieved successfully",
      data: guidelinesData,
    };
  };

  /**
   * Admin: Manually add a user to a project.
   */
  manuallyAddUserToProject = async (projectId, userId, adminId) => {
    const user = await this.userRepository.findByIdWithoutPassword(userId);
    if (!user) throw new Error("user_not_found");

    const project = await this.repository.findProjectById(projectId);
    if (!project) throw new Error("project_not_found");

    const existingApplication = await this.repository.findOneApplication({
      projectId,
      applicantId: userId,
    });

    if (existingApplication) {
      if (existingApplication.status === "approved")
        throw new Error("already_approved");

      existingApplication.status = "approved";
      existingApplication.reviewedBy = adminId;
      existingApplication.reviewedAt = new Date();
      existingApplication.workStartedAt = new Date();
      await existingApplication.save();

      project.approvedAnnotators += 1;
      await project.save();

      return { application: existingApplication, project };
    }

    const application = await this.repository.createApplication({
      projectId,
      applicantId: userId,
      status: "approved",
      reviewedBy: adminId,
      reviewedAt: new Date(),
      workStartedAt: new Date(),
      appliedAt: new Date(),
    });

    project.approvedAnnotators += 1;
    await project.save();

    return { application, project };
  };

  /**
   * Annotator: Get active projects for the user.
   */
  getUserActiveProjects = async (userId) => {
    const applications = await this.repository.findApplications(
      {
        applicantId: userId,
        status: "approved",
      },
      {
        populate: [
          {
            path: "projectId",
            populate: { path: "createdBy", select: "fullName email" },
          },
        ],
      },
    );

    return applications.map((app) => {
      const project = app.projectId;
      return {
        applicationId: app._id,
        projectId: project._id,
        projectName: project.projectName,
        projectCategory: project.projectCategory,
        payRate: project.payRate,
        status: project.status,
        joinedAt: app.reviewedAt || app.appliedAt,
        guidelines: {
          link: project.projectGuidelineLink,
          video: project.projectGuidelineVideo,
          community: project.projectCommunityLink,
          tracker: project.projectTrackerLink,
        },
        createdBy: project.createdBy,
      };
    });
  };

  // Internal helpers
  _formatUserInfo(user, applications) {
    return {
      annotatorStatus: user.annotatorStatus,
      appliedProjects: applications.length,
      totalApplications: applications.length,
      applicationStats: {
        pending: applications.filter((app) => app.status === "pending").length,
        approved: applications.filter((app) => app.status === "approved")
          .length,
        rejected: applications.filter((app) => app.status === "rejected")
          .length,
      },
    };
  }
}

module.exports = AnnotationProjectService;
