const mongoose = require("mongoose");

const microTaskSubmissionSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MicroTask",
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      required: true
    },
    status: {
      type: String,
      enum: ["in_progress", "completed", "under_review", "approved", "rejected", "partially_rejected"],
      default: "in_progress"
    },
    // Progress tracking
    completed_slots: {
      type: Number,
      default: 0
    },
    total_slots: {
      type: Number,
      required: true
    },
    progress_percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    
    // Submission metadata
    submission_date: {
      type: Date,
      default: null // Set when status changes to 'completed'
    },
    review_date: {
      type: Date,
      default: null
    },
    approval_date: {
      type: Date,
      default: null
    },
    
    // Review information
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      default: null
    },
    review_notes: {
      type: String,
      default: ""
    },
    quality_score: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    
    // Rejection details for partial rejections
    rejected_slots: [{
      slotId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TaskSlot",
        required: true
      },
      reason: {
        type: String,
        required: true
      },
      rejection_date: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Auto-generated user metadata (from profile)
    user_metadata: {
      full_name: { type: String, default: "" },
      user_id: { type: String, default: "" },
      country_of_residence: { type: String, default: "" },
      country_of_origin: { type: String, default: "" },
      age: { type: Number, default: null },
      date_of_birth: { type: Date, default: null },
      gender: { type: String, default: "" },
      recruiter_name: { type: String, default: "" },
      contact_info: {
        email: { type: String, default: "" },
        phone: { type: String, default: "" }
      }
    },
    
    // System metadata
    system_metadata: {
      vendor_name: { 
        type: String, 
        default: "MyDeep Technologies" 
      },
      submission_id: { type: String },
      task_category: { 
        type: String, 
        enum: ["mask_collection", "age_progression"] 
      },
      platform_version: { type: String, default: "1.0" },
      submission_ip: { type: String, default: "" },
      user_agent: { type: String, default: "" }
    },
    
    // Payment tracking
    payment_status: {
      type: String,
      enum: ["pending", "approved", "paid", "rejected"],
      default: "pending"
    },
    payment_amount: {
      type: Number,
      default: 0
    },
    payment_currency: {
      type: String,
      default: "USD"
    },
    payment_date: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// Indexes for efficient querying
microTaskSubmissionSchema.index({ taskId: 1, userId: 1 }, { unique: true });
microTaskSubmissionSchema.index({ userId: 1 });
microTaskSubmissionSchema.index({ status: 1 });
microTaskSubmissionSchema.index({ "system_metadata.submission_id": 1 }, { unique: true });

// Virtual to get submission images
microTaskSubmissionSchema.virtual("images", {
  ref: "SubmissionImage",
  localField: "_id",
  foreignField: "submissionId"
});

microTaskSubmissionSchema.set("toObject", { virtuals: true });
microTaskSubmissionSchema.set("toJSON", { virtuals: true });

// Pre-save middleware to generate submission ID and update progress
microTaskSubmissionSchema.pre("save", function(next) {
  // Generate unique submission ID if not exists
  if (!this.system_metadata.submission_id) {
    this.system_metadata.submission_id = `SUB-${this.taskId.toString().slice(-6)}-${Date.now().toString().slice(-6)}`;
  }
  
  // Update progress percentage
  if (this.total_slots > 0) {
    this.progress_percentage = Math.round((this.completed_slots / this.total_slots) * 100);
  }
  
  // Set submission date when completed
  if (this.status === "completed" && !this.submission_date) {
    this.submission_date = new Date();
  }
  
  // Set review date when status changes to under_review
  if (this.status === "under_review" && !this.review_date) {
    this.review_date = new Date();
  }
  
  // Set approval date when approved
  if (this.status === "approved" && !this.approval_date) {
    this.approval_date = new Date();
  }
  
  next();
});

// Method to check if submission is complete
microTaskSubmissionSchema.methods.isComplete = function() {
  return this.completed_slots >= this.total_slots;
};

// Method to get completion percentage
microTaskSubmissionSchema.methods.getCompletionPercentage = function() {
  return this.total_slots > 0 ? Math.round((this.completed_slots / this.total_slots) * 100) : 0;
};

// Static method to get submissions by status
microTaskSubmissionSchema.statics.getByStatus = function(status) {
  return this.find({ status }).populate("taskId userId images");
};

module.exports = mongoose.model("MicroTaskSubmission", microTaskSubmissionSchema);