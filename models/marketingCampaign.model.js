const mongoose = require("mongoose");

const marketingRecipientSchema = new mongoose.Schema(
  {
    dtUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      default: null,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    fullName: {
      type: String,
      default: "",
      trim: true,
    },
    firstName: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "skipped"],
      default: "pending",
    },
    providerMessageId: {
      type: String,
      default: "",
      trim: true,
    },
    deliveryProvider: {
      type: String,
      enum: ["mailjet"],
      default: "mailjet",
    },
    errorMessage: {
      type: String,
      default: "",
      trim: true,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const marketingCampaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    htmlContent: {
      type: String,
      default: "",
    },
    textContent: {
      type: String,
      default: "",
    },
    sender: {
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },
      name: {
        type: String,
        default: "",
        trim: true,
      },
    },
    audience: {
      type: {
        type: String,
        enum: ["dtusers", "custom_emails"],
        required: true,
      },
      verifiedOnly: {
        type: Boolean,
        default: true,
      },
      dtUserIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "DTUser",
        },
      ],
      filters: {
        annotatorStatus: {
          type: String,
          default: "",
          trim: true,
        },
        microTaskerStatus: {
          type: String,
          default: "",
          trim: true,
        },
        qaStatus: {
          type: String,
          default: "",
          trim: true,
        },
        country: {
          type: String,
          default: "",
          trim: true,
        },
      },
      requestedRecipientCount: {
        type: Number,
        default: 0,
      },
    },
    delivery: {
      provider: {
        type: String,
        enum: ["mailjet"],
        default: "mailjet",
      },
      batchSize: {
        type: Number,
        default: 50,
      },
      delayBetweenBatchesMs: {
        type: Number,
        default: 1000,
      },
    },
    status: {
      type: String,
      enum: [
        "draft",
        "queued",
        "sending",
        "completed",
        "completed_with_errors",
        "failed",
      ],
      default: "draft",
    },
    totalRecipients: {
      type: Number,
      default: 0,
    },
    sentCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    recipients: {
      type: [marketingRecipientSchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      required: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

marketingCampaignSchema.index({ status: 1, createdAt: -1 });
marketingCampaignSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model("MarketingCampaign", marketingCampaignSchema);
