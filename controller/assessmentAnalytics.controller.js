const MultimediaAssessmentSubmission = require('../models/multimediaAssessmentSubmission.model');
const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');
const QAReview = require('../models/qaReview.model');
const VideoReel = require('../models/videoReel.model');
const DTUser = require('../models/dtUser.model');
const Joi = require('joi');

// Validation schemas
const analyticsQuerySchema = Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    assessmentId: Joi.string().optional(),
    projectId: Joi.string().optional(),
    period: Joi.string().valid('day', 'week', 'month', 'quarter', 'year').default('month'),
    granularity: Joi.string().valid('daily', 'weekly', 'monthly').default('daily')
});

/**
 * Get comprehensive assessment analytics dashboard
 */
const getAssessmentDashboard = async (req, res) => {
    try {
        const { error, value } = analyticsQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                details: error.details
            });
        }

        const { startDate, endDate, period = 'month' } = value;
        
        // Calculate date range
        const now = new Date();
        const defaultStartDate = new Date();
        
        switch (period) {
            case 'day':
                defaultStartDate.setDate(now.getDate() - 1);
                break;
            case 'week':
                defaultStartDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                defaultStartDate.setMonth(now.getMonth() - 1);
                break;
            case 'quarter':
                defaultStartDate.setMonth(now.getMonth() - 3);
                break;
            case 'year':
                defaultStartDate.setFullYear(now.getFullYear() - 1);
                break;
        }

        const dateFilter = {
            createdAt: {
                $gte: startDate ? new Date(startDate) : defaultStartDate,
                $lte: endDate ? new Date(endDate) : now
            }
        };

        // Get overall statistics
        const [
            totalSubmissions,
            completedSubmissions,
            pendingReviews,
            totalReviews,
            totalUsers,
            totalReels
        ] = await Promise.all([
            MultimediaAssessmentSubmission.countDocuments(dateFilter),
            MultimediaAssessmentSubmission.countDocuments({
                ...dateFilter,
                status: 'submitted'
            }),
            MultimediaAssessmentSubmission.countDocuments({
                status: 'submitted',
                finalSubmittedAt: { $exists: true }
            }),
            QAReview.countDocuments({
                completedAt: {
                    $gte: dateFilter.createdAt.$gte,
                    $lte: dateFilter.createdAt.$lte
                }
            }),
            DTUser.countDocuments({
                multimediaAssessmentStatus: { $ne: 'not_started' }
            }),
            VideoReel.countDocuments({ isActive: true })
        ]);

        // Get completion rate trend
        const submissionTrend = await MultimediaAssessmentSubmission.aggregate([
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

        // Get assessment performance by configuration
        const assessmentPerformance = await MultimediaAssessmentSubmission.aggregate([
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

        // Get QA reviewer performance
        const qaPerformance = await QAReview.aggregate([
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

        // Calculate key metrics
        const completionRate = totalSubmissions > 0 ? (completedSubmissions / totalSubmissions * 100) : 0;
        const avgReviewTime = await QAReview.aggregate([
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

        res.json({
            success: true,
            data: {
                overview: {
                    totalSubmissions,
                    completedSubmissions,
                    pendingReviews,
                    totalReviews,
                    totalUsers,
                    totalReels,
                    completionRate: Number(completionRate.toFixed(1)),
                    avgReviewTimeHours: avgReviewTime.length > 0 ? 
                        Math.round(avgReviewTime[0].avgReviewTime / (1000 * 60 * 60)) : 0
                },
                trends: {
                    submissions: submissionTrend
                },
                assessmentPerformance,
                qaPerformance,
                period: {
                    startDate: dateFilter.createdAt.$gte,
                    endDate: dateFilter.createdAt.$lte,
                    period
                }
            }
        });
    } catch (error) {
        console.error('Error fetching assessment dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch assessment analytics',
            error: error.message
        });
    }
};

/**
 * Get detailed video reel usage analytics
 */
const getReelAnalytics = async (req, res) => {
    try {
        const { error, value } = analyticsQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                details: error.details
            });
        }

        // Get reel usage statistics
        const reelUsage = await VideoReel.aggregate([
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

        // Get usage by niche
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

        // Get recent usage trend
        const usageTrend = await MultimediaAssessmentSubmission.aggregate([
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

        // Get performance by reel characteristics
        const performanceByCharacteristics = await MultimediaAssessmentSubmission.aggregate([
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

        res.json({
            success: true,
            data: {
                reelUsage: reelUsage.slice(0, 50), // Top 50 most used reels
                nicheAnalytics,
                usageTrend,
                performanceByCharacteristics,
                summary: {
                    totalActiveReels: reelUsage.length,
                    totalUsages: reelUsage.reduce((sum, reel) => sum + reel.usageCount, 0),
                    avgUsagePerReel: reelUsage.length > 0 ? 
                        reelUsage.reduce((sum, reel) => sum + reel.usageCount, 0) / reelUsage.length : 0,
                    mostPopularNiche: nicheAnalytics.length > 0 ? nicheAnalytics[0]._id : 'None'
                }
            }
        });
    } catch (error) {
        console.error('Error fetching reel analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reel analytics',
            error: error.message
        });
    }
};

/**
 * Get user performance analytics
 */
const getUserPerformanceAnalytics = async (req, res) => {
    try {
        const { error, value } = analyticsQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                details: error.details
            });
        }

        const { startDate, endDate, period = 'month' } = value;
        
        const now = new Date();
        const defaultStartDate = new Date();
        defaultStartDate.setMonth(now.getMonth() - 1);

        const dateFilter = {
            createdAt: {
                $gte: startDate ? new Date(startDate) : defaultStartDate,
                $lte: endDate ? new Date(endDate) : now
            }
        };

        // Get user performance statistics
        const userPerformance = await MultimediaAssessmentSubmission.aggregate([
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

        // Get approval rates by user
        const approvalRates = await QAReview.aggregate([
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

        // Merge approval rates with user performance
        const approvalMap = new Map(
            approvalRates.map(item => [item._id.toString(), item])
        );

        const enhancedUserPerformance = userPerformance.map(user => ({
            ...user,
            approvalRate: approvalMap.get(user._id.toString())?.approvalRate || 0,
            totalReviews: approvalMap.get(user._id.toString())?.totalReviews || 0
        }));

        // Get user status distribution
        const statusDistribution = await DTUser.aggregate([
            {
                $group: {
                    _id: '$multimediaAssessmentStatus',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get completion time distribution
        const completionTimeDistribution = await MultimediaAssessmentSubmission.aggregate([
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

        res.json({
            success: true,
            data: {
                userPerformance: enhancedUserPerformance.slice(0, 100), // Top 100 users
                statusDistribution,
                completionTimeDistribution,
                summary: {
                    totalActiveUsers: enhancedUserPerformance.length,
                    avgUserScore: enhancedUserPerformance.length > 0 ? 
                        enhancedUserPerformance.reduce((sum, user) => sum + user.avgScore, 0) / enhancedUserPerformance.length : 0,
                    avgApprovalRate: enhancedUserPerformance.length > 0 ? 
                        enhancedUserPerformance.reduce((sum, user) => sum + user.approvalRate, 0) / enhancedUserPerformance.length : 0,
                    avgCompletionTimeMinutes: enhancedUserPerformance.length > 0 ? 
                        enhancedUserPerformance.reduce((sum, user) => sum + (user.avgCompletionTime / 60000), 0) / enhancedUserPerformance.length : 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching user performance analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user performance analytics',
            error: error.message
        });
    }
};

/**
 * Get QA review performance analytics
 */
const getQAAnalytics = async (req, res) => {
    try {
        const { error, value } = analyticsQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                details: error.details
            });
        }

        const { startDate, endDate, period = 'month' } = value;
        
        const now = new Date();
        const defaultStartDate = new Date();
        defaultStartDate.setMonth(now.getMonth() - 1);

        const dateFilter = {
            completedAt: {
                $gte: startDate ? new Date(startDate) : defaultStartDate,
                $lte: endDate ? new Date(endDate) : now
            }
        };

        // Get QA reviewer statistics
        const reviewerStats = await QAReview.aggregate([
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

        // Get review quality consistency
        const reviewConsistency = await QAReview.aggregate([
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

        // Get review turnaround times
        const turnaroundTimes = await QAReview.aggregate([
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

        // Get daily review volume
        const dailyReviewVolume = await QAReview.aggregate([
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

        res.json({
            success: true,
            data: {
                reviewerStats,
                reviewConsistency,
                turnaroundTimes,
                dailyReviewVolume,
                summary: {
                    totalReviewers: reviewerStats.length,
                    totalReviews: reviewerStats.reduce((sum, reviewer) => sum + reviewer.totalReviews, 0),
                    avgApprovalRate: reviewerStats.length > 0 ? 
                        reviewerStats.reduce((sum, reviewer) => sum + reviewer.approvalRate, 0) / reviewerStats.length : 0,
                    avgReviewTimeHours: reviewerStats.length > 0 ? 
                        reviewerStats.reduce((sum, reviewer) => sum + reviewer.avgReviewTimeHours, 0) / reviewerStats.length : 0,
                    avgConsistencyScore: reviewConsistency.length > 0 ? 
                        reviewConsistency.reduce((sum, reviewer) => sum + reviewer.consistencyScore, 0) / reviewConsistency.length : 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching QA analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch QA analytics',
            error: error.message
        });
    }
};

/**
 * Export analytics data to CSV
 */
const exportAnalyticsCSV = async (req, res) => {
    try {
        const { type, ...queryParams } = req.query;
        
        if (!type || !['submissions', 'reels', 'users', 'qa'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid export type. Must be one of: submissions, reels, users, qa'
            });
        }

        let csvData = [];
        let filename = `multimedia_assessment_${type}_${new Date().toISOString().split('T')[0]}.csv`;

        switch (type) {
            case 'submissions':
                const submissions = await MultimediaAssessmentSubmission.find({})
                    .populate('annotatorId', 'fullName email')
                    .populate('assessmentId', 'title')
                    .lean();
                
                csvData = [
                    ['Submission ID', 'User Name', 'User Email', 'Assessment', 'Status', 'Score', 'Submitted At', 'Time Spent (min)'].join(','),
                    ...submissions.map(sub => [
                        `"${sub._id}"`,
                        `"${sub.annotatorId?.fullName || 'N/A'}"`,
                        `"${sub.annotatorId?.email || 'N/A'}"`,
                        `"${sub.assessmentId?.title || 'N/A'}"`,
                        `"${sub.status}"`,
                        `"${sub.tasks.length > 0 ? (sub.tasks.reduce((sum, task) => sum + (task.score || 0), 0) / sub.tasks.length).toFixed(2) : 'N/A'}"`,
                        `"${sub.finalSubmittedAt ? sub.finalSubmittedAt.toISOString() : 'N/A'}"`,
                        `"${sub.totalTimeSpent ? (sub.totalTimeSpent / 60000).toFixed(1) : 'N/A'}"`
                    ].join(','))
                ];
                break;

            case 'reels':
                const reels = await VideoReel.find({ isActive: true }).lean();
                
                csvData = [
                    ['Reel ID', 'Title', 'Niche', 'Usage Count', 'Duration', 'Aspect Ratio', 'Created At'].join(','),
                    ...reels.map(reel => [
                        `"${reel._id}"`,
                        `"${reel.title || 'Untitled'}"`,
                        `"${reel.niche}"`,
                        `"${reel.usageCount || 0}"`,
                        `"${reel.duration || 'N/A'}"`,
                        `"${reel.aspectRatio || 'N/A'}"`,
                        `"${reel.createdAt.toISOString()}"`
                    ].join(','))
                ];
                break;

            // Add more export types as needed
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvData.join('\n'));

    } catch (error) {
        console.error('Error exporting analytics CSV:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export analytics data',
            error: error.message
        });
    }
};

module.exports = {
    getAssessmentDashboard,
    getReelAnalytics,
    getUserPerformanceAnalytics,
    getQAAnalytics,
    exportAnalyticsCSV
};