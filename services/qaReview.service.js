import MultimediaAssessmentSubmission from '../models/multimediaAssessmentSubmission.model.js';
import QAReview from '../models/qaReview.model.js';
import DTUser from '../models/dtUser.model.js';
import { NotFoundError, ValidationError } from '../utils/responseHandler.js';
import mongoose from 'mongoose';

/**
 * Service for managing Quality Assurance (QA) reviews of multimedia assessments.
 * Coordinates individual task auditing, final approval/rejection workflows, and batch review capabilities.
 */
class QAReviewService {
    async getRejectedSubmissions(query) {
        const { page = 1, limit = 20, sortBy = 'submittedAt', sortOrder = 'desc', filterBy = 'all' } = query;
        const skip = (page - 1) * limit;
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        // Define criteria for rejected submissions with optional sub-filters
        let matchQuery = { status: 'rejected' };
        switch (filterBy) {
            case 'recent':
                matchQuery.qaCompletedAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
                break;
            case 'low_score':
                matchQuery.totalScore = { $lt: 60 };
                break;
            case 'retakes':
                matchQuery.attemptNumber = { $gt: 1 };
                break;
        }

        // Execute aggregation to join submissions with users, configs, and their corresponding QA reviews
        const submissions = await MultimediaAssessmentSubmission.aggregate([
            { $match: matchQuery },
            { $lookup: { from: 'dtusers', localField: 'annotatorId', foreignField: '_id', as: 'user' } },
            { $unwind: '$user' },
            { $lookup: { from: 'multimediaassessmentconfigs', localField: 'assessmentId', foreignField: '_id', as: 'assessment' } },
            { $unwind: '$assessment' },
            { $lookup: { from: 'qareviews', localField: '_id', foreignField: 'submissionId', as: 'qaReview' } },
            {
                $addFields: {
                    avgScore: {
                        $cond: {
                            if: { $gt: [{ $size: '$tasks' }, 0] },
                            then: { $avg: { $map: { input: '$tasks', as: 'task', in: '$$task.score' } } },
                            else: 0
                        }
                    },
                    qaReviewer: { $arrayElemAt: ['$qaReview.reviewerId', 0] },
                    qaScore: { $arrayElemAt: ['$qaReview.overallScore', 0] },
                    qaDecision: { $arrayElemAt: ['$qaReview.decision', 0] },
                    qaCompletedAt: { $arrayElemAt: ['$qaReview.completedAt', 0] },
                    qaFeedback: { $arrayElemAt: ['$qaReview.overallFeedback', 0] }
                }
            },
            { $lookup: { from: 'dtusers', localField: 'qaReviewer', foreignField: '_id', as: 'reviewer' } },
            {
                $project: {
                    annotatorId: 1,
                    userName: '$user.fullName',
                    userEmail: '$user.email',
                    assessmentTitle: '$assessment.title',
                    submittedAt: '$submittedAt',
                    avgScore: 1,
                    qaScore: 1,
                    qaDecision: 1,
                    qaCompletedAt: 1,
                    qaReviewer: { $arrayElemAt: ['$reviewer.fullName', 0] },
                    qaFeedback: 1,
                    attemptNumber: 1,
                    tasksCompleted: { $size: '$tasks' },
                    totalTasks: '$assessment.numberOfTasks',
                    status: 1,
                    totalScore: 1
                }
            },
            { $sort: sort },
            { $skip: skip },
            { $limit: parseInt(limit) }
        ]);

        const totalCount = await MultimediaAssessmentSubmission.countDocuments(matchQuery);
        return {
            submissions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalItems: totalCount,
                hasNext: page < Math.ceil(totalCount / limit),
                hasPrev: page > 1
            }
        };
    }
    async getPendingSubmissions(query) {
        const { page = 1, limit = 20, sortBy = 'submittedAt', sortOrder = 'desc', filterBy = 'all' } = query;
        const skip = (page - 1) * limit;
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        let matchQuery = { status: 'submitted', submittedAt: { $exists: true, $ne: null } };

        switch (filterBy) {
            case 'priority':
                matchQuery.submittedAt = { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
                break;
            case 'recent':
                matchQuery.submittedAt = { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) };
                break;
            case 'retakes':
                matchQuery.attemptNumber = { $gt: 1 };
                break;
        }

        const submissions = await MultimediaAssessmentSubmission.aggregate([
            { $match: matchQuery },
            { $lookup: { from: 'dtusers', localField: 'annotatorId', foreignField: '_id', as: 'user' } },
            { $unwind: '$user' },
            { $lookup: { from: 'multimediaassessmentconfigs', localField: 'assessmentId', foreignField: '_id', as: 'assessment' } },
            { $unwind: '$assessment' },
            {
                $addFields: {
                    avgScore: { $cond: { if: { $gt: [{ $size: '$tasks' }, 0] }, then: { $avg: { $map: { input: '$tasks', as: 'task', in: '$$task.score' } } }, else: 0 } },
                    completionTime: { $subtract: ['$submittedAt', '$createdAt'] },
                    waitingTime: { $subtract: [new Date(), '$submittedAt'] }
                }
            },
            {
                $project: {
                    annotatorId: 1, userName: '$user.fullName', userEmail: '$user.email',
                    assessmentTitle: '$assessment.title', submittedAt: 1, avgScore: 1,
                    completionTime: 1, waitingTime: 1, attemptNumber: 1,
                    tasksCompleted: { $size: '$tasks' }, totalTasks: '$assessment.numberOfTasks', status: 1
                }
            },
            { $sort: sort },
            { $skip: skip },
            { $limit: parseInt(limit) }
        ]);

        const totalCount = await MultimediaAssessmentSubmission.countDocuments(matchQuery);
        return {
            submissions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalItems: totalCount,
                hasNext: page < Math.ceil(totalCount / limit),
                hasPrev: page > 1
            }
        };
    }

    async getSubmissionForReview(submissionId) {
        const submission = await MultimediaAssessmentSubmission.findById(submissionId)
            .populate('annotatorId', 'fullName email')
            .populate('assessmentId', 'title description scoringWeights')
            .lean();

        if (!submission) throw new NotFoundError('Submission not found');

        const qaReview = await QAReview.findOne({ submissionId }).lean();
        const totalScore = submission.tasks.reduce((sum, task) => sum + (task.score || 0), 0);
        const averageScore = submission.tasks.length > 0 ? totalScore / submission.tasks.length : 0;
        const completionTime = submission.submittedAt ? submission.submittedAt - submission.createdAt : null;

        return {
            submission: {
                ...submission,
                metrics: {
                    totalScore, averageScore: Number(averageScore.toFixed(2)),
                    completionTime, tasksCompleted: submission.tasks.length,
                    conversationsCreated: submission.tasks.filter(task =>
                        task.type === 'conversation' && task.conversation && task.conversation.turns.length > 0
                    ).length
                }
            },
            qaReview,
            isReviewed: !!qaReview && qaReview.status === 'completed'
        };
    }

    async reviewTask(reviewerId, data) {
        const { submissionId, taskIndex, score, feedback, qualityRating } = data;

        // Ensure reviewerId exists
        if (!reviewerId) reviewerId = new mongoose.Types.ObjectId('000000000000000000000001');

        let qaReview = await QAReview.findOne({ submissionId });

        if (!qaReview) {
            const submission = await MultimediaAssessmentSubmission.findById(submissionId);
            if (!submission) throw new NotFoundError('Submission not found');

            qaReview = new QAReview({
                submissionId, reviewerId, taskScores: [], overallScore: 0,
                decision: 'Approve', feedback: '', reviewTime: 5
            });
        }

        const taskReview = {
            taskNumber: taskIndex + 1,
            scores: {
                conversationQuality: Math.round((score / 10) * 20),
                videoSegmentation: Math.round((score / 10) * 20),
                promptRelevance: Math.round((score / 10) * 20),
                creativityAndCoherence: Math.round((score / 10) * 20),
                technicalExecution: Math.round((score / 10) * 20)
            },
            individualFeedback: feedback || '',
            totalScore: score * 10
        };

        const existingReviewIndex = qaReview.taskScores.findIndex(r => r.taskNumber === (taskIndex + 1));
        if (existingReviewIndex >= 0) qaReview.taskScores[existingReviewIndex] = taskReview;
        else qaReview.taskScores.push(taskReview);

        if (qaReview.taskScores.length > 0) {
            const totalScore = qaReview.taskScores.reduce((sum, task) => sum + task.totalScore, 0);
            qaReview.overallScore = Math.round(totalScore / qaReview.taskScores.length);
        }

        if (!qaReview.feedback) qaReview.feedback = `Task ${taskIndex + 1} reviewed`;

        await qaReview.save();

        await MultimediaAssessmentSubmission.findOneAndUpdate(
            { _id: submissionId, [`tasks.${taskIndex}`]: { $exists: true } },
            { $set: { [`tasks.${taskIndex}.qaScore`]: score, [`tasks.${taskIndex}.qaFeedback`]: feedback, [`tasks.${taskIndex}.qualityRating`]: qualityRating } }
        );

        return { taskReview, totalTasksReviewed: qaReview.taskScores.length, overallScore: qaReview.overallScore };
    }

    /**
     * Finalizes the review for an entire submission.
     * Updates submission status and the user's multimedia assessment status based on the decision.
     */
    async submitFinalReview(reviewerId, data) {
        const { submissionId, overallScore, overallFeedback, decision, privateNotes } = data;

        // Ensure a prerequisite task-by-task review has already been initiated
        const qaReview = await QAReview.findOne({ submissionId });
        if (!qaReview) throw new ValidationError('QA review not found. Please review individual tasks first.');

        const submission = await MultimediaAssessmentSubmission.findById(submissionId)
            .populate('annotatorId', 'fullName email multimediaAssessmentStatus')
            .populate('assessmentId', 'title projectId');

        if (!submission) throw new NotFoundError('Submission not found');

        // Update the QA record with the final verdict and administrative metadata
        qaReview.overallScore = overallScore;
        qaReview.overallFeedback = overallFeedback;
        qaReview.decision = decision;
        qaReview.privateNotes = privateNotes;
        qaReview.status = 'completed';
        qaReview.completedAt = new Date();
        await qaReview.save();

        // Map the QA decision to the internal submission status (Approved/Rejected/Revision)
        let newSubmissionStatus = decision === 'Approve' ? 'approved' : decision === 'Reject' ? 'rejected' : 'revision_requested';
        submission.status = newSubmissionStatus;
        submission.qaCompletedAt = new Date();
        await submission.save();

        // Synchronize the outcome back to the user's profile to affect eligibility
        if (decision === 'Approve') {
            await DTUser.findByIdAndUpdate(submission.annotatorId._id, { multimediaAssessmentStatus: 'approved', multimediaAssessmentCompletedAt: new Date() });
        } else if (decision === 'Reject') {
            await DTUser.findByIdAndUpdate(submission.annotatorId._id, { multimediaAssessmentStatus: 'failed', multimediaAssessmentLastFailedAt: new Date() });
        }

        return { decision, overallScore, submissionStatus: newSubmissionStatus };
    }

    async getReviewerDashboard(reviewerId) {
        const stats = await QAReview.aggregate([
            { $match: { reviewerId: new mongoose.Types.ObjectId(reviewerId) } },
            { $group: { _id: '$decision', count: { $sum: 1 }, avgScore: { $avg: '$overallScore' } } }
        ]);

        const recentReviews = await QAReview.find({ reviewerId })
            .populate({ path: 'submissionId', populate: [{ path: 'annotatorId', select: 'fullName email' }, { path: 'assessmentId', select: 'title' }] })
            .sort({ completedAt: -1 })
            .limit(10)
            .lean();

        const pendingCount = await MultimediaAssessmentSubmission.countDocuments({ status: 'submitted', submittedAt: { $exists: true, $ne: null } });
        const totalReviews = stats.reduce((sum, stat) => sum + stat.count, 0);
        const approvalRate = totalReviews > 0 ? (stats.find(s => s._id === 'Approve')?.count || 0) / totalReviews * 100 : 0;

        return {
            statistics: { totalReviews, approvalRate: Number(approvalRate.toFixed(1)), pendingReviews: pendingCount, decisionBreakdown: stats },
            recentReviews: recentReviews.map(review => ({
                submissionId: review.submissionId?._id,
                userName: review.submissionId?.annotatorId?.fullName,
                assessmentTitle: review.submissionId?.assessmentId?.title,
                decision: review.decision,
                overallScore: review.overallScore,
                completedAt: review.completedAt
            }))
        };
    }

    async batchReview(reviewerId, data) {
        const { submissionIds, decision, overallFeedback } = data;
        const results = { processed: 0, failed: 0, errors: [] };

        for (const submissionId of submissionIds) {
            try {
                let qaReview = await QAReview.findOne({ submissionId });
                if (!qaReview) {
                    qaReview = new QAReview({
                        submissionId, reviewerId, taskScores: [], overallScore: decision === 'Approve' ? 80 : 30,
                        decision, feedback: overallFeedback || 'Batch processed', reviewTime: 5
                    });
                }

                qaReview.decision = decision;
                qaReview.status = 'completed';
                qaReview.completedAt = new Date();
                qaReview.isBatchProcessed = true;
                await qaReview.save();

                await MultimediaAssessmentSubmission.findByIdAndUpdate(submissionId, { status: decision === 'Approve' ? 'approved' : 'rejected', qaCompletedAt: new Date() });

                const submission = await MultimediaAssessmentSubmission.findById(submissionId);
                if (submission) {
                    await DTUser.findByIdAndUpdate(submission.annotatorId, { multimediaAssessmentStatus: decision === 'Approve' ? 'approved' : 'failed' });
                }
                results.processed++;
            } catch (err) {
                results.failed++;
                results.errors.push({ submissionId, error: err.message });
            }
        }
        return results;
    }

    async getAnalytics(query) {
        const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = query;
        const overallStats = await MultimediaAssessmentSubmission.aggregate([
            { $match: { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } } },
            { $group: { _id: '$status', count: { $sum: 1 }, avgCompletionTime: { $avg: { $cond: { if: '$submittedAt', then: { $subtract: ['$submittedAt', '$createdAt'] }, else: null } } } } }
        ]);

        const dailyTrend = await MultimediaAssessmentSubmission.aggregate([
            { $match: { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } } },
            { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } }, submissions: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } } } },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        const qaStats = await QAReview.aggregate([
            { $match: { completedAt: { $gte: new Date(startDate), $lte: new Date(endDate) } } },
            { $group: { _id: '$decision', count: { $sum: 1 }, avgScore: { $avg: '$overallScore' } } }
        ]);

        return { overallStats, dailyTrend, qaStats, dateRange: { startDate, endDate } };
    }

    async getApprovedSubmissions(query) {
        const { page = 1, limit = 20, sortBy = 'submittedAt', sortOrder = 'desc', filterBy = 'all' } = query;
        const skip = (page - 1) * limit;
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        let matchQuery = { status: 'approved' };
        switch (filterBy) {
            case 'recent': matchQuery.qaCompletedAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }; break;
            case 'high_score': matchQuery.totalScore = { $gte: 80 }; break;
            case 'retakes': matchQuery.attemptNumber = { $gt: 1 }; break;
        }

        const submissions = await MultimediaAssessmentSubmission.aggregate([
            { $match: matchQuery },
            { $lookup: { from: 'dtusers', localField: 'annotatorId', foreignField: '_id', as: 'user' } },
            { $unwind: '$user' },
            { $lookup: { from: 'multimediaassessmentconfigs', localField: 'assessmentId', foreignField: '_id', as: 'assessment' } },
            { $unwind: '$assessment' },
            { $project: { annotatorId: 1, userName: '$user.fullName', userEmail: '$user.email', assessmentTitle: '$assessment.title', submittedAt: 1, totalScore: 1, attemptNumber: 1, status: 1 } },
            { $sort: sort }, { $skip: skip }, { $limit: parseInt(limit) }
        ]);

        const totalCount = await MultimediaAssessmentSubmission.countDocuments(matchQuery);
        return { submissions, pagination: { currentPage: parseInt(page), totalPages: Math.ceil(totalCount / limit), totalItems: totalCount } };
    }
}

export default new QAReviewService();
