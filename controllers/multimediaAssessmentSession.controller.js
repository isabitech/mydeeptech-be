const Joi = require('joi');
const MultimediaAssessmentSessionService = require('../services/multimediaAssessmentSession.service');

const startAssessmentSchema = Joi.object({
  assessmentId: Joi.string().required(),
  sessionMetadata: Joi.object({
    browserInfo: Joi.string().optional(),
    screenResolution: Joi.string().optional(),
    deviceType: Joi.string().valid('desktop', 'mobile', 'tablet', 'unknown').optional()
  }).optional()
});

const taskProgressSchema = Joi.object({
  taskNumber: Joi.number().min(1).max(10).required(),
  conversation: Joi.object({
    originalVideoId: Joi.string().required(),
    startingPoint: Joi.string().valid('video', 'prompt').required(),
    turns: Joi.array().items(
      Joi.object({
        turnNumber: Joi.number().min(1).required(),
        userPrompt: Joi.string().max(500).required(),
        aiResponse: Joi.object({
          responseText: Joi.string().max(500).required(),
          videoSegment: Joi.object({
            startTime: Joi.number().min(0).required(),
            endTime: Joi.number().min(0).required(),
            segmentUrl: Joi.string().uri().optional(),
            content: Joi.string().max(1000).required()
          }).required()
        }).required()
      })
    ).min(1).max(8).required()
  }).required()
});

const startAssessmentSession = async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;
    console.log(`🎬 User ${req.user?.email} starting multimedia assessment`);
    
    const { error, value } = startAssessmentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: error.details.map(detail => detail.message) });
    }
    
    const { assessmentId, sessionMetadata = {} } = value;
    const reqIp = req.ip || req.connection?.remoteAddress || '';
    
    const { submission, assessmentConfig, selectedReels } = await MultimediaAssessmentSessionService.startAssessmentSession(assessmentId, userId, sessionMetadata, reqIp);
    
    res.status(201).json({
      success: true,
      message: 'Assessment session started successfully',
      data: {
        submission: {
          id: submission._id,
          assessmentId: submission.assessmentId,
          attemptNumber: submission.attemptNumber,
          status: submission.status,
          totalTimeSpent: submission.totalTimeSpent,
          timerState: {
            isRunning: submission.timerState?.isRunning || true,
            startTime: submission.timerState?.startTime || new Date(),
            totalPausedDuration: submission.timerState?.totalPausedDuration || 0
          },
          completionPercentage: submission.completionPercentage
        },
        assessment: {
          id: assessmentConfig._id,
          title: assessmentConfig.title,
          description: assessmentConfig.description,
          instructions: assessmentConfig.instructions,
          requirements: assessmentConfig.requirements,
          taskSettings: assessmentConfig.taskSettings,
          project: {
            id: assessmentConfig.projectId._id,
            name: assessmentConfig.projectId.projectName,
            description: assessmentConfig.projectId.projectDescription
          }
        },
        availableReels: selectedReels.map(reel => ({
          id: reel._id,
          title: reel.title,
          description: reel.description,
          youtubeUrl: reel.youtubeUrl,
          thumbnailUrl: reel.thumbnailUrl,
          niche: reel.niche,
          duration: reel.duration,
          formattedDuration: reel.formattedDuration,
          aspectRatio: reel.aspectRatio,
          tags: reel.tags
        })),
        sessionInfo: {
          startedAt: submission.createdAt,
          timeRemaining: assessmentConfig.requirements.timeLimit * 60,
          allowPausing: assessmentConfig.requirements.allowPausing,
          tasksRequired: assessmentConfig.requirements.tasksPerAssessment
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error starting assessment session:', error);
    if (error.status) return res.status(error.status).json({ success: false, message: error.message, retakeInfo: error.retakeInfo, required: error.required, available: error.available });
    res.status(500).json({ success: false, message: 'Server error starting assessment session', error: error.message });
  }
};

const getAssessmentSession = async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;
    const submission = await MultimediaAssessmentSessionService.getAssessmentSession(req.params.submissionId, userId);
    
    res.status(200).json({
      success: true,
      message: 'Assessment session retrieved successfully',
      data: {
        submission: {
          id: submission._id,
          status: submission.status,
          totalTimeSpent: submission.totalTimeSpent,
          formattedTimeSpent: submission.formattedTimeSpent,
          timerState: submission.timerState,
          completionPercentage: submission.completionPercentage,
          attemptNumber: submission.attemptNumber,
          lastAutoSave: submission.lastAutoSave,
          autoSaveCount: submission.autoSaveCount
        },
        assessment: {
          id: submission.assessmentId._id,
          title: submission.assessmentId.title,
          requirements: submission.assessmentId.requirements,
          taskSettings: submission.assessmentId.taskSettings
        },
        tasks: submission.tasks.map(task => ({
          taskNumber: task.taskNumber,
          isCompleted: task.isCompleted,
          timeSpent: task.timeSpent,
          submittedAt: task.submittedAt,
          conversation: {
            originalVideo: {
              id: task.conversation.originalVideoId._id,
              title: task.conversation.originalVideoId.title,
              youtubeUrl: task.conversation.originalVideoId.youtubeUrl,
              thumbnailUrl: task.conversation.originalVideoId.thumbnailUrl,
              duration: task.conversation.originalVideoId.duration,
              niche: task.conversation.originalVideoId.niche
            },
            startingPoint: task.conversation.startingPoint,
            turns: task.conversation.turns,
            totalDuration: task.conversation.totalDuration
          }
        })),
        sessionInfo: {
          timeRemaining: submission.timeRemaining || 0,
          canPause: submission.assessmentId.requirements.allowPausing,
          isTimerRunning: submission.timerState.isRunning,
          project: {
            id: submission.projectId._id,
            name: submission.projectId.projectName
          }
        }
      }
    });
    
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error('❌ Error retrieving assessment session:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving assessment session', error: error.message });
  }
};

const saveTaskProgress = async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;
    const { error, value } = taskProgressSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: error.details.map(detail => detail.message) });
    }
    
    const { task, submission } = await MultimediaAssessmentSessionService.saveTaskProgress(req.params.submissionId, userId, value.taskNumber, value.conversation);
    
    res.status(200).json({
      success: true,
      message: 'Task progress saved successfully',
      data: {
        taskNumber: value.taskNumber,
        conversationTurns: task.conversation.turns.length,
        totalDuration: task.conversation.totalDuration,
        timeSpent: task.timeSpent,
        lastSaved: new Date(),
        completionPercentage: submission.completionPercentage
      }
    });
    
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error('❌ Error saving task progress:', error);
    res.status(500).json({ success: false, message: 'Server error saving task progress', error: error.message });
  }
};

const submitTask = async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;
    const { task, submission } = await MultimediaAssessmentSessionService.submitTask(req.params.submissionId, userId, req.params.taskNumber);
    
    res.status(200).json({
      success: true,
      message: `Task ${req.params.taskNumber} submitted successfully`,
      data: {
        taskNumber: parseInt(req.params.taskNumber),
        submittedAt: task.submittedAt,
        conversationTurns: task.conversation.turns.length,
        totalDuration: task.conversation.totalDuration,
        completionPercentage: submission.completionPercentage,
        isAssessmentComplete: submission.completionPercentage === 100
      }
    });
    
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error('❌ Error submitting task:', error);
    res.status(500).json({ success: false, message: 'Server error submitting task', error: error.message });
  }
};

const controlTimer = async (req, res) => {
  try {
    const { action } = req.body;
    if (!['start', 'pause', 'resume'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid timer action. Must be start, pause, or resume' });
    }
    
    const userId = req.userId || req.user?.userId;
    const updatedSubmission = await MultimediaAssessmentSessionService.controlTimer(req.params.submissionId, userId, action);
    
    res.status(200).json({
      success: true,
      message: `Timer ${action} successful`,
      data: {
        timerState: updatedSubmission.timerState,
        totalTimeSpent: updatedSubmission.totalTimeSpent,
        formattedTimeSpent: updatedSubmission.formattedTimeSpent,
        timeRemaining: updatedSubmission.timeRemaining
      }
    });
    
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    if (error.message && (error.message.includes('already') || error.message.includes('not running'))) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('❌ Error controlling timer:', error);
    res.status(500).json({ success: false, message: 'Server error controlling timer', error: error.message });
  }
};

const submitAssessment = async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;
    const submission = await MultimediaAssessmentSessionService.submitAssessment(req.params.submissionId, userId);
    
    res.status(200).json({
      success: true,
      message: 'Assessment submitted successfully',
      data: {
        submissionId: submission._id,
        submittedAt: submission.submittedAt,
        totalTimeSpent: submission.formattedTimeSpent,
        completedTasks: submission.tasks.length,
        status: submission.status,
        nextSteps: {
          qaReview: 'Your submission will be reviewed by our QA team',
          estimatedReviewTime: '2-3 business days',
          notificationMethod: 'You will receive an email once review is complete'
        }
      }
    });
    
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message, incompleteTasks: error.incompleteTasks });
    console.error('❌ Error submitting assessment:', error);
    res.status(500).json({ success: false, message: 'Server error submitting assessment', error: error.message });
  }
};

const getAvailableReels = async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;
    const { availableReels, totalAvailable, usedReelsCount } = await MultimediaAssessmentSessionService.getAvailableReels(req.params.assessmentId, req.query.niche, req.query.limit || 10, userId);
    
    res.status(200).json({
      success: true,
      message: 'Available video reels retrieved successfully',
      data: {
        reels: availableReels.map(reel => ({
          id: reel._id,
          title: reel.title,
          description: reel.description,
          youtubeUrl: reel.youtubeUrl,
          thumbnailUrl: reel.thumbnailUrl,
          niche: reel.niche,
          duration: reel.duration,
          formattedDuration: reel.formattedDuration,
          aspectRatio: reel.aspectRatio,
          tags: reel.tags
        })),
        totalAvailable,
        usedReelsCount
      }
    });
    
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error('❌ Error retrieving available reels:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving available reels', error: error.message });
  }
};

const handleAssessmentCompletion = async (req, res) => {
    try {
        const { userId, assessmentId, submissionId } = req.body;
        await MultimediaAssessmentSessionService.handleAssessmentCompletion(userId, assessmentId, submissionId);
        res.status(200).json({ success: true, message: 'Assessment completion handled' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
}

module.exports = {
  startAssessmentSession,
  getAssessmentSession,
  saveTaskProgress,
  submitTask,
  controlTimer,
  submitAssessment,
  getAvailableReels,
  handleAssessmentCompletion
};