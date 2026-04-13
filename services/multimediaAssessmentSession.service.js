const MultimediaAssessmentSessionRepository = require('../repositories/multimediaAssessmentSession.repository');
const MultimediaAssessmentConfigRepository = require('../repositories/multimediaAssessmentConfig.repository');
const VideoReel = require('../models/videoReel.model');
const DTUser = require('../models/dtUser.model');
const ProjectApplication = require('../models/projectApplication.model');
const AnnotationProject = require('../models/annotationProject.model');
const MailService = require('../services/mail-service/mail-service');

class MultimediaAssessmentSessionService {
    async startAssessmentSession(assessmentId, userId, sessionMetadata, reqIp) {
        const assessmentConfig = await MultimediaAssessmentConfigRepository.findById(assessmentId);
        if (!assessmentConfig || !assessmentConfig.isActive) {
            throw { status: 404, message: 'Assessment configuration not found or inactive' };
        }

        const retakeEligibility = await MultimediaAssessmentSessionRepository.canUserRetake(userId, assessmentId);
        if (!retakeEligibility.canRetake) {
            throw { status: 400, message: `Cannot start assessment: ${retakeEligibility.reason}`, retakeInfo: retakeEligibility };
        }

        const latestAttempt = await MultimediaAssessmentSessionRepository.findLatestUserAttempt(userId, assessmentId);
        const attemptNumber = latestAttempt ? latestAttempt.attemptNumber + 1 : 1;

        const availableReels = await VideoReel.getAssessmentReels(assessmentConfig);
        if (availableReels.length < assessmentConfig.requirements.tasksPerAssessment) {
            throw { status: 500, message: 'Insufficient video reels available for assessment', required: assessmentConfig.requirements.tasksPerAssessment, available: availableReels.length };
        }

        const selectedReels = availableReels
            .sort(() => 0.5 - Math.random())
            .slice(0, assessmentConfig.requirements.tasksPerAssessment);

        const submissionData = {
            assessmentId,
            annotatorId: userId,
            projectId: assessmentConfig.projectId._id,
            attemptNumber,
            previousAttempt: latestAttempt?._id || null,
            sessionMetadata: {
                browserInfo: sessionMetadata.browserInfo || '',
                ipAddress: reqIp || '',
                deviceType: sessionMetadata.deviceType || 'unknown',
                screenResolution: sessionMetadata.screenResolution || ''
            },
            timerState: {
                isRunning: true,
                startTime: new Date(),
                pausedTime: 0,
                totalPausedDuration: 0,
                lastPauseStart: null
            },
            tasks: selectedReels.map((reel, index) => ({
                taskNumber: index + 1,
                conversation: {
                    originalVideoId: reel._id,
                    turns: [],
                    totalDuration: 0,
                    startingPoint: 'prompt'
                },
                timeSpent: 0,
                isCompleted: false
            }))
        };

        const submission = await MultimediaAssessmentSessionRepository.create(submissionData);

        assessmentConfig.statistics.totalAttempts += 1;
        await assessmentConfig.save();

        const user = await DTUser.findById(userId);
        if (user && user.multimediaAssessmentStatus === 'not_started') {
            user.multimediaAssessmentStatus = 'in_progress';
            await user.save();
        }

        return { submission, assessmentConfig, selectedReels };
    }

    async getAssessmentSession(submissionId, userId) {
        const submission = await MultimediaAssessmentSessionRepository.findOne({
            _id: submissionId,
            annotatorId: userId
        });
        if (!submission) throw { status: 404, message: 'Assessment session not found or access denied' };
        
        await submission.populate('assessmentId');
        await submission.populate('projectId', 'projectName');
        await submission.populate('tasks.conversation.originalVideoId');

        return submission;
    }

    async saveTaskProgress(submissionId, userId, taskNumber, conversation) {
        const submission = await MultimediaAssessmentSessionRepository.findOne({
            _id: submissionId,
            annotatorId: userId,
            status: 'in_progress'
        });
        if (!submission) throw { status: 404, message: 'Assessment session not found, completed, or access denied' };

        const task = submission.tasks.find(t => t.taskNumber === taskNumber);
        if (!task) throw { status: 404, message: `Task ${taskNumber} not found` };

        task.conversation = {
            originalVideoId: conversation.originalVideoId,
            startingPoint: conversation.startingPoint,
            turns: conversation.turns.map(turn => ({
                ...turn,
                aiResponse: { ...turn.aiResponse, videoSegment: { ...turn.aiResponse.videoSegment, role: 'ai_response' } }
            })),
            totalDuration: conversation.turns.reduce((sum, turn) => sum + (turn.aiResponse.videoSegment.endTime - turn.aiResponse.videoSegment.startTime), 0)
        };

        const taskTimeSpent = Math.floor((Date.now() - submission.updatedAt.getTime()) / 1000);
        task.timeSpent += taskTimeSpent;

        await submission.save();
        return { task, submission };
    }

    async submitTask(submissionId, userId, taskNumber) {
        const submission = await MultimediaAssessmentSessionRepository.findOne({
            _id: submissionId,
            annotatorId: userId,
            status: 'in_progress'
        });
        if (!submission) throw { status: 404, message: 'Assessment session not found, completed, or access denied' };

        const task = submission.tasks.find(t => t.taskNumber === parseInt(taskNumber));
        if (!task) throw { status: 404, message: `Task ${taskNumber} not found` };
        if (task.isCompleted) throw { status: 400, message: 'Task already completed' };

        if (!task.conversation.turns || task.conversation.turns.length < 3) {
            throw { status: 400, message: 'Task must have at least 3 conversation turns to submit' };
        }

        await submission.completeTask(parseInt(taskNumber));
        return { task, submission };
    }

    async controlTimer(submissionId, userId, action) {
        const submission = await MultimediaAssessmentSessionRepository.findOne({
            _id: submissionId,
            annotatorId: userId,
            status: 'in_progress'
        });
        if (!submission) throw { status: 404, message: 'Assessment session not found, completed, or access denied' };
        
        await submission.populate('assessmentId');

        if ((action === 'pause' || action === 'resume') && !submission.assessmentId.requirements.allowPausing) {
            throw { status: 400, message: 'Timer pausing is not allowed for this assessment' };
        }

        let updatedSubmission;
        switch (action) {
            case 'start': updatedSubmission = await submission.startTimer(); break;
            case 'pause': updatedSubmission = await submission.pauseTimer(); break;
            case 'resume': updatedSubmission = await submission.resumeTimer(); break;
        }

        return updatedSubmission;
    }

    async submitAssessment(submissionId, userId) {
        const submission = await MultimediaAssessmentSessionRepository.findOne({
            _id: submissionId,
            annotatorId: userId,
            status: 'in_progress'
        });
        if (!submission) throw { status: 404, message: 'Assessment session not found, completed, or access denied' };

        await submission.populate('assessmentId');
        await submission.populate('annotatorId', 'fullName email');
        await submission.populate('projectId', 'projectName');

        const incompleteTasks = submission.tasks.filter(task => !task.isCompleted);
        if (incompleteTasks.length > 0) {
            throw { status: 400, message: 'All tasks must be completed before submitting assessment', incompleteTasks: incompleteTasks.map(t => t.taskNumber) };
        }

        if (submission.timerState.isRunning) {
            await submission.pauseTimer();
        }

        submission.status = 'submitted';
        submission.submittedAt = new Date();

        const user = await DTUser.findById(userId);
        if (user) {
            user.multimediaAssessmentStatus = 'under_review';
            await user.save();
        }

        await submission.save();

        submission.assessmentId.statistics.totalCompletions += 1;
        await submission.assessmentId.save();

        try {
            await MailService.sendAssessmentCompletionEmail(
                submission.annotatorId.email,
                submission.annotatorId.fullName,
                {
                    assessmentTitle: submission.assessmentId.title,
                    projectName: submission.projectId.projectName,
                    submissionId: submission._id,
                    completedTasks: submission.tasks.length,
                    totalTimeSpent: submission.formattedTimeSpent,
                    submittedAt: submission.submittedAt
                }
            );
        } catch (emailError) {
            console.error('❌ Failed to send completion email:', emailError);
        }

        try {
            await this.handleAssessmentCompletion(userId, submission.assessmentId._id, submission._id);
        } catch (applicationError) {
            console.error('❌ Failed to update project applications:', applicationError);
        }

        return submission;
    }

    async handleAssessmentCompletion(userId, assessmentId, submissionId) {
        const assessmentConfig = await MultimediaAssessmentConfigRepository.findById(assessmentId);
        
        if (assessmentConfig && assessmentConfig.projectId) {
            const applications = await ProjectApplication.find({
                projectId: assessmentConfig.projectId._id,
                applicantId: userId,
                status: 'assessment_required'
            });
            
            if (applications.length > 0) {
                await ProjectApplication.updateMany(
                    {
                        projectId: assessmentConfig.projectId._id,
                        applicantId: userId,
                        status: 'assessment_required'
                    },
                    {
                        status: 'pending',
                        assessmentCompletedAt: new Date(),
                        assessmentSubmissionId: submissionId
                    }
                );

                console.log(`✅ Updated ${applications.length} project applications to pending status for user ${userId}`);
                
                try {
                    const project = await AnnotationProject.findById(assessmentConfig.projectId._id)
                        .populate('createdBy', 'fullName email')
                        .populate('assignedAdmins', 'fullName email');
                    
                    const user = await DTUser.findById(userId, 'fullName email attachments');
                    
                    if (project && user) {
                        const applicationData = {
                            applicantName: user.fullName,
                            applicantEmail: user.email,
                            resumeUrl: user.attachments?.resume_url || '',
                            projectName: project.projectName,
                            projectCategory: project.projectCategory,
                            payRate: project.payRate,
                            coverLetter: 'Assessment completed - ready for review',
                            appliedAt: new Date(),
                            assessmentCompleted: true
                        };

                        if (project.createdBy) {
                            await MailService.sendProjectApplicationNotification(
                                project.createdBy.email,
                                project.createdBy.fullName,
                                applicationData
                            );
                        }

                        for (const admin of project.assignedAdmins) {
                            if (admin._id.toString() !== project.createdBy._id.toString()) {
                                await MailService.sendProjectApplicationNotification(
                                    admin.email,
                                    admin.fullName,
                                    applicationData
                                );
                            }
                        }
                    }
                } catch (notificationError) {
                    console.error('Failed to send admin notifications after assessment completion:', notificationError);
                }
            }
        }
    }

    async getAvailableReels(assessmentId, niche, limit, userId) {
        const assessmentConfig = await MultimediaAssessmentConfigRepository.findById(assessmentId);
        if (!assessmentConfig || !assessmentConfig.isActive) {
            throw { status: 404, message: 'Assessment configuration not found or inactive' };
        }

        const query = { isActive: true, isApproved: true };
        if (niche) query.niche = niche;

        const userSubmissions = await MultimediaAssessmentSessionRepository.find({
            annotatorId: userId,
            assessmentId
        });
        
        const usedReelIds = userSubmissions.flatMap(submission => 
            submission.tasks.map(task => task.conversation?.originalVideoId)
        ).filter(Boolean);

        if (usedReelIds.length > 0) {
            query._id = { $nin: usedReelIds };
        }

        const availableReels = await VideoReel.find(query)
            .limit(parseInt(limit))
            .sort({ usageCount: 1, createdAt: -1 });

        return { availableReels, totalAvailable: availableReels.length, usedReelsCount: usedReelIds.length };
    }
}

module.exports = new MultimediaAssessmentSessionService();
