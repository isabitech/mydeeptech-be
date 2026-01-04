import mongoose from 'mongoose';

/**
 * AUDIT LOG MODEL
 * Tracks all assessment-related actions for compliance and debugging
 * Used by Spidey Assessment system for comprehensive audit trails
 */

const auditLogSchema = new mongoose.Schema({
  // Core identification
  assessmentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'SpideyAssessmentConfig'
  },

  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'SpideyAssessmentSubmission'
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'DTUser'
  },

  // Action details
  action: {
    type: String,
    required: true,
    enum: [
      'ASSESSMENT_STARTED',
      'STAGE_TRANSITION',
      'STAGE_SUBMITTED',
      'VALIDATION_EXECUTED',
      'RULE_VIOLATION_DETECTED',
      'ASSESSMENT_FAILED',
      'ASSESSMENT_COMPLETED',
      'FINAL_DECISION_MADE',
      'AUDIT_GENERATED'
    ]
  },

  stage: {
    type: String,
    enum: ['stage1', 'stage2', 'stage3', 'stage4', 'final'],
    required: function () {
      return this.action.includes('STAGE') || this.action.includes('TRANSITION');
    }
  },

  // Contextual data
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Result information
  success: {
    type: Boolean,
    required: true
  },

  errorMessage: {
    type: String,
    default: null
  },

  // Metadata
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },

  ipAddress: {
    type: String,
    default: null
  },

  userAgent: {
    type: String,
    default: null
  },

  sessionId: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  collection: 'auditlogs'
});

// Indexes for efficient querying
auditLogSchema.index({ submissionId: 1, timestamp: 1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ assessmentId: 1, action: 1 });
auditLogSchema.index({ timestamp: -1 }); // For chronological queries

// Static methods for common operations
auditLogSchema.statics.logAction = async function (data) {
  const log = new this(data);
  return await log.save();
};

auditLogSchema.statics.getSubmissionAuditTrail = async function (submissionId) {
  return await this.find({ submissionId })
    .sort({ timestamp: 1 })
    .populate('userId', 'email fullName')
    .lean();
};

auditLogSchema.statics.getAssessmentAnalytics = async function (assessmentId) {
  const pipeline = [
    { $match: { assessmentId: new mongoose.Types.ObjectId(assessmentId) } },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
        successRate: { $avg: { $cond: ['$success', 1, 0] } }
      }
    }
  ];

  return await this.aggregate(pipeline);
};

// Instance methods
auditLogSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  return {
    id: obj._id,
    action: obj.action,
    stage: obj.stage,
    success: obj.success,
    timestamp: obj.timestamp,
    details: obj.details
  };
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;