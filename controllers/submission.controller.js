const submissionService = require("../services/submission.service");
const { validationResult } = require("express-validator");
const multer = require("multer");

class SubmissionController {

  /**
   * Start a new submission for a task
   */
  async startSubmission(req, res) {
    try {
      const { taskId } = req.params;
      const userId = req.user.id;

      const submission = await submissionService.startSubmission(taskId, userId);

      res.status(201).json({
        success: true,
        message: "Submission started successfully",
        data: submission
      });

    } catch (error) {
      console.error("Error starting submission:", error);
      
      // Handle profile completion error specially
      if (error.message.includes("complete your profile")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "PROFILE_INCOMPLETE",
          required_fields: [
            "Full name",
            "Date of birth", 
            "Gender",
            "Country of residence",
            "Country of origin"
          ]
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || "Failed to start submission"
      });
    }
  }

  /**
   * Upload image for a specific slot
   */
  async uploadImage(req, res) {
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

      const { submissionId, slotId } = req.params;
      
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file provided"
        });
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: "Invalid file type. Only JPEG, PNG, and WebP images are allowed"
        });
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (req.file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 10MB"
        });
      }

      // Get request metadata
      const metadata = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      };

      const image = await submissionService.uploadImage(
        submissionId, 
        slotId, 
        req.file.buffer, 
        metadata
      );

      res.status(201).json({
        success: true,
        message: "Image uploaded successfully",
        data: image
      });

    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to upload image"
      });
    }
  }

  /**
   * Get submission by ID
   */
  async getSubmissionById(req, res) {
    try {
      const { submissionId } = req.params;
      const submission = await submissionService.getSubmissionById(submissionId);

      // Check if user owns this submission (unless admin)
      if (req.user.role !== "ADMIN" && 
          submission.userId._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this submission"
        });
      }

      res.status(200).json({
        success: true,
        message: "Submission retrieved successfully",
        data: submission
      });

    } catch (error) {
      console.error("Error fetching submission:", error);
      res.status(404).json({
        success: false,
        message: error.message || "Submission not found"
      });
    }
  }

  /**
   * Get current user's submissions
   */
  async getUserSubmissions(req, res) {
    try {
      const userId = req.user.id;
      const submissions = await submissionService.getUserSubmissions(userId, req.query);

      res.status(200).json({
        success: true,
        message: "User submissions retrieved successfully",
        data: submissions
      });

    } catch (error) {
      console.error("Error fetching user submissions:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch submissions"
      });
    }
  }

  /**
   * Submit completed submission for review
   */
  async submitForReview(req, res) {
    try {
      const { submissionId } = req.params;
      const userId = req.user.id;

      const submission = await submissionService.submitForReview(submissionId, userId);

      res.status(200).json({
        success: true,
        message: "Submission sent for review successfully",
        data: submission
      });

    } catch (error) {
      console.error("Error submitting for review:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to submit for review"
      });
    }
  }

  /**
   * Delete an uploaded image
   */
  async deleteImage(req, res) {
    try {
      const { submissionId, imageId } = req.params;
      const userId = req.user.id;

      const result = await submissionService.deleteImage(submissionId, imageId, userId);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });

    } catch (error) {
      console.error("Error deleting image:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to delete image"
      });
    }
  }

  /**
   * Get submission progress
   */
  async getSubmissionProgress(req, res) {
    try {
      const { submissionId } = req.params;
      const submission = await submissionService.getSubmissionById(submissionId);

      // Check ownership
      if (req.user.role !== "ADMIN" && 
          submission.userId._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this submission"
        });
      }

      res.status(200).json({
        success: true,
        message: "Submission progress retrieved successfully",
        data: {
          submissionId: submission._id,
          status: submission.status,
          progress: submission.progress,
          completedSlots: submission.completed_slots,
          totalSlots: submission.total_slots,
          progressPercentage: submission.progress_percentage,
          canSubmitForReview: submission.progress_percentage === 100 && 
                             submission.status === "in_progress"
        }
      });

    } catch (error) {
      console.error("Error fetching submission progress:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch submission progress"
      });
    }
  }

  /**
   * Get available slots for submission
   */
  async getSubmissionSlots(req, res) {
    try {
      const { submissionId } = req.params;
      const submission = await submissionService.getSubmissionById(submissionId);

      // Check ownership
      if (req.user.role !== "ADMIN" && 
          submission.userId._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this submission"
        });
      }

      res.status(200).json({
        success: true,
        message: "Submission slots retrieved successfully",
        data: {
          slots: submission.slotsWithImages,
          summary: {
            total: submission.slotsWithImages.length,
            uploaded: submission.slotsWithImages.filter(s => s.uploaded).length,
            missing: submission.slotsWithImages.filter(s => !s.uploaded).length,
            approved: submission.slotsWithImages.filter(s => s.approved).length
          }
        }
      });

    } catch (error) {
      console.error("Error fetching submission slots:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch submission slots"
      });
    }
  }

  /**
   * Check if user can start a new submission for task
   */
  async checkSubmissionEligibility(req, res) {
    try {
      const { taskId } = req.params;
      const userId = req.user.id;

      // Check if user already has submission for this task
      const MicroTaskSubmission = require("../models/microTaskSubmission.model");
      const existingSubmission = await MicroTaskSubmission.findOne({ taskId, userId });

      if (existingSubmission) {
        return res.status(200).json({
          success: true,
          message: "User eligibility checked",
          data: {
            canStart: false,
            reason: "Already has submission for this task",
            existingSubmission: {
              id: existingSubmission._id,
              status: existingSubmission.status,
              progress: existingSubmission.progress_percentage
            }
          }
        });
      }

      // Check profile completeness
      const DTUser = require("../models/dtUser.model");
      const user = await DTUser.findById(userId);
      
      if (!user || !user.isMicroTaskProfileComplete()) {
        return res.status(200).json({
          success: true,
          message: "User eligibility checked",
          data: {
            canStart: false,
            reason: "Profile incomplete",
            requiredFields: [
              "Full name",
              "Date of birth",
              "Gender", 
              "Country of residence",
              "Country of origin"
            ]
          }
        });
      }

      res.status(200).json({
        success: true,
        message: "User eligibility checked",
        data: {
          canStart: true,
          reason: "Eligible to start submission"
        }
      });

    } catch (error) {
      console.error("Error checking submission eligibility:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to check eligibility"
      });
    }
  }
}

module.exports = new SubmissionController();