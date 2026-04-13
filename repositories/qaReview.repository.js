const mongoose = require('mongoose');
const QAReview = require('../models/qaReview.model');
const MultimediaAssessmentSubmission = require('../models/multimediaAssessmentSubmission.model');
const DTUser = require('../models/dtUser.model');
const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');

class QAReviewRepository {
    /**
     * Find submissions with pagination and optional filtering
     */
    async findSubmissions({ matchQuery, sort, skip, limit }) {
        return await MultimediaAssessmentSubmission.aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'dtusers',
                    localField: 'annotatorId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $lookup: {
                    from: 'multimediaassessmentconfigs',
                    localField: 'assessmentId',
                    foreignField: '_id',
                    as: 'assessment'
                }
            },
            { $unwind: '$assessment' },
            {
                $addFields: {
                    avgScore: {
                        $cond: {
                            if: { $gt: [{ $size: '$tasks' }, 0] },
                            then: {
                                $avg: {
                                    $map: {
                                        input: '$tasks',
                                        as: 'task',
                                        in: '$$task.score'
                                    }
                                }
                            },
                            else: 0
                        }
                    },
                    completionTime: {
                        $subtract: ['$submittedAt', '$createdAt']
                    },
                    waitingTime: {
                        $subtract: [new Date(), '$submittedAt']
                    }
                }
            },
            {
                $project: {
                    annotatorId: 1,
                    userName: '$user.fullName',
                    userEmail: '$user.email',
                    assessmentTitle: '$assessment.title',
                    submittedAt: '$submittedAt',
                    qaCompletedAt: 1,
                    avgScore: 1,
                    completionTime: 1,
                    waitingTime: 1,
                    attemptNumber: 1,
                    tasksCompleted: { $size: '$tasks' },
                    totalTasks: '$assessment.numberOfTasks',
                    status: 1
                }
            },
            { $sort: sort },
            { $skip: skip },
            { $limit: limit }
        ]);
    }

    /**
     * Count submissions matching query
     */
    async countSubmissions(matchQuery) {
        return await MultimediaAssessmentSubmission.countDocuments(matchQuery);
    }

    /**
     * Find submission by ID with populated fields
     */
    async findSubmissionById(id) {
        return await MultimediaAssessmentSubmission.findById(id)
            .populate('annotatorId', 'fullName email')
            .populate('assessmentId', 'title description scoringWeights')
            .lean();
    }

    /**
     * Find QA review by submission ID
     */
    async findReviewBySubmissionId(submissionId) {
        return await QAReview.findOne({ submissionId }).lean();
    }

    /**
     * Find QAReview document for update
     */
    async findReviewDocument(submissionId) {
        return await QAReview.findOne({ submissionId });
    }

    /**
     * Create a new QA review
     */
    async createReview(data) {
        const qaReview = new QAReview(data);
        return await qaReview.save();
    }

    /**
     * Update submission fields
     */
    async updateSubmission(id, updateData) {
        return await MultimediaAssessmentSubmission.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );
    }

    /**
     * Update individual task in submission
     */
    async updateSubmissionTask(submissionId, taskIndex, taskUpdate) {
        const updateObj = {};
        for (const [key, value] of Object.entries(taskUpdate)) {
            updateObj[`tasks.${taskIndex}.${key}`] = value;
        }

        return await MultimediaAssessmentSubmission.findOneAndUpdate(
            { 
                _id: submissionId,
                [`tasks.${taskIndex}`]: { $exists: true }
            },
            { $set: updateObj },
            { new: true }
        );
    }

    /**
     * Get reviewer statistics
     */
    async getReviewerStats(reviewerId) {
        return await QAReview.aggregate([
            { $match: { reviewerId } },
            {
                $group: {
                    _id: '$decision',
                    count: { $sum: 1 },
                    avgScore: { $avg: '$overallScore' }
                }
            }
        ]);
    }

    /**
     * Get recent reviews for a reviewer
     */
    async getRecentReviews(reviewerId, limit = 10) {
        return await QAReview.find({ reviewerId })
            .populate({
                path: 'submissionId',
                populate: [
                    { path: 'annotatorId', select: 'fullName email' },
                    { path: 'assessmentId', select: 'title' }
                ]
            })
            .sort({ completedAt: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Get overall statistics for submissions (Analytics)
     */
    async getOverallStats(startDate, endDate) {
        return await MultimediaAssessmentSubmission.aggregate([
            {
                $match: {
                    createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    avgCompletionTime: {
                        $avg: {
                            $cond: {
                                if: '$submittedAt',
                                then: { $subtract: ['$submittedAt', '$createdAt'] },
                                else: null
                            }
                        }
                    }
                }
            }
        ]);
    }

    /**
     * Get daily submission trend (Analytics)
     */
    async getDailyTrend(startDate, endDate) {
        return await MultimediaAssessmentSubmission.aggregate([
            {
                $match: {
                    createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    submissions: { $sum: 1 },
                    completed: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0]
                        }
                    }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);
    }

    /**
     * Get QA stats summary (Analytics)
     */
    async getQAStatsSummary(startDate, endDate) {
        return await QAReview.aggregate([
            {
                $match: {
                    completedAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
                }
            },
            {
                $group: {
                    _id: '$decision',
                    count: { $sum: 1 },
                    avgScore: { $avg: '$overallScore' }
                }
            }
        ]);
    }

    /**
     * Get detailed analytics for a specific reviewer
     */
    async getQAStatsByReviewer(reviewerId, startDate, endDate) {
        const matchStage = { reviewerId: new mongoose.Types.ObjectId(reviewerId) };
        if (startDate || endDate) {
            matchStage.completedAt = {};
            if (startDate) matchStage.completedAt.$gte = new Date(startDate);
            if (endDate) matchStage.completedAt.$lte = new Date(endDate);
        }

        return await QAReview.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalReviews: { $sum: 1 },
                    avgScore: { $avg: '$overallScore' },
                    approvedCount: { $sum: { $cond: [{ $eq: ['$decision', 'Approve'] }, 1, 0] } },
                    rejectedCount: { $sum: { $cond: [{ $eq: ['$decision', 'Reject'] }, 1, 0] } },
                    revisionRequestedCount: { $sum: { $cond: [{ $eq: ['$decision', 'Request Revision'] }, 1, 0] } },
                    batchProcessedCount: { $sum: { $cond: ['$isBatchProcessed', 1, 0] } }
                }
            }
        ]);
    }

    /**
     * List all QA reviewers
     */
    async findAllQAReviewers() {
        return await DTUser.find({ role: 'qa_reviewer' })
            .select('fullName email multimediaAssessmentStatus createdAt lastLoginAt')
            .sort({ fullName: 1 });
    }

    /**
     * Find user by ID
     */
    async findUserById(id) {
        return await DTUser.findById(id);
    }
}

module.exports = new QAReviewRepository();
