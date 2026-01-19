import mongoose from "mongoose";

const annotationProjectSchema = new mongoose.Schema(
  {
    // Basic project information
    projectName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    projectDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    projectCategory: {
      type: String,
      required: true,
      enum: [
        "Text Annotation",
        "Image Annotation",
        "Audio Annotation",
        "Video Annotation",
        "Data Labeling",
        "Content Moderation",
        "Transcription",
        "Translation",
        "Sentiment Analysis",
        "Entity Recognition",
        "Classification",
        "Object Detection",
        "Semantic Segmentation",
        "Survey Research",
        "Data Entry",
        "Quality Assurance",
        "Other"
      ]
    },
    payRate: {
      type: Number,
      required: true,
      min: 0
    },
    payRateCurrency: {
      type: String,
      default: "USD",
      enum: ["USD", "EUR", "GBP", "NGN", "KES", "GHS"]
    },
    payRateType: {
      type: String,
      default: "per_task",
      enum: ["per_task", "per_hour", "per_project", "per_annotation"]
    },

    // Project settings
    status: {
      type: String,
      enum: ["draft", "active", "paused", "completed", "cancelled"],
      default: "active"
    },
    maxAnnotators: {
      type: Number,
      default: null // null means unlimited
    },
    deadline: {
      type: Date,
      default: null
    },
    estimatedDuration: {
      type: String, // e.g., "2 weeks", "1 month"
      default: null
    },
    difficultyLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert"],
      default: "intermediate"
    },

    // Requirements
    requiredSkills: {
      type: [String],
      default: []
    },
    minimumExperience: {
      type: String,
      enum: ["none", "beginner", "intermediate", "advanced"],
      default: "none"
    },
    languageRequirements: {
      type: [String],
      default: []
    },

    // Admin/Creator info
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      required: true
    },
    assignedAdmins: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser"
    }],

    // Application and participation tracking
    totalApplications: {
      type: Number,
      default: 0
    },
    approvedAnnotators: {
      type: Number,
      default: 0
    },

    // Project guidelines and resources
    projectGuidelineLink: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^https?:\/\/.+/.test(v);
        },
        message: 'Project guideline link must be a valid URL'
      }
    },
    projectGuidelineVideo: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Project guideline video must be a valid URL'
      },
      default: null
    },
    projectCommunityLink: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Project community link must be a valid URL'
      },
      default: null
    },
    projectTrackerLink: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Project tracker link must be a valid URL'
      },
      default: null
    },

    // Project metadata
    tags: {
      type: [String],
      default: []
    },
    isPublic: {
      type: Boolean,
      default: true
    },
    applicationDeadline: {
      type: Date,
      default: null
    },

    // Project media and attachments
    media: [{
      publicId: { type: String, required: true },
      url: { type: String, required: true },
      originalName: { type: String, required: true },
      size: { type: Number, required: true },
      format: { type: String, required: true },
      resourceType: { type: String, enum: ["image", "video", "raw"], required: true },
      thumbnail: { type: String, default: null },
      optimizedUrl: { type: String, default: null },
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DTUser",
        required: true
      },
      uploadedAt: { type: Date, default: Date.now }
    }],

    projectFiles: {
      instructionDocuments: [{
        publicId: { type: String, required: true },
        url: { type: String, required: true },
        originalName: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now }
      }],
      sampleData: [{
        publicId: { type: String, required: true },
        url: { type: String, required: true },
        originalName: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now }
      }],
      guidelines: [{
        publicId: { type: String, required: true },
        url: { type: String, required: true },
        originalName: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now }
      }]
    },

    // Project deletion OTP (for Projects Officer authorization)
    deletionOTP: {
      code: { type: String, default: null },
      expiresAt: { type: Date, default: null },
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DTUser",
        default: null
      },
      requestedAt: { type: Date, default: null },
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date, default: null },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DTUser",
        default: null
      }
    },

    // Assessment configuration (optional)
    assessment: {
      isRequired: {
        type: Boolean,
        default: false
      },
      assessmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MultimediaAssessmentConfig",
        default: null
      },
      assessmentInstructions: {
        type: String,
        maxlength: 1000,
        default: ''
      },
      // When assessment was attached to project
      attachedAt: {
        type: Date,
        default: null
      },
      attachedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DTUser",
        default: null
      }
    }
  },
  { timestamps: true }
);

// Indexes for better query performance
annotationProjectSchema.index({ projectCategory: 1, status: 1 });
annotationProjectSchema.index({ createdBy: 1 });
annotationProjectSchema.index({ status: 1, isPublic: 1 });
annotationProjectSchema.index({ tags: 1 });

// Virtual for application count
annotationProjectSchema.virtual('applicationCount', {
  ref: 'ProjectApplication',
  localField: '_id',
  foreignField: 'projectId',
  count: true
});

// Ensure virtual fields are serialized
annotationProjectSchema.set('toJSON', { virtuals: true });

const AnnotationProject = mongoose.model("AnnotationProject", annotationProjectSchema);
export default AnnotationProject;
