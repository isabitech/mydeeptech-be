const path = require('path');
const sharp = require('sharp');
const exifParser = require('exif-parser');
const fs = require('fs').promises;
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
const TOTAL_REQUIRED = 16;

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

// Helper function to build remaining breakdown
function buildRemainingBreakdown(progress) {
    return VALID_LABELS.reduce((acc, label) => {
        acc[label] = Math.max(0, REQUIRED_PER_LABEL - (progress[label] || 0));
        return acc;
    }, {});
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
  }

  async approveOrRejectApplication(req, res) {
    try {
      const { userId } = req.user || {};
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
      } else {
        application.status = 'rejected';
        
        // Send rejection email notification
        if (application.applicant && application.applicant.email) {
          try {
            const taskData = {
              taskTitle: application.task?.taskTitle || 'Untitled Task',
              category: application.task?.category || 'General',
              rejectionMessage: rejectionMessage || 'Bad image representation',
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
      data: taskApplication
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
        let maxImages = 20;
        let perLabel = true;
        let perLabelLimit = REQUIRED_PER_LABEL;
        let requireDate = false;
        let allowedLabels = VALID_LABELS;
        
        if (category === 'age_progression') {
            maxImages = 15;
            perLabel = false;
            requireDate = true;
            allowedLabels = VALID_LABELS;
        }

        const invalidFiles = uploadedFiles.filter((file) => !allowedLabels.includes(file.fieldname));
        if (invalidFiles.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid image label(s): ${[...new Set(invalidFiles.map((f) => f.fieldname))].join(", ")}. Must be one of: ${allowedLabels.join(", ")}.`,
            });
        }

        let taskSubmission = await TaskApplication.findOne({ task: taskId });
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
            });
        }

        if (!taskSubmission) {
            return res.status(404).json({
                success: false,
                message: "Task submission not found and could not be created.",
            });
        }

        if (taskSubmission.isComplete) {
            return res.status(400).json({
                success: false,
                message: `All ${maxImages} images have already been uploaded for this task.`,
            });
        }

        // Per-label limit
        if (perLabel) {
            const errors = [];
            const currentCounts = { ...taskSubmission.uploadProgress };
            
            for (const file of uploadedFiles) {
                const label = file.fieldname;
                const currentForLabel = currentCounts[label] || 0;
                const incomingForLabel = uploadedFiles.filter((f) => f.fieldname === label).length;
                const projectedCount = currentForLabel + incomingForLabel;
                
                if (projectedCount > perLabelLimit) {
                    errors.push(`"${label}" already has ${currentForLabel}/${perLabelLimit} images. You are trying to add ${incomingForLabel} more, which exceeds the limit.`);
                }
            }
            
            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Upload exceeds allowed image count for one or more labels.",
                    details: [...new Set(errors)],
                });
            }
            
            for (const file of uploadedFiles) {
                const label = file.fieldname;
                taskSubmission.uploadProgress[label] = (taskSubmission.uploadProgress[label] || 0) + 1;
                taskSubmission.uploadProgress.total = (taskSubmission.uploadProgress.total || 0) + 1;
            }
        } else {
            for (const file of uploadedFiles) {
                const label = file.fieldname;
                const newCount = (taskSubmission.uploadProgress[label] || 0) + 1;
                
                if (newCount > maxImages) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot upload more than ${maxImages} images for ${label}.`,
                    });
                }
                
                taskSubmission.uploadProgress[label] = newCount;
                taskSubmission.uploadProgress.total = (taskSubmission.uploadProgress.total || 0) + 1;
            }
        }

        const projectedTotal = taskSubmission.images.length + uploadedFiles.length;
        if (projectedTotal > maxImages) {
            return res.status(400).json({
                success: false,
                message: `Upload would exceed the total image limit of ${maxImages}.`,
            });
        }

        const imageIds = [];

        for (const [index, file] of uploadedFiles.entries()) {
            try {
                // IMPORTANT: Extract metadata from LOCAL file BEFORE Cloudinary upload
                // file.path should still be the local temp file path at this point
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
                
                // NOW upload to Cloudinary using the local file path
                let cloudinaryResult;
                try {
                    cloudinaryResult = await cloudinary.uploader.upload(file.path, {
                        folder: 'mydeeptech/images',
                        resource_type: 'auto',
                    });
                    console.log(`[Cloudinary Upload] Success for ${file.originalname}: ${cloudinaryResult.secure_url}`);
                } catch (cloudinaryError) {
                    console.error(`[Cloudinary Upload] Failed for ${file.originalname}:`, cloudinaryError);
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
                    fileUrl: cloudinaryResult.secure_url,  // Use Cloudinary URL
                    publicId: cloudinaryResult.public_id,   // Use Cloudinary publicId
                    exif: exifStore,
                    imageFormat: imageMetadata.format,
                    imageOrientation: imageMetadata.orientation,
                    ...(requireDate && dateTaken ? { dateTaken } : {}),
                };
                
                const image = await TaskImageUpload.create({
                    url: cloudinaryResult.secure_url,      // Cloudinary URL
                    publicId: cloudinaryResult.public_id,  // Cloudinary publicId
                    label: file.fieldname,
                    ...(requireDate && dateTaken ? { dateTaken } : {}),
                    metadata,
                });

                console.log("[Image Upload] Stored metadata for image:", JSON.stringify({
                    id: image._id,
                    url: image.url,
                    label: image.label,
                    metadata: image.metadata
                }, null, 2));
                
                imageIds.push(image._id);
                
                // Clean up local temp file after successful upload
                if (file.path && !file.path.includes('cloudinary')) {
                    await fs.unlink(file.path).catch(console.error);
                }
            } catch (fileError) {
                console.error(`Error processing file ${file.originalname}:`, fileError);
                // Clean up temp file if it exists
                if (file.path && await fs.access(file.path).catch(() => false)) {
                    await fs.unlink(file.path).catch(console.error);
                }
                return res.status(500).json({
                    success: false,
                    message: `Error processing file ${file.originalname}: ${fileError.message}`,
                });
            }
        }

        taskSubmission.images.push(...imageIds);
        await taskSubmission.save();

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
      remaining: buildRemainingBreakdown(progress),
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

    taskSubmission.images = taskSubmission.images.filter(
      (img) => img._id.toString() !== imageId
    );

    if (taskSubmission.images.length > 0) {
      const bulkOps = taskSubmission.images.map((img, index) => ({
        updateOne: {
          filter: { _id: img._id },
          update: { $set: { "metadata.imageSequence": index + 1 } },
        },
      }));

      await TaskImageUpload.bulkWrite(bulkOps);
    }

    if ((taskSubmission.status === "processing" || taskSubmission.status === "completed")) {
      taskSubmission.status = "ongoing";
    }

    await taskSubmission.save();

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

module.exports = new MicroTaskController();