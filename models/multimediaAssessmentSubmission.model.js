import mongoose from 'mongoose';

// Sub-schemas for nested structures
const videoSegmentSchema = new mongoose.Schema({
  startTime: {
    type: Number, // in seconds
    required: true,
    min: 0
  },
  endTime: {
    type: Number, // in seconds
    required: true,
    min: 0
  },
  segmentUrl: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user_prompt', 'ai_response'],
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000
  },
  cloudinaryData: {
    publicId: String,
    version: String,
    resourceType: {
      type: String,
      default: 'video'
    }
  }
}, { _id: true });

const conversationTurnSchema = new mongoose.Schema({
  turnNumber: {
    type: Number,
    required: true,
    min: 1
  },
  userPrompt: {
    type: String,
    required: true,
    maxlength: 500
  },
  aiResponse: {
    videoSegment: videoSegmentSchema,
    responseText: {
      type: String,
      required: true,
      maxlength: 500
    }
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const multimediaConversationSchema = new mongoose.Schema({
  originalVideoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VideoReel',
    required: true
  },
  turns: [conversationTurnSchema],
  totalDuration: {
    type: Number, // Total duration of all video segments in seconds
    default: 0
  },
  startingPoint: {
    type: String,
    enum: ['video', 'prompt'],
    required: true
  }
}, { _id: false });

const assessmentTaskSchema = new mongoose.Schema({
  taskNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  conversation: multimediaConversationSchema,
  timeSpent: {
    type: Number, // in seconds
    default: 0
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  submittedAt: {
    type: Date,
    default: null
  },

  // QA scoring for individual task
  qaScore: {
    conversationQuality: {
      type: Number,
      min: 0,
      max: 20,
      default: null
    },
    videoSegmentation: {
      type: Number,
      min: 0,
      max: 20,
      default: null
    },
    promptRelevance: {
      type: Number,
      min: 0,
      max: 20,
      default: null
    },
    creativityAndCoherence: {
      type: Number,
      min: 0,
      max: 20,
      default: null
    },
    technicalExecution: {
      type: Number,
      min: 0,
      max: 20,
      default: null
    },
    taskTotal: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    individualFeedback: {
      type: String,
      maxlength: 1000,
      default: ''
    }
  }
}, { _id: true });

const timerStateSchema = new mongoose.Schema({
  isRunning: {
    type: Boolean,
    default: false
  },
  startTime: {
    type: Date,
    default: null
  },
  pausedTime: {
    type: Number, // accumulated paused time in seconds
    default: 0
  },
  totalPausedDuration: {
    type: Number, // total time spent paused in seconds
    default: 0
  },
  lastPauseStart: {
    type: Date,
    default: null
  }
}, { _id: false });

const multimediaAssessmentSubmissionSchema = new mongoose.Schema({
  // Assessment reference
  assessmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MultimediaAssessmentConfig',
    required: true
  },

  // User information
  annotatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DTUser',
    required: true
  },

  // Project reference
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnnotationProject',
    required: true
  },

  // Assessment tasks
  tasks: [assessmentTaskSchema],

  // Time tracking
  totalTimeSpent: {
    type: Number, // in seconds
    default: 0
  },
  timerState: {
    type: timerStateSchema,
    default: () => ({
      isRunning: false,
      startTime: null,
      pausedTime: 0,
      totalPausedDuration: 0,
      lastPauseStart: null
    })
  },

  // Submission status
  status: {
    type: String,
    enum: ['in_progress', 'submitted', 'under_review', 'approved', 'rejected'],
    default: 'in_progress'
  },

  // Submission info
  submittedAt: {
    type: Date,
    default: null
  },

  // QA Review reference
  qaReview: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QAReview',
    default: null
  },

  // Overall scoring
  totalScore: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },

  // Attempt tracking
  attemptNumber: {
    type: Number,
    default: 1,
    min: 1
  },

  // Previous attempt reference for retakes
  previousAttempt: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MultimediaAssessmentSubmission',
    default: null
  },

  // Session metadata
  sessionMetadata: {
    browserInfo: {
      type: String,
      default: ''
    },
    ipAddress: {
      type: String,
      default: ''
    },
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown'
    },
    screenResolution: {
      type: String,
      default: ''
    }
  },

  // Auto-save progress tracking
  lastAutoSave: {
    type: Date,
    default: Date.now
  },
  autoSaveCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
multimediaAssessmentSubmissionSchema.index({ annotatorId: 1, assessmentId: 1 });
multimediaAssessmentSubmissionSchema.index({ projectId: 1, status: 1 });
multimediaAssessmentSubmissionSchema.index({ status: 1, submittedAt: -1 });
multimediaAssessmentSubmissionSchema.index({ qaReview: 1 });
multimediaAssessmentSubmissionSchema.index({ createdAt: -1 });

// Compound index for finding user's latest attempt
multimediaAssessmentSubmissionSchema.index({
  annotatorId: 1,
  assessmentId: 1,
  attemptNumber: -1
});

// Virtual for completion percentage
multimediaAssessmentSubmissionSchema.virtual('completionPercentage').get(function () {
  if (!this.tasks || this.tasks.length === 0) return 0;
  const completedTasks = this.tasks.filter(task => task.isCompleted).length;
  return Math.round((completedTasks / this.tasks.length) * 100);
});

// Virtual for formatted time spent
multimediaAssessmentSubmissionSchema.virtual('formattedTimeSpent').get(function () {
  const hours = Math.floor(this.totalTimeSpent / 3600);
  const minutes = Math.floor((this.totalTimeSpent % 3600) / 60);
  const seconds = this.totalTimeSpent % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
});

// Virtual for time remaining
multimediaAssessmentSubmissionSchema.virtual('timeRemaining').get(function () {
  if (!this.populated('assessmentId') || !this.assessmentId.requirements) return null;

  const timeLimitSeconds = this.assessmentId.requirements.timeLimit * 60;
  const remaining = timeLimitSeconds - this.totalTimeSpent;
  return Math.max(0, remaining);
});

// Static method to find user's latest attempt for assessment
multimediaAssessmentSubmissionSchema.statics.findLatestUserAttempt = function (annotatorId, assessmentId) {
  return this.findOne({ annotatorId, assessmentId })
    .sort({ attemptNumber: -1 })
    .populate('assessmentId')
    .populate('annotatorId', 'fullName email')
    .populate('qaReview');
};

// Static method to check if user can retake assessment
multimediaAssessmentSubmissionSchema.statics.canUserRetake = async function (annotatorId, assessmentId) {
  const latestAttempt = await this.findLatestUserAttempt(annotatorId, assessmentId);

  if (!latestAttempt) return { canRetake: true, reason: 'First attempt' };

  const config = latestAttempt.assessmentId;

  // Check if retakes are allowed
  if (!config.requirements.retakePolicy.allowed) {
    return { canRetake: false, reason: 'Retakes not allowed' };
  }

  // Check if user passed
  if (latestAttempt.status === 'approved') {
    return { canRetake: false, reason: 'Already passed' };
  }

  // Check cooldown period for failed attempts
  if (latestAttempt.status === 'rejected' && latestAttempt.updatedAt) {
    const cooldownMs = config.requirements.retakePolicy.cooldownHours * 60 * 60 * 1000;
    const timeElapsed = Date.now() - latestAttempt.updatedAt.getTime();

    if (timeElapsed < cooldownMs) {
      const remainingMs = cooldownMs - timeElapsed;
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
      return {
        canRetake: false,
        reason: `Cooldown period active`,
        remainingHours
      };
    }
  }

  return { canRetake: true, reason: 'Eligible for retake' };
};

// Instance method to start timer
multimediaAssessmentSubmissionSchema.methods.startTimer = function () {
  if (this.timerState.isRunning) {
    throw new Error('Timer is already running');
  }

  this.timerState.isRunning = true;
  this.timerState.startTime = new Date();
  this.timerState.lastPauseStart = null;

  return this.save();
};

// Instance method to pause timer
multimediaAssessmentSubmissionSchema.methods.pauseTimer = function () {
  if (!this.timerState.isRunning) {
    throw new Error('Timer is not running');
  }

  this.timerState.isRunning = false;
  this.timerState.lastPauseStart = new Date();

  // Calculate time elapsed since start and add to total
  if (this.timerState.startTime) {
    const elapsed = Date.now() - this.timerState.startTime.getTime();
    this.totalTimeSpent += Math.floor(elapsed / 1000);
  }

  return this.save();
};

// Instance method to resume timer
multimediaAssessmentSubmissionSchema.methods.resumeTimer = function () {
  if (this.timerState.isRunning) {
    throw new Error('Timer is already running');
  }

  // Calculate paused duration and add to total
  if (this.timerState.lastPauseStart) {
    const pauseDuration = Date.now() - this.timerState.lastPauseStart.getTime();
    this.timerState.totalPausedDuration += Math.floor(pauseDuration / 1000);
  }

  this.timerState.isRunning = true;
  this.timerState.startTime = new Date();
  this.timerState.lastPauseStart = null;

  return this.save();
};

// Instance method to complete task
multimediaAssessmentSubmissionSchema.methods.completeTask = function (taskNumber) {
  const task = this.tasks.find(t => t.taskNumber === taskNumber);
  if (!task) {
    throw new Error(`Task ${taskNumber} not found`);
  }

  task.isCompleted = true;
  task.submittedAt = new Date();

  return this.save();
};

// Instance method to calculate total score from QA scores
multimediaAssessmentSubmissionSchema.methods.calculateTotalScore = function () {
  const completedTasks = this.tasks.filter(task =>
    task.isCompleted && task.qaScore && task.qaScore.taskTotal !== null
  );

  if (completedTasks.length === 0) {
    this.totalScore = null;
    return this.totalScore;
  }

  const totalScore = completedTasks.reduce((sum, task) => sum + task.qaScore.taskTotal, 0);
  this.totalScore = Math.round(totalScore / completedTasks.length);

  return this.totalScore;
};

// Pre-save middleware to validate submission
multimediaAssessmentSubmissionSchema.pre('save', function (next) {
  // Validate timer state
  if (this.timerState.isRunning && !this.timerState.startTime) {
    return next(new Error('Timer cannot be running without start time'));
  }

  // Auto-update last save time
  this.lastAutoSave = new Date();
  this.autoSaveCount += 1;

  next();
});

const MultimediaAssessmentSubmission = mongoose.model('MultimediaAssessmentSubmission', multimediaAssessmentSubmissionSchema);
export default MultimediaAssessmentSubmission;