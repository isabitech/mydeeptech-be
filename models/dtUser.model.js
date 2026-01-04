import mongoose from "mongoose";

const dtUserSchema = new mongoose.Schema(
  {
    // Basic registration fields
    fullName: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    domains: {
      type: [String],
      default: []
    },
    socialsFollowed: {
      type: [String],
      default: []
    },
    consent: {
      type: Boolean,
      required: true
    },

    // Authentication fields
    password: {
      type: String,
      default: null
    },
    hasSetPassword: {
      type: Boolean,
      default: false
    },
    isEmailVerified: { type: Boolean, default: false },

    // Password reset fields
    passwordResetToken: {
      type: String,
      default: null
    },
    passwordResetExpires: {
      type: Date,
      default: null
    },
    passwordResetAttempts: {
      type: Number,
      default: 0
    },

    // Default statuses
    annotatorStatus: {
      type: String,
      enum: ["pending", "submitted", "verified", "approved", "rejected"],
      default: "pending",
    },
    microTaskerStatus: {
      type: String,
      enum: ["pending", "submitted", "verified", "approved", "rejected"],
      default: "pending",
    },
    qaStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    multimediaAssessmentStatus: {
      type: String,
      enum: ["not_started", "in_progress", "submitted", "under_review", "passed", "failed"],
      default: "not_started",
    },
    // Spidey High-Discipline Assessment Status (integrates with existing system)
    spideyAssessmentStatus: {
      type: String,
      enum: ["not_started", "in_progress", "submitted", "under_review", "passed", "failed"],
      default: "not_started",
    },
    resultLink: { type: String, default: "" },

    // Result submissions and storage
    resultSubmissions: [{
      originalResultLink: { type: String, default: '' }, // Empty for direct uploads
      cloudinaryResultData: {
        publicId: { type: String, required: true },
        url: { type: String, required: true },
        optimizedUrl: { type: String, default: "" },
        thumbnailUrl: { type: String, default: "" },
        originalName: { type: String, default: "" },
        size: { type: Number, default: 0 },
        format: { type: String, default: "" }
      },
      submissionDate: { type: Date, default: Date.now },
      projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AnnotationProject",
        default: null
      },
      taskId: { type: String, default: "" }, // For future task tracking
      status: {
        type: String,
        enum: ["pending", "processing", "stored", "failed"],
        default: "pending"
      },
      uploadMethod: {
        type: String,
        enum: ["url_submission", "direct_upload"],
        default: "direct_upload"
      },
      notes: { type: String, default: "" }
    }],

    // Extended profile information
    personal_info: {
      country: { type: String, default: "" },
      time_zone: { type: String, default: "" },
      available_hours_per_week: { type: Number, default: 0 },
      preferred_communication_channel: {
        type: String,
        enum: ["email", "phone", "whatsapp", "telegram", "slack", ""],
        default: ""
      }
    },

    payment_info: {
      account_name: { type: String, default: "" },
      account_number: { type: String, default: "" },
      bank_name: { type: String, default: "" },
      bank_code: { type: String, default: "" }, // For Paystack integration
      payment_method: {
        type: String,
        enum: ["bank_transfer", "paypal", "crypto", "mobile_money", ""],
        default: ""
      },
      payment_currency: {
        type: String,
        enum: ["USD", "EUR", "GBP", "NGN", "KES", "GHS", ""],
        default: ""
      }
    },

    professional_background: {
      education_field: { type: String, default: "" },
      years_of_experience: { type: Number, default: 0 },
      annotation_experience_types: {
        type: [String],
        default: [],
        enum: ["text_annotation", "image_annotation", "audio_annotation", "video_annotation", "data_labeling", "content_moderation", "transcription", "translation"]
      }
    },

    tool_experience: {
      type: [String],
      default: [],
      enum: ["labelbox", "scale_ai", "cvat", "e2f", "appen", "clickworker", "mechanical_turk", "toloka", "remotasks", "annotator_tools", "custom_platforms"]
    },

    annotation_skills: {
      type: [String],
      default: [],
      enum: ["text_annotation", "image_annotation", "video_annotation", "audio_annotation", "sentiment_analysis", "entity_recognition", "classification", "object_detection", "semantic_segmentation", "transcription", "translation", "content_moderation", "data_entry"]
    },

    language_proficiency: {
      primary_language: { type: String, default: "" },
      other_languages: { type: [String], default: [] },
      english_fluency_level: {
        type: String,
        enum: ["basic", "intermediate", "advanced", "native", ""],
        default: ""
      }
    },

    system_info: {
      device_type: {
        type: String,
        enum: ["desktop", "laptop", "tablet", "mobile", ""],
        default: ""
      },
      operating_system: {
        type: String,
        enum: ["windows", "macos", "linux", "android", "ios", ""],
        default: ""
      },
      internet_speed_mbps: { type: Number, default: 0 },
      power_backup: { type: Boolean, default: false },
      has_webcam: { type: Boolean, default: false },
      has_microphone: { type: Boolean, default: false }
    },

    project_preferences: {
      domains_of_interest: { type: [String], default: [] },
      availability_type: {
        type: String,
        enum: ["full_time", "part_time", "project_based", "flexible", ""],
        default: ""
      },
      nda_signed: { type: Boolean, default: false }
    },

    attachments: {
      resume_url: { type: String, default: "" },
      id_document_url: { type: String, default: "" },
      work_samples_url: { type: [String], default: [] }
    },

    // Profile picture and media
    profilePicture: {
      publicId: { type: String, default: "" },
      url: { type: String, default: "" },
      thumbnail: { type: String, default: "" },
      optimizedUrl: { type: String, default: "" }
    }
  },
  { timestamps: true }
);

const DTUser = mongoose.model("DTUser", dtUserSchema);
export default DTUser;
