const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema(
  {
    // User who took the assessment
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DTUser',
      required: true,
      index: true
    },

    // Assessment metadata
    assessmentType: {
      type: String,
      enum: ['annotator_qualification', 'skill_assessment', 'project_specific'],
      default: 'annotator_qualification',
      required: true
    },
    
    // Assessment scoring
    totalQuestions: {
      type: Number,
      required: true,
      min: 1
    },
    correctAnswers: {
      type: Number,
      required: true,
      min: 0
    },
    scorePercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    
    // Assessment result
    passed: {
      type: Boolean,
      required: true
    },
    passingScore: {
      type: Number,
      default: 60,
      min: 0,
      max: 100
    },

    // Timing information
    startedAt: {
      type: Date,
      required: true
    },
    completedAt: {
      type: Date,
      required: true
    },
    timeSpentMinutes: {
      type: Number,
      required: true,
      min: 0
    },

    // Assessment content and responses
    questions: [{
      questionId: {
        type: String,
        required: true
      },
      questionText: {
        type: String,
        required: true
      },
      questionType: {
        type: String,
        enum: ['multiple_choice', 'true_false', 'text_input', 'image_annotation', 'other'],
        default: 'multiple_choice'
      },
      options: [{
        optionId: { type: String },
        optionText: { type: String },
        isCorrect: { type: Boolean, default: false }
      }],
      correctAnswer: {
        type: mongoose.Schema.Types.Mixed, // Can be string, array, or object
        required: true
      },
      userAnswer: {
        type: mongoose.Schema.Types.Mixed, // User's response
        required: true
      },
      isCorrect: {
        type: Boolean,
        required: true
      },
      pointsAwarded: {
        type: Number,
        default: 1
      },
      maxPoints: {
        type: Number,
        default: 1
      }
    }],

    // Status tracking
    statusBeforeAssessment: {
      annotatorStatus: {
        type: String,
        enum: ["pending", "submitted", "verified", "approved", "rejected"],
        required: true
      },
      microTaskerStatus: {
        type: String,
        enum: ["pending", "submitted", "verified", "approved", "rejected"],
        required: true
      }
    },
    statusAfterAssessment: {
      annotatorStatus: {
        type: String,
        enum: ["pending", "submitted", "verified", "approved", "rejected"]
      },
      microTaskerStatus: {
        type: String,
        enum: ["pending", "submitted", "verified", "approved", "rejected"]
      }
    },

    // Additional assessment data
    category: {
      type: String,
      default: 'general'
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate'
    },
    
    // IP and session tracking for security
    ipAddress: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    },
    
    // Retake information
    attemptNumber: {
      type: Number,
      default: 1,
      min: 1
    },
    isRetake: {
      type: Boolean,
      default: false
    },
    previousAttempts: [{
      attemptDate: Date,
      scorePercentage: Number,
      passed: Boolean
    }],

    // Review and verification
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DTUser',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewNotes: {
      type: String,
      default: '',
      maxlength: 1000
    },
    flaggedForReview: {
      type: Boolean,
      default: false
    },
    flagReason: {
      type: String,
      default: '',
      maxlength: 500
    }
  },
  { 
    timestamps: true 
  }
);

// Indexes for efficient querying
assessmentSchema.index({ userId: 1, createdAt: -1 });
assessmentSchema.index({ userId: 1, assessmentType: 1 });
assessmentSchema.index({ passed: 1, createdAt: -1 });
assessmentSchema.index({ scorePercentage: -1 });
assessmentSchema.index({ assessmentType: 1, passed: 1 });

// Virtual to calculate time spent in a readable format
assessmentSchema.virtual('timeSpentFormatted').get(function() {
  const minutes = this.timeSpentMinutes;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${remainingMinutes}m`;
});

// Static method to get user's best score
assessmentSchema.statics.getUserBestScore = function(userId, assessmentType = 'annotator_qualification') {
  return this.findOne({
    userId: userId,
    assessmentType: assessmentType
  }).sort({ scorePercentage: -1, createdAt: -1 });
};

// Static method to get user's latest attempt
assessmentSchema.statics.getUserLatestAttempt = function(userId, assessmentType = 'annotator_qualification') {
  return this.findOne({
    userId: userId,
    assessmentType: assessmentType
  }).sort({ createdAt: -1 });
};

// Static method to check if user can retake (e.g., wait period)
assessmentSchema.statics.canUserRetake = function(userId, assessmentType = 'annotator_qualification', waitHours = 24) {
  const waitTime = new Date(Date.now() - waitHours * 60 * 60 * 1000);
  
  return this.findOne({
    userId: userId,
    assessmentType: assessmentType,
    createdAt: { $gte: waitTime }
  }).then(recentAttempt => {
    return !recentAttempt; // Can retake if no recent attempt found
  });
};

// Instance method to calculate grade
assessmentSchema.methods.getGrade = function() {
  const score = this.scorePercentage;
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
};

// Pre-save hook to calculate derived fields
assessmentSchema.pre('save', function(next) {
  // Calculate score percentage
  if (this.totalQuestions > 0) {
    this.scorePercentage = Math.round((this.correctAnswers / this.totalQuestions) * 100);
  }
  
  // Determine if passed
  this.passed = this.scorePercentage >= this.passingScore;
  
  // Calculate time spent in minutes
  if (this.startedAt && this.completedAt) {
    this.timeSpentMinutes = Math.round((this.completedAt - this.startedAt) / (1000 * 60));
  }
  
  next();
});

module.exports = mongoose.model('Assessment', assessmentSchema);