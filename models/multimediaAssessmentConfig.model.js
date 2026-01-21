const mongoose = require('mongoose');

const multimediaAssessmentConfigSchema = new mongoose.Schema({
  // Basic configuration
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  instructions: {
    type: String,
    required: true,
    maxlength: 5000
  },
  
  // Project association
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnnotationProject',
    required: true
  },
  
  // Assessment requirements
  requirements: {
    tasksPerAssessment: {
      type: Number,
      default: 5,
      min: 1,
      max: 10
    },
    timeLimit: {
      type: Number, // in minutes
      default: 60,
      min: 15,
      max: 300 // Max 5 hours
    },
    allowPausing: {
      type: Boolean,
      default: true
    },
    retakePolicy: {
      allowed: {
        type: Boolean,
        default: true
      },
      cooldownHours: {
        type: Number,
        default: 24,
        min: 1,
        max: 168 // Max 1 week
      },
      maxAttempts: {
        type: Number,
        default: 3,
        min: 1,
        max: 10
      }
    }
  },
  
  // Video reel configuration
  videoReels: {
    totalAvailable: {
      type: Number,
      default: 0
    },
    reelsPerNiche: {
      lifestyle: { type: Number, default: 0 },
      fashion: { type: Number, default: 0 },
      food: { type: Number, default: 0 },
      travel: { type: Number, default: 0 },
      fitness: { type: Number, default: 0 },
      beauty: { type: Number, default: 0 },
      comedy: { type: Number, default: 0 },
      education: { type: Number, default: 0 },
      technology: { type: Number, default: 0 },
      music: { type: Number, default: 0 },
      dance: { type: Number, default: 0 },
      art: { type: Number, default: 0 },
      pets: { type: Number, default: 0 },
      nature: { type: Number, default: 0 },
      business: { type: Number, default: 0 },
      motivation: { type: Number, default: 0 },
      diy: { type: Number, default: 0 },
      gaming: { type: Number, default: 0 },
      sports: { type: Number, default: 0 },
      other: { type: Number, default: 0 }
    },
    randomizationEnabled: {
      type: Boolean,
      default: true
    }
  },
  
  // Scoring configuration
  scoring: {
    passingScore: {
      type: Number,
      default: 70,
      min: 0,
      max: 100
    },
    qaRequired: {
      type: Boolean,
      default: true
    },
    autoApprovalThreshold: {
      type: Number,
      default: null, // If null, all require manual review
      min: 0,
      max: 100
    },
    scoreWeights: {
      conversationQuality: {
        type: Number,
        default: 20,
        min: 0,
        max: 100
      },
      videoSegmentation: {
        type: Number,
        default: 20,
        min: 0,
        max: 100
      },
      promptRelevance: {
        type: Number,
        default: 20,
        min: 0,
        max: 100
      },
      creativityAndCoherence: {
        type: Number,
        default: 20,
        min: 0,
        max: 100
      },
      technicalExecution: {
        type: Number,
        default: 20,
        min: 0,
        max: 100
      }
    }
  },
  
  // Task configuration
  taskSettings: {
    conversationTurns: {
      min: {
        type: Number,
        default: 3
      },
      max: {
        type: Number,
        default: 8
      },
      recommended: {
        type: Number,
        default: 5
      }
    },
    videoSegmentLength: {
      min: {
        type: Number,
        default: 5 // seconds
      },
      max: {
        type: Number,
        default: 30 // seconds
      },
      recommended: {
        type: Number,
        default: 15
      }
    },
    allowVideoAsStartingPoint: {
      type: Boolean,
      default: true
    },
    allowPromptAsStartingPoint: {
      type: Boolean,
      default: true
    }
  },
  
  // Management info
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DTUser',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DTUser'
  },
  
  // Statistics
  statistics: {
    totalAttempts: {
      type: Number,
      default: 0
    },
    totalCompletions: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    averageTimeSpent: {
      type: Number, // in minutes
      default: 0
    },
    passRate: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
multimediaAssessmentConfigSchema.index({ projectId: 1 });
multimediaAssessmentConfigSchema.index({ isActive: 1 });
multimediaAssessmentConfigSchema.index({ createdBy: 1, createdAt: -1 });

// Virtual for completion rate
multimediaAssessmentConfigSchema.virtual('completionRate').get(function() {
  if (this.statistics.totalAttempts === 0) return 0;
  return ((this.statistics.totalCompletions / this.statistics.totalAttempts) * 100).toFixed(2);
});

// Virtual for total configured reels
multimediaAssessmentConfigSchema.virtual('totalConfiguredReels').get(function() {
  return Object.values(this.videoReels.reelsPerNiche).reduce((sum, count) => sum + count, 0);
});

// Static method to get active assessments for project
multimediaAssessmentConfigSchema.statics.getByProject = async function(projectId) {
  return this.findOne({ projectId, isActive: true })
    .populate('projectId', 'projectName projectDescription')
    .populate('createdBy', 'fullName email');
};

// Instance method to update statistics
multimediaAssessmentConfigSchema.methods.updateStatistics = async function() {
  const MultimediaAssessmentSubmission = mongoose.model('MultimediaAssessmentSubmission');
  
  const stats = await MultimediaAssessmentSubmission.aggregate([
    {
      $match: { assessmentId: this._id }
    },
    {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        totalCompletions: { 
          $sum: { $cond: [{ $in: ['$status', ['submitted', 'under_review', 'approved', 'rejected']] }, 1, 0] }
        },
        averageScore: { $avg: '$totalScore' },
        averageTimeSpent: { $avg: '$totalTimeSpent' },
        passCount: { 
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        }
      }
    }
  ]);
  
  if (stats.length > 0) {
    const stat = stats[0];
    this.statistics.totalAttempts = stat.totalAttempts;
    this.statistics.totalCompletions = stat.totalCompletions;
    this.statistics.averageScore = Math.round(stat.averageScore || 0);
    this.statistics.averageTimeSpent = Math.round((stat.averageTimeSpent || 0) / 60); // Convert to minutes
    this.statistics.passRate = stat.totalCompletions > 0 ? 
      Math.round((stat.passCount / stat.totalCompletions) * 100) : 0;
  }
  
  return this.save();
};

// Validation for score weights (should total 100)
multimediaAssessmentConfigSchema.pre('save', function(next) {
  const weights = this.scoring.scoreWeights;
  const total = weights.conversationQuality + weights.videoSegmentation + 
                weights.promptRelevance + weights.creativityAndCoherence + 
                weights.technicalExecution;
  
  if (Math.abs(total - 100) > 0.01) {
    return next(new Error('Score weights must total 100'));
  }
  
  next();
});

module.exports = mongoose.model('MultimediaAssessmentConfig', multimediaAssessmentConfigSchema);