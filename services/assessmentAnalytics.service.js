const repository = require('../repositories/assessmentAnalytics.repository');

class AssessmentAnalyticsService {
    constructor(analyticsRepository = repository) {
        this.repository = analyticsRepository;
    }

    calculateDateRange(startDate, endDate, period) {
        const now = new Date();
        const defaultStartDate = new Date();
        
        if (!startDate) {
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
                default:
                    defaultStartDate.setMonth(now.getMonth() - 1);
            }
        }

        return {
            $gte: startDate ? new Date(startDate) : defaultStartDate,
            $lte: endDate ? new Date(endDate) : now
        };
    }

    async getAssessmentDashboard(value) {
        const { startDate, endDate, period = 'month' } = value;
        const dateRange = this.calculateDateRange(startDate, endDate, period);
        const dateFilter = { createdAt: dateRange };

        const [
            submissionCounts,
            totalReviews,
            totalUsers,
            totalReels,
            submissionTrend,
            assessmentPerformance,
            qaPerformance,
            avgReviewTimeData
        ] = await Promise.all([
            this.repository.getSubmissionCounts(dateFilter),
            this.repository.getReviewCount(dateFilter),
            this.repository.getUserCount(),
            this.repository.getActiveReelsCount(),
            this.repository.getSubmissionTrend(dateFilter),
            this.repository.getAssessmentPerformance(dateFilter),
            this.repository.getQAPerformance(dateFilter),
            this.repository.getAvgReviewTime(dateFilter)
        ]);

        const [totalSubmissions, completedSubmissions, pendingReviews] = submissionCounts;
        const completionRate = totalSubmissions > 0 ? (completedSubmissions / totalSubmissions * 100) : 0;
        const avgReviewTimeHours = avgReviewTimeData.length > 0 ? 
            Math.round(avgReviewTimeData[0].avgReviewTime / (1000 * 60 * 60)) : 0;

        return {
            overview: {
                totalSubmissions,
                completedSubmissions,
                pendingReviews,
                totalReviews,
                totalUsers,
                totalReels,
                completionRate: Number(completionRate.toFixed(1)),
                avgReviewTimeHours
            },
            trends: {
                submissions: submissionTrend
            },
            assessmentPerformance,
            qaPerformance,
            period: {
                startDate: dateRange.$gte,
                endDate: dateRange.$lte,
                period
            }
        };
    }

    async getReelAnalytics(value) {
        const [
            reelUsage,
            nicheAnalytics,
            usageTrend,
            performanceByCharacteristics
        ] = await Promise.all([
            this.repository.getReelUsageStats(),
            this.repository.getNicheAnalytics(),
            this.repository.getRecentUsageTrend(),
            this.repository.getPerformanceByCharacteristics()
        ]);

        return {
            reelUsage: reelUsage.slice(0, 50),
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
        };
    }

    async getUserPerformanceAnalytics(value) {
        const { startDate, endDate, period = 'month' } = value;
        const dateRange = this.calculateDateRange(startDate, endDate, period);
        const dateFilter = { createdAt: dateRange };

        const [
            userPerformance,
            approvalRates,
            statusDistribution,
            completionTimeDistribution
        ] = await Promise.all([
            this.repository.getUserPerformance(dateFilter),
            this.repository.getApprovalRatesByUser(dateFilter),
            this.repository.getStatusDistribution(),
            this.repository.getCompletionTimeDistribution(dateFilter)
        ]);

        const approvalMap = new Map(
            approvalRates.map(item => [item._id.toString(), item])
        );

        const enhancedUserPerformance = userPerformance.map(user => ({
            ...user,
            approvalRate: approvalMap.get(user._id.toString())?.approvalRate || 0,
            totalReviews: approvalMap.get(user._id.toString())?.totalReviews || 0
        }));

        return {
            userPerformance: enhancedUserPerformance.slice(0, 100),
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
        };
    }

    async getQAAnalytics(value) {
        const { startDate, endDate, period = 'month' } = value;
        const dateRange = this.calculateDateRange(startDate, endDate, period);
        // QA metrics use completedAt for date filtering
        const dateFilter = { completedAt: dateRange };

        const [
            reviewerStats,
            reviewConsistency,
            turnaroundTimes,
            dailyReviewVolume
        ] = await Promise.all([
            this.repository.getReviewerStats(dateFilter),
            this.repository.getReviewConsistency(dateFilter),
            this.repository.getTurnaroundTimes(dateFilter),
            this.repository.getDailyReviewVolume(dateFilter)
        ]);

        return {
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
        };
    }

    async exportAnalyticsCSV(type, queryParams) {
        let csvData = [];
        let filename = `multimedia_assessment_${type}_${new Date().toISOString().split('T')[0]}.csv`;

        switch (type) {
            case 'submissions':
                const submissions = await this.repository.findSubmissionsForExport();
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
                const reels = await this.repository.findReelsForExport();
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
        }

        return { csvData, filename };
    }
}

module.exports = new AssessmentAnalyticsService();
