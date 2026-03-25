const mongoose = require("mongoose");

const HubstaffUserSessionSchema = new mongoose.Schema(
  {
    // User and Device References
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      required: true,
      index: true,
    },
    deviceId: {
      type: String, // HVNC device identifier
      required: true,
      index: true,
    },
    hvncSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HVNCSession",
      required: true,
    },

    // Session Timing
    date: {
      type: String, // YYYY-MM-DD format
      required: true,
      index: true,
    },
    sessionStartTime: {
      type: Date,
      required: true,
    },
    sessionEndTime: {
      type: Date,
      default: null, // null while session is active
    },

    // Hubstaff Timer Context
    hubstaffStartOffset: {
      type: Number, // Seconds - timer value when user started
      required: true,
    },
    hubstaffEndOffset: {
      type: Number, // Seconds - timer value when user stopped
      default: null,
    },

    // Calculated Work Time
    userWorkedSeconds: {
      type: Number,
      default: 0,
    },
    userWorkedHours: {
      type: Number,
      default: 0,
    },

    // Session Status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    endReason: {
      type: String,
      enum: [
        "user_paused",
        "user_stopped",
        "hvnc_disconnected",
        "timer_stopped",
        "device_timeout",
      ],
      default: null,
    },

    // Metadata
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "hubstaff_user_sessions",
  },
);

// Compound indexes for efficient queries
HubstaffUserSessionSchema.index({ userId: 1, date: 1 });
HubstaffUserSessionSchema.index({ deviceId: 1, date: 1 });
HubstaffUserSessionSchema.index({ isActive: 1, deviceId: 1 });
HubstaffUserSessionSchema.index({ date: 1, isActive: 1 });

// Instance methods
HubstaffUserSessionSchema.methods.calculateWorkedTime = function () {
  if (this.hubstaffEndOffset && this.hubstaffStartOffset) {
    this.userWorkedSeconds = this.hubstaffEndOffset - this.hubstaffStartOffset;
    this.userWorkedHours =
      Math.round((this.userWorkedSeconds / 3600) * 100) / 100; // Round to 2 decimal places
  }
  return this;
};

HubstaffUserSessionSchema.methods.endSession = function (
  endOffset,
  reason = "user_stopped",
) {
  this.sessionEndTime = new Date();
  this.hubstaffEndOffset = endOffset;
  this.endReason = reason;
  this.isActive = false;
  this.updatedAt = new Date();
  this.calculateWorkedTime();
  return this;
};

// Static methods
HubstaffUserSessionSchema.statics.getActiveSessionForDevice = function (
  deviceId,
) {
  const today = new Date().toISOString().split("T")[0];
  return this.findOne({
    deviceId,
    date: today,
    isActive: true,
  }).populate("userId", "firstName lastName email");
};

HubstaffUserSessionSchema.statics.getUserDailySummary = function (
  userId,
  date,
) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date,
        isActive: false, // Only completed sessions
      },
    },
    {
      $group: {
        _id: "$date",
        totalWorkedSeconds: { $sum: "$userWorkedSeconds" },
        totalWorkedHours: { $sum: "$userWorkedHours" },
        sessionsCount: { $sum: 1 },
        sessions: {
          $push: {
            deviceId: "$deviceId",
            startTime: "$sessionStartTime",
            endTime: "$sessionEndTime",
            workedHours: "$userWorkedHours",
          },
        },
      },
    },
  ]);
};

module.exports = mongoose.model(
  "HubstaffUserSession",
  HubstaffUserSessionSchema,
);
