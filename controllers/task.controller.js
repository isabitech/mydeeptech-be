const path = require('path');
const sharp = require('sharp');
const exifParser = require('exif-parser');
const fs = require('fs').promises;
const TaskSubmission = require("../models/task-submission.model");
const TaskImageUpload = require("../models/imageUpload.model");
const Task = require("../models/task.model");
const TaskApplication = require("../models/taskApplication.model");
const microTaskService = require("../services/microTask.service");
const microTaskAdminService = require("../services/microTaskAdmin.service");
const { validationResult } = require("express-validator");
const cloudinary = require('cloudinary').v2;
const ProjectMailService = require('../services/mail-service/project.service');
const {
  getRawTaskApplicationStatus,
  getTaskApplicationBucketStatus,
} = require("../utils/taskApplicationStatus");

const VALID_LABELS = ['View 1', 'View 2', 'View 3', 'View 4'];
const MASK_COLLECTION_PER_LABEL_LIMIT = 5;
const MASK_COLLECTION_TOTAL_REQUIRED = 20;
const AGE_PROGRESSION_TOTAL_REQUIRED = 15;

// Helper function to extract image metadata
async function extractImageMetadata(filePath) {
    try {
        const metadata = await sharp(filePath).metadata();
        
        const resolution = {
            width: metadata.width || null,
            height: metadata.height || null,
        };
        
        let exifData = null;
        let dateTakenFromExif = null;
        
        try {
            const buffer = await fs.readFile(filePath);
            const parser = exifParser.create(buffer);
            const result = parser.parse();
            exifData = result.tags;
            
            if (exifData.DateTimeOriginal) {
                dateTakenFromExif = exifData.DateTimeOriginal;
            } else if (exifData.DateTimeDigitized) {
                dateTakenFromExif = exifData.DateTimeDigitized;
            } else if (exifData.DateTime) {
                dateTakenFromExif = exifData.DateTime;
            }
            
            if (dateTakenFromExif && typeof dateTakenFromExif === 'string') {
                dateTakenFromExif = dateTakenFromExif.replace(/:/g, '-').replace(' ', 'T');
                dateTakenFromExif = new Date(dateTakenFromExif);
            }
        } catch (exifError) {
            console.log('No EXIF data found:', exifError.message);
        }
        
        const stats = await fs.stat(filePath);
        
        return {
            resolution,
            exifData,
            dateTakenFromExif,
            fileModifiedDate: stats.mtime,
            fileCreatedDate: stats.birthtime,
            format: metadata.format,
            orientation: metadata.orientation,
            colorSpace: metadata.space,
            hasAlpha: metadata.hasAlpha,
        };
    } catch (error) {
        console.error('Error extracting image metadata:', error);
        return {
            resolution: { width: null, height: null },
            exifData: null,
            dateTakenFromExif: null,
            fileModifiedDate: null,
            fileCreatedDate: null,
            format: null,
            orientation: null,
            colorSpace: null,
            hasAlpha: null,
        };
    }
}

async function getTaskApplicationImageState(taskApplication) {
    const rawImageIds = Array.isArray(taskApplication?.images)
        ? taskApplication.images
              .map((image) => image?._id || image)
              .filter(Boolean)
        : [];

    const imageIds = rawImageIds.filter((imageId, index, allImageIds) => {
        return allImageIds.findIndex(
            (candidateId) => candidateId.toString() === imageId.toString()
        ) === index;
    });

    const imageDocuments = imageIds.length
        ? await TaskImageUpload.find(
              { _id: { $in: imageIds } },
              "label"
          ).lean()
        : [];

    const labelCounts = {
        "View 1": 0,
        "View 2": 0,
        "View 3": 0,
        "View 4": 0,
    };

    imageDocuments.forEach((image) => {
        if (labelCounts[image.label] !== undefined) {
            labelCounts[image.label] += 1;
        }
    });

    return {
        rawImageIds,
        imageIds,
        imageDocuments,
        labelCounts,
        total: imageDocuments.length,
        hasReferenceMismatch: rawImageIds.length !== imageIds.length,
    };
}

function getUploadRules(category) {
    if (category === 'age_progression') {
        return {
            maxImages: AGE_PROGRESSION_TOTAL_REQUIRED,
            perLabel: false,
            perLabelLimit: AGE_PROGRESSION_TOTAL_REQUIRED,
            requireDate: true,
            allowedLabels: ['View 1'],
        };
    }

    return {
        maxImages: MASK_COLLECTION_TOTAL_REQUIRED,
        perLabel: true,
        perLabelLimit: MASK_COLLECTION_PER_LABEL_LIMIT,
        requireDate: false,
        allowedLabels: VALID_LABELS,
    };
}

function countIncomingFilesByLabel(files = []) {
    return files.reduce((counts, file) => {
        if (!file?.fieldname) {
            return counts;
        }

        counts[file.fieldname] = (counts[file.fieldname] || 0) + 1;
        return counts;
    }, {});
}

function buildExpectedUploadProgress(category, imageState) {
    if (category === 'age_progression') {
        return {
            'View 1': imageState.labelCounts['View 1'] || 0,
            total: imageState.total,
        };
    }

    return {
        ...imageState.labelCounts,
        total: imageState.total,
    };
}

function hasProgressMismatch(storedProgress = {}, expectedProgress = {}) {
    const keys = new Set([
        ...Object.keys(storedProgress || {}),
        ...Object.keys(expectedProgress || {}),
    ]);

    for (const key of keys) {
        if ((storedProgress?.[key] || 0) !== (expectedProgress?.[key] || 0)) {
            return true;
        }
    }

    return false;
}

async function cleanupCreatedTaskUploads(createdUploads = []) {
    for (const createdUpload of createdUploads) {
        if (!createdUpload) {
            continue;
        }

        if (createdUpload.imageId) {
            await TaskImageUpload.findByIdAndDelete(createdUpload.imageId).catch((error) => {
                console.error(
                    `Failed to rollback task image document ${createdUpload.imageId}:`,
                    error
                );
            });
        }

        if (createdUpload.publicId) {
            await cloudinary.uploader.destroy(createdUpload.publicId).catch((error) => {
                console.error(
                    `Failed to rollback Cloudinary asset ${createdUpload.publicId}:`,
                    error
                );
            });
        }
    }
}

// Helper function to build remaining breakdown
function buildRemainingBreakdown(progress, category = 'mask_collection') {
    if (category === 'age_progression') {
        const view1Count = progress['View 1'] || progress.total || 0;
        return {
            'View 1': Math.max(0, AGE_PROGRESSION_TOTAL_REQUIRED - view1Count),
            'View 2': 0,
            'View 3': 0,
            'View 4': 0,
        };
    }

    return VALID_LABELS.reduce((acc, label) => {
        acc[label] = Math.max(0, MASK_COLLECTION_PER_LABEL_LIMIT - (progress[label] || 0));
        return acc;
    }, {});
}

function serializeTaskApplicationForResponse(taskApplication) {
  if (!taskApplication) {
    return taskApplication;
  }

  const serializedTaskApplication =
    typeof taskApplication.toObject === "function"
      ? taskApplication.toObject()
      : taskApplication;

  const workflowStatus = getRawTaskApplicationStatus(serializedTaskApplication);

  return {
    ...serializedTaskApplication,
    workflowStatus,
    status: getTaskApplicationBucketStatus(serializedTaskApplication),
  };
}

class MicroTaskController {
  /**
   * Create a new micro task (Admin only)
   */
  async createMicroTask(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array()
        });
      }

      const taskData = {
        ...req.body,
        createdBy: req.user.userId
      };

      const task = await microTaskService.createMicroTask(taskData, {
        uploadedIllustrationFiles: Array.isArray(req.files) ? req.files : [],
      });

      res.status(201).json({
        success: true,
        message: "Micro task created successfully",
        data: task
      });

    } catch (error) {
      console.error("Error creating micro task:", error);
      res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to create micro task"
      });
    }
  }

  /**
   * Get all micro tasks with filters
   */
  async getAllMicroTasks(req, res) {
    const { userId } = req.user || {};
    const tasks = await microTaskService.getAllMicroTasks(req.query, userId);
    res.status(200).json({
      success: true,
      message: "Micro tasks retrieved successfully",
      data: tasks
    });
  }

  /**
   * Get all micro tasks with filters
   */
  async getTasksByFilters(req, res) {
    const userId = req.user && req.user?.userDoc?.role === "user" ? req.user?.userId : null;
    const tasks = await microTaskService.getTasksByFilters(req.query, userId);
    res.status(200).json({
      success: true,
      message: "Micro tasks retrieved successfully",
      data: tasks
    });
  }

  async getReviewedSubmissionsForTask(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { taskId } = req.params;
      const reviewedSubmissions =
        await microTaskAdminService.getReviewedSubmissionsForTask(
          taskId,
          req.query,
        );

      return res.status(200).json({
        success: true,
        message: "Task reviewed submissions retrieved successfully",
        data: reviewedSubmissions,
      });
    } catch (error) {
      console.error("Error fetching reviewed task submissions:", error);
      const statusCode =
        error.message.includes("Micro task not found")
          ? 404
          : error.message.includes("Invalid admin review status filter")
            ? 400
            : 500;

      return res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to fetch reviewed task submissions",
      });
    }
  }

  async overrideReviewedSubmission(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { taskId, submissionId } = req.params;
      const adminId = req.user?.userId || req.user?.id;
      const submission = await microTaskAdminService.overrideSubmissionReview(
        taskId,
        submissionId,
        adminId,
        {
          ...req.body,
          actor_name: req.user?.fullName || req.user?.userDoc?.fullName || "",
          actor_role: req.user?.role || req.user?.userDoc?.role || "admin",
        },
      );

      return res.status(200).json({
        success: true,
        message: "Submission review overridden successfully",
        data: submission,
      });
    } catch (error) {
      console.error("Error overriding reviewed submission:", error);
      const statusCode =
        error.message.includes("Submission not found")
          ? 404
          : error.message.includes("Invalid admin override status") ||
              error.message.includes("sync_images") ||
              error.message.includes("All images must be reviewed") ||
              error.message.includes("cannot be approved") ||
              error.message.includes("partial rejection requires")
            ? 400
            : 500;

      return res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to override submission review",
      });
    }
  }

  async exportTaskDataset(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { taskId } = req.params;
      const exportContext = await microTaskAdminService.prepareTaskDatasetExport(
        taskId,
        {
          status: req.query.status,
          exportedBy: req.user?.userId || req.user?.id,
        },
      );

      res.setHeader("X-Exported-Task-Id", exportContext.summary.taskId);
      res.setHeader(
        "X-Exported-Task-Status",
        exportContext.summary.status,
      );
      res.setHeader(
        "X-Exported-Submission-Count",
        String(exportContext.summary.totalSubmissions),
      );
      res.setHeader(
        "X-Exported-Image-Count",
        String(exportContext.summary.totalImages),
      );
      res.setHeader("X-Export-Mode", "stream");
      res.status(200);
      res.type(exportContext.contentType);
      res.attachment(exportContext.fileName);
      if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
      }

      await microTaskAdminService.streamPreparedTaskDatasetExport(
        exportContext,
        res,
      );
      return;
    } catch (error) {
      console.error("Error exporting task dataset:", error);

      if (res.headersSent) {
        if (typeof res.destroy === "function" && res.destroyed !== true) {
          res.destroy(error);
        }
        return;
      }

      const statusCode =
        error.message.includes("Micro task not found") ||
        error.message.includes("No submissions found")
          ? 404
          : error.message.includes("Invalid export status")
            ? 400
            : 500;

      return res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to export task dataset",
      });
    }
  }

  async getAllMicroTasksForUser(req, res) {
    const { userId } = req.user || {};
    const tasks = await microTaskService.getAllMicroTasks(req.query, userId);
    res.status(200).json({
      success: true,
      message: "Micro tasks retrieved successfully",
      data: tasks
    });
  }

  /**
   * POST /api/apply-for-task
   * User applies for a task (creates an assignment with pending status for admin review)
   */
  async applyForTask(req, res) {
    const { userId } = req.user || {};
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID is required.',
      });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
      });
    }

    if (!task.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply for a deactivated task.',
      });
    }

    if (task.dueDate && new Date() > new Date(task.dueDate)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply for a task whose due date has already passed.',
      });
    }

    // Check if user has already applied
    const existingAssignment = await TaskApplication.findOne({
      task: taskId,
      applicant: userId,
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this task.',
      });
    }

    const newAssignment = new TaskApplication({
      task: taskId,
      applicant: userId,
      assignedBy: null,
      dueDate: task.dueDate,
      status: "pending",
    });

    const savedAssignment = await newAssignment.save();

    if (!savedAssignment) {
      return res.status(500).json({
        success: false,
        message: 'Failed to apply for task.',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Applied for task successfully. Awaiting admin review.',
      data: serializeTaskApplicationForResponse(savedAssignment),
    });
  }

  async approveOrRejectApplication(req, res) {
    try {
      const { userId } = req.admin || {};
      const { applicationId, action = "reject", rejectionMessage } = req.body;

      if (!applicationId || !action) {
        return res.status(400).json({
          success: false,
          message: 'ApplicationId and Action are required.',
        });
      }

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid action!',
        });
      }

      // Populate both task and applicant to get email information
      const application = await TaskApplication.findById(applicationId)
        .populate('task', 'taskTitle category')
        .populate('applicant', 'fullName email');

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Application not found.',
        });
      }

      if (action === 'approve') {
        application.status = 'approved';
        application.approvedBy = userId;
        application.reviewedBy = userId;
        application.approvedDate = new Date();
      } else {
        application.status = 'rejected';
        application.rejectedBy = userId;
        application.reviewedBy = userId;
        application.rejectionMessage = rejectionMessage ?? "Login and retake your task submission";
        application.rejectedAt = new Date();
        
        // Send rejection email notification
        if (application.applicant && application.applicant.email) {
          try {
            const taskData = {
              taskTitle: application.task?.taskTitle || 'Untitled Task',
              category: application.task?.category || 'General',
              rejectionReason: rejectionMessage ?? "Login and retake your task submission",
              adminName: 'MyDeepTech Admin'
            };

            await ProjectMailService.sendTaskApplicationRejectionNotification(
              application.applicant.email,
              application.applicant.fullName || 'User',
              taskData
            );
            
            console.log(`Rejection email sent to ${application.applicant.email} for task application ${applicationId}`);
          } catch (emailError) {
            console.error('Failed to send rejection email:', emailError);
          }
        }
      }

      await application.save();

      return res.status(200).json({
        success: true,
        message: `Application ${action}d successfully.`,
        data: application,
      });
    } catch (error) {
      console.error('Error in approveOrRejectApplication:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to process application.',
      });
    }
  }

  async reviewTaskApplication(req, res) {

    const { userId } = req.admin || {}; 

    try {
      const { applicationId, action = "reject", reviewNote } = req.body;
      if (!applicationId || !action) {
        return res.status(400).json({
          success: false,
          message: 'ApplicationId and Action are required.',
        });
      }
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid action!',
        });
      }
      const application = await TaskApplication.findById(applicationId)
        .populate('task', 'taskTitle category')
        .populate('applicant', 'fullName email');
      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Application not found.',
        });
      }
      if (action === 'approve') {
        application.status = 'approved';
        application.reviewedBy = userId;
        application.reviewedAt = new Date();
      } else {
        application.status = 'rejected';
        application.reviewedBy = userId;
        application.reviewedAt = new Date();
        application.reviewNote = reviewNote;
      }
      await application.save();
      return res.status(200).json({ 
        success: true,
        message: `Application ${action}d successfully.`,
        data: application,
      });
    } catch (error) {
      console.error('Error in reviewTaskApplication:', error);    
      return res.status(500).json({
        success: false,
        message: 'Failed to process application.',
      });
    }
  }


  async rejectTaskImage(req, res) {
    try {
      const { userId } = req.admin || {};
      const { applicationId, imageId, rejectionMessage } = req.body;

      if (!applicationId || !imageId || !rejectionMessage) {
        return res.status(400).json({
          success: false,
          message: 'applicationId, ImageId, and rejectionMessage are required.',
        });
      }

      const taskApplication = await TaskApplication.findById(applicationId)
        .populate('images')
        .populate('task', 'taskTitle category')
        .populate('applicant', 'fullName email');

      if (!taskApplication) {
        return res.status(404).json({
          success: false,
          message: 'Task application not found.',
        });
      }

      const image = await TaskImageUpload.findOne({
        _id: imageId,
      });
      if (!image) {
        return res.status(404).json({
          success: false,
          message: 'Image not found in task application.',
        });
      }

      image.status = 'rejected';
      image.rejectionMessage = rejectionMessage;
      image.reviewedBy = userId;

      await image.save();

      // Send rejection email notification
      if (taskApplication.applicant && taskApplication.applicant.email) {
        try {
          const taskData = {
            taskTitle: taskApplication.task?.taskTitle || 'Untitled Task',
            category: taskApplication.task?.category || 'General',
            rejectionMessage: rejectionMessage || 'Bad quality image',
            adminName: 'MyDeepTech Admin',
            imageId: imageId
          };

          console.log(`Image rejection email would be sent to ${taskApplication.applicant.email} for image ${imageId}`);
        } catch (emailError) {
          console.error('Failed to send rejection email:', emailError);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Image rejected successfully.',
        data: image,
      });
    } catch (error) {
      console.error('Error in rejectTaskImage:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reject image.',
      });
    }
  }

  /**
   * Get micro task by ID
   */
  async getMicroTaskById(req, res) {
    try {
      const { taskId } = req.params;
      const task = await microTaskService.getMicroTaskById(taskId);

      res.status(200).json({
        success: true,
        message: "Micro task retrieved successfully",
        data: task
      });

    } catch (error) {
      console.error("Error fetching micro task:", error);
      res.status(404).json({
        success: false,
        message: error.message || "Micro task not found"
      });
    }
  }

  /**
   * Get micro task by ID
   */
  async getTaskApplicationForUser(req, res) {
    const { taskId } = req.params;
    const { userId } = req.user || {};
    const taskApplication = await microTaskService.getTaskApplicationForUser(taskId, userId);
    res.status(200).json({
      success: true,
      message: "Micro task retrieved successfully",
      data: serializeTaskApplicationForResponse(taskApplication)
    });
  }

  /**
   * Update micro task (Admin only)
   */
  async updateMicroTask(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array()
        });
      }

      const { taskId } = req.params;
      const task = await microTaskService.updateMicroTask(taskId, req.body, {
        uploadedIllustrationFiles: Array.isArray(req.files) ? req.files : [],
      });

      res.status(200).json({
        success: true,
        message: "Micro task updated successfully",
        data: task
      });

    } catch (error) {
      console.error("Error updating micro task:", error);
      res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to update micro task"
      });
    }
  }

  /**
   * Delete micro task (Admin only)
   */
  async deleteMicroTask(req, res) {
    try {
      const { taskId } = req.params;
      const result = await microTaskService.deleteMicroTask(taskId);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });

    } catch (error) {
      console.error("Error deleting micro task:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to delete micro task"
      });
    }
  }

  /**
   * Get available tasks for current user
   */
  async getAvailableTasksForUser(req, res) {
    try {
      const { userId } = req.user || {};
      const tasks = await microTaskService.getAvailableTasksForUser(userId);

      res.status(200).json({
        success: true,
        message: "Available tasks retrieved successfully",
        data: {
          tasks,
          total: tasks.length
        }
      });

    } catch (error) {
      console.error("Error fetching available tasks:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch available tasks"
      });
    }
  }

  /**
   * Get task statistics (Admin only)
   */
  async getTaskStatistics(req, res) {
    try {
      const statistics = await microTaskService.getTaskStatistics();

      res.status(200).json({
        success: true,
        message: "Task statistics retrieved successfully",
        data: statistics
      });

    } catch (error) {
      console.error("Error fetching task statistics:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch task statistics"
      });
    }
  }

  /**
   * Toggle task status (activate/pause/complete)
   */
  async toggleTaskStatus(req, res) {
    try {
      const { taskId } = req.params;
      const { status } = req.body;

      if (!["active", "paused", "completed", "cancelled"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status. Allowed: active, paused, completed, cancelled"
        });
      }

      const task = await microTaskService.updateMicroTask(taskId, { status });

      res.status(200).json({
        success: true,
        message: `Task status updated to ${status}`,
        data: task
      });

    } catch (error) {
      console.error("Error updating task status:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update task status"
      });
    }
  }

  /**
   * Get task slots for a specific task
   */
  async getTaskSlots(req, res) {
    try {
      const { taskId } = req.params;
      const TaskSlot = require("../models/taskSlot.model");
      
      const slots = await TaskSlot.find({ taskId }).sort({ sequence: 1 });

      res.status(200).json({
        success: true,
        message: "Task slots retrieved successfully",
        data: {
          slots,
          total: slots.length
        }
      });

    } catch (error) {
      console.error("Error fetching task slots:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch task slots"
      });
    }
  }

  /**
   * Duplicate an existing task
   */
  async duplicateTask(req, res) {
    try {
      const { taskId } = req.params;
      const { title } = req.body;

      const originalTask = await microTaskService.getMicroTaskById(taskId);
      if (!originalTask) {
        return res.status(404).json({
          success: false,
          message: "Original task not found"
        });
      }

      const duplicateData = {
        ...originalTask,
        title: title || `${originalTask.title} (Copy)`,
        status: "draft",
        createdBy: req.user.id
      };

      delete duplicateData._id;
      delete duplicateData.slots;
      delete duplicateData.submissionStats;
      delete duplicateData.createdAt;
      delete duplicateData.updatedAt;

      const duplicateTask = await microTaskService.createMicroTask(duplicateData);

      res.status(201).json({
        success: true,
        message: "Task duplicated successfully",
        data: duplicateTask
      });

    } catch (error) {
      console.error("Error duplicating task:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to duplicate task"
      });
    }
  }

  /**
   * POST /api/task-submissions/upload
   * User uploads images for an assigned task (supports incremental uploads)
   */


async uploadTaskImages(req, res) {
    try {
        const { userId } = req.user || {};
        const { taskId } = req.body;
        const rawFiles = req.files;
        const uploadedFiles = Array.isArray(rawFiles)
            ? rawFiles
            : Object.values(rawFiles || {}).flat();

        if (!taskId) {
            return res.status(400).json({
                success: false,
                message: "Task ID is required.",
            });
        }

        if (!uploadedFiles || uploadedFiles.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No files were uploaded.",
            });
        }

        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found",
            });
        }

        const category = task.category;
        const {
            maxImages,
            perLabel,
            perLabelLimit,
            requireDate,
            allowedLabels,
        } = getUploadRules(category);

        const invalidFiles = uploadedFiles.filter((file) => !allowedLabels.includes(file.fieldname));
        if (invalidFiles.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid image label(s): ${[...new Set(invalidFiles.map((f) => f.fieldname))].join(", ")}. Must be one of: ${allowedLabels.join(", ")}.`,
            });
        }

        // FIX: Find by task AND applicant (specific user)
        let taskSubmission = await TaskApplication.findOne({ 
            task: taskId,
            applicant: userId
        });

        if (!taskSubmission && task.status.toLowerCase() === "pending") {
            const initialProgress = category === 'age_progression'
                ? { 'View 1': 0, total: 0 }
                : { 'View 1': 0, 'View 2': 0, 'View 3': 0, 'View 4': 0, total: 0 };
            
            taskSubmission = new TaskApplication({
                task: taskId,
                applicant: userId,
                images: [],
                dueDate: task.dueDate,
                uploadProgress: initialProgress,
                status: 'ongoing'
            });
            
            await taskSubmission.save();
        }

        if (!taskSubmission) {
            return res.status(404).json({
                success: false,
                message: "Task submission not found and could not be created.",
            });
        }

        // Check if task is already complete for THIS user
        if (taskSubmission.isComplete) {
            return res.status(400).json({
                success: false,
                message: `You have already uploaded all ${maxImages} images for this task.`,
            });
        }

        const currentImageState = await getTaskApplicationImageState(taskSubmission);
        const expectedProgress = buildExpectedUploadProgress(category, currentImageState);
        taskSubmission.images = currentImageState.imageIds;

        if (
            hasProgressMismatch(taskSubmission.uploadProgress, expectedProgress) ||
            currentImageState.hasReferenceMismatch ||
            currentImageState.rawImageIds.length !== currentImageState.total
        ) {
            taskSubmission.markModified('images');
            await taskSubmission.save();
        }

        // Check total limit first to prevent exceeding
        const currentTotal = currentImageState.total;
        const incomingCount = uploadedFiles.length;
        const projectedTotal = currentTotal + incomingCount;
        
        if (projectedTotal > maxImages) {
            return res.status(400).json({
                success: false,
                message: `Upload would exceed the total image limit of ${maxImages}. You have ${currentTotal} uploaded and are trying to add ${incomingCount} more.`,
            });
        }

        // Per-label validation or age progression validation
        if (perLabel) {
            // For mask_collection: validate per-label limits (5 per label)
            const errors = [];
            const currentCounts = { ...currentImageState.labelCounts };
            const incomingCounts = countIncomingFilesByLabel(uploadedFiles);
            
            for (const label of Object.keys(incomingCounts)) {
                const currentForLabel = currentCounts[label] || 0;
                const incomingForLabel = incomingCounts[label];
                const projectedCount = currentForLabel + incomingForLabel;
                
                if (projectedCount > perLabelLimit) {
                    errors.push(`"${label}" already has ${currentForLabel}/${perLabelLimit} images. You are trying to add ${incomingForLabel} more, which would exceed the limit.`);
                }
            }
            
            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: errors[0],
                    code: "LABEL_LIMIT_EXCEEDED",
                    details: errors,
                    currentCounts,
                    incomingCounts,
                    perLabelLimit,
                });
            }
            
        } else {
            // For age_progression: validate total limit and label
            for (const file of uploadedFiles) {
                const label = file.fieldname;
                
                // Ensure only View 1 is uploaded
                if (label !== 'View 1') {
                    return res.status(400).json({
                        success: false,
                        message: `Age progression only accepts 'View 1' images, but received '${label}'.`,
                    });
                }
                
                // Check individual View 1 limit
                const currentView1Count = currentImageState.labelCounts['View 1'] || 0;
                if (currentView1Count + 1 > maxImages) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot upload more than ${maxImages} total images for View 1. Currently have ${currentView1Count} uploaded.`,
                    });
                }
            }
            
        }

        const imageIds = [];
        const createdUploads = [];

        for (const [index, file] of uploadedFiles.entries()) {
            let uploadedPublicId = null;
            try {
                // IMPORTANT: Extract metadata from LOCAL file BEFORE Cloudinary upload
                const imageMetadata = await extractImageMetadata(file.path);
                const resolution = imageMetadata.resolution;
                
                let dateTaken = req.body.dateTaken || 
                               file.dateTaken || 
                               (file.body && file.body.dateTaken) || 
                               (file.metadata && file.metadata.dateTaken);
                
                if (!dateTaken && imageMetadata.dateTakenFromExif) {
                    dateTaken = imageMetadata.dateTakenFromExif;
                }
                
                if (requireDate && !dateTaken) {
                    dateTaken = imageMetadata.fileModifiedDate;
                    
                    if (!dateTaken) {
                        if (file.path && await fs.access(file.path).catch(() => false)) {
                            await fs.unlink(file.path).catch(console.error);
                        }
                        await cleanupCreatedTaskUploads(createdUploads);
                        return res.status(400).json({
                            success: false,
                            message: "Missing dateTaken for age_progression image.",
                        });
                    }
                }
                
                if (dateTaken && !(dateTaken instanceof Date) && typeof dateTaken === 'string') {
                    try {
                        dateTaken = new Date(dateTaken);
                    } catch (e) {
                        console.error('Error parsing dateTaken:', e);
                        dateTaken = null;
                    }
                }
                
                let exifStore = null;
                if (imageMetadata.exifData) {
                    exifStore = {
                        make: imageMetadata.exifData.Make || null,
                        model: imageMetadata.exifData.Model || null,
                        dateTimeOriginal: imageMetadata.exifData.DateTimeOriginal || null,
                        dateTimeDigitized: imageMetadata.exifData.DateTimeDigitized || null,
                        exposureTime: imageMetadata.exifData.ExposureTime || null,
                        fNumber: imageMetadata.exifData.FNumber || null,
                        iso: imageMetadata.exifData.ISO || null,
                        focalLength: imageMetadata.exifData.FocalLength || null,
                        flash: imageMetadata.exifData.Flash || null,
                        gpsLatitude: imageMetadata.exifData.GPSLatitude || null,
                        gpsLongitude: imageMetadata.exifData.GPSLongitude || null,
                    };
                }
                
                // Upload to Cloudinary
                let cloudinaryResult;
                try {
                    cloudinaryResult = await cloudinary.uploader.upload(file.path, {
                        folder: 'mydeeptech/images',
                        resource_type: 'auto',
                    });
                    uploadedPublicId = cloudinaryResult.public_id;
                } catch (cloudinaryError) {
                    console.error(`[Cloudinary Upload] Failed for ${file.originalname}:`, cloudinaryError);
                    if (file.path && await fs.access(file.path).catch(() => false)) {
                        await fs.unlink(file.path).catch(console.error);
                    }
                    await cleanupCreatedTaskUploads(createdUploads);
                    return res.status(500).json({
                        success: false,
                        message: `Failed to upload ${file.originalname} to cloud storage.`,
                    });
                }
                
                const metadata = {
                    angle: file.fieldname,
                    taskCategory: task.category ?? null,
                    sceneTitle: req.body.sceneTitle || null,
                    imageSequence: taskSubmission.images.length + index + 1,
                    uploadTimestamp: new Date(),
                    fileSize: file.size,
                    fileName: file.originalname,
                    fileType: file.mimetype,
                    resolution,
                    fileUrl: cloudinaryResult.secure_url,
                    publicId: cloudinaryResult.public_id,
                    exif: exifStore,
                    imageFormat: imageMetadata.format,
                    imageOrientation: imageMetadata.orientation,
                    ...(requireDate && dateTaken ? { dateTaken } : {}),
                };
                
                const image = await TaskImageUpload.create({
                    taskApplication: taskSubmission._id,
                    url: cloudinaryResult.secure_url,
                    publicId: cloudinaryResult.public_id,
                    label: file.fieldname,
                    ...(requireDate && dateTaken ? { dateTaken } : {}),
                    metadata,
                });

                imageIds.push(image._id);
                createdUploads.push({
                    imageId: image._id,
                    publicId: cloudinaryResult.public_id,
                });
                
                // Clean up local temp file
                if (file.path && !file.path.includes('cloudinary')) {
                    await fs.unlink(file.path).catch(console.error);
                }
            } catch (fileError) {
                console.error(`Error processing file ${file.originalname}:`, fileError);
                if (file.path && await fs.access(file.path).catch(() => false)) {
                    await fs.unlink(file.path).catch(console.error);
                }
                if (uploadedPublicId) {
                    await cloudinary.uploader.destroy(uploadedPublicId).catch((error) => {
                        console.error(
                            `Failed to rollback current Cloudinary asset ${uploadedPublicId}:`,
                            error
                        );
                    });
                }
                await cleanupCreatedTaskUploads(createdUploads);
                return res.status(500).json({
                    success: false,
                    message: `Error processing file ${file.originalname}: ${fileError.message}`,
                });
            }
        }

        taskSubmission.images = [...currentImageState.imageIds, ...imageIds];
        taskSubmission.markModified('images');

        try {
            await taskSubmission.save();
        } catch (saveError) {
            await cleanupCreatedTaskUploads(createdUploads);
            throw saveError;
        }

        // Check completion status after saving
        if (taskSubmission.isComplete) {
            taskSubmission.status = "under_review";
            taskSubmission.submittedAt = new Date();
            await taskSubmission.save();
        } else if (taskSubmission.status === "pending") {
            taskSubmission.status = "processing";
            await taskSubmission.save();
        }

        return res.status(200).json({
            success: true,
            message: taskSubmission.isComplete
                ? "All images uploaded successfully. Task sent to the QA queue!"
                : `${uploadedFiles.length} image(s) uploaded. Keep going!`,
            data: {
                submissionId: taskSubmission._id,
                assignmentStatus: getTaskApplicationBucketStatus(taskSubmission),
                workflowStatus: getRawTaskApplicationStatus(taskSubmission),
                isComplete: taskSubmission.isComplete,
                uploadProgress: taskSubmission.uploadProgress,
                remaining: buildRemainingBreakdown(taskSubmission.uploadProgress, category),
            },
        });
    } catch (error) {
        console.error('Error in uploadTaskImages:', error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while uploading images.",
            error: error.message,
        });
    }
}

  /**
   * Get task submission by ID
   */
  async getTaskSubmissionById(req, res) {
    const { submissionId } = req.params;
    const { userId } = req.user || {};

    const taskSubmission = await TaskSubmission.findOne({ assignment: submissionId, submittedBy: userId })
      .populate('assignment')
      .populate('images', 'url publicId label')
      .populate('task', 'taskTitle category');

    if (!taskSubmission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
        data: null,
      });
    }

    const progress = taskSubmission.uploadProgress || {};
    
    const submissionResponse = {
      ...taskSubmission.toObject(),
      totalImages: taskSubmission.images?.length || 0,
      progress,
      remaining: buildRemainingBreakdown(progress, taskSubmission.task?.category),
    };

    return res.status(200).json({
      success: true,
      message: "Task submission retrieved successfully",
      data: submissionResponse,
    });
  }

  /**
   * Delete task image
   */
  async deleteTaskImage(req, res) {
    const { submissionId } = req.params;
    const { userId } = req.user || {};
    const { publicId, taskId } = req.query;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: "publicId query parameter is required",
        data: null,
      });
    }

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: "taskId query parameter is required",
        data: null,
      });
    }

    const assignment = await TaskApplication.findOne({
      task: submissionId,
      applicant: userId,
    })
      .populate('task', 'taskTitle category')
      .populate('images', 'url publicId label');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found or does not belong to you.',
        data: null,
      });
    }

    const taskSubmission = await TaskSubmission.findOne({ assignment: submissionId, submittedBy: userId })
      .populate('images', 'url publicId label');

    if (!taskSubmission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
        data: null,
      });
    }

    const imageIndex = taskSubmission.images.findIndex(img => img.publicId === publicId);
    
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Image not found in submission",
        data: null,
      });
    }

    // Remove image from Cloudinary
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error("Error deleting image from Cloudinary:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete image from storage",
        data: null,
      });
    }

    if (!taskSubmission.task) {
      taskSubmission.task = taskId;
    }

    // Remove image from submission
    taskSubmission.images.splice(imageIndex, 1);
    await taskSubmission.save();

    // Update assignment status if needed
    if (taskSubmission.images.length === 0 && assignment.status === 'In Progress') {
      assignment.status = 'Pending';
      await assignment.save();
    }

    return res.status(200).json({
      success: true,
      message: "Image deleted successfully",
      data: {
        submissionId: taskSubmission._id,
        assignmentStatus: getTaskApplicationBucketStatus(assignment),
        workflowStatus: getRawTaskApplicationStatus(assignment),
        remainingImages: taskSubmission.images.length,
        uploadProgress: taskSubmission.uploadProgress,
        remaining: buildRemainingBreakdown(
          taskSubmission.uploadProgress,
          assignment.task?.category
        ),
        task: taskSubmission.task || null,
      },
    });
  }

async getTaskSubmissionByIdAndDeleteImage(req, res) {
  const { userId } = req.user || {};
  const { publicId, imageId, taskApplicationId } = req.body;

  if (!publicId || !imageId) {
    return res.status(400).json({
      success: false,
      message: "Image data required.",
      data: null,
    });
  }

  const taskSubmission = await TaskApplication.findOne({
    _id: taskApplicationId,
    applicant: userId,
  })
    .populate("task", "taskTitle category")
    .populate("images", "url publicId label metadata");

  if (!taskSubmission) {
    return res.status(404).json({
      success: false,
      message: "Submission not found or does not belong to you.",
      data: null,
    });
  }

  const imageDoc = taskSubmission.images.find(
    (img) => img._id.toString() === imageId && img.publicId === publicId
  );

  if (!imageDoc) {
    return res.status(404).json({
      success: false,
      message: "Image not found in this submission.",
      data: null,
    });
  }

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary deletion error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete image from storage. No changes were made.",
      data: null,
    });
  }

  await TaskImageUpload.findByIdAndDelete(imageDoc._id);

  taskSubmission.images = taskSubmission.images
    .filter((img) => img._id.toString() !== imageId)
    .map((img) => img._id);

  // REMOVE THIS ENTIRE BLOCK - DO NOT RE-SEQUENCE IMAGES
  // if (taskSubmission.images.length > 0) {
  //   const bulkOps = taskSubmission.images.map((img, index) => ({
  //     updateOne: {
  //       filter: { _id: img._id },
  //       update: { $set: { "metadata.imageSequence": index + 1 } },
  //     },
  //   }));
  //   await TaskImageUpload.bulkWrite(bulkOps);
  // }

  if (
    taskSubmission.status === "processing" ||
    taskSubmission.status === "completed" ||
    taskSubmission.status === "under_review"
  ) {
    taskSubmission.status = "ongoing";
  }

  taskSubmission.markModified("images");
  await taskSubmission.save();

  const refreshed = await TaskApplication.findById(taskApplicationId);

  return res.status(200).json({
    success: true,
    message: "Image deleted successfully.",
    data: {
      taskApplicationId: taskSubmission._id,
      assignmentStatus: getTaskApplicationBucketStatus(refreshed),
      workflowStatus: getRawTaskApplicationStatus(refreshed),
      isComplete: refreshed.isComplete,
      remainingImages: refreshed.images.length,
      uploadProgress: refreshed.uploadProgress,
      remaining: buildRemainingBreakdown(
        refreshed.uploadProgress,
        taskSubmission.task?.category
      ),
    },
  });
}
}

module.exports = new MicroTaskController();
