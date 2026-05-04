const microTaskQAService = require("../services/microTaskQA.service");
const { validationResult } = require("express-validator");

class MicroTaskQAController {

  /**
   * Get submissions pending review
   */
  async getSubmissionsPendingReview(req, res) {
    try {
      const submissions = await microTaskQAService.getSubmissionsPendingReview(req.query);

      res.status(200).json({
        success: true,
        message: "Pending submissions retrieved successfully",
        data: submissions
      });

    } catch (error) {
      console.error("Error fetching pending submissions:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch pending submissions"
      });
    }
  }

  /**
   * Get detailed submission for review
   */
  async getSubmissionForReview(req, res) {
    try {
      const { submissionId } = req.params;
      const submission = await microTaskQAService.getSubmissionForReview(submissionId);

      res.status(200).json({
        success: true,
        message: "Submission for review retrieved successfully",
        data: submission
      });

    } catch (error) {
      console.error("Error fetching submission for review:", error);
      res.status(404).json({
        success: false,
        message: error.message || "Submission not found or not under review"
      });
    }
  }

  /**
   * Review individual image
   */
  async reviewImage(req, res) {
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

      const { imageId } = req.params;
      const reviewerId = req.user.id;

      const image = await microTaskQAService.reviewImage(imageId, reviewerId, req.body);

      res.status(200).json({
        success: true,
        message: "Image reviewed successfully",
        data: image
      });

    } catch (error) {
      console.error("Error reviewing image:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to review image"
      });
    }
  }

  /**
   * Complete submission review
   */
  async completeSubmissionReview(req, res) {
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

      const { submissionId } = req.params;
      const reviewerId = req.user.id;

      const submission = await microTaskQAService.completeSubmissionReview(
        submissionId, 
        reviewerId, 
        req.body
      );

      res.status(200).json({
        success: true,
        message: "Submission review completed successfully",
        data: submission
      });

    } catch (error) {
      console.error("Error completing submission review:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to complete submission review"
      });
    }
  }

  /**
   * Bulk approve multiple submissions
   */
  async bulkApproveSubmissions(req, res) {
    try {
      const { submissionIds } = req.body;
      const reviewerId = req.user.id;

      if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "submissionIds must be a non-empty array"
        });
      }

      const results = await microTaskQAService.bulkApproveSubmissions(submissionIds, reviewerId);

      res.status(200).json({
        success: true,
        message: `Bulk approval completed: ${results.approved.length} approved, ${results.failed.length} failed`,
        data: results
      });

    } catch (error) {
      console.error("Error in bulk approval:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to bulk approve submissions"
      });
    }
  }

  /**
   * Get review statistics
   */
  async getReviewStatistics(req, res) {
    try {
      const statistics = await microTaskQAService.getReviewStatistics();

      res.status(200).json({
        success: true,
        message: "Review statistics retrieved successfully",
        data: statistics
      });

    } catch (error) {
      console.error("Error fetching review statistics:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch review statistics"
      });
    }
  }

  /**
   * Get submissions reviewed by current user
   */
  async getReviewerSubmissions(req, res) {
    try {
      const reviewerId = req.user.id;
      const submissions = await microTaskQAService.getReviewerSubmissions(reviewerId, req.query);

      res.status(200).json({
        success: true,
        message: "Reviewer submissions retrieved successfully",
        data: submissions
      });

    } catch (error) {
      console.error("Error fetching reviewer submissions:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch reviewer submissions"
      });
    }
  }

  /**
   * Get review queue summary
   */
  async getReviewQueueSummary(req, res) {
    try {
      const MicroTaskSubmission = require("../models/microTaskSubmission.model");
      const SubmissionImage = require("../models/submissionImage.model");

      const [queueStats, imageStats, urgentReviews] = await Promise.all([
        // Queue statistics
        MicroTaskSubmission.aggregate([
          { $match: { status: "under_review" } },
          {
            $group: {
              _id: "$taskId",
              count: { $sum: 1 },
              avgDaysPending: {
                $avg: {
                  $divide: [
                    { $subtract: [new Date(), "$submission_date"] },
                    1000 * 60 * 60 * 24
                  ]
                }
              }
            }
          },
          {
            $lookup: {
              from: "microtasks",
              localField: "_id",
              foreignField: "_id",
              as: "task"
            }
          },
          { $unwind: "$task" },
          {
            $project: {
              taskTitle: "$task.title",
              category: "$task.category",
              pendingCount: "$count",
              avgDaysPending: { $round: ["$avgDaysPending", 1] }
            }
          }
        ]),

        // Image review stats
        SubmissionImage.aggregate([
          { $match: { review_status: "pending" } },
          {
            $group: {
              _id: null,
              totalPending: { $sum: 1 }
            }
          }
        ]),

        // Urgent reviews (over 3 days)
        MicroTaskSubmission.find({
          status: "under_review",
          submission_date: {
            $lte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          }
        })
        .populate("taskId", "title category")
        .populate("userId", "fullName")
        .select("submission_date")
      ]);

      const totalPendingImages = imageStats[0]?.totalPending || 0;

      res.status(200).json({
        success: true,
        message: "Review queue summary retrieved successfully",
        data: {
          queueByTask: queueStats,
          totalPendingImages,
          urgentReviews: urgentReviews.map(sub => ({
            id: sub._id,
            taskTitle: sub.taskId.title,
            category: sub.taskId.category,
            userName: sub.userId.fullName,
            daysPending: Math.floor(
              (new Date() - new Date(sub.submission_date)) / (1000 * 60 * 60 * 24)
            )
          })),
          summary: {
            totalSubmissionsPending: queueStats.reduce((acc, item) => acc + item.pendingCount, 0),
            totalImagesPending: totalPendingImages,
            urgentReviewsCount: urgentReviews.length,
            averagePendingDays: queueStats.length > 0 ? 
              Math.round(queueStats.reduce((acc, item) => acc + item.avgDaysPending, 0) / queueStats.length * 10) / 10 : 0
          }
        }
      });

    } catch (error) {
      console.error("Error fetching review queue summary:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch review queue summary"
      });
    }
  }

  /**
   * Assign reviewer to submission
   */
  async assignReviewer(req, res) {
    try {
      const { submissionId } = req.params;
      const { reviewerId } = req.body;

      if (!reviewerId) {
        return res.status(400).json({
          success: false,
          message: "Reviewer ID is required"
        });
      }

      // Verify reviewer exists and has QA role
      const DTUser = require("../models/dtUser.model");
      const reviewer = await DTUser.findById(reviewerId);
      
      if (!reviewer || reviewer.role !== "QA_REVIEWER") {
        return res.status(400).json({
          success: false,
          message: "Invalid reviewer or user does not have QA reviewer role"
        });
      }

      const MicroTaskSubmission = require("../models/microTaskSubmission.model");
      const submission = await MicroTaskSubmission.findByIdAndUpdate(
        submissionId,
        { 
          reviewedBy: reviewerId,
          $addToSet: { 
            assignmentHistory: {
              reviewerId,
              assignedAt: new Date(),
              assignedBy: req.user.id
            }
          }
        },
        { new: true }
      ).populate("reviewedBy", "fullName email");

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: "Submission not found"
        });
      }

      res.status(200).json({
        success: true,
        message: "Reviewer assigned successfully",
        data: {
          submissionId: submission._id,
          reviewer: {
            id: submission.reviewedBy._id,
            name: submission.reviewedBy.fullName,
            email: submission.reviewedBy.email
          }
        }
      });

    } catch (error) {
      console.error("Error assigning reviewer:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to assign reviewer"
      });
    }
  }
}

module.exports = new MicroTaskQAController();