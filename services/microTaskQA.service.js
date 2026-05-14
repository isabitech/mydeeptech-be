const TaskApplication = require("../models/taskApplication.model");
const TaskImageUpload = require("../models/imageUpload.model");
const Task = require("../models/task.model");
const DTUser = require("../models/dtUser.model");

class MicroTaskQAService {
  getQueueStatuses() {
    return ["under_review", "completed"];
  }

  getReviewableStatuses(allowOverride = false) {
    const baseStatuses = ["under_review", "completed"];

    if (allowOverride) {
      return [...baseStatuses, "approved", "rejected", "partially_rejected"];
    }

    return baseStatuses;
  }

  getImageIdsFromSubmission(submission) {
    return (submission.images || []).map((image) =>
      image?._id ? image._id : image,
    );
  }

  sortImages(images = []) {
    return [...images].sort((left, right) => {
      const leftSequence = left?.metadata?.imageSequence ?? Number.MAX_SAFE_INTEGER;
      const rightSequence =
        right?.metadata?.imageSequence ?? Number.MAX_SAFE_INTEGER;

      if (leftSequence !== rightSequence) {
        return leftSequence - rightSequence;
      }

      return new Date(left.createdAt || 0) - new Date(right.createdAt || 0);
    });
  }

  buildImageStats(images = []) {
    const stats = {
      total: images.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      needs_replacement: 0,
    };

    images.forEach((image) => {
      const status = image?.status || "pending";
      if (Object.prototype.hasOwnProperty.call(stats, status)) {
        stats[status] += 1;
      }
    });

    return stats;
  }

  buildProgress(submission, images = []) {
    const uploaded =
      submission?.uploadProgress?.total ?? submission?.images?.length ?? images.length;
    const total =
      submission?.task?.totalImagesRequired ||
      submission?.task?.required_count ||
      uploaded ||
      0;
    const percentage = total > 0 ? Math.round((uploaded / total) * 100) : 0;

    return {
      uploaded,
      total,
      percentage,
      isComplete: submission?.isComplete === true || percentage >= 100,
    };
  }

  formatUser(user) {
    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      fullName: user.fullName || "",
      email: user.email || "",
      qaStatus: user.qaStatus || null,
      country:
        user.personal_info?.country || user.country || user.personalInfo?.country || "",
      phone: user.phone || user.phoneNumber || "",
    };
  }

  formatTask(task) {
    if (!task) {
      return null;
    }

    return {
      _id: task._id,
      taskTitle: task.taskTitle || task.title || "",
      category: task.category || "",
      payRate: task.payRate || 0,
      currency: task.currency || task.payRateCurrency || "USD",
      totalImagesRequired: task.totalImagesRequired || task.required_count || 0,
      dueDate: task.dueDate || task.deadline || null,
    };
  }

  formatReviewer(user) {
    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      fullName: user.fullName || "",
      email: user.email || "",
    };
  }

  formatImage(image, { detailed = false } = {}) {
    if (!image) {
      return null;
    }

    const resolution = image.metadata?.resolution || null;

    return {
      _id: image._id,
      url: image.url,
      publicId: image.publicId,
      label: image.label,
      status: image.status,
      rejectionMessage: image.rejectionMessage || "",
      qaNotes: image.qaNotes || "",
      reviewedAt: image.reviewedAt || null,
      reviewedBy: this.formatReviewer(image.reviewedBy),
      metadata: {
        angle: image.metadata?.angle || image.label || null,
        taskCategory: image.metadata?.taskCategory || null,
        imageSequence: image.metadata?.imageSequence || null,
        uploadTimestamp: image.metadata?.uploadTimestamp || image.createdAt || null,
        fileSize: image.metadata?.fileSize || null,
        resolution: resolution
          ? {
              width: resolution.width ?? null,
              height: resolution.height ?? null,
            }
          : null,
        fileUrl: image.metadata?.fileUrl || image.url,
        fileName: detailed ? image.metadata?.fileName || null : undefined,
        fileType: detailed ? image.metadata?.fileType || null : undefined,
        dateTaken:
          detailed ? image.metadata?.dateTaken || image.dateTaken || null : undefined,
      },
    };
  }

  formatSubmissionSummary(submission) {
    const images = this.sortImages(submission.images || []);
    const formattedImages = images.map((image) => this.formatImage(image));
    const imageStats = this.buildImageStats(images);
    const progress = this.buildProgress(submission, images);
    const submittedAt = submission.submittedAt || submission.createdAt || null;
    const daysPending = submittedAt
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(submittedAt).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 0;

    return {
      _id: submission._id,
      status: submission.status,
      submittedAt,
      reviewedAt: submission.reviewedAt || null,
      reviewNote: submission.reviewNote || "",
      qaScore: submission.qaScore ?? null,
      task: this.formatTask(submission.task),
      applicant: this.formatUser(submission.applicant),
      reviewer: this.formatReviewer(submission.reviewedBy),
      progress,
      imageStats,
      images: formattedImages,
      reviewPriority: {
        daysPending,
        score: daysPending + ((submission.task?.payRate || 0) * 0.1),
      },
    };
  }

  formatSubmissionDetail(submission) {
    const images = this.sortImages(submission.images || []);
    const formattedImages = images.map((image) =>
      this.formatImage(image, { detailed: true }),
    );
    const imageStats = this.buildImageStats(images);
    const progress = this.buildProgress(submission, images);

    return {
      _id: submission._id,
      status: submission.status,
      isComplete: submission.isComplete === true,
      submittedAt: submission.submittedAt || submission.createdAt || null,
      reviewedAt: submission.reviewedAt || null,
      reviewNote: submission.reviewNote || "",
      qaScore: submission.qaScore ?? null,
      task: this.formatTask(submission.task),
      applicant: this.formatUser(submission.applicant),
      reviewer: this.formatReviewer(submission.reviewedBy),
      progress,
      imageStats,
      images: formattedImages,
      allImagesReviewed: imageStats.pending === 0,
    };
  }

  async getSubmissionsPendingReview(query = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        taskId,
        category,
        priority = "oldest_first",
      } = query;

      const pageNumber = Math.max(1, parseInt(page, 10) || 1);
      const pageSize = Math.max(1, parseInt(limit, 10) || 10);
      const skip = (pageNumber - 1) * pageSize;
      const filter = {
        status: { $in: this.getQueueStatuses() },
      };

      if (taskId) {
        filter.task = taskId;
      }

      if (category) {
        const matchingTaskIds = await Task.find({ category }).distinct("_id");

        if (filter.task) {
          const isMatchingTask = matchingTaskIds.some(
            (id) => id.toString() === String(filter.task),
          );

          if (!isMatchingTask) {
            return {
              submissions: [],
              pagination: {
                current_page: pageNumber,
                per_page: pageSize,
                total_items: 0,
                total_pages: 0,
              },
              statistics: await this.getReviewStatistics(),
            };
          }
        } else {
          filter.task = { $in: matchingTaskIds };
        }
      }

      const sort =
        priority === "newest_first"
          ? { submittedAt: -1, createdAt: -1 }
          : { submittedAt: 1, createdAt: 1 };

      const [submissions, total] = await Promise.all([
        TaskApplication.find(filter)
          .populate("task", "taskTitle category payRate currency totalImagesRequired dueDate")
          .populate("applicant", "fullName email personal_info phone phoneNumber qaStatus")
          .populate("reviewedBy", "fullName email")
          .populate("images", "url publicId label status rejectionMessage qaNotes metadata reviewedBy reviewedAt createdAt")
          .sort(sort)
          .skip(skip)
          .limit(pageSize),
        TaskApplication.countDocuments(filter),
      ]);

      return {
        submissions: submissions.map((submission) =>
          this.formatSubmissionSummary(submission),
        ),
        pagination: {
          current_page: pageNumber,
          per_page: pageSize,
          total_items: total,
          total_pages: Math.ceil(total / pageSize),
        },
        statistics: await this.getReviewStatistics(),
      };
    } catch (error) {
      throw new Error(`Error fetching submissions for review: ${error.message}`);
    }
  }

  async getSubmissionById(submissionId) {
    return TaskApplication.findById(submissionId)
      .populate("task", "taskTitle category payRate currency totalImagesRequired dueDate instructions quality_guidelines")
      .populate("applicant", "fullName email personal_info phone phoneNumber qaStatus date_of_birth gender")
      .populate("reviewedBy", "fullName email")
      .populate({
        path: "images",
        select:
          "url publicId label status rejectionMessage qaNotes metadata reviewedBy reviewedAt createdAt dateTaken",
        populate: {
          path: "reviewedBy",
          select: "fullName email",
        },
      });
  }

  async getSubmissionForReview(submissionId, options = {}) {
    try {
      const { allowAnyStatus = false } = options;
      const submission = await this.getSubmissionById(submissionId);

      if (!submission) {
        throw new Error("Submission not found");
      }

      const allowedStatuses = allowAnyStatus
        ? null
        : this.getQueueStatuses();

      if (allowedStatuses && !allowedStatuses.includes(submission.status)) {
        throw new Error("Submission is not in the QA queue");
      }

      return this.formatSubmissionDetail(submission);
    } catch (error) {
      throw new Error(`Error fetching submission for review: ${error.message}`);
    }
  }

  async reviewImage(imageId, reviewerId, reviewData) {
    try {
      const { status, rejection_reason, quality_notes } = reviewData;

      if (!["approved", "rejected", "needs_replacement"].includes(status)) {
        throw new Error("Invalid review status");
      }

      const image = await TaskImageUpload.findById(imageId);

      if (!image) {
        throw new Error("Image not found");
      }

      image.status = status;
      image.rejectionMessage = rejection_reason || "";
      image.qaNotes = quality_notes || "";
      image.reviewedBy = reviewerId;
      image.reviewedAt = new Date();

      await image.save();

      const submission = await TaskApplication.findOne({ images: image._id });
      if (submission && submission.status === "completed") {
        submission.status = "under_review";
        await submission.save();
      }

      return TaskImageUpload.findById(imageId).populate(
        "reviewedBy",
        "fullName email",
      );
    } catch (error) {
      throw new Error(`Error reviewing image: ${error.message}`);
    }
  }

  async completeSubmissionReview(submissionId, reviewerId, reviewData) {
    try {
      const {
        status,
        quality_score,
        review_notes,
        allow_override = false,
      } = reviewData;

      if (!["approved", "rejected", "partially_rejected"].includes(status)) {
        throw new Error("Invalid review status");
      }

      const submission = await this.getSubmissionById(submissionId);

      if (!submission) {
        throw new Error("Submission not found");
      }

      const reviewableStatuses = this.getReviewableStatuses(allow_override);
      if (!reviewableStatuses.includes(submission.status)) {
        throw new Error("Submission cannot be reviewed in its current state");
      }

      const imageIds = this.getImageIdsFromSubmission(submission);
      const images = await TaskImageUpload.find({ _id: { $in: imageIds } });
      const pendingImages = images.filter((image) => image.status === "pending");
      const rejectedImages = images.filter((image) =>
        ["rejected", "needs_replacement"].includes(image.status),
      );

      if (pendingImages.length > 0) {
        throw new Error(
          "All images must be reviewed before completing submission review",
        );
      }

      if (status === "approved" && rejectedImages.length > 0) {
        throw new Error(
          "A submission cannot be approved while one or more images are rejected",
        );
      }

      if (status === "partially_rejected" && rejectedImages.length === 0) {
        throw new Error(
          "A partial rejection requires at least one rejected image",
        );
      }

      submission.status = status;
      submission.reviewedBy = reviewerId;
      submission.reviewedAt = new Date();
      submission.reviewNote = review_notes || "";
      submission.qaScore =
        quality_score === undefined || quality_score === null
          ? null
          : Number(quality_score);

      if (status === "approved") {
        submission.approvedBy = reviewerId;
        submission.approvedDate = new Date();
        submission.rejectedBy = null;
        submission.rejectedAt = null;
        submission.rejectionMessage = null;
      }

      if (status === "rejected" || status === "partially_rejected") {
        submission.rejectedBy = reviewerId;
        submission.rejectedAt = new Date();
        submission.rejectionMessage = review_notes || "";
      }

      await submission.save();

      return this.getSubmissionForReview(submissionId, { allowAnyStatus: true });
    } catch (error) {
      throw new Error(`Error completing submission review: ${error.message}`);
    }
  }

  async bulkApproveSubmissions(submissionIds, reviewerId) {
    try {
      const results = {
        approved: [],
        failed: [],
        total: submissionIds.length,
      };

      for (const submissionId of submissionIds) {
        try {
          const submission = await this.getSubmissionById(submissionId);

          if (!submission) {
            throw new Error("Submission not found");
          }

          const imageIds = this.getImageIdsFromSubmission(submission);

          await TaskImageUpload.updateMany(
            { _id: { $in: imageIds }, status: { $ne: "approved" } },
            {
              $set: {
                status: "approved",
                rejectionMessage: "",
                qaNotes: "Bulk approved",
                reviewedBy: reviewerId,
                reviewedAt: new Date(),
              },
            },
          );

          const reviewedSubmission = await this.completeSubmissionReview(
            submissionId,
            reviewerId,
            {
              status: "approved",
              quality_score: 85,
              review_notes: "Bulk approved - met quality standards",
            },
          );

          results.approved.push({
            submissionId,
            taskTitle: reviewedSubmission.task?.taskTitle || "Unknown Task",
            userName: reviewedSubmission.applicant?.fullName || "Unknown User",
          });
        } catch (error) {
          results.failed.push({
            submissionId,
            error: error.message,
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Error in bulk approval: ${error.message}`);
    }
  }

  async getReviewQueueSummary() {
    try {
      const submissions = await TaskApplication.find({
        status: { $in: this.getQueueStatuses() },
      })
        .populate("task", "taskTitle category")
        .populate("applicant", "fullName")
        .populate("images", "status");

      const queueByTaskMap = new Map();
      let totalPendingImages = 0;

      submissions.forEach((submission) => {
        const taskId = submission.task?._id?.toString();
        if (!taskId) {
          return;
        }

        const submittedAt = submission.submittedAt || submission.createdAt || new Date();
        const daysPending = Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(submittedAt).getTime()) / (1000 * 60 * 60 * 24),
          ),
        );

        if (!queueByTaskMap.has(taskId)) {
          queueByTaskMap.set(taskId, {
            taskId,
            taskTitle: submission.task.taskTitle || "",
            category: submission.task.category || "",
            pendingCount: 0,
            totalPendingDays: 0,
          });
        }

        const taskSummary = queueByTaskMap.get(taskId);
        taskSummary.pendingCount += 1;
        taskSummary.totalPendingDays += daysPending;

        (submission.images || []).forEach((image) => {
          if (image.status === "pending") {
            totalPendingImages += 1;
          }
        });
      });

      const queueByTask = Array.from(queueByTaskMap.values()).map((item) => ({
        taskId: item.taskId,
        taskTitle: item.taskTitle,
        category: item.category,
        pendingCount: item.pendingCount,
        avgDaysPending:
          item.pendingCount > 0
            ? Math.round((item.totalPendingDays / item.pendingCount) * 10) / 10
            : 0,
      }));

      const urgentReviews = submissions
        .map((submission) => {
          const submittedAt = submission.submittedAt || submission.createdAt || new Date();
          const daysPending = Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(submittedAt).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          );

          return {
            id: submission._id,
            taskTitle: submission.task?.taskTitle || "",
            category: submission.task?.category || "",
            userName: submission.applicant?.fullName || "",
            daysPending,
          };
        })
        .filter((submission) => submission.daysPending >= 3)
        .sort((left, right) => right.daysPending - left.daysPending);

      const averagePendingDays =
        queueByTask.length > 0
          ? Math.round(
              (queueByTask.reduce(
                (total, item) => total + item.avgDaysPending,
                0,
              ) /
                queueByTask.length) *
                10,
            ) / 10
          : 0;

      return {
        queueByTask,
        totalPendingImages,
        urgentReviews,
        summary: {
          totalSubmissionsPending: submissions.length,
          totalImagesPending: totalPendingImages,
          urgentReviewsCount: urgentReviews.length,
          averagePendingDays,
        },
      };
    } catch (error) {
      throw new Error(`Error fetching review queue summary: ${error.message}`);
    }
  }

  async getReviewStatistics() {
    try {
      const [submissions, images] = await Promise.all([
        TaskApplication.find({})
          .select("status qaScore reviewedBy reviewedAt submittedAt")
          .lean(),
        TaskImageUpload.find({})
          .select("status")
          .lean(),
      ]);

      const submissionStats = {
        total: submissions.length,
        under_review: 0,
        approved: 0,
        rejected: 0,
        partially_rejected: 0,
      };

      submissions.forEach((submission) => {
        if (Object.prototype.hasOwnProperty.call(submissionStats, submission.status)) {
          submissionStats[submission.status] += 1;
        }
      });

      const imageStats = {
        total: images.length,
        pending: 0,
        approved: 0,
        rejected: 0,
        needs_replacement: 0,
      };

      images.forEach((image) => {
        if (Object.prototype.hasOwnProperty.call(imageStats, image.status)) {
          imageStats[image.status] += 1;
        }
      });

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const reviewerMap = new Map();

      submissions
        .filter(
          (submission) =>
            submission.reviewedBy &&
            submission.reviewedAt &&
            new Date(submission.reviewedAt) >= oneWeekAgo,
        )
        .forEach((submission) => {
          const reviewerId = submission.reviewedBy.toString();

          if (!reviewerMap.has(reviewerId)) {
            reviewerMap.set(reviewerId, {
              reviewsCompleted: 0,
              totalQaScore: 0,
              qaScoreCount: 0,
            });
          }

          const reviewerSummary = reviewerMap.get(reviewerId);
          reviewerSummary.reviewsCompleted += 1;

          if (typeof submission.qaScore === "number") {
            reviewerSummary.totalQaScore += submission.qaScore;
            reviewerSummary.qaScoreCount += 1;
          }
        });

      const reviewerIds = Array.from(reviewerMap.keys());
      const reviewers =
        reviewerIds.length > 0
          ? await DTUser.find({ _id: { $in: reviewerIds } })
              .select("fullName")
              .lean()
          : [];
      const reviewerNameMap = new Map(
        reviewers.map((reviewer) => [reviewer._id.toString(), reviewer.fullName || "Unknown"]),
      );

      const topReviewers = reviewerIds
        .map((reviewerId) => {
          const reviewerSummary = reviewerMap.get(reviewerId);
          const averageQaScore =
            reviewerSummary.qaScoreCount > 0
              ? Math.round(
                  reviewerSummary.totalQaScore / reviewerSummary.qaScoreCount,
                )
              : 0;

          return {
            reviewerId,
            reviewerName: reviewerNameMap.get(reviewerId) || "Unknown",
            reviewsCompleted: reviewerSummary.reviewsCompleted,
            avgQualityScore: averageQaScore,
          };
        })
        .sort((left, right) => right.reviewsCompleted - left.reviewsCompleted)
        .slice(0, 5);

      const pendingReviews = submissions.filter((submission) =>
        this.getQueueStatuses().includes(submission.status),
      );

      const avgTurnaroundTime =
        pendingReviews.length > 0
          ? pendingReviews.reduce((total, submission) => {
              const submittedAt = submission.submittedAt || submission.reviewedAt || new Date();
              const daysPending = Math.max(
                0,
                Math.floor(
                  (Date.now() - new Date(submittedAt).getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              );

              return total + daysPending;
            }, 0) / pendingReviews.length
          : 0;

      return {
        submissions: submissionStats,
        images: imageStats,
        review_performance: {
          avg_turnaround_days: Math.round(avgTurnaroundTime * 10) / 10,
          active_reviewers: reviewerIds.length,
          total_reviews_this_week: topReviewers.reduce(
            (total, reviewer) => total + reviewer.reviewsCompleted,
            0,
          ),
          avg_quality_score:
            topReviewers.length > 0
              ? Math.round(
                  topReviewers.reduce(
                    (total, reviewer) => total + reviewer.avgQualityScore,
                    0,
                  ) / topReviewers.length,
                )
              : 0,
        },
        top_reviewers: topReviewers,
      };
    } catch (error) {
      throw new Error(`Error fetching review statistics: ${error.message}`);
    }
  }

  async getReviewerSubmissions(reviewerId, query = {}) {
    try {
      const { page = 1, limit = 10, status } = query;
      const pageNumber = Math.max(1, parseInt(page, 10) || 1);
      const pageSize = Math.max(1, parseInt(limit, 10) || 10);
      const skip = (pageNumber - 1) * pageSize;
      const filter = { reviewedBy: reviewerId };

      if (status) {
        filter.status = status;
      }

      const [submissions, total] = await Promise.all([
        TaskApplication.find(filter)
          .populate("task", "taskTitle category payRate currency totalImagesRequired")
          .populate("applicant", "fullName email personal_info phone phoneNumber")
          .populate("reviewedBy", "fullName email")
          .populate("images", "url publicId label status rejectionMessage qaNotes metadata reviewedBy reviewedAt createdAt")
          .sort({ reviewedAt: -1, updatedAt: -1 })
          .skip(skip)
          .limit(pageSize),
        TaskApplication.countDocuments(filter),
      ]);

      return {
        submissions: submissions.map((submission) =>
          this.formatSubmissionSummary(submission),
        ),
        pagination: {
          current_page: pageNumber,
          per_page: pageSize,
          total_items: total,
          total_pages: Math.ceil(total / pageSize),
        },
      };
    } catch (error) {
      throw new Error(`Error fetching reviewer submissions: ${error.message}`);
    }
  }
}

module.exports = new MicroTaskQAService();
