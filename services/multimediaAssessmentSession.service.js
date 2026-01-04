import MultimediaAssessmentSubmission from '../models/multimediaAssessmentSubmission.model.js';
import MultimediaAssessmentConfig from '../models/multimediaAssessmentConfig.model.js';
import VideoReel from '../models/videoReel.model.js';
import DTUser from '../models/dtUser.model.js';
import AnnotationProject from '../models/annotationProject.model.js';
import ProjectApplication from '../models/projectApplication.model.js';
import { sendAssessmentCompletionEmail } from '../utils/multimediaAssessmentEmails.js';
import { sendProjectApplicationNotification } from '../utils/projectMailer.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

class MultimediaAssessmentSessionService {
    /**
     * Start multimedia assessment session
     */
    async startAssessmentSession(userId, assessmentId, sessionMetadata = {}, clientIp) {
        // Get assessment configuration
        const assessmentConfig = await MultimediaAssessmentConfig.findById(assessmentId)
            .populate('projectId', 'projectName projectDescription');

        if (!assessmentConfig || !assessmentConfig.isActive) {
            throw new NotFoundError('Assessment configuration not found or inactive');
        }

        // Check if user can take/retake
        const retakeEligibility = await MultimediaAssessmentSubmission.canUserRetake(userId, assessmentId);
        if (!retakeEligibility.canRetake) {
            throw new ValidationError(`Cannot start assessment: ${retakeEligibility.reason}`);
        }

        // Get attempt number
        const latestAttempt = await MultimediaAssessmentSubmission.findOne({
            annotatorId: userId,
            assessmentId
        }).sort({ attemptNumber: -1 });

        const attemptNumber = latestAttempt ? latestAttempt.attemptNumber + 1 : 1;

        // Get randomized reels
        const availableReels = await VideoReel.getAssessmentReels(assessmentConfig);
        if (availableReels.length < assessmentConfig.requirements.tasksPerAssessment) {
            throw new Error(`Insufficient video reels available. Required: ${assessmentConfig.requirements.tasksPerAssessment}, Available: ${availableReels.length}`);
        }

        const selectedReels = availableReels
            .sort(() => 0.5 - Math.random())
            .slice(0, assessmentConfig.requirements.tasksPerAssessment);

        // Create submission
        const submission = new MultimediaAssessmentSubmission({
            assessmentId,
            annotatorId: userId,
            projectId: assessmentConfig.projectId._id,
            attemptNumber,
            previousAttempt: latestAttempt?._id || null,
            sessionMetadata: {
                browserInfo: sessionMetadata.browserInfo || '',
                ipAddress: clientIp || '',
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
        });

        await submission.save();

        // Update stats
        assessmentConfig.statistics.totalAttempts += 1;
        await assessmentConfig.save();

        // Update user status
        await DTUser.findByIdAndUpdate(userId, {
            $set: { multimediaAssessmentStatus: 'in_progress' }
        });

        return { submission, assessmentConfig, selectedReels };
    }

    /**
     * Get current assessment session
     */
    async getAssessmentSession(submissionId, userId) {
        const submission = await MultimediaAssessmentSubmission.findOne({
            _id: submissionId,
            annotatorId: userId
        })
            .populate('assessmentId')
            .populate('projectId', 'projectName')
            .populate('tasks.conversation.originalVideoId');

        if (!submission) {
            throw new NotFoundError('Assessment session not found or access denied');
        }

        return submission;
    }

    /**
     * Save task progress
     */
    async saveTaskProgress(submissionId, userId, progressData) {
        const { taskNumber, conversation } = progressData;

        const submission = await MultimediaAssessmentSubmission.findOne({
            _id: submissionId,
            annotatorId: userId,
            status: 'in_progress'
        });

        if (!submission) {
            throw new NotFoundError('Assessment session not found or not in progress');
        }

        const task = submission.tasks.find(t => t.taskNumber === taskNumber);
        if (!task) {
            throw new NotFoundError(`Task ${taskNumber} not found`);
        }

        // Update conversation
        task.conversation = {
            originalVideoId: conversation.originalVideoId,
            startingPoint: conversation.startingPoint,
            turns: conversation.turns.map(turn => ({
                ...turn,
                aiResponse: {
                    ...turn.aiResponse,
                    videoSegment: {
                        ...turn.aiResponse.videoSegment,
                        role: 'ai_response'
                    }
                }
            })),
            totalDuration: conversation.turns.reduce((sum, turn) => {
                const segmentDuration = turn.aiResponse.videoSegment.endTime - turn.aiResponse.videoSegment.startTime;
                return sum + segmentDuration;
            }, 0)
        };

        // Approximate time spent
        const now = new Date();
        const taskTimeSpent = Math.floor((now.getTime() - submission.updatedAt.getTime()) / 1000);
        task.timeSpent += Math.max(0, taskTimeSpent);

        await submission.save();
        return submission;
    }

    /**
     * Submit individual task
     */
    async submitTask(submissionId, userId, taskNumber) {
        const submission = await MultimediaAssessmentSubmission.findOne({
            _id: submissionId,
            annotatorId: userId,
            status: 'in_progress'
        });

        if (!submission) {
            throw new NotFoundError('Assessment session not found or not in progress');
        }

        const task = submission.tasks.find(t => t.taskNumber === parseInt(taskNumber));
        if (!task) {
            throw new NotFoundError(`Task ${taskNumber} not found`);
        }

        if (task.isCompleted) {
            throw new ValidationError('Task already completed');
        }

        if (!task.conversation.turns || task.conversation.turns.length < 3) {
            throw new ValidationError('Task must have at least 3 conversation turns to submit');
        }

        await submission.completeTask(parseInt(taskNumber));
        return submission;
    }

    /**
     * Control assessment timer
     */
    async controlTimer(submissionId, userId, action) {
        const submission = await MultimediaAssessmentSubmission.findOne({
            _id: submissionId,
            annotatorId: userId,
            status: 'in_progress'
        }).populate('assessmentId');

        if (!submission) {
            throw new NotFoundError('Assessment session not found or not in progress');
        }

        if ((action === 'pause' || action === 'resume') && !submission.assessmentId.requirements.allowPausing) {
            throw new ValidationError('Timer pausing is not allowed for this assessment');
        }

        switch (action) {
            case 'start': return await submission.startTimer();
            case 'pause': return await submission.pauseTimer();
            case 'resume': return await submission.resumeTimer();
            default: throw new ValidationError('Invalid timer action');
        }
    }

    /**
     * Submit final assessment
     */
    async submitAssessment(submissionId, userId) {
        const submission = await MultimediaAssessmentSubmission.findOne({
            _id: submissionId,
            annotatorId: userId,
            status: 'in_progress'
        })
            .populate('assessmentId')
            .populate('annotatorId', 'fullName email')
            .populate('projectId', 'projectName');

        if (!submission) {
            throw new NotFoundError('Assessment session not found or not in progress');
        }

        // Validate all tasks completed
        const incompleteTasks = submission.tasks.filter(task => !task.isCompleted);
        if (incompleteTasks.length > 0) {
            throw new ValidationError(`All tasks must be completed. Incomplete: ${incompleteTasks.map(t => t.taskNumber).join(', ')}`);
        }

        // Stop timer
        if (submission.timerState.isRunning) {
            await submission.pauseTimer();
        }

        // Update status
        submission.status = 'submitted';
        submission.submittedAt = new Date();
        await submission.save();

        // Update user status
        await DTUser.findByIdAndUpdate(userId, {
            $set: { multimediaAssessmentStatus: 'under_review' }
        });

        // Update assessment stats
        await MultimediaAssessmentConfig.findByIdAndUpdate(submission.assessmentId._id, {
            $inc: { 'statistics.totalCompletions': 1 }
        });

        // Send completion email
        try {
            await sendAssessmentCompletionEmail(
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
        } catch (e) { console.error('Email failed:', e); }

        // Handle project application updates
        try {
            await this._handleAssessmentCompletion(userId, submission.assessmentId._id, submission._id);
        } catch (e) { console.error('Application update failed:', e); }

        return submission;
    }

    /**
     * Internal: Handle assessment completion impact on applications
     */
    async _handleAssessmentCompletion(userId, assessmentId, submissionId) {
        const assessmentConfig = await MultimediaAssessmentConfig.findById(assessmentId);
        if (!assessmentConfig?.projectId) return;

        const applications = await ProjectApplication.find({
            projectId: assessmentConfig.projectId,
            applicantId: userId,
            status: 'assessment_required'
        });

        if (applications.length > 0) {
            await ProjectApplication.updateMany(
                { _id: { $in: applications.map(a => a._id) } },
                {
                    status: 'pending',
                    assessmentCompletedAt: new Date(),
                    assessmentSubmissionId: submissionId
                }
            );

            // Notify admins
            const project = await AnnotationProject.findById(assessmentConfig.projectId)
                .populate('createdBy', 'fullName email')
                .populate('assignedAdmins', 'fullName email');

            const user = await DTUser.findById(userId);

            if (project && user) {
                const adminEmails = [project.createdBy?.email, ...project.assignedAdmins.map(a => a.email)].filter(Boolean);
                const uniqueAdmins = [...new Set(adminEmails)];

                for (const adminEmail of uniqueAdmins) {
                    await sendProjectApplicationNotification(adminEmail, {
                        applicantName: user.fullName,
                        applicantEmail: user.email,
                        projectName: project.projectName,
                        projectCategory: project.projectCategory,
                        appliedAt: new Date(),
                        coverLetter: 'Assessment completed - ready for review'
                    });
                }
            }
        }
    }

    /**
     * Get available video reels
     */
    async getAvailableReels(assessmentId, userId, niche, limit = 20) {
        const assessmentConfig = await MultimediaAssessmentConfig.findById(assessmentId);
        if (!assessmentConfig || !assessmentConfig.isActive) {
            throw new NotFoundError('Assessment configuration not found or inactive');
        }

        const query = { isActive: true, isApproved: true };
        if (niche) query.niche = niche;

        // Exclude used reels
        const userSubmissions = await MultimediaAssessmentSubmission.find({
            annotatorId: userId,
            assessmentId
        }).select('tasks.conversation.originalVideoId');

        const usedReelIds = userSubmissions.flatMap(s => s.tasks.map(t => t.conversation.originalVideoId)).filter(Boolean);
        if (usedReelIds.length > 0) query._id = { $nin: usedReelIds };

        const reels = await VideoReel.find(query).limit(parseInt(limit)).sort({ usageCount: 1, createdAt: -1 });
        return { reels, totalAvailable: reels.length, usedReelsCount: usedReelIds.length };
    }
}

export default new MultimediaAssessmentSessionService();
