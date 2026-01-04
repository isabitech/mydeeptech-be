import multimediaAssessmentSessionService from '../services/multimediaAssessmentSession.service.js';
import { ResponseHandler, ValidationError, NotFoundError } from '../utils/responseHandler.js';
import Joi from 'joi';

/**
 * MULTIMEDIA ASSESSMENT SESSION CONTROLLER
 * REST API for candidate assessment sessions
 */
class MultimediaAssessmentSessionController {
  // Validation schemas
  static startAssessmentSchema = Joi.object({
    assessmentId: Joi.string().required(),
    sessionMetadata: Joi.object({
      browserInfo: Joi.string().optional(),
      screenResolution: Joi.string().optional(),
      deviceType: Joi.string().valid('desktop', 'mobile', 'tablet', 'unknown').optional()
    }).optional()
  });

  static taskProgressSchema = Joi.object({
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

  /**
   * Start multimedia assessment session
   * POST /api/assessments/multimedia/start
   */
  async startAssessmentSession(req, res) {
    const userId = req.userId || req.user?._id || req.user?.userId;
    const { error, value } = MultimediaAssessmentSessionController.startAssessmentSchema.validate(req.body);

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const clientIp = req.ip || req.connection?.remoteAddress || '';
    const { submission, assessmentConfig, selectedReels } = await multimediaAssessmentSessionService.startAssessmentSession(
      userId,
      value.assessmentId,
      value.sessionMetadata,
      clientIp
    );

    ResponseHandler.success(res, {
      submission: {
        id: submission._id,
        assessmentId: submission.assessmentId,
        attemptNumber: submission.attemptNumber,
        status: submission.status,
        totalTimeSpent: submission.totalTimeSpent,
        timerState: submission.timerState,
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
    }, 'Assessment session started successfully', 201);
  }

  /**
   * Get current assessment session
   * GET /api/assessments/multimedia/:submissionId
   */
  async getAssessmentSession(req, res) {
    const { submissionId } = req.params;
    const userId = req.userId || req.user?._id || req.user?.userId;

    const submission = await multimediaAssessmentSessionService.getAssessmentSession(submissionId, userId);

    ResponseHandler.success(res, {
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
        timeRemaining: submission.timeRemaining,
        canPause: submission.assessmentId.requirements.allowPausing,
        isTimerRunning: submission.timerState.isRunning,
        project: {
          id: submission.projectId._id,
          name: submission.projectId.projectName
        }
      }
    });
  }

  /**
   * Save task progress (auto-save)
   * PATCH /api/assessments/multimedia/:submissionId/progress
   */
  async saveTaskProgress(req, res) {
    const { submissionId } = req.params;
    const userId = req.userId || req.user?._id || req.user?.userId;

    const { error, value } = MultimediaAssessmentSessionController.taskProgressSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const submission = await multimediaAssessmentSessionService.saveTaskProgress(submissionId, userId, value);
    const task = submission.tasks.find(t => t.taskNumber === value.taskNumber);

    ResponseHandler.success(res, {
      taskNumber: value.taskNumber,
      conversationTurns: task.conversation.turns.length,
      totalDuration: task.conversation.totalDuration,
      timeSpent: task.timeSpent,
      lastSaved: new Date(),
      completionPercentage: submission.completionPercentage
    }, 'Task progress saved successfully');
  }

  /**
   * Submit individual task
   * POST /api/assessments/multimedia/:submissionId/tasks/:taskNumber/submit
   */
  async submitTask(req, res) {
    const { submissionId, taskNumber } = req.params;
    const userId = req.userId || req.user?._id || req.user?.userId;

    const submission = await multimediaAssessmentSessionService.submitTask(submissionId, userId, taskNumber);
    const task = submission.tasks.find(t => t.taskNumber === parseInt(taskNumber));

    ResponseHandler.success(res, {
      taskNumber: parseInt(taskNumber),
      submittedAt: task.submittedAt,
      conversationTurns: task.conversation.turns.length,
      totalDuration: task.conversation.totalDuration,
      completionPercentage: submission.completionPercentage,
      isAssessmentComplete: submission.completionPercentage === 100
    }, `Task ${taskNumber} submitted successfully`);
  }

  /**
   * Control assessment timer (start/pause/resume)
   * POST /api/assessments/multimedia/:submissionId/timer
   */
  async controlTimer(req, res) {
    const { submissionId } = req.params;
    const { action } = req.body;
    const userId = req.userId || req.user?._id || req.user?.userId;

    const updatedSubmission = await multimediaAssessmentSessionService.controlTimer(submissionId, userId, action);

    ResponseHandler.success(res, {
      timerState: updatedSubmission.timerState,
      totalTimeSpent: updatedSubmission.totalTimeSpent,
      formattedTimeSpent: updatedSubmission.formattedTimeSpent,
      timeRemaining: updatedSubmission.timeRemaining
    }, `Timer ${action} successful`);
  }

  /**
   * Submit final assessment
   * POST /api/assessments/multimedia/:submissionId/submit
   */
  async submitAssessment(req, res) {
    const { submissionId } = req.params;
    const userId = req.userId || req.user?._id || req.user?.userId;

    const submission = await multimediaAssessmentSessionService.submitAssessment(submissionId, userId);

    ResponseHandler.success(res, {
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
    }, 'Assessment submitted successfully');
  }

  /**
   * Get available video reels for assessment
   * GET /api/assessments/multimedia/reels/:assessmentId
   */
  async getAvailableReels(req, res) {
    const { assessmentId } = req.params;
    const { niche, limit } = req.query;
    const userId = req.userId || req.user?._id || req.user?.userId;

    const result = await multimediaAssessmentSessionService.getAvailableReels(assessmentId, userId, niche, limit);
    ResponseHandler.success(res, result);
  }
}

export default new MultimediaAssessmentSessionController();