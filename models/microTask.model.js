const mongoose = require("mongoose");

const microTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    category: {
      type: String,
      required: true,
      enum: ["mask_collection", "age_progression"]
    },
    required_count: {
      type: Number,
      required: true,
      validate: {
        validator: function(value) {
          return (this.category === "mask_collection" && value === 20) ||
                 (this.category === "age_progression" && value === 15);
        },
        message: "Invalid count for category: mask_collection requires 20, age_progression requires 15"
      }
    },
    status: {
      type: String,
      enum: ["draft", "active", "paused", "completed", "cancelled"],
      default: "draft"
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
    maxParticipants: {
      type: Number,
      default: null // null means unlimited
    },
    deadline: {
      type: Date,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      required: true
    },
    // Task-specific requirements
    requirements: {
      // For mask collection
      mask_types: {
        type: [String],
        default: ["A", "B"]
      },
      // For age progression
      min_time_span_months: {
        type: Number,
        default: 1
      },
      max_time_span_years: {
        type: Number,
        default: 5
      },
      min_face_resolution: {
        type: Number,
        default: 240 // pixels
      }
    },
    // Auto-generated metadata configuration
    vendor_name: {
      type: String,
      default: "MyDeep Technologies"
    },
    // Instructions and guidelines
    instructions: {
      type: String,
      default: ""
    },
    quality_guidelines: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

// Virtual to get active submissions count
microTaskSchema.virtual("activeSubmissions", {
  ref: "MicroTaskSubmission",
  localField: "_id",
  foreignField: "taskId",
  count: true,
  match: { status: { $in: ["in_progress", "completed", "under_review"] } }
});

microTaskSchema.set("toObject", { virtuals: true });
microTaskSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("MicroTask", microTaskSchema);