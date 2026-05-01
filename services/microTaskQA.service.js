const MicroTaskSubmission = require("../models/microTaskSubmission.model");
const SubmissionImage = require("../models/submissionImage.model");
const TaskSlot = require("../models/taskSlot.model");
const MicroTask = require("../models/microTask.model");
const DTUser = require("../models/dtUser.model");

class MicroTaskQAService {

  /**
   * Get submissions pending review with filters
   * @param {Object} query - Query filters and pagination
   * @returns {Object} Submissions pending review
   */
  async getSubmissionsPendingReview(query = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        taskId,
        category,
        priority = "oldest_first"
      } = query;

      const filter = { status: "under_review" };
      if (taskId) filter.taskId = taskId;

      // Sort options
      let sort = { submission_date: 1 }; // Default: oldest first
      if (priority === "newest_first") sort = { submission_date: -1 };

      const skip = (page - 1) * limit;

      let submissions = await MicroTaskSubmission.find(filter)
        .populate("taskId", "title category payRate payRateCurrency")
        .populate("userId", "fullName email personal_info.country")
        .populate("reviewedBy", "fullName email")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));

      // Filter by category if specified
      if (category) {
        submissions = submissions.filter(sub => sub.taskId.category === category);
      }

      // Get image counts and quality info for each submission
      const submissionsWithDetails = await Promise.all(
        submissions.map(async (submission) => {
          const imageStats = await SubmissionImage.aggregate([
            { $match: { submissionId: submission._id } },
            {
              $group: {
                _id: "$review_status",
                count: { $sum: 1 }
              }
            }
          ]);

          const stats = {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
            needs_replacement: 0
          };

          imageStats.forEach(stat => {
            stats[stat._id] = stat.count;
            stats.total += stat.count;
          });

          // Calculate review priority score
          const daysSinceSubmission = Math.floor(
            (new Date() - new Date(submission.submission_date)) / (1000 * 60 * 60 * 24)
          );

          return {
            ...submission.toJSON(),
            imageStats: stats,
            reviewPriority: {
              daysPending: daysSinceSubmission,
              score: daysSinceSubmission + (submission.taskId.payRate * 0.1) // Higher pay = higher priority
            }
          };
        })
      );

      const total = await MicroTaskSubmission.countDocuments(filter);

      return {
        submissions: submissionsWithDetails,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total_items: total,
          total_pages: Math.ceil(total / limit)
        },
        statistics: await this.getReviewStatistics()
      };

    } catch (error) {
      throw new Error(`Error fetching submissions for review: ${error.message}`);
    }
  }

  /**
   * Get detailed submission for review
   * @param {String} submissionId - Submission ID
   * @returns {Object} Complete submission data for review
   */
  async getSubmissionForReview(submissionId) {
    try {
      const submission = await MicroTaskSubmission.findById(submissionId)
        .populate("taskId")
        .populate("userId")
        .populate("reviewedBy", "fullName email");

      if (!submission) {
        throw new Error("Submission not found");
      }

      if (submission.status !== "under_review") {
        throw new Error("Submission is not under review");
      }

      // Get all images with slot information
      const images = await SubmissionImage.find({ submissionId })
        .populate("slotId")
        .sort({ "slotId.sequence": 1 });

      // Get task slots for reference
      const allSlots = await TaskSlot.find({ taskId: submission.taskId._id })
        .sort({ sequence: 1 });

      // Map images to slots for review interface
      const reviewSlots = allSlots.map(slot => {
        const image = images.find(img => 
          img.slotId._id.toString() === slot._id.toString()
        );

        return {
          slot: {
            _id: slot._id,
            slot_name: slot.slot_name,
            sequence: slot.sequence,
            metadata: slot.metadata,
            validation_rules: slot.validation_rules,
            slot_instructions: slot.slot_instructions
          },
          image: image ? {
            _id: image._id,
            cloudinary_data: image.cloudinary_data,
            image_metadata: image.image_metadata,
            quality_check: image.quality_check,
            review_status: image.review_status,
            rejection_reason: image.rejection_reason
          } : null,
          status: image ? image.review_status : "missing"
        };
      });

      return {
        ...submission.toJSON(),
        reviewSlots,
        totalImages: images.length,
        requiredImages: allSlots.length,
        completionPercentage: submission.progress_percentage
      };

    } catch (error) {
      throw new Error(`Error fetching submission for review: ${error.message}`);
    }
  }

  /**
   * Review individual image
   * @param {String} imageId - Image ID
   * @param {String} reviewerId - Reviewer ID
   * @param {Object} reviewData - Review decision and notes
   * @returns {Object} Updated image
   */
  async reviewImage(imageId, reviewerId, reviewData) {
    try {
      const { status, rejection_reason, quality_notes } = reviewData;

      if (!["approved", "rejected", "needs_replacement"].includes(status)) {
        throw new Error("Invalid review status");
      }

      const image = await SubmissionImage.findById(imageId);
      if (!image) {
        throw new Error("Image not found");
      }

      // Update image review
      image.review_status = status;
      image.rejection_reason = rejection_reason || "";
      image.reviewedBy = reviewerId;
      image.review_date = new Date();

      // Update quality check notes
      if (quality_notes) {
        image.quality_check.validation_notes = quality_notes;
      }

      await image.save();

      return await SubmissionImage.findById(imageId).populate("slotId reviewedBy");

    } catch (error) {
      throw new Error(`Error reviewing image: ${error.message}`);
    }
  }

  /**
   * Complete submission review
   * @param {String} submissionId - Submission ID
   * @param {String} reviewerId - Reviewer ID
   * @param {Object} reviewData - Overall review decision
   * @returns {Object} Updated submission
   */
  async completeSubmissionReview(submissionId, reviewerId, reviewData) {
    try {
      const { 
        status, // "approved", "rejected", "partially_rejected"
        quality_score,
        review_notes,
        rejected_slots = []
      } = reviewData;

      if (!["approved", "rejected", "partially_rejected"].includes(status)) {
        throw new Error("Invalid review status");
      }

      const submission = await MicroTaskSubmission.findById(submissionId);
      if (!submission) {
        throw new Error("Submission not found");
      }

      if (submission.status !== "under_review") {
        throw new Error("Submission is not under review");
      }

      // Validate all images have been reviewed
      const pendingImages = await SubmissionImage.countDocuments({
        submissionId,
        review_status: "pending"
      });

      if (pendingImages > 0) {
        throw new Error("All images must be reviewed before completing submission review");
      }

      // Update submission
      submission.status = status;
      submission.reviewedBy = reviewerId;
      submission.review_date = new Date();
      submission.quality_score = quality_score || null;
      submission.review_notes = review_notes || "";

      // Handle partial rejections
      if (status === "partially_rejected" && rejected_slots.length > 0) {
        submission.rejected_slots = rejected_slots.map(slot => ({
          slotId: slot.slotId,
          reason: slot.reason,
          rejection_date: new Date()
        }));
      }

      // Set approval date for approved submissions
      if (status === "approved") {
        submission.approval_date = new Date();
        submission.payment_status = "approved";
      }

      await submission.save();

      // If partially rejected, reset submission to in_progress
      if (status === "partially_rejected") {
        submission.status = "in_progress";
        await submission.save();
      }

      return await this.getSubmissionForReview(submissionId);

    } catch (error) {
      throw new Error(`Error completing submission review: ${error.message}`);
    }
  }

  /**
   * Bulk approve multiple submissions
   * @param {Array} submissionIds - Array of submission IDs
   * @param {String} reviewerId - Reviewer ID
   * @returns {Object} Bulk approval result
   */
  async bulkApproveSubmissions(submissionIds, reviewerId) {
    try {
      const results = {
        approved: [],
        failed: [],
        total: submissionIds.length
      };

      for (const submissionId of submissionIds) {
        try {
          // First approve all images
          await SubmissionImage.updateMany(
            { submissionId, review_status: "pending" },
            { 
              review_status: "approved", 
              reviewedBy: reviewerId,
              review_date: new Date()
            }
          );

          // Then approve submission
          const submission = await this.completeSubmissionReview(submissionId, reviewerId, {
            status: "approved",
            quality_score: 85, // Default good quality score for bulk approval
            review_notes: "Bulk approved - met quality standards"
          });

          results.approved.push({
            submissionId,
            taskTitle: submission.taskId.title,
            userName: submission.userId.fullName
          });

        } catch (error) {
          results.failed.push({
            submissionId,
            error: error.message
          });
        }
      }

      return results;

    } catch (error) {
      throw new Error(`Error in bulk approval: ${error.message}`);
    }
  }

  /**
   * Get review statistics for dashboard
   * @returns {Object} Review statistics
   */
  async getReviewStatistics() {
    try {
      const [submissionStats, imageStats, reviewerStats] = await Promise.all([
        // Submission statistics
        MicroTaskSubmission.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
              avgQualityScore: { $avg: "$quality_score" }
            }
          }
        ]),

        // Image statistics
        SubmissionImage.aggregate([
          {
            $group: {
              _id: "$review_status",
              count: { $sum: 1 }
            }
          }
        ]),

        // Reviewer productivity
        MicroTaskSubmission.aggregate([
          {
            $match: { 
              reviewedBy: { $ne: null },
              review_date: { 
                $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
              }
            }
          },
          {
            $group: {
              _id: "$reviewedBy",
              reviewsCompleted: { $sum: 1 },
              avgQualityScore: { $avg: "$quality_score" }
            }
          },
          {
            $lookup: {
              from: "dtusers",
              localField: "_id",
              foreignField: "_id",
              as: "reviewer"
            }
          },
          { $unwind: "$reviewer" },
          {
            $project: {
              reviewerName: "$reviewer.fullName",
              reviewsCompleted: 1,
              avgQualityScore: 1
            }
          }
        ])
      ]);

      // Calculate review turnaround time
      const pendingReviews = await MicroTaskSubmission.find({
        status: "under_review"
      }).select("submission_date");

      const avgTurnaroundTime = pendingReviews.length > 0 ? 
        pendingReviews.reduce((acc, sub) => {
          const daysPending = Math.floor(
            (new Date() - new Date(sub.submission_date)) / (1000 * 60 * 60 * 24)
          );
          return acc + daysPending;
        }, 0) / pendingReviews.length : 0;

      return {
        submissions: {
          total: submissionStats.reduce((acc, stat) => acc + stat.count, 0),
          under_review: submissionStats.find(s => s._id === "under_review")?.count || 0,
          approved: submissionStats.find(s => s._id === "approved")?.count || 0,
          rejected: submissionStats.find(s => s._id === "rejected")?.count || 0,
          partially_rejected: submissionStats.find(s => s._id === "partially_rejected")?.count || 0
        },
        images: {
          total: imageStats.reduce((acc, stat) => acc + stat.count, 0),
          pending: imageStats.find(s => s._id === "pending")?.count || 0,
          approved: imageStats.find(s => s._id === "approved")?.count || 0,
          rejected: imageStats.find(s => s._id === "rejected")?.count || 0,
          needs_replacement: imageStats.find(s => s._id === "needs_replacement")?.count || 0
        },
        review_performance: {
          avg_turnaround_days: Math.round(avgTurnaroundTime * 10) / 10,
          active_reviewers: reviewerStats.length,
          total_reviews_this_week: reviewerStats.reduce((acc, stat) => acc + stat.reviewsCompleted, 0),
          avg_quality_score: reviewerStats.length > 0 ? 
            Math.round(reviewerStats.reduce((acc, stat) => acc + stat.avgQualityScore, 0) / reviewerStats.length) : 0
        },
        top_reviewers: reviewerStats.slice(0, 5)
      };

    } catch (error) {
      throw new Error(`Error fetching review statistics: ${error.message}`);
    }
  }

  /**
   * Get submissions by reviewer
   * @param {String} reviewerId - Reviewer ID
   * @param {Object} query - Query options
   * @returns {Object} Reviewer's submissions
   */
  async getReviewerSubmissions(reviewerId, query = {}) {
    try {
      const { page = 1, limit = 10, status } = query;
      const filter = { reviewedBy: reviewerId };

      if (status) filter.status = status;

      const skip = (page - 1) * limit;

      const [submissions, total] = await Promise.all([
        MicroTaskSubmission.find(filter)
          .populate("taskId", "title category")
          .populate("userId", "fullName email")
          .sort({ review_date: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        MicroTaskSubmission.countDocuments(filter)
      ]);

      return {
        submissions,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total_items: total,
          total_pages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      throw new Error(`Error fetching reviewer submissions: ${error.message}`);
    }
  }
}

module.exports = new MicroTaskQAService();