const mongoose = require("mongoose");

const projectApplicationSchema = new mongoose.Schema(
  {
    // Core application data
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnnotationProject",
      required: true
    },
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      required: true
    },
    
    // Application status and timeline
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "withdrawn", "removed", "assessment_required"],
      default: "pending"
    },
    appliedAt: {
      type: Date,
      default: Date.now
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      default: null
    },

    // Application details
    coverLetter: {
      type: String,
      maxlength: 1000,
      default: ""
    },
    resumeUrl: {
      type: String,
      required: true // Resume is now required for all applications
    },
    proposedRate: {
      type: Number,
      default: null // User can propose their own rate
    },
    availability: {
      type: String,
      enum: ["full_time", "part_time", "weekends", "flexible"],
      default: "flexible"
    },
    estimatedCompletionTime: {
      type: String,
      default: ""
    },

    // Review details (filled when admin reviews)
    reviewNotes: {
      type: String,
      maxlength: 500,
      default: ""
    },
    rejectionReason: {
      type: String,
      enum: [
        "insufficient_experience",
        "not_suitable_skills", 
        "project_full",
        "application_quality",
        "availability_mismatch",
        "rate_mismatch",
        "other"
      ],
      default: null
    },

    // Notification tracking
    applicantNotified: {
      type: Boolean,
      default: false
    },
    adminNotified: {
      type: Boolean,
      default: false
    },

    // Work progress (for approved applications)
    workStartedAt: {
      type: Date,
      default: null
    },
    workCompletedAt: {
      type: Date,
      default: null
    },
    tasksCompleted: {
      type: Number,
      default: 0
    },
    qualityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },

    // Removal tracking (for removed approved applicants)
    removedAt: {
      type: Date,
      default: null
    },
    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DTUser',
      default: null
    },
    removalReason: {
      type: String,
      enum: [
        "performance_issues",
        "project_cancelled",
        "violates_guidelines", 
        "unavailable",
        "quality_concerns",
        "admin_decision",
        "other"
      ],
      default: null
    },
    removalNotes: {
      type: String,
      maxlength: 500,
      default: ""
    },

    // Assessment tracking (for projects that require assessments)
    assessmentCompletedAt: {
      type: Date,
      default: null
    },
    assessmentSubmissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MultimediaAssessmentSubmission',
      default: null
    },
    assessmentResult: {
      type: String,
      enum: ['pending', 'passed', 'failed', 'not_required'],
      default: 'not_required'
    }
  },
  { timestamps: true }
);

// Compound indexes for better query performance
projectApplicationSchema.index({ projectId: 1, applicantId: 1 }, { unique: true }); // Prevent duplicate applications
projectApplicationSchema.index({ projectId: 1, status: 1 });
projectApplicationSchema.index({ applicantId: 1, status: 1 });
projectApplicationSchema.index({ reviewedBy: 1 });
projectApplicationSchema.index({ appliedAt: -1 });

// Virtual to populate project details
projectApplicationSchema.virtual('project', {
  ref: 'AnnotationProject',
  localField: 'projectId',
  foreignField: '_id',
  justOne: true
});

// Virtual to populate applicant details
projectApplicationSchema.virtual('applicant', {
  ref: 'DTUser',
  localField: 'applicantId',
  foreignField: '_id',
  justOne: true
});

// Virtual to populate reviewer details
projectApplicationSchema.virtual('reviewer', {
  ref: 'DTUser',
  localField: 'reviewedBy',
  foreignField: '_id',
  justOne: true
});

// Ensure virtual fields are serialized
projectApplicationSchema.set('toJSON', { virtuals: true });

// Pre-save middleware to update timestamps
projectApplicationSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status !== 'pending') {
    this.reviewedAt = new Date();
  }
  next();
});

module.exports = mongoose.model("ProjectApplication", projectApplicationSchema);