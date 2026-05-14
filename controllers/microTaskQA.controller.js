const microTaskQAService = require("../services/microTaskQA.service");
const TaskApplication = require("../models/taskApplication.model");
const DTUser = require("../models/dtUser.model");
const { validationResult } = require("express-validator");

const getActorId = (req) => req.user?.userId || req.user?.id || null;
const getActorRole = (req) =>
  String(req.user?.role || req.user?.userDoc?.role || "")
    .trim()
    .toLowerCase();
const isAdminActor = (req) => ["admin", "super_admin"].includes(getActorRole(req));

class MicroTaskQAController {
  async getSubmissionsPendingReview(req, res) {
    try {
      const submissions = await microTaskQAService.getSubmissionsPendingReview(
        req.query,
      );

      res.status(200).json({
        success: true,
        message: "Pending submissions retrieved successfully",
        data: submissions,
      });
    } catch (error) {
      console.error("Error fetching pending submissions:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch pending submissions",
      });
    }
  }

  async getSubmissionForReview(req, res) {
    try {
      const { submissionId } = req.params;
      const submission = await microTaskQAService.getSubmissionForReview(
        submissionId,
        { allowAnyStatus: isAdminActor(req) },
      );

      res.status(200).json({
        success: true,
        message: "Submission for review retrieved successfully",
        data: submission,
      });
    } catch (error) {
      console.error("Error fetching submission for review:", error);
      res.status(404).json({
        success: false,
        message: error.message || "Submission not found or not under review",
      });
    }
  }

  async reviewImage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { imageId } = req.params;
      const reviewerId = getActorId(req);

      const image = await microTaskQAService.reviewImage(
        imageId,
        reviewerId,
        req.body,
      );

      res.status(200).json({
        success: true,
        message: "Image reviewed successfully",
        data: image,
      });
    } catch (error) {
      console.error("Error reviewing image:", error);
      const statusCode =
        error.message.includes("Image not found")
          ? 404
          : error.message.includes("Invalid review status")
            ? 400
            : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to review image",
      });
    }
  }

  async completeSubmissionReview(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { submissionId } = req.params;
      const reviewerId = getActorId(req);

      const submission = await microTaskQAService.completeSubmissionReview(
        submissionId,
        reviewerId,
        {
          ...req.body,
          allow_override: isAdminActor(req),
        },
      );

      res.status(200).json({
        success: true,
        message: "Submission review completed successfully",
        data: submission,
      });
    } catch (error) {
      console.error("Error completing submission review:", error);
      const statusCode =
        error.message.includes("Submission not found")
          ? 404
          : error.message.includes("Invalid review status") ||
              error.message.includes("All images must be reviewed") ||
              error.message.includes("cannot be approved") ||
              error.message.includes("partial rejection requires") ||
              error.message.includes("cannot be reviewed")
            ? 400
            : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to complete submission review",
      });
    }
  }

  async bulkApproveSubmissions(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { submissionIds } = req.body;
      const reviewerId = getActorId(req);

      if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "submissionIds must be a non-empty array",
        });
      }

      const results = await microTaskQAService.bulkApproveSubmissions(
        submissionIds,
        reviewerId,
      );

      res.status(200).json({
        success: true,
        message: `Bulk approval completed: ${results.approved.length} approved, ${results.failed.length} failed`,
        data: results,
      });
    } catch (error) {
      console.error("Error in bulk approval:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to bulk approve submissions",
      });
    }
  }

  async getReviewStatistics(req, res) {
    try {
      const statistics = await microTaskQAService.getReviewStatistics();

      res.status(200).json({
        success: true,
        message: "Review statistics retrieved successfully",
        data: statistics,
      });
    } catch (error) {
      console.error("Error fetching review statistics:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch review statistics",
      });
    }
  }

  async getReviewerSubmissions(req, res) {
    try {
      const reviewerId = getActorId(req);
      const submissions = await microTaskQAService.getReviewerSubmissions(
        reviewerId,
        req.query,
      );

      res.status(200).json({
        success: true,
        message: "Reviewer submissions retrieved successfully",
        data: submissions,
      });
    } catch (error) {
      console.error("Error fetching reviewer submissions:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch reviewer submissions",
      });
    }
  }

  async getReviewQueueSummary(req, res) {
    try {
      const summary = await microTaskQAService.getReviewQueueSummary();

      res.status(200).json({
        success: true,
        message: "Review queue summary retrieved successfully",
        data: summary,
      });
    } catch (error) {
      console.error("Error fetching review queue summary:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch review queue summary",
      });
    }
  }

  async assignReviewer(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { submissionId } = req.params;
      const { reviewerId } = req.body;

      const reviewer = await DTUser.findById(reviewerId);
      const reviewerRole = String(reviewer?.role || "")
        .trim()
        .toLowerCase();
      const canReview =
        reviewer &&
        (reviewer.qaStatus === "approved" ||
          ["admin", "super_admin"].includes(reviewerRole));

      if (!canReview) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid reviewer. The selected user must be an approved QA or an admin.",
        });
      }

      const update = {
        reviewedBy: reviewerId,
      };

      const submission = await TaskApplication.findByIdAndUpdate(
        submissionId,
        update,
        { new: true },
      ).populate("reviewedBy", "fullName email");

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: "Submission not found",
        });
      }

      if (submission.status === "completed") {
        submission.status = "under_review";
        await submission.save();
      }

      res.status(200).json({
        success: true,
        message: "Reviewer assigned successfully",
        data: {
          submissionId: submission._id,
          submissionStatus: submission.status,
          reviewer: {
            id: submission.reviewedBy?._id || reviewer._id,
            name: submission.reviewedBy?.fullName || reviewer.fullName,
            email: submission.reviewedBy?.email || reviewer.email,
          },
        },
      });
    } catch (error) {
      console.error("Error assigning reviewer:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to assign reviewer",
      });
    }
  }
}

module.exports = new MicroTaskQAController();
