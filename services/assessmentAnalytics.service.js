import MultimediaAssessmentSubmission from '../models/multimediaAssessmentSubmission.model.js';
import QAReview from '../models/qaReview.model.js';
import VideoReel from '../models/videoReel.model.js';
import DTUser from '../models/dtUser.model.js';


class AssessmentAnalyticsService {
    async getDashboard(filter) {
        const { startDate, endDate, period = 'month' } = filter;

        const now = new Date();
        const defaultStartDate = new Date();

        switch (period) {
            case 'day': defaultStartDate.setDate(now.getDate() - 1); break;
            case 'week': defaultStartDate.setDate(now.getDate() - 7); break;
            case 'month': defaultStartDate.setMonth(now.getMonth() - 1); break;
            case 'quarter': defaultStartDate.setMonth(now.getMonth() - 3); break;
            case 'year': defaultStartDate.setFullYear(now.getFullYear() - 1); break;
        }

        const dateFilter = {
            createdAt: {
                $gte: startDate ? new Date(startDate) : defaultStartDate,
                $lte: endDate ? new Date(endDate) : now
            }
        };

        const [
            totalSubmissions,
            completedSubmissions,
            pendingReviews,
            totalReviews,
            totalUsers,
            totalReels
        ] = await Promise.all([
            MultimediaAssessmentSubmission.countDocuments(dateFilter),
            MultimediaAssessmentSubmission.countDocuments({ ...dateFilter, status: 'submitted' }),
            MultimediaAssessmentSubmission.countDocuments({ status: 'submitted', finalSubmittedAt: { $exists: true } }),
            QAReview.countDocuments({
                completedAt: { $gte: dateFilter.createdAt.$gte, $lte: dateFilter.createdAt.$lte }
            }),
            DTUser.countDocuments({ multimediaAssessmentStatus: { $ne: 'not_started' } }),
            VideoReel.countDocuments({ isActive: true })
        ]);

        const submissionTrend = await MultimediaAssessmentSubmission.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } },
                    total: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        const assessmentPerformance = await MultimediaAssessmentSubmission.aggregate([
            { $match: { ...dateFilter, status: 'submitted' } },
            {
                $lookup: { from: 'multimediaassessmentconfigs', localField: 'assessmentId', foreignField: '_id', as: 'assessment' }
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
                                $map: { input: '$tasks', as: 'task', in: '$$task.score' }
                            }
                        }
                    }
                }
            },
            { $sort: { totalSubmissions: -1 } }
        ]);

        const qaPerformance = await QAReview.aggregate([
            {
                $match: {
                    completedAt: { $gte: dateFilter.createdAt.$gte, $lte: dateFilter.createdAt.$lte }
                }
            },
            {
                $lookup: { from: 'dtusers', localField: 'reviewerId', foreignField: '_id', as: 'reviewer' }
            },
            { $unwind: '$reviewer' },
            {
                $group: {
                    _id: '$reviewerId',
                    reviewerName: { $first: '$reviewer.fullName' },
                    totalReviews: { $sum: 1 },
                    avgReviewScore: { $avg: '$overallScore' },
                    approvals: { $sum: { $cond: [{ $eq: ['$decision', 'Approve'] }, 1, 0] } },
                    rejections: { $sum: { $cond: [{ $eq: ['$decision', 'Reject'] }, 1, 0] } }
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

        const completionRate = totalSubmissions > 0 ? (completedSubmissions / totalSubmissions * 100) : 0;
        const avgReviewTime = await QAReview.aggregate([
            {
                $match: {
                    completedAt: { $gte: dateFilter.createdAt.$gte, $lte: dateFilter.createdAt.$lte }
                }
            },
            { $project: { reviewTime: { $subtract: ['$completedAt', '$createdAt'] } } },
            { $group: { _id: null, avgReviewTime: { $avg: '$reviewTime' } } }
        ]);

        return {
            overview: {
                totalSubmissions,
                completedSubmissions,
                pendingReviews,
                totalReviews,
                totalUsers,
                totalReels,
                completionRate: Number(completionRate.toFixed(1)),
                avgReviewTimeHours: avgReviewTime.length > 0 ? Math.round(avgReviewTime[0].avgReviewTime / (1000 * 60 * 60)) : 0
            },
            trends: { submissions: submissionTrend },
            assessmentPerformance,
            qaPerformance,
            period: { startDate: dateFilter.createdAt.$gte, endDate: dateFilter.createdAt.$lte, period }
        };
    }

    async getReelAnalytics() {
        const reelUsage = await VideoReel.aggregate([
            { $match: { isActive: true } },
            {
                $project: {
                    title: 1, niche: 1, usageCount: 1, createdAt: 1, duration: 1, aspectRatio: 1,
                    usageRate: {
                        $cond: {
                            if: { $gt: [{ $dateDiff: { startDate: '$createdAt', endDate: new Date(), unit: 'day' } }, 0] },
                            then: { $divide: ['$usageCount', { $dateDiff: { startDate: '$createdAt', endDate: new Date(), unit: 'day' } }] },
                            else: '$usageCount'
                        }
                    }
                }
            },
            { $sort: { usageCount: -1 } }
        ]);

        const nicheAnalytics = await VideoReel.aggregate([
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

        const usageTrend = await MultimediaAssessmentSubmission.aggregate([
            { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
            { $unwind: '$tasks' },
            { $unwind: '$tasks.selectedReels' },
            {
                $group: {
                    _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } },
                    reelUsages: { $sum: 1 },
                    uniqueReels: { $addToSet: '$tasks.selectedReels.reelId' }
                }
            },
            { $addFields: { uniqueReelCount: { $size: '$uniqueReels' } } },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        const performanceByCharacteristics = await MultimediaAssessmentSubmission.aggregate([
            { $match: { status: 'submitted' } },
            { $unwind: '$tasks' },
            { $unwind: '$tasks.selectedReels' },
            {
                $lookup: { from: 'videoreels', localField: 'tasks.selectedReels.reelId', foreignField: '_id', as: 'reel' }
            },
            { $unwind: '$reel' },
            {
                $group: {
                    _id: { niche: '$reel.niche', aspectRatio: '$reel.aspectRatio' },
                    avgTaskScore: { $avg: '$tasks.score' },
                    usageCount: { $sum: 1 },
                    avgCompletionTime: { $avg: '$tasks.timeSpent' }
                }
            },
            { $sort: { avgTaskScore: -1 } }
        ]);

        return {
            reelUsage: reelUsage.slice(0, 50),
            nicheAnalytics,
            usageTrend,
            performanceByCharacteristics,
            summary: {
                totalActiveReels: reelUsage.length,
                totalUsages: reelUsage.reduce((sum, reel) => sum + reel.usageCount, 0),
                avgUsagePerReel: reelUsage.length > 0 ? reelUsage.reduce((sum, reel) => sum + reel.usageCount, 0) / reelUsage.length : 0,
                mostPopularNiche: nicheAnalytics.length > 0 ? nicheAnalytics[0]._id : 'None'
            }
        };
    }

    async getUserPerformance(filter) {
        const { startDate, endDate } = filter;
        const now = new Date();
        const defaultStartDate = new Date();
        defaultStartDate.setMonth(now.getMonth() - 1);

        const dateFilter = {
            createdAt: {
                $gte: startDate ? new Date(startDate) : defaultStartDate,
                $lte: endDate ? new Date(endDate) : now
            }
        };

        const userPerformance = await MultimediaAssessmentSubmission.aggregate([
            { $match: { ...dateFilter, status: 'submitted' } },
            {
                $lookup: { from: 'dtusers', localField: 'annotatorId', foreignField: '_id', as: 'user' }
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
                                $map: { input: '$tasks', as: 'task', in: '$$task.score' }
                            }
                        }
                    },
                    avgCompletionTime: { $avg: '$totalTimeSpent' },
                    totalTasksCompleted: { $sum: { $size: '$tasks' } }
                }
            },
            { $sort: { avgScore: -1 } }
        ]);

        const approvalRates = await QAReview.aggregate([
            {
                $match: {
                    completedAt: { $gte: dateFilter.createdAt.$gte, $lte: dateFilter.createdAt.$lte }
                }
            },
            {
                $lookup: { from: 'multimediaassessmentsubmissions', localField: 'submissionId', foreignField: '_id', as: 'submission' }
            },
            { $unwind: '$submission' },
            {
                $group: {
                    _id: '$submission.annotatorId',
                    totalReviews: { $sum: 1 },
                    approvals: { $sum: { $cond: [{ $eq: ['$decision', 'Approve'] }, 1, 0] } }
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

        const approvalMap = new Map(approvalRates.map(item => [item._id.toString(), item]));

        const enhancedUserPerformance = userPerformance.map(user => ({
            ...user,
            approvalRate: approvalMap.get(user._id.toString())?.approvalRate || 0,
            totalReviews: approvalMap.get(user._id.toString())?.totalReviews || 0
        }));

        const statusDistribution = await DTUser.aggregate([
            { $group: { _id: '$multimediaAssessmentStatus', count: { $sum: 1 } } }
        ]);

        const completionTimeDistribution = await MultimediaAssessmentSubmission.aggregate([
            { $match: { ...dateFilter, status: 'submitted' } },
            {
                $bucket: {
                    groupBy: { $divide: ['$totalTimeSpent', 60000] },
                    boundaries: [0, 15, 30, 45, 60, 90, 120, 180, Infinity],
                    default: 'Other',
                    output: {
                        count: { $sum: 1 },
                        avgScore: {
                            $avg: {
                                $avg: {
                                    $map: { input: '$tasks', as: 'task', in: '$$task.score' }
                                }
                            }
                        }
                    }
                }
            }
        ]);

        return {
            userPerformance: enhancedUserPerformance.slice(0, 100),
            statusDistribution,
            completionTimeDistribution,
            summary: {
                totalActiveUsers: enhancedUserPerformance.length,
                avgUserScore: enhancedUserPerformance.length > 0 ? enhancedUserPerformance.reduce((sum, user) => sum + user.avgScore, 0) / enhancedUserPerformance.length : 0,
                avgApprovalRate: enhancedUserPerformance.length > 0 ? enhancedUserPerformance.reduce((sum, user) => sum + user.approvalRate, 0) / enhancedUserPerformance.length : 0,
                avgCompletionTimeMinutes: enhancedUserPerformance.length > 0 ? enhancedUserPerformance.reduce((sum, user) => sum + (user.avgCompletionTime / 60000), 0) / enhancedUserPerformance.length : 0
            }
        };
    }

    async getQAAnalytics(filter) {
        const { startDate, endDate } = filter;
        const now = new Date();
        const defaultStartDate = new Date();
        defaultStartDate.setMonth(now.getMonth() - 1);

        const dateFilter = {
            completedAt: {
                $gte: startDate ? new Date(startDate) : defaultStartDate,
                $lte: endDate ? new Date(endDate) : now
            }
        };

        const reviewerStats = await QAReview.aggregate([
            { $match: dateFilter },
            {
                $lookup: { from: 'dtusers', localField: 'reviewerId', foreignField: '_id', as: 'reviewer' }
            },
            { $unwind: '$reviewer' },
            {
                $group: {
                    _id: '$reviewerId',
                    reviewerName: { $first: '$reviewer.fullName' },
                    totalReviews: { $sum: 1 },
                    avgReviewScore: { $avg: '$overallScore' },
                    avgReviewTime: { $avg: { $subtract: ['$completedAt', '$createdAt'] } },
                    decisions: { $push: '$decision' }
                }
            },
            {
                $addFields: {
                    approvals: { $size: { $filter: { input: '$decisions', cond: { $eq: ['$$this', 'Approve'] } } } },
                    rejections: { $size: { $filter: { input: '$decisions', cond: { $eq: ['$$this', 'Reject'] } } } },
                    revisions: { $size: { $filter: { input: '$decisions', cond: { $eq: ['$$this', 'Request Revision'] } } } }
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
                    avgReviewTimeHours: { $divide: ['$avgReviewTime', 3600000] }
                }
            },
            { $sort: { totalReviews: -1 } }
        ]);

        const reviewConsistency = await QAReview.aggregate([
            { $match: dateFilter },
            {
                $group: { _id: '$reviewerId', scores: { $push: '$overallScore' }, totalReviews: { $sum: 1 } }
            },
            {
                $addFields: {
                    avgScore: { $avg: '$scores' },
                    scoreVariance: {
                        $let: {
                            vars: { mean: { $avg: '$scores' } },
                            in: {
                                $avg: {
                                    $map: { input: '$scores', as: 'score', in: { $pow: [{ $subtract: ['$$score', '$$mean'] }, 2] } }
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
                            then: { $subtract: [100, { $multiply: [{ $divide: [{ $sqrt: '$scoreVariance' }, 10] }, 10] }] },
                            else: 100
                        }
                    }
                }
            },
            { $sort: { consistencyScore: -1 } }
        ]);

        const turnaroundTimes = await QAReview.aggregate([
            { $match: dateFilter },
            { $project: { turnaroundTime: { $subtract: ['$completedAt', '$createdAt'] }, decision: 1 } },
            { $group: { _id: '$decision', avgTurnaroundTime: { $avg: '$turnaroundTime' }, count: { $sum: 1 } } },
            { $addFields: { avgTurnaroundHours: { $divide: ['$avgTurnaroundTime', 3600000] } } }
        ]);

        const dailyReviewVolume = await QAReview.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: { year: { $year: '$completedAt' }, month: { $month: '$completedAt' }, day: { $dayOfMonth: '$completedAt' } },
                    totalReviews: { $sum: 1 },
                    avgScore: { $avg: '$overallScore' },
                    decisions: { $push: '$decision' }
                }
            },
            {
                $addFields: {
                    approvals: { $size: { $filter: { input: '$decisions', cond: { $eq: ['$$this', 'Approve'] } } } }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        return {
            reviewerStats,
            reviewConsistency,
            turnaroundTimes,
            dailyReviewVolume,
            summary: {
                totalReviewers: reviewerStats.length,
                totalReviews: reviewerStats.reduce((sum, reviewer) => sum + reviewer.totalReviews, 0),
                avgApprovalRate: reviewerStats.length > 0 ? reviewerStats.reduce((sum, reviewer) => sum + reviewer.approvalRate, 0) / reviewerStats.length : 0,
                avgReviewTimeHours: reviewerStats.length > 0 ? reviewerStats.reduce((sum, reviewer) => sum + reviewer.avgReviewTimeHours, 0) / reviewerStats.length : 0,
                avgConsistencyScore: reviewConsistency.length > 0 ? reviewConsistency.reduce((sum, reviewer) => sum + reviewer.consistencyScore, 0) / reviewConsistency.length : 0
            }
        };
    }
}

export default new AssessmentAnalyticsService();
