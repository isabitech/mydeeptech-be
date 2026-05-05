const TaskSubmission = require("../models/task-submission.model");
const TaskImageUpload = require("../models/imageUpload.model");
const Task = require("../models/task.model");
const TaskApplication = require("../models/taskApplication.model");
const microTaskService = require("../services/microTask.service");
const { validationResult } = require("express-validator");
const cloudinary = require('cloudinary').v2;
const ProjectMailService = require('../services/mail-service/project.service');


const VALID_LABELS = ['View 1', 'View 2', 'View 3', 'View 4'];
const REQUIRED_PER_LABEL = 4;
const TOTAL_REQUIRED = 20;

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

      const task = await microTaskService.createMicroTask(taskData);

      res.status(201).json({
        success: true,
        message: "Micro task created successfully",
        data: task
      });

    } catch (error) {
      console.error("Error creating micro task:", error);
      res.status(500).json({
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
    console.log("Fetching all micro tasks with filters:", req.query, "for user:", userId);
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
              data: savedAssignment,
          });
  };

  async approveOrRejectApplication(req, res) {
    try {
      const { userId } = req.user || {};
      const { applicationId, action, rejectionReason } = req.body;

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
      } else {
          application.status = 'rejected';
          
          // Send rejection email notification
          if (application.applicant && application.applicant.email) {
            try {
              const taskData = {
                taskTitle: application.task?.taskTitle || 'Untitled Task',
                category: application.task?.category || 'General',
                rejectionReason: rejectionReason || '',
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
              // Don't fail the entire operation if email fails
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
        data: taskApplication
      });
  }

  /**
   * Update micro task (Admin only)
   */
  async updateMicroTask(req, res) {
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

      const { taskId } = req.params;
      const task = await microTaskService.updateMicroTask(taskId, req.body);

      res.status(200).json({
        success: true,
        message: "Micro task updated successfully",
        data: task
      });

    } catch (error) {
      console.error("Error updating micro task:", error);
      res.status(500).json({
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

      // Get original task
      const originalTask = await microTaskService.getMicroTaskById(taskId);
      if (!originalTask) {
        return res.status(404).json({
          success: false,
          message: "Original task not found"
        });
      }

      // Create duplicate with new title
      const duplicateData = {
        ...originalTask,
        title: title || `${originalTask.title} (Copy)`,
        status: "draft",
        createdBy: req.user.id
      };

      // Remove fields that shouldn't be copied
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

    const invalidFiles = uploadedFiles.filter(
      (file) => !VALID_LABELS.includes(file.fieldname)
    );

    if (invalidFiles.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid image label(s): ${[
          ...new Set(invalidFiles.map((f) => f.fieldname)),
        ].join(", ")}. Must be one of: ${VALID_LABELS.join(", ")}.`,
      });
    }

    let taskSubmission = await TaskApplication.findOne({ task: taskId });

    if (!taskSubmission && task.status.toLowerCase() === "pending") {
      taskSubmission = new TaskApplication({
        task: taskId,
        applicant: userId,
        images: [],
        dueDate: task.dueDate,
      });
    }

    if (taskSubmission.isComplete) {
      return res.status(400).json({
        success: false,
        message: "All 20 images have already been uploaded for this task.",
      });
    }

    // Check per-label capacity before inserting
    const errors = [];
    const currentCounts = { ...taskSubmission.uploadProgress };

    for (const file of uploadedFiles) {
      const label = file.fieldname;
      const currentForLabel = currentCounts[label] || 0;
      const incomingForLabel = uploadedFiles.filter(
        (f) => f.fieldname === label
      ).length;
      const projectedCount = currentForLabel + incomingForLabel;

      if (projectedCount > REQUIRED_PER_LABEL) {
        errors.push(
          `"${label}" already has ${currentForLabel}/${REQUIRED_PER_LABEL} images. ` +
            `You are trying to add ${incomingForLabel} more, which exceeds the limit.`
        );
      }
    }

    const uniqueErrors = [...new Set(errors)];
    if (uniqueErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Upload exceeds allowed image count for one or more labels.",
        details: uniqueErrors,
      });
    }

    const projectedTotal = taskSubmission.images.length + uploadedFiles.length;
    if (projectedTotal > TOTAL_REQUIRED) {
      return res.status(400).json({
        success: false,
        message: `Upload would exceed the total image limit of ${TOTAL_REQUIRED}. You currently have ${taskSubmission.images.length} and are trying to add ${uploadedFiles.length}.`,
      });
    }

    // ── Map uploaded files to image sub-documents with metadata
    const imageIds = [];

    for (const [index, file] of uploadedFiles.entries()) {

      // ── Resolution: Cloudinary storage attaches width/height directly
      // If using memoryStorage instead, swap this block for sharp(file.buffer)
      const resolution = {
        width: file.width ?? null,
        height: file.height ?? null,
      };

      const metadata = {
        angle: file.fieldname,                                      // e.g. "View 1"
        taskCategory: task.category ?? null,                        // from Task model
        imageSequence: taskSubmission.images.length + index + 1,   // global sequence
        uploadTimestamp: new Date(),
        fileSize: file.size,                                        // bytes
        fileName: file.originalname,
        fileType: file.mimetype,                                    // e.g. "image/jpeg"
        resolution,
        fileUrl: file.path,                                         // cloudinary URL
        publicId: file.filename,                                    // cloudinary public ID
      };

      const image = await TaskImageUpload.create({
        url: file.path,
        publicId: file.filename,
        label: file.fieldname,
        metadata,
      });

      imageIds.push(image._id);
    }

    taskSubmission.images.push(...imageIds);
    taskSubmission.task = taskSubmission.task || taskId;

    await taskSubmission.save();

    // Sync assignment status
    if (taskSubmission.isComplete) {
      taskSubmission.status = "completed";
      taskSubmission.submittedAt = new Date();
      await taskSubmission.save();
    } else if (taskSubmission.status === "pending") {
      taskSubmission.status = "processing";
      await taskSubmission.save();
    }

    return res.status(200).json({
      success: true,
      message: taskSubmission.isComplete
        ? "All images uploaded successfully. Task submitted for review!"
        : `${uploadedFiles.length} image(s) uploaded. Keep going!`,
      data: {
        submissionId: taskSubmission._id,
        assignmentStatus: taskSubmission.status,
        isComplete: taskSubmission.isComplete,
        uploadProgress: taskSubmission.uploadProgress,
        remaining: buildRemainingBreakdown(taskSubmission.uploadProgress),
      },
    });
  }

  /**
   * Get task statistics (Admin only)
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
      remaining: buildRemainingBreakdown(progress),
    };

    return res.status(200).json({
        success: true,
        message: "Task submission retrieved successfully",
        data: submissionResponse,
      });
  }

// deleteTaskImage
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
      .populate('images', 'url publicId label')

      if (!assignment) {
          return res.status(404).json({
              success: false,
              message: 'Assignment not found or does not belong to you.',
              data: null,
          });
      }

      // if (['submitted', 'approved'].includes(assignment.status)) {
      //     return res.status(400).json({
      //         success: false,
      //         message: `This assignment has already been ${assignment.status.toLowerCase()} and cannot be modified.`,
      //         data: null,
      //     });
      // }
  
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

      if(!taskSubmission.task){
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
            assignmentStatus: assignment.status,
            remainingImages: taskSubmission.images.length,
            uploadProgress: taskSubmission.uploadProgress,
            remaining: buildRemainingBreakdown(taskSubmission.uploadProgress),
            task: taskSubmission.task || null,
          },
        });
    }

    async getTaskSubmissionByIdAndDeleteImage(req, res) {

      const { userId } = req.user || {};
      const { publicId, imageId, taskApplicationId } = req.body;

      // ── Validate request body
      if (!publicId || !imageId) {
        return res.status(400).json({
          success: false,
          message: "Image data required.",
          data: null,
        });
      }

      // ── Load the submission
      const taskSubmission = await TaskApplication.findOne({
        _id: taskApplicationId,
        applicant: userId,
      })
        .populate("task", "taskTitle category")
        .populate("images", "url publicId label metadata");  // ++ include metadata

      if (!taskSubmission) {
        return res.status(404).json({
          success: false,
          message: "Submission not found or does not belong to you.",
          data: null,
        });
      }

      // ── Find the image in the populated array
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

      // ── Delete from Cloudinary
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

      // ── Delete the ImageUpload document
      await TaskImageUpload.findByIdAndDelete(imageDoc._id);

      // ── Remove the ObjectId ref from the submission
      taskSubmission.images = taskSubmission.images.filter(
        (img) => img._id.toString() !== imageId
      );

      // ── Resequence remaining images (gap-free after deletion) ─────────────
      if (taskSubmission.images.length > 0) {
        const bulkOps = taskSubmission.images.map((img, index) => ({
          updateOne: {
            filter: { _id: img._id },
            update: { $set: { "metadata.imageSequence": index + 1 } },
          },
        }));

        await TaskImageUpload.bulkWrite(bulkOps);
      }

      // ── Sync status BEFORE saving
      if (taskSubmission.images.length === 0 && taskSubmission.status === "processing") {
        taskSubmission.status = "pending";
      }

      await taskSubmission.save();

      // ── Re-fetch clean uploadProgress (virtuals need plain docs)
      const refreshed = await TaskApplication.findById(taskApplicationId);

      return res.status(200).json({
        success: true,
        message: "Image deleted successfully.",
        data: {
          taskApplicationId: taskSubmission._id,
          assignmentStatus: refreshed.status,
          isComplete: refreshed.isComplete,
          remainingImages: refreshed.images.length,
          uploadProgress: refreshed.uploadProgress,
          remaining: buildRemainingBreakdown(refreshed.uploadProgress),
        },
      });
    }

}

 function buildRemainingBreakdown(progress) {
    return VALID_LABELS.reduce((acc, label) => {
        acc[label] = Math.max(0, REQUIRED_PER_LABEL - (progress[label] || 0));
        return acc;
    }, {});
}

module.exports = new MicroTaskController();