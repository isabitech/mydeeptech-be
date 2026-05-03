const TaskSubmission = require("../models/task-submission.model");
const Task = require("../models/task.model");
const TaskApplication = require("../models/taskApplication.model");
const microTaskService = require("../services/microTask.service");
const { validationResult } = require("express-validator");

const VALID_LABELS = ['Front', 'Right', 'Left', 'Bottom'];
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
   
    const userId = req.user && req.user.role === "user" ? req.user.userId : null;
  
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
              status: 'pending',
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
    const { userId } = req.user || {};
    const { applicationId, action } = req.body;

    if (!applicationId || !action) {
        return res.status(400).json({
            success: false,
            message: 'AApplicationId and Action are required.',
        });
    }

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid action!',
        });
    }

    const application = await TaskApplication.findById(applicationId).populate('task');

    if (!application) {
        return res.status(404).json({
            success: false,
            message: 'Application not found.',
        });
    }

    if (application.status !== 'pending') {
        return res.status(400).json({
            success: false,
            message: `Cannot ${action} an application that is not pending.`,
        });
    }

    if (action === 'approve') {
        application.status = 'approved';
        application.approvedBy = userId;
    } else {
        application.status = 'rejected';
    }

    await application.save();

    return res.status(200).json({
        success: true,
        message: `Application ${action}d successfully.`,
        data: application,
    });
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
        const { assignmentId, taskId } = req.body;
        const rawFiles = req.files;
        const uploadedFiles = Array.isArray(rawFiles)
            ? rawFiles
            : Object.values(rawFiles || {}).flat();

        if (!assignmentId) {
            return res.status(400).json({
                success: false,
                message: 'assignmentId is required.',
            });
        }

        if (!taskId) {
            return res.status(400).json({
                success: false,
                message: 'Task ID is required.',
            });
        }

       if (!uploadedFiles || uploadedFiles.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files were uploaded.',
            });
        }

        const assignment = await TaskApplication.findOne({
            _id: assignmentId,
            applicant: userId,
        }).populate('task', 'taskTitle category');


        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found or does not belong to you.',
            });
        }

        if (['Submitted', 'Approved'].includes(assignment.status)) {
            return res.status(400).json({
                success: false,
                message: `This assignment has already been ${assignment.status.toLowerCase()} and cannot be modified.`,
            });
        }

        if (new Date() > new Date(assignment.dueDate)) {
            return res.status(400).json({
                success: false,
                message: 'The due date for this assignment has passed.',
            });
        }

        const invalidFiles = uploadedFiles.filter(
            (file) => !VALID_LABELS.includes(file.fieldname)
        );

        if (invalidFiles.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid image label(s): ${[...new Set(invalidFiles.map(f => f.fieldname))].join(', ')}. Must be one of: ${VALID_LABELS.join(', ')}.`,
            });
        }

        let submission = await TaskSubmission.findOne({ assignment: assignmentId });

        if (!submission) {
            submission = new TaskSubmission({
                assignment: assignmentId,
                submittedBy: userId,
                images: [],
            });
        }

        if (submission.isComplete) {
            return res.status(400).json({
                success: false,
                message: 'All 20 images have already been uploaded for this task.',
            });
        }

        // Check per-label capacity before inserting
        const errors = [];
        const currentCounts = { ...submission.uploadProgress };

        for (const file of uploadedFiles) {
            const label = file.fieldname;
            const currentForLabel = currentCounts[label] || 0;

            // Count how many of this label are in the current batch too
            const incomingForLabel = uploadedFiles.filter(f => f.fieldname === label).length;
            const projectedCount = currentForLabel + incomingForLabel;

            if (projectedCount > REQUIRED_PER_LABEL) {
                errors.push(
                    `"${label}" already has ${currentForLabel}/${REQUIRED_PER_LABEL} images. ` +
                    `You are trying to add ${incomingForLabel} more, which exceeds the limit.`
                );
            }
        }

        // Deduplicate error messages per label
        const uniqueErrors = [...new Set(errors)];
        if (uniqueErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Upload exceeds allowed image count for one or more labels.',
                details: uniqueErrors,
            });
        }

        // Check total capacity 
        const projectedTotal = submission.images.length + uploadedFiles.length;
        if (projectedTotal > TOTAL_REQUIRED) {
            return res.status(400).json({
                success: false,
                message: `Upload would exceed the total image limit of ${TOTAL_REQUIRED}. You currently have ${submission.images.length} and are trying to add ${uploadedFiles.length}.`,
            });
        }

        //  Map uploaded files to image sub-documents 
        // Assumes multer-storage-cloudinary or similar attaches .path & .filename
        const newImages = uploadedFiles.map((file) => ({
            url: file.path, 
            label: file.fieldname, 
            publicId: file.filename,
        }));

        submission.images.push(...newImages);

       if (!submission.task) {
          submission.task = taskId;
        }

        await submission.save();

          // Sync assignment status
        if (submission.isComplete) {
            assignment.status = 'Submitted';
            assignment.submittedAt = new Date();
        } else if (assignment.status === 'Pending') {
            // First upload moves assignment to In Progress
            assignment.status = 'In Progress';
        }

        // Respond with progress
        return res.status(200).json({
            success: true,
            message: submission.isComplete
                ? 'All images uploaded successfully. Task submitted for review!'
                : `${uploadedFiles.length} image(s) uploaded. Keep going!`,
            data: {
                submissionId: submission._id,
                assignmentStatus: assignment.status,
                isComplete: submission.isComplete,
                uploadProgress: submission.uploadProgress,
                remaining: buildRemainingBreakdown(submission.uploadProgress),
            },
        });

}

  /**
   * Get task statistics (Admin only)
   */
  async getTaskSubmissionById(req, res) {

    const { submissionId } = req.params;
    const { userId } = req.user || {};

    const submission = await TaskSubmission.findOne({ assignment: submissionId, submittedBy: userId })
    .populate('assignment')
    .populate('task', 'taskTitle category');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
        data: null,
      });
    }

    const progress = submission.uploadProgress || {};
    
    const submissionResponse = {
      ...submission.toObject(),
      totalImages: submission.images?.length || 0,
      progress,
      remaining: buildRemainingBreakdown(progress),
    };

    return res.status(200).json({
        success: true,
        message: "Task submission retrieved successfully",
        data: submissionResponse,
      });
  }


  async getTaskSubmissionByIdAndDeleteImage(req, res) {

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
          _id: submissionId,
          applicant: userId,
      }).populate('task', 'taskTitle category');

      if (!assignment) {
          return res.status(404).json({
              success: false,
              message: 'Assignment not found or does not belong to you.',
              data: null,
          });
      }

      if (['Submitted', 'Approved'].includes(assignment.status)) {
          return res.status(400).json({
              success: false,
              message: `This assignment has already been ${assignment.status.toLowerCase()} and cannot be modified.`,
              data: null,
          });
      }
  
      const submission = await TaskSubmission.findOne({ assignment: submissionId, submittedBy: userId });
  
      if (!submission) {
        return res.status(404).json({
          success: false,
          message: "Submission not found",
          data: null,
        });
      }
  
      const imageIndex = submission.images.findIndex(img => img.publicId === publicId);
      
      if (imageIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Image not found in submission",
          data: null,
        });
      }
  
      // Remove image from Cloudinary
      const cloudinary = require('cloudinary').v2;
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

      if(!submission.task){
        submission.task = taskId;
      }
  
      // Remove image from submission
      submission.images.splice(imageIndex, 1);
      await submission.save();

      // Update assignment status if needed
      if (submission.images.length === 0 && assignment.status === 'In Progress') {
        assignment.status = 'Pending';
        await assignment.save();
      }
  
      return res.status(200).json({
          success: true,
          message: "Image deleted successfully",
          data: {
            submissionId: submission._id,
            assignmentStatus: assignment.status,
            remainingImages: submission.images.length,
            uploadProgress: submission.uploadProgress,
            remaining: buildRemainingBreakdown(submission.uploadProgress),
            task: submission.task || null,
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