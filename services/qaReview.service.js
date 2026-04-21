const mongoose = require("mongoose");
const qaReviewRepository = require("../repositories/qaReview.repository");
const emailService = require("../utils/emailService");

class QAReviewService {
  toInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  buildPagination({ page, limit, total }) {
    const totalPages = Math.ceil(total / limit);

    return {
      currentPage: page,
      totalPages,
      totalItems: total,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  buildSubmissionMatch(filterBy, baseQuery) {
    const matchQuery = { ...baseQuery };

    switch (filterBy) {
      case "priority":
        matchQuery.submittedAt = {
          $lte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        };
        break;
      case "recent":
        matchQuery.submittedAt = {
          $gte: new Date(Date.now() - 6 * 60 * 60 * 1000),
        };
        break;
      case "high_score":
        matchQuery.totalScore = { $gte: 80 };
        break;
      case "low_score":
        matchQuery.totalScore = { $lt: 50 };
        break;
      case "retakes":
        matchQuery.attemptNumber = { $gt: 1 };
        break;
    }

    return matchQuery;
  }

  /**
   * Get pending submissions for QA review
   */
  async getPendingSubmissions(query) {
    const {
      page = 1,
      limit = 20,
      sortBy = "submittedAt",
      sortOrder = "desc",
      filterBy = "all",
    } = query;

    const pageNumber = this.toInt(page, 1);
    const pageSize = this.toInt(limit, 20);
    const skip = (pageNumber - 1) * pageSize;
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const matchQuery = this.buildSubmissionMatch(filterBy, {
      status: "submitted",
      submittedAt: { $exists: true, $ne: null },
    });

    const [submissions, totalCount] = await Promise.all([
      qaReviewRepository.findSubmissions({
        matchQuery,
        sort,
        skip,
        limit: pageSize,
      }),
      qaReviewRepository.countSubmissions(matchQuery),
    ]);

    return {
      submissions,
      pagination: {
        ...this.buildPagination({
          page: pageNumber,
          limit: pageSize,
          total: totalCount,
        }),
      },
    };
  }

  /**
   * Get detailed submission for review
   */
  async getSubmissionForReview(submissionId) {
    const [submission, qaReview] = await Promise.all([
      qaReviewRepository.findSubmissionById(submissionId),
      qaReviewRepository.findReviewBySubmissionId(submissionId),
    ]);

    if (!submission) {
      throw new Error("Submission not found");
    }

    const tasks = submission.tasks || [];
    const totalScore = tasks.reduce((sum, task) => sum + (task.score || 0), 0);
    const averageScore = tasks.length > 0 ? totalScore / tasks.length : 0;
    const completionTime = submission.submittedAt
      ? submission.submittedAt - submission.createdAt
      : null;

    return {
      submission: {
        ...submission,
        metrics: {
          totalScore,
          averageScore: Number(averageScore.toFixed(2)),
          completionTime,
          tasksCompleted: tasks.length,
          conversationsCreated: tasks.filter(
            (task) =>
              task.type === "conversation" &&
              task.conversation &&
              Array.isArray(task.conversation.turns) &&
              task.conversation.turns.length > 0,
          ).length,
        },
      },
      qaReview,
      isReviewed:
        !!qaReview &&
        (qaReview.status === "completed" ||
          qaReview.reviewStatus === "completed"),
    };
  }

  /**
   * Review individual task
   */
  async reviewTask(data, user) {
    const { submissionId, taskIndex, score, feedback, qualityRating } = data;

    // For testing purposes, handle potential missing user
    let reviewerId = user?._id;
    if (!reviewerId) {
      console.log(
        "⚠️ No authenticated user found, using default test reviewer ID",
      );
      reviewerId = new mongoose.Types.ObjectId("000000000000000000000001");
    }

    // Find or create QA review
    let qaReview = await qaReviewRepository.findReviewDocument(submissionId);

    if (!qaReview) {
      const submission =
        await qaReviewRepository.findSubmissionById(submissionId);
      if (!submission) {
        throw new Error("Submission not found");
      }

      qaReview = await qaReviewRepository.createReview({
        submissionId,
        reviewerId,
        taskScores: [],
        overallScore: 0,
        decision: "Approve", // Default, will be updated
        feedback: "",
        reviewTime: 5, // Default 5 minutes
      });
    } else {
      // Ensure reviewerId is set for existing reviews
      if (!qaReview.reviewerId) {
        qaReview.reviewerId = reviewerId;
      }
    }

    // Create task review matching QAReview model structure
    const taskReview = {
      taskNumber: taskIndex + 1, // 1-based numbering
      scores: {
        conversationQuality: Math.round((score / 10) * 20), // Convert 0-10 to 0-20
        videoSegmentation: Math.round((score / 10) * 20),
        promptRelevance: Math.round((score / 10) * 20),
        creativityAndCoherence: Math.round((score / 10) * 20),
        technicalExecution: Math.round((score / 10) * 20),
      },
      individualFeedback: feedback || "",
      totalScore: score * 10, // Convert 0-10 to 0-100
    };

    // Update or add task review
    const existingReviewIndex = qaReview.taskScores.findIndex(
      (review) => review.taskNumber === taskIndex + 1,
    );

    if (existingReviewIndex >= 0) {
      qaReview.taskScores[existingReviewIndex] = taskReview;
    } else {
      qaReview.taskScores.push(taskReview);
    }

    // Calculate overall score as average of task scores
    if (qaReview.taskScores.length > 0) {
      const totalScoreSum = qaReview.taskScores.reduce(
        (sum, task) => sum + task.totalScore,
        0,
      );
      qaReview.overallScore = Math.round(
        totalScoreSum / qaReview.taskScores.length,
      );
    }

    // Set required fields if not already set
    if (!qaReview.feedback) {
      qaReview.feedback = `Task ${taskIndex + 1} reviewed with score ${score}/10`;
    }

    qaReview.lastUpdatedAt = new Date();
    await qaReview.save();

    // Update submission with QA score for this task
    await qaReviewRepository.updateSubmissionTask(submissionId, taskIndex, {
      qaScore: score,
      qaFeedback: feedback || "",
      qualityRating: qualityRating || "Good",
    });

    return {
      taskReview,
      totalTasksReviewed: qaReview.taskScores.length,
      overallScore: qaReview.overallScore,
    };
  }

  /**
   * Submit final review and decision
   */
  async submitFinalReview(data, user) {
    const {
      submissionId,
      overallScore,
      overallFeedback,
      decision,
      privateNotes,
    } = data;
    const reviewerId = user._id;

    // Find QA review
    const qaReview = await qaReviewRepository.findReviewDocument(submissionId);
    if (!qaReview) {
      throw new Error(
        "QA review not found. Please review individual tasks first.",
      );
    }

    // Find submission
    const submission =
      await qaReviewRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }

    // Update QA review with final decision
    qaReview.overallScore = overallScore;
    qaReview.feedback = overallFeedback; // Model uses 'feedback' as a required field
    qaReview.overallFeedback = overallFeedback; // Controller used this
    qaReview.decision = decision;
    qaReview.privateNotes = privateNotes;
    qaReview.reviewStatus = "completed";
    qaReview.status = "completed";
    qaReview.reviewedAt = new Date();
    qaReview.completedAt = new Date();
    await qaReview.save();

    // Update submission status
    let newSubmissionStatus;
    switch (decision) {
      case "Approve":
        newSubmissionStatus = "approved";
        break;
      case "Reject":
        newSubmissionStatus = "rejected";
        break;
      case "Request Revision":
        newSubmissionStatus = "revision_requested";
        break;
    }

    // Update submission
    await qaReviewRepository.updateSubmission(submissionId, {
      status: newSubmissionStatus,
      qaCompletedAt: new Date(),
    });

    // Update user multimedia assessment status
    const annotatorId = submission.annotatorId._id || submission.annotatorId;
    const annotator = await qaReviewRepository.findUserById(annotatorId);

    if (annotator) {
      if (decision === "Approve") {
        annotator.multimediaAssessmentStatus = "approved";
        annotator.multimediaAssessmentCompletedAt = new Date();
      } else if (decision === "Reject") {
        annotator.multimediaAssessmentStatus = "failed";
        annotator.multimediaAssessmentLastFailedAt = new Date();
      }
      await annotator.save();
    }

    // Send email notification
    try {
      await emailService.sendAssessmentResult({
        userEmail: annotator?.email || submission.annotatorId.email,
        userName: annotator?.fullName || submission.annotatorId.fullName,
        assessmentTitle: submission.assessmentId.title,
        decision,
        overallScore,
        feedback: overallFeedback,
        canRetake: decision === "Reject",
      });
    } catch (emailError) {
      console.error("Failed to send assessment result email:", emailError);
    }

    return {
      decision,
      overallScore,
      submissionStatus: newSubmissionStatus,
      emailSent: true,
    };
  }

  /**
   * Get reviewer dashboard statistics
   */
  async getReviewerDashboard(user) {
    const reviewerId = user._id;

    const [stats, recentReviewsRaw, pendingCount] = await Promise.all([
      qaReviewRepository.getReviewerStats(reviewerId),
      qaReviewRepository.getRecentReviews(reviewerId),
      qaReviewRepository.countSubmissions({
        status: "submitted",
        submittedAt: { $exists: true, $ne: null },
      }),
    ]);

    const totalReviews = stats.reduce((sum, stat) => sum + stat.count, 0);
    const approvalRate =
      totalReviews > 0
        ? ((stats.find((s) => s._id === "Approve")?.count || 0) /
            totalReviews) *
          100
        : 0;

    return {
      statistics: {
        totalReviews,
        approvalRate: Number(approvalRate.toFixed(1)),
        pendingReviews: pendingCount,
        decisionBreakdown: stats,
      },
      recentReviews: recentReviewsRaw.map((review) => ({
        submissionId: review.submissionId?._id || review.submissionId,
        userName: review.submissionId?.annotatorId?.fullName || "Unknown",
        assessmentTitle: review.submissionId?.assessmentId?.title || "Unknown",
        decision: review.decision,
        overallScore: review.overallScore,
        completedAt: review.completedAt || review.reviewedAt,
      })),
    };
  }

  /**
   * Batch process multiple submissions
   */
  async batchReviewSubmissions(data, user) {
    const { submissionIds, decision, overallFeedback } = data;
    const reviewerId = user._id;

    const results = {
      processed: 0,
      failed: 0,
      errors: [],
    };

    for (const submissionId of submissionIds) {
      try {
        // Find or create QA review
        let qaReview =
          await qaReviewRepository.findReviewDocument(submissionId);

        if (!qaReview) {
          qaReview = await qaReviewRepository.createReview({
            submissionId,
            reviewerId,
            taskScores: [],
            overallScore: decision === "Approve" ? 80 : 30,
            decision: decision,
            feedback: overallFeedback || "Batch processed",
            overallFeedback: overallFeedback || "Batch processed",
            reviewTime: 5,
            reviewStatus: "completed",
            status: "completed",
            completedAt: new Date(),
            isBatchProcessed: true,
          });
        } else {
          qaReview.overallScore = decision === "Approve" ? 80 : 30;
          qaReview.overallFeedback = overallFeedback;
          qaReview.feedback = overallFeedback || "Batch processed";
          qaReview.decision = decision;
          qaReview.reviewStatus = "completed";
          qaReview.status = "completed";
          qaReview.completedAt = new Date();
          qaReview.isBatchProcessed = true;
          await qaReview.save();
        }

        // Update submission
        const newStatus = decision === "Approve" ? "approved" : "rejected";
        await qaReviewRepository.updateSubmission(submissionId, {
          status: newStatus,
          qaCompletedAt: new Date(),
          totalScore: qaReview.overallScore,
        });

        // Update user status
        const submission =
          await qaReviewRepository.findSubmissionById(submissionId);
        if (submission) {
          const annotatorId =
            submission.annotatorId?._id || submission.annotatorId;
          const annotator = await qaReviewRepository.findUserById(annotatorId);
          if (annotator) {
            const newUserStatus =
              decision === "Approve" ? "approved" : "failed";
            annotator.multimediaAssessmentStatus = newUserStatus;
            if (decision === "Approve") {
              annotator.multimediaAssessmentCompletedAt = new Date();
            } else {
              annotator.multimediaAssessmentLastFailedAt = new Date();
            }
            await annotator.save();
          }
        }

        results.processed++;
      } catch (itemError) {
        results.failed++;
        results.errors.push({
          submissionId,
          error: itemError.message,
        });
      }
    }

    return results;
  }

  /**
   * Get submission analytics
   */
  async getSubmissionAnalytics(query) {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
    } = query;

    const [overallStats, dailyTrend, qaStats] = await Promise.all([
      qaReviewRepository.getOverallStats(startDate, endDate),
      qaReviewRepository.getDailyTrend(startDate, endDate),
      qaReviewRepository.getQAStatsSummary(startDate, endDate),
    ]);

    return {
      overallStats,
      dailyTrend,
      qaStats,
      dateRange: { startDate, endDate },
    };
  }

  /**
   * List submissions by status (Approved/Rejected)
   */
  async getSubmissionsByStatus(status, query) {
    const {
      page = 1,
      limit = 20,
      sortBy = "submittedAt",
      sortOrder = "desc",
      filterBy = "all",
    } = query;

    const pageNumber = this.toInt(page, 1);
    const pageSize = this.toInt(limit, 20);
    const skip = (pageNumber - 1) * pageSize;
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const matchQuery = this.buildSubmissionMatch(filterBy, { status });

    const [submissions, totalCount] = await Promise.all([
      qaReviewRepository.findSubmissions({
        matchQuery,
        sort,
        skip,
        limit: pageSize,
      }),
      qaReviewRepository.countSubmissions(matchQuery),
    ]);

    return {
      submissions,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalCount / pageSize),
        totalItems: totalCount,
        hasNext: pageNumber < Math.ceil(totalCount / pageSize),
        hasPrev: pageNumber > 1,
      },
    };
  }

  /**
   * Get QA reviewer performance stats
   */
  async getQAStatsByReviewer(reviewerId, query) {
    const { startDate, endDate } = query;
    const stats = await qaReviewRepository.getQAStatsByReviewer(
      reviewerId,
      startDate,
      endDate,
    );

    if (!stats || stats.length === 0) {
      return {
        totalReviews: 0,
        avgScore: 0,
        approvalRate: 0,
        rejectionRate: 0,
        revisionRate: 0,
      };
    }

    const s = stats[0];
    const total = s.totalReviews || 1;

    return {
      totalReviews: s.totalReviews,
      avgScore: Number(s.avgScore?.toFixed(1) || 0),
      approvalRate: Number(((s.approvedCount / total) * 100).toFixed(1)),
      rejectionRate: Number(((s.rejectedCount / total) * 100).toFixed(1)),
      revisionRate: Number(
        ((s.revisionRequestedCount / total) * 100).toFixed(1),
      ),
      batchProcessedCount: s.batchProcessedCount,
    };
  }

  /**
   * Manage QAReviewers
   */
  async listQAReviewers() {
    return await qaReviewRepository.findAllQAReviewers();
  }

  async addQAReviewer(userId) {
    const user = await qaReviewRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.role = "qa_reviewer";
    await user.save();
    return user;
  }

  async removeQAReviewer(userId) {
    const user = await qaReviewRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.role = "annotator"; // Fallback to annotator
    await user.save();
    return user;
  }
}

module.exports = new QAReviewService();
