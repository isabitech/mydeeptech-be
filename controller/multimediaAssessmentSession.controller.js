const MultimediaAssessmentSubmission = require('../models/multimediaAssessmentSubmission.model');
const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');
const VideoReel = require('../models/videoReel.model');
const DTUser = require('../models/dtUser.model');
const Joi = require('joi');
const { sendAssessmentInvitationEmail, sendAssessmentCompletionEmail } = require('../utils/multimediaAssessmentEmails');

// Validation schemas
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

/**
 * Start multimedia assessment session
 * POST /api/assessments/multimedia/start
 */
const startAssessmentSession = async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;
    console.log(`🎬 User ${req.user?.email} starting multimedia assessment`);
    
    // Validate request body
    const { error, value } = startAssessmentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => detail.message)
      });
    }
    
    const { assessmentId, sessionMetadata = {} } = value;
    
    // Get assessment configuration
    const assessmentConfig = await MultimediaAssessmentConfig.findById(assessmentId)
      .populate('projectId', 'projectName projectDescription');
    
    if (!assessmentConfig || !assessmentConfig.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Assessment configuration not found or inactive'
      });
    }
    
    // Check if user can take/retake this assessment
    const retakeEligibility = await MultimediaAssessmentSubmission.canUserRetake(userId, assessmentId);
    
    if (!retakeEligibility.canRetake) {
      return res.status(400).json({
        success: false,
        message: `Cannot start assessment: ${retakeEligibility.reason}`,
        retakeInfo: retakeEligibility
      });
    }
    
    // Get user's latest attempt to determine attempt number
    const latestAttempt = await MultimediaAssessmentSubmission.findLatestUserAttempt(userId, assessmentId);
    const attemptNumber = latestAttempt ? latestAttempt.attemptNumber + 1 : 1;
    
    // Generate randomized video reels for assessment
    const availableReels = await VideoReel.getAssessmentReels(assessmentConfig);
    
    if (availableReels.length < assessmentConfig.requirements.tasksPerAssessment) {
      return res.status(500).json({
        success: false,
        message: 'Insufficient video reels available for assessment',
        required: assessmentConfig.requirements.tasksPerAssessment,
        available: availableReels.length
      });
    }
    
    // Select reels for this session (random selection from available pool)
    const selectedReels = availableReels
      .sort(() => 0.5 - Math.random()) // Shuffle
      .slice(0, assessmentConfig.requirements.tasksPerAssessment);
    
    // Create assessment submission
    const submission = new MultimediaAssessmentSubmission({
      assessmentId,
      annotatorId: userId,
      projectId: assessmentConfig.projectId._id,
      attemptNumber,
      previousAttempt: latestAttempt?._id || null,
      sessionMetadata: {
        browserInfo: sessionMetadata.browserInfo || '',
        ipAddress: req.ip || req.connection.remoteAddress || '',
        deviceType: sessionMetadata.deviceType || 'unknown',
        screenResolution: sessionMetadata.screenResolution || ''
      },
      timerState: {
        isRunning: true, // Start the timer immediately
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
          startingPoint: 'prompt' // Default, user can change
        },
        timeSpent: 0,
        isCompleted: false
      }))
    });
    
    await submission.save();
    
    // Update assessment statistics
    assessmentConfig.statistics.totalAttempts += 1;
    await assessmentConfig.save();
    
    // Update user's multimedia assessment status
    const user = await DTUser.findById(userId);
    if (user && user.multimediaAssessmentStatus === 'not_started') {
      user.multimediaAssessmentStatus = 'in_progress';
      await user.save();
    }
    
    console.log(`✅ Assessment session started: ${submission._id} for user ${req.user?.email}`);
    
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
          timeRemaining: assessmentConfig.requirements.timeLimit * 60, // in seconds
          allowPausing: assessmentConfig.requirements.allowPausing,
          tasksRequired: assessmentConfig.requirements.tasksPerAssessment
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error starting assessment session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error starting assessment session',
      error: error.message
    });
  }
};

/**
 * Get current assessment session
 * GET /api/assessments/multimedia/:submissionId
 */
const getAssessmentSession = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.userId || req.user?.userId;
    
    const submission = await MultimediaAssessmentSubmission.findOne({
      _id: submissionId,
      annotatorId: userId
    })
    .populate('assessmentId')
    .populate('projectId', 'projectName')
    .populate('tasks.conversation.originalVideoId');
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Assessment session not found or access denied'
      });
    }
    
    // Calculate time remaining
    const timeRemaining = submission.timeRemaining || 0;
    
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
          timeRemaining,
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
    console.error('❌ Error retrieving assessment session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving assessment session',
      error: error.message
    });
  }
};

/**
 * Save task progress (auto-save)
 * PATCH /api/assessments/multimedia/:submissionId/progress
 */
const saveTaskProgress = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.userId || req.user?.userId;
    
    // Validate request body
    const { error, value } = taskProgressSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => detail.message)
      });
    }
    
    const { taskNumber, conversation } = value;
    
    const submission = await MultimediaAssessmentSubmission.findOne({
      _id: submissionId,
      annotatorId: userId,
      status: 'in_progress'
    });
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Assessment session not found, completed, or access denied'
      });
    }
    
    // Find and update the specific task
    const task = submission.tasks.find(t => t.taskNumber === taskNumber);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: `Task ${taskNumber} not found`
      });
    }
    
    // Update conversation data
    task.conversation = {
      originalVideoId: conversation.originalVideoId,
      startingPoint: conversation.startingPoint,
      turns: conversation.turns.map(turn => ({
        ...turn,
        aiResponse: {
          ...turn.aiResponse,
          videoSegment: {
            ...turn.aiResponse.videoSegment,
            role: 'ai_response' // Auto-assign role for AI responses
          }
        }
      })),
      totalDuration: conversation.turns.reduce((sum, turn) => {
        const segmentDuration = turn.aiResponse.videoSegment.endTime - turn.aiResponse.videoSegment.startTime;
        return sum + segmentDuration;
      }, 0)
    };
    
    // Calculate time spent on this task (approximate)
    const taskTimeSpent = Math.floor((Date.now() - submission.updatedAt.getTime()) / 1000);
    task.timeSpent += taskTimeSpent;
    
    await submission.save();
    
    console.log(`💾 Progress saved for task ${taskNumber} in session ${submissionId}`);
    
    res.status(200).json({
      success: true,
      message: 'Task progress saved successfully',
      data: {
        taskNumber,
        conversationTurns: task.conversation.turns.length,
        totalDuration: task.conversation.totalDuration,
        timeSpent: task.timeSpent,
        lastSaved: new Date(),
        completionPercentage: submission.completionPercentage
      }
    });
    
  } catch (error) {
    console.error('❌ Error saving task progress:', error);
    res.status(500).json({
      success: false,
      message: 'Server error saving task progress',
      error: error.message
    });
  }
};

/**
 * Submit individual task
 * POST /api/assessments/multimedia/:submissionId/tasks/:taskNumber/submit
 */
const submitTask = async (req, res) => {
  try {
    const { submissionId, taskNumber } = req.params;
    const userId = req.userId || req.user?.userId;
    
    const submission = await MultimediaAssessmentSubmission.findOne({
      _id: submissionId,
      annotatorId: userId,
      status: 'in_progress'
    });
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Assessment session not found, completed, or access denied'
      });
    }
    
    // Find the task
    const task = submission.tasks.find(t => t.taskNumber === parseInt(taskNumber));
    if (!task) {
      return res.status(404).json({
        success: false,
        message: `Task ${taskNumber} not found`
      });
    }
    
    if (task.isCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Task already completed'
      });
    }
    
    // Validate task completion requirements
    if (!task.conversation.turns || task.conversation.turns.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Task must have at least 3 conversation turns to submit'
      });
    }
    
    // Mark task as completed
    await submission.completeTask(parseInt(taskNumber));
    
    console.log(`✅ Task ${taskNumber} submitted in session ${submissionId}`);
    
    res.status(200).json({
      success: true,
      message: `Task ${taskNumber} submitted successfully`,
      data: {
        taskNumber: parseInt(taskNumber),
        submittedAt: task.submittedAt,
        conversationTurns: task.conversation.turns.length,
        totalDuration: task.conversation.totalDuration,
        completionPercentage: submission.completionPercentage,
        isAssessmentComplete: submission.completionPercentage === 100
      }
    });
    
  } catch (error) {
    console.error('❌ Error submitting task:', error);
    res.status(500).json({
      success: false,
      message: 'Server error submitting task',
      error: error.message
    });
  }
};

/**
 * Control assessment timer (start/pause/resume)
 * POST /api/assessments/multimedia/:submissionId/timer
 */
const controlTimer = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { action } = req.body; // 'start', 'pause', 'resume'
    const userId = req.userId || req.user?.userId;
    
    if (!['start', 'pause', 'resume'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timer action. Must be start, pause, or resume'
      });
    }
    
    const submission = await MultimediaAssessmentSubmission.findOne({
      _id: submissionId,
      annotatorId: userId,
      status: 'in_progress'
    }).populate('assessmentId');
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Assessment session not found, completed, or access denied'
      });
    }
    
    // Check if pausing is allowed
    if ((action === 'pause' || action === 'resume') && !submission.assessmentId.requirements.allowPausing) {
      return res.status(400).json({
        success: false,
        message: 'Timer pausing is not allowed for this assessment'
      });
    }
    
    let updatedSubmission;
    
    try {
      switch (action) {
        case 'start':
          updatedSubmission = await submission.startTimer();
          break;
        case 'pause':
          updatedSubmission = await submission.pauseTimer();
          break;
        case 'resume':
          updatedSubmission = await submission.resumeTimer();
          break;
      }
    } catch (timerError) {
      return res.status(400).json({
        success: false,
        message: timerError.message
      });
    }
    
    console.log(`⏱️ Timer ${action} for session ${submissionId}`);
    
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
    console.error('❌ Error controlling timer:', error);
    res.status(500).json({
      success: false,
      message: 'Server error controlling timer',
      error: error.message
    });
  }
};

/**
 * Submit final assessment
 * POST /api/assessments/multimedia/:submissionId/submit
 */
const submitAssessment = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.userId || req.user?.userId;
    
    const submission = await MultimediaAssessmentSubmission.findOne({
      _id: submissionId,
      annotatorId: userId,
      status: 'in_progress'
    })
    .populate('assessmentId')
    .populate('annotatorId', 'fullName email')
    .populate('projectId', 'projectName');
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Assessment session not found, completed, or access denied'
      });
    }
    
    // Validate that all tasks are completed
    const incompleteTasks = submission.tasks.filter(task => !task.isCompleted);
    if (incompleteTasks.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'All tasks must be completed before submitting assessment',
        incompleteTasks: incompleteTasks.map(task => task.taskNumber)
      });
    }
    
    // Stop timer if running
    if (submission.timerState.isRunning) {
      await submission.pauseTimer();
    }
    
    // Update submission status
    submission.status = 'submitted';
    submission.submittedAt = new Date();
    
    // Update user's multimedia assessment status
    const user = await DTUser.findById(userId);
    if (user) {
      user.multimediaAssessmentStatus = 'under_review';
      await user.save();
    }
    
    await submission.save();
    
    // Update assessment statistics
    submission.assessmentId.statistics.totalCompletions += 1;
    await submission.assessmentId.save();
    
    // Send completion email to user
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
    } catch (emailError) {
      console.error('❌ Failed to send completion email:', emailError);
    }

    // Handle project application updates
    try {
      await handleAssessmentCompletion(userId, submission.assessmentId._id, submission._id);
    } catch (applicationError) {
      console.error('❌ Failed to update project applications:', applicationError);
    }
    
    console.log(`🎯 Assessment submitted: ${submissionId} by user ${submission.annotatorId.email}`);
    
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
    console.error('❌ Error submitting assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error submitting assessment',
      error: error.message
    });
  }
};

/**
 * Get available video reels for assessment
 * GET /api/assessments/multimedia/reels/:assessmentId
 */
const getAvailableReels = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { niche, limit = 20 } = req.query;
    const userId = req.userId || req.user?.userId;
    
    // Get assessment configuration
    const assessmentConfig = await MultimediaAssessmentConfig.findById(assessmentId);
    if (!assessmentConfig || !assessmentConfig.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Assessment configuration not found or inactive'
      });
    }
    
    // Build query for available reels
    const query = {
      isActive: true,
      isApproved: true
    };
    
    if (niche) {
      query.niche = niche;
    }
    
    // Get user's previous submissions to exclude already used reels
    const userSubmissions = await MultimediaAssessmentSubmission.find({
      annotatorId: userId,
      assessmentId
    }).select('tasks.conversation.originalVideoId');
    
    const usedReelIds = userSubmissions.flatMap(submission => 
      submission.tasks.map(task => task.conversation.originalVideoId)
    ).filter(Boolean);
    
    if (usedReelIds.length > 0) {
      query._id = { $nin: usedReelIds };
    }
    
    const availableReels = await VideoReel.find(query)
      .limit(parseInt(limit))
      .sort({ usageCount: 1, createdAt: -1 }); // Prefer less used reels
    
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
        totalAvailable: availableReels.length,
        usedReelsCount: usedReelIds.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error retrieving available reels:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving available reels',
      error: error.message
    });
  }
};

/**
 * Handle assessment completion and update project applications
 */
const handleAssessmentCompletion = async (userId, assessmentId, submissionId) => {
    try {
        // Find the assessment configuration to get the project
        const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');
        const assessmentConfig = await MultimediaAssessmentConfig.findById(assessmentId)
            .populate('projectId', 'projectName');
        
        if (assessmentConfig && assessmentConfig.projectId) {
            // Find any applications for this project that are in assessment_required status
            const ProjectApplication = require('../models/projectApplication.model');
            const applications = await ProjectApplication.find({
                projectId: assessmentConfig.projectId._id,
                applicantId: userId,
                status: 'assessment_required'
            });
            
            if (applications.length > 0) {
                // Update applications to pending status for admin review
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
                
                // Send notification to project admins about the completed assessment
                try {
                    const AnnotationProject = require('../models/annotationProject.model');
                    const DTUser = require('../models/dtUser.model');
                    
                    const project = await AnnotationProject.findById(assessmentConfig.projectId._id)
                        .populate('createdBy', 'fullName email')
                        .populate('assignedAdmins', 'fullName email');
                    
                    const user = await DTUser.findById(userId, 'fullName email attachments');
                    
                    if (project && user) {
                        const { sendProjectApplicationNotification } = require('../utils/projectMailer');
                        
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

                        // Send notification to project creator
                        if (project.createdBy) {
                            await sendProjectApplicationNotification(
                                project.createdBy.email,
                                project.createdBy.fullName,
                                applicationData
                            );
                        }

                        // Send notification to assigned admins
                        for (const admin of project.assignedAdmins) {
                            if (admin._id.toString() !== project.createdBy._id.toString()) {
                                await sendProjectApplicationNotification(
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
    } catch (error) {
        console.error('Error handling assessment completion:', error);
    }
};

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