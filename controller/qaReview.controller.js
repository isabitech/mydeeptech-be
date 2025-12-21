const Joi = require('joi');
const MultimediaAssessmentSubmission = require('../models/multimediaAssessmentSubmission.model');
const QAReview = require('../models/qaReview.model');
const DTUser = require('../models/dtUser.model');
const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');
const emailService = require('../utils/emailService');

// Validation schemas
const reviewTaskSchema = Joi.object({
    submissionId: Joi.string().required(),
    taskIndex: Joi.number().integer().min(0).required(),
    score: Joi.number().min(0).max(10).required(),
    feedback: Joi.string().max(1000).allow('').default(''),
    qualityRating: Joi.string().valid('Excellent', 'Good', 'Fair', 'Poor').required(),
    notes: Joi.string().max(2000).allow('').default('')
});

const finalReviewSchema = Joi.object({
    submissionId: Joi.string().required(),
    overallScore: Joi.number().min(0).max(10).required(),
    overallFeedback: Joi.string().max(2000).allow('').default(''),
    decision: Joi.string().valid('Approve', 'Reject', 'Request Revision').required(),
    privateNotes: Joi.string().max(2000).allow('').default('')
});

const batchReviewSchema = Joi.object({
    submissionIds: Joi.array().items(Joi.string()).min(1).max(50).required(),
    decision: Joi.string().valid('Approve', 'Reject').required(),
    overallFeedback: Joi.string().max(1000).allow('').default('Batch processed')
});

/**
 * Get pending submissions for QA review
 */
const getPendingSubmissions = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            sortBy = 'submittedAt',
            sortOrder = 'desc',
            filterBy = 'all'
        } = req.query;

        const skip = (page - 1) * limit;
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        // Build filter query
        let matchQuery = { 
            status: 'submitted',
            finalSubmittedAt: { $exists: true } 
        };

        // Apply additional filters
        switch (filterBy) {
            case 'priority':
                matchQuery = { 
                    ...matchQuery,
                    submittedAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Older than 24 hours
                };
                break;
            case 'recent':
                matchQuery = { 
                    ...matchQuery,
                    submittedAt: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } // Within 6 hours
                };
                break;
            case 'retakes':
                matchQuery = { 
                    ...matchQuery,
                    attemptNumber: { $gt: 1 }
                };
                break;
        }

        const submissions = await MultimediaAssessmentSubmission.aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'dtusers',
                    localField: 'userId',
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
                        $subtract: ['$finalSubmittedAt', '$startedAt']
                    },
                    waitingTime: {
                        $subtract: [new Date(), '$finalSubmittedAt']
                    }
                }
            },
            {
                $project: {
                    userId: 1,
                    userName: '$user.name',
                    userEmail: '$user.email',
                    assessmentTitle: '$assessment.title',
                    submittedAt: '$finalSubmittedAt',
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
            { $limit: parseInt(limit) }
        ]);

        const totalCount = await MultimediaAssessmentSubmission.countDocuments(matchQuery);

        res.json({
            success: true,
            data: {
                submissions,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / limit),
                    totalItems: totalCount,
                    hasNext: page < Math.ceil(totalCount / limit),
                    hasPrev: page > 1
                }
            }
        });
    } catch (error) {
        console.error('Error fetching pending submissions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending submissions',
            error: error.message
        });
    }
};

/**
 * Get detailed submission for review
 */
const getSubmissionForReview = async (req, res) => {
    try {
        const { submissionId } = req.params;

        const submission = await MultimediaAssessmentSubmission.findById(submissionId)
            .populate('userId', 'name email')
            .populate('assessmentId', 'title description scoringWeights')
            .lean();

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        // Check if QA review already exists
        let qaReview = await QAReview.findOne({ submissionId }).lean();

        // Calculate metrics
        const totalScore = submission.tasks.reduce((sum, task) => sum + (task.score || 0), 0);
        const averageScore = submission.tasks.length > 0 ? totalScore / submission.tasks.length : 0;
        const completionTime = submission.finalSubmittedAt ? 
            submission.finalSubmittedAt - submission.startedAt : null;

        res.json({
            success: true,
            data: {
                submission: {
                    ...submission,
                    metrics: {
                        totalScore,
                        averageScore: Number(averageScore.toFixed(2)),
                        completionTime,
                        tasksCompleted: submission.tasks.length,
                        conversationsCreated: submission.tasks.filter(task => 
                            task.type === 'conversation' && task.conversation && task.conversation.turns.length > 0
                        ).length
                    }
                },
                qaReview,
                isReviewed: !!qaReview && qaReview.status === 'completed'
            }
        });
    } catch (error) {
        console.error('Error fetching submission for review:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch submission details',
            error: error.message
        });
    }
};

/**
 * Review and score individual task
 */
const reviewTask = async (req, res) => {
    try {
        const { error, value } = reviewTaskSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                details: error.details
            });
        }

        const { submissionId, taskIndex, score, feedback, qualityRating, notes } = value;
        const reviewerId = req.user._id;

        // Find or create QA review
        let qaReview = await QAReview.findOne({ submissionId });
        
        if (!qaReview) {
            const submission = await MultimediaAssessmentSubmission.findById(submissionId);
            if (!submission) {
                return res.status(404).json({
                    success: false,
                    message: 'Submission not found'
                });
            }

            qaReview = new QAReview({
                submissionId,
                reviewerId,
                taskReviews: []
            });
        }

        // Update or add task review
        const existingReviewIndex = qaReview.taskReviews.findIndex(
            review => review.taskIndex === taskIndex
        );

        const taskReview = {
            taskIndex,
            score,
            feedback,
            qualityRating,
            notes,
            reviewedAt: new Date()
        };

        if (existingReviewIndex >= 0) {
            qaReview.taskReviews[existingReviewIndex] = taskReview;
        } else {
            qaReview.taskReviews.push(taskReview);
        }

        qaReview.lastUpdatedAt = new Date();
        await qaReview.save();

        // Update submission with QA score for this task
        await MultimediaAssessmentSubmission.findOneAndUpdate(
            { 
                _id: submissionId,
                [`tasks.${taskIndex}`]: { $exists: true }
            },
            { 
                $set: { 
                    [`tasks.${taskIndex}.qaScore`]: score,
                    [`tasks.${taskIndex}.qaFeedback`]: feedback,
                    [`tasks.${taskIndex}.qualityRating`]: qualityRating
                }
            }
        );

        res.json({
            success: true,
            message: 'Task reviewed successfully',
            data: {
                taskReview,
                totalTasksReviewed: qaReview.taskReviews.length
            }
        });
    } catch (error) {
        console.error('Error reviewing task:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to review task',
            error: error.message
        });
    }
};

/**
 * Submit final review and decision
 */
const submitFinalReview = async (req, res) => {
    try {
        const { error, value } = finalReviewSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                details: error.details
            });
        }

        const { submissionId, overallScore, overallFeedback, decision, privateNotes } = value;
        const reviewerId = req.user._id;

        // Find QA review
        const qaReview = await QAReview.findOne({ submissionId });
        if (!qaReview) {
            return res.status(404).json({
                success: false,
                message: 'QA review not found. Please review individual tasks first.'
            });
        }

        // Find submission
        const submission = await MultimediaAssessmentSubmission.findById(submissionId)
            .populate('userId', 'name email multimediaAssessmentStatus')
            .populate('assessmentId', 'title projectId');

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        // Update QA review with final decision
        qaReview.overallScore = overallScore;
        qaReview.overallFeedback = overallFeedback;
        qaReview.decision = decision;
        qaReview.privateNotes = privateNotes;
        qaReview.status = 'completed';
        qaReview.completedAt = new Date();
        await qaReview.save();

        // Update submission status
        let newSubmissionStatus;
        let newUserStatus;

        switch (decision) {
            case 'Approve':
                newSubmissionStatus = 'approved';
                newUserStatus = 'approved';
                break;
            case 'Reject':
                newSubmissionStatus = 'rejected';
                newUserStatus = 'failed';
                break;
            case 'Request Revision':
                newSubmissionStatus = 'revision_requested';
                newUserStatus = 'pending';
                break;
        }

        // Update submission
        submission.status = newSubmissionStatus;
        submission.qaCompletedAt = new Date();
        await submission.save();

        // Update user multimedia assessment status
        if (decision === 'Approve') {
            await DTUser.findByIdAndUpdate(
                submission.userId._id,
                { 
                    multimediaAssessmentStatus: 'approved',
                    multimediaAssessmentCompletedAt: new Date()
                }
            );
        } else if (decision === 'Reject') {
            await DTUser.findByIdAndUpdate(
                submission.userId._id,
                { 
                    multimediaAssessmentStatus: 'failed',
                    multimediaAssessmentLastFailedAt: new Date()
                }
            );
        }

        // Send email notification
        try {
            await emailService.sendAssessmentResult({
                userEmail: submission.userId.email,
                userName: submission.userId.name,
                assessmentTitle: submission.assessmentId.title,
                decision,
                overallScore,
                feedback: overallFeedback,
                canRetake: decision === 'Reject'
            });
        } catch (emailError) {
            console.error('Failed to send assessment result email:', emailError);
        }

        res.json({
            success: true,
            message: `Assessment ${decision.toLowerCase()}d successfully`,
            data: {
                decision,
                overallScore,
                submissionStatus: newSubmissionStatus,
                userStatus: newUserStatus,
                emailSent: true
            }
        });
    } catch (error) {
        console.error('Error submitting final review:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit final review',
            error: error.message
        });
    }
};

/**
 * Get QA reviewer dashboard statistics
 */
const getReviewerDashboard = async (req, res) => {
    try {
        const reviewerId = req.user._id;

        // Get reviewer statistics
        const stats = await QAReview.aggregate([
            { $match: { reviewerId } },
            {
                $group: {
                    _id: '$decision',
                    count: { $sum: 1 },
                    avgScore: { $avg: '$overallScore' }
                }
            }
        ]);

        // Get recent reviews
        const recentReviews = await QAReview.find({ reviewerId })
            .populate({
                path: 'submissionId',
                populate: [
                    { path: 'userId', select: 'name email' },
                    { path: 'assessmentId', select: 'title' }
                ]
            })
            .sort({ completedAt: -1 })
            .limit(10)
            .lean();

        // Get pending review count
        const pendingCount = await MultimediaAssessmentSubmission.countDocuments({
            status: 'submitted',
            finalSubmittedAt: { $exists: true }
        });

        // Calculate reviewer metrics
        const totalReviews = stats.reduce((sum, stat) => sum + stat.count, 0);
        const approvalRate = totalReviews > 0 ? 
            (stats.find(s => s._id === 'Approve')?.count || 0) / totalReviews * 100 : 0;

        res.json({
            success: true,
            data: {
                statistics: {
                    totalReviews,
                    approvalRate: Number(approvalRate.toFixed(1)),
                    pendingReviews: pendingCount,
                    decisionBreakdown: stats
                },
                recentReviews: recentReviews.map(review => ({
                    submissionId: review.submissionId._id,
                    userName: review.submissionId.userId.name,
                    assessmentTitle: review.submissionId.assessmentId.title,
                    decision: review.decision,
                    overallScore: review.overallScore,
                    completedAt: review.completedAt
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching reviewer dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data',
            error: error.message
        });
    }
};

/**
 * Batch process multiple submissions
 */
const batchReviewSubmissions = async (req, res) => {
    try {
        const { error, value } = batchReviewSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                details: error.details
            });
        }

        const { submissionIds, decision, overallFeedback } = value;
        const reviewerId = req.user._id;

        const results = {
            processed: 0,
            failed: 0,
            errors: []
        };

        for (const submissionId of submissionIds) {
            try {
                // Find or create QA review
                let qaReview = await QAReview.findOne({ submissionId });
                
                if (!qaReview) {
                    qaReview = new QAReview({
                        submissionId,
                        reviewerId,
                        taskReviews: []
                    });
                }

                // Set batch review decision
                qaReview.overallScore = decision === 'Approve' ? 8.0 : 3.0; // Default scores
                qaReview.overallFeedback = overallFeedback;
                qaReview.decision = decision;
                qaReview.status = 'completed';
                qaReview.completedAt = new Date();
                qaReview.isBatchProcessed = true;
                await qaReview.save();

                // Update submission
                const newStatus = decision === 'Approve' ? 'approved' : 'rejected';
                await MultimediaAssessmentSubmission.findByIdAndUpdate(submissionId, {
                    status: newStatus,
                    qaCompletedAt: new Date()
                });

                // Update user status
                const submission = await MultimediaAssessmentSubmission.findById(submissionId);
                if (submission) {
                    const newUserStatus = decision === 'Approve' ? 'approved' : 'failed';
                    await DTUser.findByIdAndUpdate(submission.userId, {
                        multimediaAssessmentStatus: newUserStatus
                    });
                }

                results.processed++;
            } catch (itemError) {
                results.failed++;
                results.errors.push({
                    submissionId,
                    error: itemError.message
                });
            }
        }

        res.json({
            success: true,
            message: `Batch processing completed. ${results.processed} processed, ${results.failed} failed.`,
            data: results
        });
    } catch (error) {
        console.error('Error in batch review:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process batch review',
            error: error.message
        });
    }
};

/**
 * Get submission analytics for admin
 */
const getSubmissionAnalytics = async (req, res) => {
    try {
        const { 
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            endDate = new Date()
        } = req.query;

        // Overall statistics
        const overallStats = await MultimediaAssessmentSubmission.aggregate([
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
                                if: '$finalSubmittedAt',
                                then: { $subtract: ['$finalSubmittedAt', '$startedAt'] },
                                else: null
                            }
                        }
                    }
                }
            }
        ]);

        // Daily submission trend
        const dailyTrend = await MultimediaAssessmentSubmission.aggregate([
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

        // QA review statistics
        const qaStats = await QAReview.aggregate([
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

        res.json({
            success: true,
            data: {
                overallStats,
                dailyTrend,
                qaStats,
                dateRange: {
                    startDate,
                    endDate
                }
            }
        });
    } catch (error) {
        console.error('Error fetching submission analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics',
            error: error.message
        });
    }
};

module.exports = {
    getPendingSubmissions,
    getSubmissionForReview,
    reviewTask,
    submitFinalReview,
    getReviewerDashboard,
    batchReviewSubmissions,
    getSubmissionAnalytics
};