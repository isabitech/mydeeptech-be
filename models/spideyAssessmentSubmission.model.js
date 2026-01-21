const mongoose = require('mongoose');

// Spidey Assessment Submission - integrates with existing submission system
// Follows same patterns as MultimediaAssessmentSubmission but with Spidey-specific validation
const spideyAssessmentSubmissionSchema = new mongoose.Schema({
  // Integration with existing user and project systems
  assessmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SpideyAssessmentConfig',
    required: true
  },
  annotatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DTUser', // Uses existing user model
    required: true,
    index: true
  },
  // Alias for state machine compatibility
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DTUser',
    required: true,
    index: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnnotationProject',
    required: true
  },
  
  // Assessment type integration
  assessmentType: {
    type: String,
    default: 'spidey_assessment',
    required: true
  },
  
  // State machine progression
  currentStage: {
    type: String,
    enum: [null, 'stage1', 'stage2', 'stage3', 'stage4', 'completed', 'failed'],
    default: null, // Must start from null - state machine enforces progression
    required: false
  },
  
  // Stage completion tracking
  stages: {
    stage1: {
      status: { 
        type: String, 
        enum: ['not_started', 'in_progress', 'completed', 'failed'],
        default: 'not_started' 
      },
      startedAt: Date,
      completedAt: Date,
      timeSpent: Number, // in seconds
      score: Number,
      maxScore: Number,
      responses: [{
        questionId: String,
        userAnswer: mongoose.Schema.Types.Mixed,
        isCorrect: Boolean,
        isCritical: Boolean,
        autoFailed: { type: Boolean, default: false }
      }],
      passed: Boolean,
      failureReason: String,
      auditLog: [{
        timestamp: Date,
        action: String,
        details: mongoose.Schema.Types.Mixed
      }]
    },
    
    stage2: {
      status: { 
        type: String, 
        enum: ['not_started', 'in_progress', 'completed', 'failed'],
        default: 'not_started' 
      },
      startedAt: Date,
      completedAt: Date,
      timeSpent: Number,
      submission: {
        promptText: String,
        domain: String,
        failureExplanation: String,
        fileReferences: [String],
        response: String
      },
      validation: {
        hasFileReference: Boolean,
        validDomain: Boolean,
        noForbiddenKeywords: Boolean,
        adequateLength: Boolean,
        logicalExplanation: Boolean
      },
      violations: [String], // Array of detected violations
      passed: Boolean,
      failureReason: String,
      auditLog: [{
        timestamp: Date,
        action: String,
        details: mongoose.Schema.Types.Mixed
      }]
    },
    
    stage3: {
      status: { 
        type: String, 
        enum: ['not_started', 'in_progress', 'completed', 'failed'],
        default: 'not_started' 
      },
      startedAt: Date,
      completedAt: Date,
      timeSpent: Number,
      files: [{
        filename: String,
        originalName: String,
        mimeType: String,
        size: Number,
        storageUrl: String,
        uploadedAt: Date,
        virusScanResult: {
          status: { type: String, enum: ['pending', 'clean', 'infected', 'error'] },
          scanDate: Date,
          details: String
        },
        validationType: { type: String, enum: ['golden_solution', 'rubric'] },
        contentHash: String // For immutability
      }],
      rubrics: {
        positiveRubric: {
          content: String,
          length: Number,
          isTestable: Boolean,
          validationPassed: Boolean
        },
        negativeRubric: {
          content: String,
          length: Number,
          isTestable: Boolean,
          validationPassed: Boolean
        }
      },
      validation: {
        allFilesValid: Boolean,
        virusScanPassed: Boolean,
        adequateContent: Boolean,
        rubricsValid: Boolean
      },
      violations: [String],
      passed: Boolean,
      failureReason: String,
      auditLog: [{
        timestamp: Date,
        action: String,
        details: mongoose.Schema.Types.Mixed
      }]
    },
    
    stage4: {
      status: { 
        type: String, 
        enum: ['not_started', 'in_progress', 'completed', 'failed'],
        default: 'not_started' 
      },
      startedAt: Date,
      completedAt: Date,
      timeSpent: Number,
      integrityTrap: {
        instructionGiven: String,
        userResponse: String,
        violationFlagged: Boolean,
        blindlyComplied: Boolean,
        responseTime: Number // Quick compliance is suspicious
      },
      validation: {
        detectedBlindCompliance: Boolean,
        properlyFlagged: Boolean,
        integrityMaintained: Boolean
      },
      passed: Boolean,
      failureReason: String,
      auditLog: [{
        timestamp: Date,
        action: String,
        details: mongoose.Schema.Types.Mixed
      }]
    }
  },
  
  // Overall assessment status (integrates with existing system)
  status: {
    type: String,
    enum: ['in_progress', 'submitted', 'under_review', 'approved', 'rejected', 'failed', 'completed', 'expired'],
    default: 'in_progress',
    required: true
  },

  // State machine tracking - required for strict enforcement
  stageHistory: [{
    stage: { type: String, required: true },
    result: {
      passed: { type: Boolean, required: true },
      score: { type: Number, min: 0, max: 100 },
      requiredScore: { type: Number, min: 0, max: 100 },
      hardFail: { type: Boolean, default: false },
      violations: [{
        rule: String,
        description: String,
        severity: { type: String, enum: ['warning', 'error', 'critical'], default: 'error' }
      }],
      submissionData: mongoose.Schema.Types.Mixed,
      timeSpent: { type: Number, min: 0 },
      submittedAt: { type: Date, required: true }
    },
    completedAt: { type: Date, required: true },
    passed: { type: Boolean, required: true },
    score: { type: Number, min: 0, max: 100 },
    violations: [{
      rule: String,
      description: String,
      severity: { type: String, enum: ['warning', 'error', 'critical'] }
    }]
  }],

  // Rule violations for audit
  ruleViolations: [{
    reason: { type: String, required: true },
    details: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, required: true, default: Date.now },
    severity: { type: String, enum: ['warning', 'error', 'critical'], default: 'error' }
  }],

  // Comprehensive audit trail
  auditTrail: [{
    action: { type: String, required: true },
    details: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, required: true, default: Date.now },
    stage: String
  }],

  // Failure information
  failureReason: {
    type: String,
    enum: [
      'INVALID_STAGE_TRANSITION',
      'HARD_FAIL_VIOLATION', 
      'STAGE_FAILED',
      'TIME_EXPIRED',
      'INTEGRITY_VIOLATION',
      'FORBIDDEN_FORMAT',
      'MISSING_REQUIREMENTS',
      'MANUAL_TERMINATION'
    ]
  },

  // Timing fields for state machine
  startedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  lastActivityAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: function() {
      // 7 days from start by default
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  },
  
  // Timing and session tracking
  totalTimeSpent: { type: Number, default: 0 }, // in seconds
  sessionStarted: { type: Date, required: true },
  submittedAt: Date,
  
  // Scoring (only calculated after hard rules pass)
  finalScore: {
    totalPoints: Number,
    maxPoints: Number,
    percentage: Number,
    breakdown: {
      stage1Score: Number,
      stage2Score: Number,
      stage3Score: Number,
      stage4Score: Number
    },
    passed: Boolean,
    autoApproved: Boolean
  },
  
  // Hard rule violations (any = immediate fail)
  hardRuleViolations: [{
    rule: String,
    violation: String,
    stageDetected: String,
    timestamp: Date,
    severity: { type: String, enum: ['warning', 'fail'], default: 'fail' }
  }],
  
  // Security and audit
  securityData: {
    ipAddress: String,
    userAgent: String,
    sessionId: String,
    suspiciousActivity: [{
      type: String,
      description: String,
      timestamp: Date,
      severity: { type: String, enum: ['low', 'medium', 'high'] }
    }]
  },
  
  // Integration with existing QA system
  qaReview: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QAReview'
  },
  
  // Attempt tracking
  attemptNumber: { type: Number, default: 1 },
  
  // Failure analysis for improvement
  failureAnalysis: {
    primaryFailureStage: String,
    failureCategory: { 
      type: String, 
      enum: ['hard_rule', 'scoring', 'integrity', 'technical', 'time_limit'] 
    },
    improvementSuggestions: [String],
    retakeEligible: { type: Boolean, default: false }
  }
}, {
  timestamps: true,
  collection: 'spideyassessmentsubmissions'
});

// Indexes for performance
spideyAssessmentSubmissionSchema.index({ annotatorId: 1, status: 1 });
spideyAssessmentSubmissionSchema.index({ projectId: 1, submittedAt: -1 });
spideyAssessmentSubmissionSchema.index({ currentStage: 1, status: 1 });
spideyAssessmentSubmissionSchema.index({ 'finalScore.passed': 1 });
spideyAssessmentSubmissionSchema.index({ assessmentType: 1 });

// Method to validate stage progression (implements state machine)
spideyAssessmentSubmissionSchema.methods.canProgressToStage = function(targetStage) {
  const validTransitions = {
    'stage1': ['stage2'],
    'stage2': ['stage3'],
    'stage3': ['stage4'],
    'stage4': ['completed']
  };
  
  return validTransitions[this.currentStage]?.includes(targetStage) || false;
};

// State machine methods for strict enforcement
spideyAssessmentSubmissionSchema.methods.isExpired = function() {
  return this.status === 'in_progress' && new Date() > this.expiresAt;
};

spideyAssessmentSubmissionSchema.methods.getTimeSpentInMinutes = function() {
  if (!this.startedAt) return 0;
  const endTime = this.completedAt || new Date();
  return Math.round((endTime - this.startedAt) / (1000 * 60));
};

spideyAssessmentSubmissionSchema.methods.addRuleViolation = function(reason, details, severity = 'error') {
  this.ruleViolations.push({
    reason,
    details,
    severity,
    timestamp: new Date()
  });
};

spideyAssessmentSubmissionSchema.methods.addAuditEntry = function(action, details, stage = null) {
  this.auditTrail.push({
    action,
    details,
    stage,
    timestamp: new Date()
  });
};

// Method to fail assessment with reason
spideyAssessmentSubmissionSchema.methods.failAssessment = function(stage, reason, violationType = 'hard_rule') {
  this.status = 'failed';
  this.currentStage = 'failed';
  this.submittedAt = new Date();
  
  // Mark the failing stage
  if (this.stages[stage]) {
    this.stages[stage].status = 'failed';
    this.stages[stage].failureReason = reason;
    this.stages[stage].completedAt = new Date();
  }
  
  // Record failure analysis
  this.failureAnalysis = {
    primaryFailureStage: stage,
    failureCategory: violationType,
    retakeEligible: violationType !== 'hard_rule' // Hard rules = no retake
  };
  
  return this.save();
};

// Method to progress to next stage
spideyAssessmentSubmissionSchema.methods.progressToNextStage = function() {
  const stageOrder = ['stage1', 'stage2', 'stage3', 'stage4', 'completed'];
  const currentIndex = stageOrder.indexOf(this.currentStage);
  
  if (currentIndex >= 0 && currentIndex < stageOrder.length - 1) {
    this.currentStage = stageOrder[currentIndex + 1];
    return true;
  }
  
  return false;
};

// Method to add audit log entry
spideyAssessmentSubmissionSchema.methods.addAuditLog = function(stage, action, details) {
  if (!this.stages[stage]) return false;
  
  this.stages[stage].auditLog.push({
    timestamp: new Date(),
    action,
    details
  });
  
  return this.save();
};

// Static method to find submissions pending QA review
spideyAssessmentSubmissionSchema.statics.findPendingQAReview = function() {
  return this.find({
    status: 'submitted',
    assessmentType: 'spidey_assessment',
    submittedAt: { $exists: true }
  }).populate('annotatorId assessmentId projectId');
};

// Static method to check retake eligibility
spideyAssessmentSubmissionSchema.statics.checkRetakeEligibility = async function(userId, assessmentId) {
  const attempts = await this.find({
    annotatorId: userId,
    assessmentId: assessmentId
  }).sort({ createdAt: -1 });
  
  if (attempts.length === 0) return { eligible: true, reason: 'First attempt' };
  
  const lastAttempt = attempts[0];
  if (lastAttempt.status === 'approved') {
    return { eligible: false, reason: 'Already passed' };
  }
  
  // Check retake policy from config
  // This would need to be populated with actual config
  return { eligible: false, reason: 'Retakes not allowed for Spidey assessment' };
};

// Pre-save middleware for state machine enforcement
spideyAssessmentSubmissionSchema.pre('save', function(next) {
  // Update lastActivityAt on any change
  this.lastActivityAt = new Date();
  
  // Auto-expire check
  if (this.isExpired() && this.status === 'in_progress') {
    this.status = 'expired';
    this.currentStage = 'failed';
    this.failureReason = 'TIME_EXPIRED';
    this.completedAt = new Date();
  }
  
  // Set candidateId from annotatorId for state machine compatibility
  if (this.annotatorId && !this.candidateId) {
    this.candidateId = this.annotatorId;
  }
  
  next();
});

const SpideyAssessmentSubmission = mongoose.model('SpideyAssessmentSubmission', spideyAssessmentSubmissionSchema);

module.exports = SpideyAssessmentSubmission;