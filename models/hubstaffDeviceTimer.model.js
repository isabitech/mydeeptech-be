const mongoose = require("mongoose");

const HubstaffDeviceTimerSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },

    // Current Timer State
    isActive: {
      type: Boolean,
      default: false,
    },
    totalElapsedSeconds: {
      type: Number,
      default: 0,
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },

    // Daily Reset Tracking
    timerResetAt: {
      type: Date, // When timer was reset to 00:00:00
      default: null,
    },

    // Last known state for change detection
    lastKnownState: {
      isActive: {
        type: Boolean,
        default: false,
      },
      elapsedSeconds: {
        type: Number,
        default: 0,
      },
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
    collection: "hubstaff_device_timers",
  },
);

// Unique compound index
HubstaffDeviceTimerSchema.index({ deviceId: 1, date: 1 }, { unique: true });

// Instance methods
HubstaffDeviceTimerSchema.methods.updateTimerState = function (timerData) {
  this.lastKnownState.isActive = this.isActive;
  this.lastKnownState.elapsedSeconds = this.totalElapsedSeconds;

  this.isActive = timerData.isActive;
  this.totalElapsedSeconds = timerData.totalSeconds;
  this.lastUpdatedAt = new Date();
  this.updatedAt = new Date();

  return this;
};

HubstaffDeviceTimerSchema.methods.hasStateChanged = function () {
  return (
    this.isActive !== this.lastKnownState.isActive ||
    this.totalElapsedSeconds !== this.lastKnownState.elapsedSeconds
  );
};

HubstaffDeviceTimerSchema.methods.getFormattedTime = function () {
  const hours = Math.floor(this.totalElapsedSeconds / 3600);
  const minutes = Math.floor((this.totalElapsedSeconds % 3600) / 60);
  const seconds = this.totalElapsedSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

// Static methods
HubstaffDeviceTimerSchema.statics.findOrCreateDailyTimer = function (
  deviceId,
  date = null,
) {
  const timerDate = date || new Date().toISOString().split("T")[0];

  return this.findOneAndUpdate(
    { deviceId, date: timerDate },
    {
      $setOnInsert: {
        deviceId,
        date: timerDate,
        isActive: false,
        totalElapsedSeconds: 0,
        createdAt: new Date(),
      },
      $set: {
        updatedAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );
};

module.exports = mongoose.model(
  "HubstaffDeviceTimer",
  HubstaffDeviceTimerSchema,
);
