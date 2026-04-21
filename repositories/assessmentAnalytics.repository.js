const MultimediaAssessmentSubmission = require('../models/multimediaAssessmentSubmission.model');
const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');
const QAReview = require('../models/qaReview.model');
const VideoReel = require('../models/videoReel.model');
const DTUser = require('../models/dtUser.model');
const mongoose = require('mongoose');

class AssessmentAnalyticsRepository {
    async getSubmissionCounts(dateFilter) {
        return await Promise.all([
            MultimediaAssessmentSubmission.countDocuments(dateFilter),
            MultimediaAssessmentSubmission.countDocuments({
                ...dateFilter,
                status: 'submitted'
            }),
            MultimediaAssessmentSubmission.countDocuments({
                status: 'submitted',
                finalSubmittedAt: { $exists: true }
            })
        ]);
    }

    async getReviewCount(dateFilter) {
        return await QAReview.countDocuments({
            completedAt: {
                $gte: dateFilter.createdAt.$gte,
                $lte: dateFilter.createdAt.$lte
            }
        });
    }

    async getUserCount() {
        return await DTUser.countDocuments({
            multimediaAssessmentStatus: { $ne: 'not_started' }
        });
    }

    async getActiveReelsCount() {
        return await VideoReel.countDocuments({ isActive: true });
    }

    async getSubmissionTrend(dateFilter) {
        return await MultimediaAssessmentSubmission.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    total: { $sum: 1 },
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

    async getAssessmentPerformance(dateFilter) {
        return await MultimediaAssessmentSubmission.aggregate([
            { $match: { ...dateFilter, status: 'submitted' } },
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
                $group: {
                    _id: '$assessmentId',
                    assessmentTitle: { $first: '$assessment.title' },
                    totalSubmissions: { $sum: 1 },
                    avgCompletionTime: { $avg: '$totalTimeSpent' },
                    avgScore: {
                        $avg: {
                            $avg: {
                                $map: {
                                    input: '$tasks',
                                    as: 'task',
                                    in: '$$task.score'
                                }
                            }
                        }
                    }
                }
            },
            { $sort: { totalSubmissions: -1 } }
        ]);
    }

    async getQAPerformance(dateFilter) {
        return await QAReview.aggregate([
            {
                $match: {
                    completedAt: {
                        $gte: dateFilter.createdAt.$gte,
                        $lte: dateFilter.createdAt.$lte
                    }
                }
            },
            {
                $lookup: {
                    from: 'dtusers',
                    localField: 'reviewerId',
                    foreignField: '_id',
                    as: 'reviewer'
                }
            },
            { $unwind: '$reviewer' },
            {
                $group: {
                    _id: '$reviewerId',
                    reviewerName: { $first: '$reviewer.fullName' },
                    totalReviews: { $sum: 1 },
                    avgReviewScore: { $avg: '$overallScore' },
                    approvals: {
                        $sum: {
                            $cond: [{ $eq: ['$decision', 'Approve'] }, 1, 0]
                        }
                    },
                    rejections: {
                        $sum: {
                            $cond: [{ $eq: ['$decision', 'Reject'] }, 1, 0]
                        }
                    }
                }
            },
            {
                $addFields: {
                    approvalRate: {
                        $cond: {
                            if: { $gt: ['$totalReviews', 0] },
                            then: { $multiply: [{ $divide: ['$approvals', '$totalReviews'] }, 100] },
                            else: 0
                        }
                    }
                }
            },
            { $sort: { totalReviews: -1 } }
        ]);
    }

    async getAvgReviewTime(dateFilter) {
        return await QAReview.aggregate([
            {
                $match: {
                    completedAt: {
                        $gte: dateFilter.createdAt.$gte,
                        $lte: dateFilter.createdAt.$lte
                    }
                }
            },
            {
                $project: {
                    reviewTime: { $subtract: ['$completedAt', '$createdAt'] }
                }
            },
            {
                $group: {
                    _id: null,
                    avgReviewTime: { $avg: '$reviewTime' }
                }
            }
        ]);
    }

    async getReelUsageStats() {
        return await VideoReel.aggregate([
            { $match: { isActive: true } },
            {
                $project: {
                    title: 1,
                    niche: 1,
                    usageCount: 1,
                    createdAt: 1,
                    duration: 1,
                    aspectRatio: 1,
                    usageRate: {
                        $cond: {
                            if: { $gt: [{ $dateDiff: { startDate: '$createdAt', endDate: new Date(), unit: 'day' } }, 0] },
                            then: {
                                $divide: [
                                    '$usageCount',
                                    { $dateDiff: { startDate: '$createdAt', endDate: new Date(), unit: 'day' } }
                                ]
                            },
                            else: '$usageCount'
                        }
                    }
                }
            },
            { $sort: { usageCount: -1 } }
        ]);
    }

    async getNicheAnalytics() {
        return await VideoReel.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: '$niche',
                    totalReels: { $sum: 1 },
                    totalUsage: { $sum: '$usageCount' },
                    avgUsagePerReel: { $avg: '$usageCount' },
                    avgDuration: { $avg: '$duration' }
                }
            },
            { $sort: { totalUsage: -1 } }
        ]);
    }

    async getRecentUsageTrend() {
        return await MultimediaAssessmentSubmission.aggregate([
            {
                $match: {
                    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
                }
            },
            {
                $unwind: '$tasks'
            },
            {
                $unwind: '$tasks.selectedReels'
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    reelUsages: { $sum: 1 },
                    uniqueReels: { $addToSet: '$tasks.selectedReels.reelId' }
                }
            },
            {
                $addFields: {
                    uniqueReelCount: { $size: '$uniqueReels' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);
    }

    async getPerformanceByCharacteristics() {
        return await MultimediaAssessmentSubmission.aggregate([
            { $match: { status: 'submitted' } },
            { $unwind: '$tasks' },
            { $unwind: '$tasks.selectedReels' },
            {
                $lookup: {
                    from: 'videoreels',
                    localField: 'tasks.selectedReels.reelId',
                    foreignField: '_id',
                    as: 'reel'
                }
            },
            { $unwind: '$reel' },
            {
                $group: {
                    _id: {
                        niche: '$reel.niche',
                        aspectRatio: '$reel.aspectRatio'
                    },
                    avgTaskScore: { $avg: '$tasks.score' },
                    usageCount: { $sum: 1 },
                    avgCompletionTime: { $avg: '$tasks.timeSpent' }
                }
            },
            { $sort: { avgTaskScore: -1 } }
        ]);
    }

    async getUserPerformance(dateFilter) {
        return await MultimediaAssessmentSubmission.aggregate([
            { $match: { ...dateFilter, status: 'submitted' } },
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
                $group: {
                    _id: '$annotatorId',
                    userName: { $first: '$user.fullName' },
                    userEmail: { $first: '$user.email' },
                    totalSubmissions: { $sum: 1 },
                    avgScore: {
                        $avg: {
                            $avg: {
                                $map: {
                                    input: '$tasks',
                                    as: 'task',
                                    in: '$$task.score'
                                }
                            }
                        }
                    },
                    avgCompletionTime: { $avg: '$totalTimeSpent' },
                    totalTasksCompleted: { $sum: { $size: '$tasks' } }
                }
            },
            { $sort: { avgScore: -1 } }
        ]);
    }

    async getApprovalRatesByUser(dateFilter) {
        return await QAReview.aggregate([
            {
                $match: {
                    completedAt: {
                        $gte: dateFilter.createdAt.$gte,
                        $lte: dateFilter.createdAt.$lte
                    }
                }
            },
            {
                $lookup: {
                    from: 'multimediaassessmentsubmissions',
                    localField: 'submissionId',
                    foreignField: '_id',
                    as: 'submission'
                }
            },
            { $unwind: '$submission' },
            {
                $group: {
                    _id: '$submission.annotatorId',
                    totalReviews: { $sum: 1 },
                    approvals: {
                        $sum: {
                            $cond: [{ $eq: ['$decision', 'Approve'] }, 1, 0]
                        }
                    }
                }
            },
            {
                $addFields: {
                    approvalRate: {
                        $cond: {
                            if: { $gt: ['$totalReviews', 0] },
                            then: { $multiply: [{ $divide: ['$approvals', '$totalReviews'] }, 100] },
                            else: 0
                        }
                    }
                }
            }
        ]);
    }

    async getStatusDistribution() {
        return await DTUser.aggregate([
            {
                $group: {
                    _id: '$multimediaAssessmentStatus',
                    count: { $sum: 1 }
                }
            }
        ]);
    }

    async getCompletionTimeDistribution(dateFilter) {
        return await MultimediaAssessmentSubmission.aggregate([
            { $match: { ...dateFilter, status: 'submitted' } },
            {
                $bucket: {
                    groupBy: { $divide: ['$totalTimeSpent', 60000] }, // Convert to minutes
                    boundaries: [0, 15, 30, 45, 60, 90, 120, 180, Infinity],
                    default: 'Other',
                    output: {
                        count: { $sum: 1 },
                        avgScore: {
                            $avg: {
                                $avg: {
                                    $map: {
                                        input: '$tasks',
                                        as: 'task',
                                        in: '$$task.score'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        ]);
    }

    async getReviewerStats(dateFilter) {
        return await QAReview.aggregate([
            { $match: dateFilter },
            {
                $lookup: {
                    from: 'dtusers',
                    localField: 'reviewerId',
                    foreignField: '_id',
                    as: 'reviewer'
                }
            },
            { $unwind: '$reviewer' },
            {
                $group: {
                    _id: '$reviewerId',
                    reviewerName: { $first: '$reviewer.fullName' },
                    totalReviews: { $sum: 1 },
                    avgReviewScore: { $avg: '$overallScore' },
                    avgReviewTime: { $avg: { $subtract: ['$completedAt', '$createdAt'] } },
                    decisions: {
                        $push: '$decision'
                    }
                }
            },
            {
                $addFields: {
                    approvals: {
                        $size: {
                            $filter: {
                                input: '$decisions',
                                cond: { $eq: ['$$this', 'Approve'] }
                            }
                        }
                    },
                    rejections: {
                        $size: {
                            $filter: {
                                input: '$decisions',
                                cond: { $eq: ['$$this', 'Reject'] }
                            }
                        }
                    },
                    revisions: {
                        $size: {
                            $filter: {
                                input: '$decisions',
                                cond: { $eq: ['$$this', 'Request Revision'] }
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    approvalRate: {
                        $cond: {
                            if: { $gt: ['$totalReviews', 0] },
                            then: { $multiply: [{ $divide: ['$approvals', '$totalReviews'] }, 100] },
                            else: 0
                        }
                    },
                    avgReviewTimeHours: { $divide: ['$avgReviewTime', 3600000] } // Convert to hours
                }
            },
            { $sort: { totalReviews: -1 } }
        ]);
    }

    async getReviewConsistency(dateFilter) {
        return await QAReview.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: '$reviewerId',
                    scores: { $push: '$overallScore' },
                    totalReviews: { $sum: 1 }
                }
            },
            {
                $addFields: {
                    avgScore: { $avg: '$scores' },
                    scoreVariance: {
                        $let: {
                            vars: {
                                mean: { $avg: '$scores' }
                            },
                            in: {
                                $avg: {
                                    $map: {
                                        input: '$scores',
                                        as: 'score',
                                        in: { $pow: [{ $subtract: ['$$score', '$$mean'] }, 2] }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    scoreStdDev: { $sqrt: '$scoreVariance' },
                    consistencyScore: {
                        $cond: {
                            if: { $gt: ['$totalReviews', 1] },
                            then: {
                                $subtract: [
                                    100,
                                    { $multiply: [{ $divide: [{ $sqrt: '$scoreVariance' }, 10] }, 10] }
                                ]
                            },
                            else: 100
                        }
                    }
                }
            },
            { $sort: { consistencyScore: -1 } }
        ]);
    }

    async getTurnaroundTimes(dateFilter) {
        return await QAReview.aggregate([
            { $match: dateFilter },
            {
                $project: {
                    turnaroundTime: { $subtract: ['$completedAt', '$createdAt'] },
                    decision: 1
                }
            },
            {
                $group: {
                    _id: '$decision',
                    avgTurnaroundTime: { $avg: '$turnaroundTime' },
                    count: { $sum: 1 }
                }
            },
            {
                $addFields: {
                    avgTurnaroundHours: { $divide: ['$avgTurnaroundTime', 3600000] }
                }
            }
        ]);
    }

    async getDailyReviewVolume(dateFilter) {
        return await QAReview.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: {
                        year: { $year: '$completedAt' },
                        month: { $month: '$completedAt' },
                        day: { $dayOfMonth: '$completedAt' }
                    },
                    totalReviews: { $sum: 1 },
                    avgScore: { $avg: '$overallScore' },
                    decisions: { $push: '$decision' }
                }
            },
            {
                $addFields: {
                    approvals: {
                        $size: {
                            $filter: {
                                input: '$decisions',
                                cond: { $eq: ['$$this', 'Approve'] }
                            }
                        }
                    }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);
    }

    async findSubmissionsForExport() {
        return await MultimediaAssessmentSubmission.find({})
            .populate('annotatorId', 'fullName email')
            .populate('assessmentId', 'title')
            .lean();
    }

    async findReelsForExport() {
        return await VideoReel.find({ isActive: true }).lean();
    }
}

module.exports = new AssessmentAnalyticsRepository();
