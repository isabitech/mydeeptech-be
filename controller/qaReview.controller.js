const Joi = require('joi');
const mongoose = require('mongoose');
const MultimediaAssessmentSubmission = require('../models/multimediaAssessmentSubmission.model');
const QAReview = require('../models/qaReview.model');
const DTUser = require('../models/dtUser.model');
const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');
const ProjectApplication = require('../models/projectApplication.model');
const emailService = require('../utils/emailService');

// Validation schemas
const reviewTaskSchema = Joi.object({
    submissionId: Joi.string().required(),
    taskIndex: Joi.number().integer().min(0).required(),
    score: Joi.number().min(0).max(10).required(),
    feedback: Joi.string().max(1000).allow('').default(''),
    qualityRating: Joi.string().valid('Excellent', 'Good', 'Fair', 'Poor').default('Good'),
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
        // Check if user has QA reviewer permissions (qaStatus === 'approved')
        const userQAStatus = req.user?.userDoc?.qaStatus;
        const isAdmin = req.user?.userDoc?.isAdmin;
        const isQAReviewer = isAdmin || userQAStatus === 'approved';
        
        if (!isQAReviewer) {
            console.log('❌ QA Access denied for user:', req.user?.email, 'QA Status:', userQAStatus);
            return res.status(403).json({
                success: false,
                message: 'Access denied. QA reviewer permissions required.',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        console.log('🔍 QA: Fetching pending submissions for user:', req.user?.email);

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
            submittedAt: { $exists: true, $ne: null } 
        };

        console.log('📋 Base query:', matchQuery);

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

        console.log('🔍 Final query with filters:', matchQuery);

        // First, let's check if there are any matching documents
        const matchCount = await MultimediaAssessmentSubmission.countDocuments(matchQuery);
        console.log(`📊 Found ${matchCount} submissions matching query`);

        if (matchCount === 0) {
            console.log('⚠️  No submissions found with the specified criteria');
            
            // Let's check what data is available
            const totalSubmissions = await MultimediaAssessmentSubmission.countDocuments();
            const submittedCount = await MultimediaAssessmentSubmission.countDocuments({ status: 'submitted' });
            
            console.log(`📈 Debug info - Total: ${totalSubmissions}, Submitted: ${submittedCount}`);
            
            return res.json({
                success: true,
                data: {
                    submissions: [],
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: 0,
                        totalItems: 0,
                        hasNext: false,
                        hasPrev: false
                    },
                    debug: {
                        queryUsed: matchQuery,
                        totalSubmissionsInDB: totalSubmissions,
                        submittedSubmissionsInDB: submittedCount,
                        message: 'No submissions match the current criteria'
                    }
                }
            });
        }

        const submissions = await MultimediaAssessmentSubmission.aggregate([
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

        console.log(`✅ Aggregation completed, returned ${submissions.length} submissions`);

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
        // Check if user has QA reviewer permissions (qaStatus === 'approved')
        const userQAStatus = req.user?.userDoc?.qaStatus;
        const isAdmin = req.user?.userDoc?.isAdmin;
        const isQAReviewer = isAdmin || userQAStatus === 'approved';
        
        if (!isQAReviewer) {
            console.log('❌ QA Access denied for user:', req.user?.email, 'QA Status:', userQAStatus);
            return res.status(403).json({
                success: false,
                message: 'Access denied. QA reviewer permissions required.',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        const { submissionId } = req.params;

        const submission = await MultimediaAssessmentSubmission.findById(submissionId)
            .populate('annotatorId', 'fullName email')
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
        const completionTime = submission.submittedAt ? 
            submission.submittedAt - submission.createdAt : null;

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
        
        // Debug: Check if user is authenticated
        console.log('🔍 req.user:', req.user);
        console.log('🔍 req.user._id:', req.user?._id);
        
        // For testing purposes, use a default reviewer ID if no user is authenticated
        let reviewerId = req.user?._id;
        if (!reviewerId) {
            console.log('⚠️ No authenticated user found, using default test reviewer ID');
            reviewerId = new mongoose.Types.ObjectId('000000000000000000000001');
        }

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
                taskScores: [],
                overallScore: 0,
                decision: 'Request Revision', // Temporary placeholder - will be updated in final review
                feedback: 'Individual task reviews in progress'
            });
        } else {
            // Ensure reviewerId is set for existing reviews
            if (!qaReview.reviewerId) {
                qaReview.reviewerId = reviewerId;
            }
        }

        // Update or add task review - use taskScores instead of taskReviews
        const existingReviewIndex = qaReview.taskScores.findIndex(
            review => review.taskNumber === (taskIndex + 1) // taskNumber is 1-based
        );

        // Create task review matching QAReview model structure
        const taskReview = {
            taskNumber: taskIndex + 1, // 1-based numbering
            scores: {
                conversationQuality: Math.round((score / 10) * 20), // Convert 0-10 to 0-20
                videoSegmentation: Math.round((score / 10) * 20),
                promptRelevance: Math.round((score / 10) * 20),
                creativityAndCoherence: Math.round((score / 10) * 20),
                technicalExecution: Math.round((score / 10) * 20)
            },
            individualFeedback: feedback || '',
            totalScore: score * 10 // Convert 0-10 to 0-100
        };

        if (existingReviewIndex >= 0) {
            qaReview.taskScores[existingReviewIndex] = taskReview;
        } else {
            qaReview.taskScores.push(taskReview);
        }

        // Calculate overall score as average of task scores
        if (qaReview.taskScores.length > 0) {
            const totalScore = qaReview.taskScores.reduce((sum, task) => sum + task.totalScore, 0);
            qaReview.overallScore = Math.round(totalScore / qaReview.taskScores.length);
        }
        
        // Set required fields if not already set
        if (!qaReview.feedback) {
            qaReview.feedback = `Task ${taskIndex + 1} reviewed with score ${score}/10`;
        }
        if (!qaReview.reviewTime) {
            qaReview.reviewTime = 5; // Default 5 minutes
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
                totalTasksReviewed: qaReview.taskScores.length,
                overallScore: qaReview.overallScore
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
        // Check if user has QA reviewer permissions (qaStatus === 'approved')
        const userQAStatus = req.user?.userDoc?.qaStatus;
        const isAdmin = req.user?.userDoc?.isAdmin;
        const isQAReviewer = isAdmin || userQAStatus === 'approved';
        
        if (!isQAReviewer) {
            console.log('❌ QA Access denied for user:', req.user?.email, 'QA Status:', userQAStatus);
            return res.status(403).json({
                success: false,
                message: 'Access denied. QA reviewer permissions required.',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

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
            .populate('annotatorId', 'fullName email multimediaAssessmentStatus')
            .populate({
                path: 'assessmentId',
                select: 'title projectId',
                populate: {
                    path: 'projectId',
                    select: 'projectName projectCategory'
                }
            });

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
        let projectAutoApproved = false;
        if (decision === 'Approve') {
            await DTUser.findByIdAndUpdate(
                submission.annotatorId._id,
                { 
                    multimediaAssessmentStatus: 'approved',
                    multimediaAssessmentCompletedAt: new Date()
                }
            );
            
            // Auto-approve project application if exists
            try {
                const projectId = submission.assessmentId.projectId;
                if (projectId) {
                    const projectApplication = await ProjectApplication.findOneAndUpdate(
                        {
                            userId: submission.annotatorId._id,
                            projectId: projectId,
                            status: { $in: ['pending', 'under_review'] }
                        },
                        {
                            status: 'approved',
                            approvedAt: new Date(),
                            approvedBy: req.user._id,
                            approvalReason: 'Multimedia assessment passed - auto-approved'
                        },
                        { new: true }
                    );
                    
                    if (projectApplication) {
                        projectAutoApproved = true;
                        console.log(`✅ Auto-approved project application ${projectApplication._id} for user ${submission.annotatorId._id}`);
                    } else {
                        // Create new project application if none exists
                        const newApplication = new ProjectApplication({
                            userId: submission.annotatorId._id,
                            projectId: projectId,
                            status: 'approved',
                            appliedAt: new Date(),
                            approvedAt: new Date(),
                            approvedBy: req.user._id,
                            approvalReason: 'Multimedia assessment passed - auto-approved',
                            applicationData: {
                                reason: 'Automatically approved based on multimedia assessment performance',
                                experience: 'Demonstrated competency through multimedia assessment'
                            }
                        });
                        await newApplication.save();
                        projectAutoApproved = true;
                        console.log(`✅ Created and approved new project application ${newApplication._id} for user ${submission.annotatorId._id}`);
                    }
                }
            } catch (projectError) {
                console.error('Error auto-approving project application:', projectError);
                // Don't fail the QA approval if project approval fails
            }
        } else if (decision === 'Reject') {
            await DTUser.findByIdAndUpdate(
                submission.annotatorId._id,
                { 
                    multimediaAssessmentStatus: 'failed',
                    multimediaAssessmentLastFailedAt: new Date()
                }
            );
        }

        // Send email notification
        let emailSent = false;
        try {
            // Use direct Brevo API for better reliability
            const brevo = require('@getbrevo/brevo');
            const apiInstance = new brevo.TransactionalEmailsApi();
            apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
            
            const emailContent = `
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 300;">MyDeepTech</h1>
                  <p style="color: #f1f3f4; margin: 10px 0 0 0; font-size: 16px;">Assessment Results</p>
                </div>
                
                <div style="background-color: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <h2 style="color: #333; margin-bottom: 20px;">Dear ${submission.annotatorId.fullName},</h2>
                  
                  ${decision === 'Approve' ? `
                    <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 20px; margin: 20px 0; text-align: center;">
                      <h3 style="color: #155724; margin: 0 0 10px 0;">🎉 Congratulations!</h3>
                      <p style="color: #155724; margin: 0; font-size: 16px;"><strong>Your ${submission.assessmentId.title} has been approved!</strong></p>
                    </div>
                    
                    <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                      We're pleased to inform you that you have successfully passed your multimedia assessment with a score of <strong>${overallScore}%</strong>.
                    </p>
                    
                    ${projectAutoApproved ? `
                      <div style="background-color: #e2f3ff; border: 1px solid #b3d7ff; border-radius: 5px; padding: 15px; margin: 20px 0;">
                        <h3 style="color: #0c5aa6; margin: 0 0 10px 0;">🚀 Project Access Granted</h3>
                        <p style="color: #0c5aa6; margin: 0; font-size: 14px;">
                          You have been automatically approved for the <strong>${submission.assessmentId.projectId?.projectName}</strong> project. 
                          You can now access project tasks and start earning.
                        </p>
                      </div>
                    ` : ''}
                  ` : `
                    <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 20px; margin: 20px 0; text-align: center;">
                      <h3 style="color: #721c24; margin: 0 0 10px 0;">Assessment Results</h3>
                      <p style="color: #721c24; margin: 0; font-size: 16px;">Your ${submission.assessmentId.title} requires revision.</p>
                    </div>
                    
                    <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                      Your assessment score was <strong>${overallScore}%</strong>. While this doesn't meet our current requirements, we encourage you to review the feedback and try again.
                    </p>
                  `}
                  
                  ${overallFeedback ? `
                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
                      <h3 style="color: #856404; margin: 0 0 10px 0;">📝 Feedback</h3>
                      <p style="color: #856404; margin: 0; font-size: 14px;">${overallFeedback}</p>
                    </div>
                  ` : ''}
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://mydeeptech.ng/dashboard" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: 500;">View Dashboard</a>
                  </div>
                  
                  <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                    Thank you for participating in our assessment process. If you have any questions, please don't hesitate to contact our support team.
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                  
                  <div style="text-align: center; color: #888; font-size: 12px;">
                    <p>Best regards,<br><strong>MyDeepTech QA Team</strong></p>
                  </div>
                </div>
              </div>
            `;
            
            const sendSmtpEmail = new brevo.SendSmtpEmail();
            sendSmtpEmail.subject = decision === 'Approve' ? 
              `🎉 Assessment Approved - Welcome to ${submission.assessmentId.projectId?.projectName}` : 
              `Assessment Results - ${submission.assessmentId.title}`;
            sendSmtpEmail.htmlContent = emailContent;
            sendSmtpEmail.sender = { 
              name: "MyDeepTech QA Team", 
              email: process.env.BREVO_SENDER_EMAIL || "no-reply@mydeeptech.ng" 
            };
            sendSmtpEmail.to = [{ email: submission.annotatorId.email, name: submission.annotatorId.fullName }];
            sendSmtpEmail.replyTo = { email: "support@mydeeptech.ng", name: "MyDeepTech Support" };
            
            await apiInstance.sendTransacEmail(sendSmtpEmail);
            emailSent = true;
            console.log(`✅ Assessment result email sent to ${submission.annotatorId.email}`);
        } catch (emailError) {
            console.error('Failed to send assessment result email:', emailError);
            emailSent = false;
        }

        res.json({
            success: true,
            message: `Assessment ${decision.toLowerCase()}d successfully${projectAutoApproved ? ' and project application auto-approved' : ''}`,
            data: {
                decision,
                overallScore,
                submissionStatus: newSubmissionStatus,
                userStatus: newUserStatus,
                emailSent,
                projectAutoApproved
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
        // Check if user has QA reviewer permissions (qaStatus === 'approved')
        const userQAStatus = req.user?.userDoc?.qaStatus;
        const isAdmin = req.user?.userDoc?.isAdmin;
        const isQAReviewer = isAdmin || userQAStatus === 'approved';
        
        if (!isQAReviewer) {
            console.log('❌ QA Access denied for user:', req.user?.email, 'QA Status:', userQAStatus);
            return res.status(403).json({
                success: false,
                message: 'Access denied. QA reviewer permissions required.',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

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
                    { path: 'annotatorId', select: 'fullName email' },
                    { path: 'assessmentId', select: 'title' }
                ]
            })
            .sort({ completedAt: -1 })
            .limit(10)
            .lean();

        // Get pending review count
        const pendingCount = await MultimediaAssessmentSubmission.countDocuments({
            status: 'submitted',
            submittedAt: { $exists: true, $ne: null }
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
                    userName: review.submissionId.annotatorId.fullName,
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
        // Check if user has QA reviewer permissions (qaStatus === 'approved')
        const userQAStatus = req.user?.userDoc?.qaStatus;
        const isAdmin = req.user?.userDoc?.isAdmin;
        const isQAReviewer = isAdmin || userQAStatus === 'approved';
        
        if (!isQAReviewer) {
            console.log('❌ QA Access denied for user:', req.user?.email, 'QA Status:', userQAStatus);
            return res.status(403).json({
                success: false,
                message: 'Access denied. QA reviewer permissions required.',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

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
                        taskScores: [],
                        overallScore: 0,
                        decision: decision.toLowerCase(),
                        feedback: overallFeedback || 'Batch processed',
                        reviewTime: 5 // Default 5 minutes
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
        // Check if user has QA reviewer permissions (qaStatus === 'approved')
        const userQAStatus = req.user?.userDoc?.qaStatus;
        const isAdmin = req.user?.userDoc?.isAdmin;
        const isQAReviewer = isAdmin || userQAStatus === 'approved';
        
        if (!isQAReviewer) {
            console.log('❌ QA Access denied for user:', req.user?.email, 'QA Status:', userQAStatus);
            return res.status(403).json({
                success: false,
                message: 'Access denied. QA reviewer permissions required.',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

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
                                if: '$submittedAt',
                                then: { $subtract: ['$submittedAt', '$createdAt'] },
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

/**
 * Get approved submissions
 */
const getApprovedSubmissions = async (req, res) => {
    try {
        // Check if user has QA reviewer permissions (qaStatus === 'approved')
        const userQAStatus = req.user?.userDoc?.qaStatus;
        const isAdmin = req.user?.userDoc?.isAdmin;
        const isQAReviewer = isAdmin || userQAStatus === 'approved';
        
        if (!isQAReviewer) {
            console.log('❌ QA Access denied for user:', req.user?.email, 'QA Status:', userQAStatus);
            return res.status(403).json({
                success: false,
                message: 'Access denied. QA reviewer permissions required.',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        const { 
            page = 1, 
            limit = 20, 
            sortBy = 'submittedAt',
            sortOrder = 'desc',
            filterBy = 'all'
        } = req.query;

        const skip = (page - 1) * limit;
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        // Build filter query for approved submissions
        let matchQuery = { 
            status: 'approved'
        };

        // Apply additional filters
        switch (filterBy) {
            case 'recent':
                matchQuery = { 
                    ...matchQuery,
                    qaCompletedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Within 7 days
                };
                break;
            case 'high_score':
                matchQuery = { 
                    ...matchQuery,
                    totalScore: { $gte: 80 } // Score >= 80
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
                $lookup: {
                    from: 'qareviews',
                    localField: '_id',
                    foreignField: 'submissionId',
                    as: 'qaReview'
                }
            },
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
                    qaReviewer: { $arrayElemAt: ['$qaReview.reviewerId', 0] },
                    qaScore: { $arrayElemAt: ['$qaReview.overallScore', 0] },
                    qaDecision: { $arrayElemAt: ['$qaReview.decision', 0] },
                    qaCompletedAt: { $arrayElemAt: ['$qaReview.completedAt', 0] }
                }
            },
            {
                $lookup: {
                    from: 'dtusers',
                    localField: 'qaReviewer',
                    foreignField: '_id',
                    as: 'reviewer'
                }
            },
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
        console.error('Error fetching approved submissions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch approved submissions',
            error: error.message
        });
    }
};

/**
 * Get rejected submissions
 */
const getRejectedSubmissions = async (req, res) => {
    try {
        // Check if user has QA reviewer permissions (qaStatus === 'approved')
        const userQAStatus = req.user?.userDoc?.qaStatus;
        const isAdmin = req.user?.userDoc?.isAdmin;
        const isQAReviewer = isAdmin || userQAStatus === 'approved';
        
        if (!isQAReviewer) {
            console.log('❌ QA Access denied for user:', req.user?.email, 'QA Status:', userQAStatus);
            return res.status(403).json({
                success: false,
                message: 'Access denied. QA reviewer permissions required.',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        const { 
            page = 1, 
            limit = 20, 
            sortBy = 'submittedAt',
            sortOrder = 'desc',
            filterBy = 'all'
        } = req.query;

        const skip = (page - 1) * limit;
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        // Build filter query for rejected submissions
        let matchQuery = { 
            status: 'rejected'
        };

        // Apply additional filters
        switch (filterBy) {
            case 'recent':
                matchQuery = { 
                    ...matchQuery,
                    qaCompletedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Within 7 days
                };
                break;
            case 'low_score':
                matchQuery = { 
                    ...matchQuery,
                    totalScore: { $lt: 60 } // Score < 60
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
                $lookup: {
                    from: 'qareviews',
                    localField: '_id',
                    foreignField: 'submissionId',
                    as: 'qaReview'
                }
            },
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
                    qaReviewer: { $arrayElemAt: ['$qaReview.reviewerId', 0] },
                    qaScore: { $arrayElemAt: ['$qaReview.overallScore', 0] },
                    qaDecision: { $arrayElemAt: ['$qaReview.decision', 0] },
                    qaCompletedAt: { $arrayElemAt: ['$qaReview.completedAt', 0] },
                    qaFeedback: { $arrayElemAt: ['$qaReview.overallFeedback', 0] }
                }
            },
            {
                $lookup: {
                    from: 'dtusers',
                    localField: 'qaReviewer',
                    foreignField: '_id',
                    as: 'reviewer'
                }
            },
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
        console.error('Error fetching rejected submissions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch rejected submissions',
            error: error.message
        });
    }
};

module.exports = {
    getPendingSubmissions,
    getApprovedSubmissions,
    getRejectedSubmissions,
    getSubmissionForReview,
    reviewTask,
    submitFinalReview,
    getReviewerDashboard,
    batchReviewSubmissions,
    getSubmissionAnalytics
};