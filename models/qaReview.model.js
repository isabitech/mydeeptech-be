import mongoose from 'mongoose';

const qaTaskScoreSchema = new mongoose.Schema({
  taskNumber: {
    type: Number,
    required: true,
    min: 1
  },
  scores: {
    conversationQuality: {
      type: Number,
      required: true,
      min: 0,
      max: 20
    },
    videoSegmentation: {
      type: Number,
      required: true,
      min: 0,
      max: 20
    },
    promptRelevance: {
      type: Number,
      required: true,
      min: 0,
      max: 20
    },
    creativityAndCoherence: {
      type: Number,
      required: true,
      min: 0,
      max: 20
    },
    technicalExecution: {
      type: Number,
      required: true,
      min: 0,
      max: 20
    }
  },
  individualFeedback: {
    type: String,
    maxlength: 1000,
    default: ''
  },
  totalScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, { _id: false });

const qaReviewSchema = new mongoose.Schema({
  // Reference to the submission being reviewed
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MultimediaAssessmentSubmission',
    required: true,
    unique: true // One review per submission
  },

  // QA Reviewer information
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DTUser',
    required: true
  },

  // Task-level scoring
  taskScores: [qaTaskScoreSchema],

  // Overall assessment
  overallScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },

  // QA Decision
  decision: {
    type: String,
    enum: ['Approve', 'Reject', 'Request Revision'],
    required: true
  },

  // Detailed feedback
  feedback: {
    type: String,
    required: true,
    maxlength: 2000
  },

  // Detailed comments for improvement
  detailedComments: {
    type: String,
    maxlength: 5000,
    default: ''
  },

  // QA Categories feedback
  categoryFeedback: {
    conversationQuality: {
      type: String,
      maxlength: 500,
      default: ''
    },
    videoSegmentation: {
      type: String,
      maxlength: 500,
      default: ''
    },
    promptRelevance: {
      type: String,
      maxlength: 500,
      default: ''
    },
    creativityAndCoherence: {
      type: String,
      maxlength: 500,
      default: ''
    },
    technicalExecution: {
      type: String,
      maxlength: 500,
      default: ''
    }
  },

  // Review process tracking
  reviewTime: {
    type: Number, // in minutes
    required: true,
    min: 1
  },

  // Review status
  reviewStatus: {
    type: String,
    enum: ['draft', 'completed'],
    default: 'completed'
  },

  // Review metadata
  reviewedAt: {
    type: Date,
    default: Date.now
  },

  // Quality indicators
  reviewQuality: {
    thoroughness: {
      type: Number,
      min: 1,
      max: 5,
      default: null // To be set by admin/senior QA
    },
    consistency: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    helpfulness: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    }
  },

  // Admin oversight
  adminReview: {
    reviewed: {
      type: Boolean,
      default: false
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DTUser',
      default: null
    },
    adminComments: {
      type: String,
      maxlength: 1000,
      default: ''
    },
    adminApproval: {
      type: String,
      enum: ['approved', 'needs_revision', 'rejected'],
      default: null
    }
  },

  // Revision tracking
  revisionHistory: [{
    revisedAt: {
      type: Date,
      default: Date.now
    },
    changes: {
      type: String,
      maxlength: 1000
    },
    previousScore: Number,
    newScore: Number,
    reason: {
      type: String,
      maxlength: 500
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
qaReviewSchema.index({ submissionId: 1 }, { unique: true });
qaReviewSchema.index({ reviewerId: 1, reviewedAt: -1 });
qaReviewSchema.index({ decision: 1, reviewedAt: -1 });
qaReviewSchema.index({ overallScore: 1 });
qaReviewSchema.index({ reviewStatus: 1 });

// Virtual for average task score
qaReviewSchema.virtual('averageTaskScore').get(function () {
  if (!this.taskScores || this.taskScores.length === 0) return 0;
  const total = this.taskScores.reduce((sum, task) => sum + task.totalScore, 0);
  return Math.round(total / this.taskScores.length);
});

// Virtual for review efficiency (score per minute)
qaReviewSchema.virtual('reviewEfficiency').get(function () {
  if (this.reviewTime === 0) return 0;
  return (this.taskScores.length / this.reviewTime).toFixed(2);
});

// Virtual for feedback length analysis
qaReviewSchema.virtual('feedbackAnalysis').get(function () {
  const totalFeedbackLength = this.feedback.length + this.detailedComments.length +
    Object.values(this.categoryFeedback).reduce((sum, feedback) => sum + feedback.length, 0);

  return {
    totalLength: totalFeedbackLength,
    averagePerTask: this.taskScores.length > 0 ? Math.round(totalFeedbackLength / this.taskScores.length) : 0,
    thoroughnessLevel: totalFeedbackLength > 1000 ? 'detailed' :
      totalFeedbackLength > 500 ? 'moderate' : 'brief'
  };
});

// Static method to get QA reviewer statistics
qaReviewSchema.statics.getReviewerStats = async function (reviewerId, startDate, endDate) {
  const matchStage = { reviewerId };

  if (startDate || endDate) {
    matchStage.reviewedAt = {};
    if (startDate) matchStage.reviewedAt.$gte = startDate;
    if (endDate) matchStage.reviewedAt.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageScore: { $avg: '$overallScore' },
        averageReviewTime: { $avg: '$reviewTime' },
        approvalRate: {
          $avg: { $cond: [{ $eq: ['$decision', 'Approve'] }, 1, 0] }
        },
        totalReviewTime: { $sum: '$reviewTime' },
        scoreDistribution: {
          $push: '$overallScore'
        }
      }
    },
    {
      $addFields: {
        approvalRate: { $multiply: ['$approvalRate', 100] }, // Convert to percentage
        averageReviewTime: { $round: ['$averageReviewTime', 1] },
        averageScore: { $round: ['$averageScore', 1] }
      }
    }
  ]);
};

// Static method to get pending reviews for QA dashboard
qaReviewSchema.statics.getPendingReviews = async function (reviewerId = null, limit = 50, page = 1) {
  const MultimediaAssessmentSubmission = mongoose.model('MultimediaAssessmentSubmission');

  const matchStage = {
    status: 'submitted',
    qaReview: { $exists: false }
  };

  const skip = (page - 1) * limit;

  return MultimediaAssessmentSubmission.find(matchStage)
    .populate('annotatorId', 'fullName email')
    .populate('assessmentId', 'title projectId')
    .populate('projectId', 'projectName')
    .sort({ submittedAt: 1 }) // FIFO - First submitted, first reviewed
    .skip(skip)
    .limit(limit);
};

// Instance method to calculate task scores
qaReviewSchema.methods.calculateTaskScores = function () {
  this.taskScores.forEach(taskScore => {
    const scores = taskScore.scores;
    taskScore.totalScore = scores.conversationQuality + scores.videoSegmentation +
      scores.promptRelevance + scores.creativityAndCoherence +
      scores.technicalExecution;
  });

  // Calculate overall score as average of task scores
  if (this.taskScores.length > 0) {
    const total = this.taskScores.reduce((sum, task) => sum + task.totalScore, 0);
    this.overallScore = Math.round(total / this.taskScores.length);
  }

  return this;
};

// Instance method to add revision
qaReviewSchema.methods.addRevision = function (changes, reason, newScore) {
  const previousScore = this.overallScore;

  this.revisionHistory.push({
    changes,
    reason,
    previousScore,
    newScore: newScore || this.overallScore
  });

  return this;
};

// Instance method to complete review and update submission
qaReviewSchema.methods.completeReview = async function () {
  const MultimediaAssessmentSubmission = mongoose.model('MultimediaAssessmentSubmission');

  // Update the submission status and score
  const submission = await MultimediaAssessmentSubmission.findById(this.submissionId);

  if (!submission) {
    throw new Error('Associated submission not found');
  }

  // Update submission with QA results
  submission.status = this.decision === 'Approve' ? 'approved' :
    this.decision === 'Request Revision' ? 'revision_requested' : 'rejected';
  submission.totalScore = this.overallScore;
  submission.qaReview = this._id;

  // Update individual task scores in submission
  this.taskScores.forEach(taskScore => {
    const task = submission.tasks.find(t => t.taskNumber === taskScore.taskNumber);
    if (task) {
      task.qaScore = {
        conversationQuality: taskScore.scores.conversationQuality,
        videoSegmentation: taskScore.scores.videoSegmentation,
        promptRelevance: taskScore.scores.promptRelevance,
        creativityAndCoherence: taskScore.scores.creativityAndCoherence,
        technicalExecution: taskScore.scores.technicalExecution,
        taskTotal: taskScore.totalScore,
        individualFeedback: taskScore.individualFeedback
      };
    }
  });

  await submission.save();

  // Update user's multimedia assessment status
  const DTUser = mongoose.model('DTUser');
  const user = await DTUser.findById(submission.annotatorId);

  if (user) {
    user.multimediaAssessmentStatus = this.decision === 'Approve' ? 'passed' :
      this.decision === 'Request Revision' ? 'pending' : 'failed';
    await user.save();
  }

  return this.save();
};

// Pre-save middleware to validate scores
qaReviewSchema.pre('save', function (next) {
  // Ensure all task scores are calculated
  this.calculateTaskScores();

  // Validate that we have scores for all tasks in submission
  if (this.taskScores.length === 0) {
    return next(new Error('At least one task score is required'));
  }

  next();
});

const QAReview = mongoose.model('QAReview', qaReviewSchema);
export default QAReview;