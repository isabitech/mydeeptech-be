const mongoose = require("mongoose");

const hvncCommandSchema = new mongoose.Schema(
  {
    command_id: {
      type: String,
      required: true,
      unique: true,
      default: () =>
        `cmd_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
      index: true,
    },
    device_id: {
      type: String,
      required: true,
      ref: "HVNCDevice",
      index: true,
    },
    session_id: {
      type: String,
      required: true,
      ref: "HVNCSession",
      index: true,
    },
    user_email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      ref: "HVNCUser",
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "session",
        "chrome",
        "hubstaff",
        "system",
        "desktop",
        "file",
        "application",
      ],
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        // Session actions
        "start_session",
        "stop_session",

        // Chrome actions
        "navigate",
        "click",
        "type",
        "scroll",
        "refresh",
        "back",
        "forward",
        "new_tab",
        "close_tab",
        "switch_tab",
        "download",
        "upload",
        "take_screenshot",
        "execute_javascript",
        "get_page_content",
        "wait_for_element",
        "clear_cache",
        "set_cookies",
        "get_cookies",

        // Hubstaff actions
        "start_timer",
        "stop_timer",
        "pause_timer",
        "change_project",
        "get_time_status",
        "get_projects",

        // System actions
        "get_system_info",
        "restart",
        "shutdown",
        "update_config",
        "run_diagnostic",
        "clear_logs",

        // Desktop actions
        "show_desktop",
        "hide_desktop",
        "switch_desktop",
        "take_desktop_screenshot",

        // File actions
        "download_file",
        "upload_file",
        "delete_file",
        "list_files",

        // Application actions
        "launch_app",
        "close_app",
        "focus_app",
        "minimize_app",
      ],
      index: true,
    },
    parameters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator: function (v) {
          // Validate required parameters based on action
          if (
            this.action === "navigate" &&
            (!v.url || typeof v.url !== "string")
          ) {
            return false;
          }
          if (this.action === "click" && !v.selector && !v.coordinates) {
            return false;
          }
          if (this.action === "type" && (!v.text || !v.selector)) {
            return false;
          }
          return true;
        },
        message: "Invalid parameters for the specified action",
      },
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "sent",
        "acknowledged",
        "executing",
        "completed",
        "failed",
        "timeout",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },
    sent_at: Date,
    acknowledged_at: Date,
    started_at: Date,
    completed_at: Date,
    expires_at: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    },
    timeout_seconds: {
      type: Number,
      default: 30,
      min: 1,
      max: 300, // Max 5 minutes
    },
    retry_count: {
      type: Number,
      default: 0,
      max: 3,
    },
    max_retries: {
      type: Number,
      default: 2,
      max: 5,
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    error_message: String,
    error_code: String,
    execution_time_ms: {
      type: Number,
      min: 0,
    },
    response_size_bytes: Number,
    metadata: {
      source: {
        type: String,
        enum: [
          "admin_dashboard",
          "api",
          "automation",
          "scheduled",
          "user_request",
        ],
        default: "admin_dashboard",
      },
      correlation_id: String,
      batch_id: String,
      parent_command_id: String,
      is_background: {
        type: Boolean,
        default: false,
      },
      requires_confirmation: {
        type: Boolean,
        default: false,
      },
      confirmation_received: Boolean,
      confirmation_by: String,
      confirmation_at: Date,
      scheduled_for: Date,
      environment: {
        type: String,
        enum: ["production", "staging", "development"],
        default: "production",
      },
    },
    tags: [String],
    notes: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual to check if command is expired
hvncCommandSchema.virtual("is_expired").get(function () {
  return this.expires_at < new Date();
});

// Virtual to check if command is active
hvncCommandSchema.virtual("is_active").get(function () {
  return (
    ["pending", "sent", "acknowledged", "executing"].includes(this.status) &&
    !this.is_expired
  );
});

// Virtual to check if command can be retried
hvncCommandSchema.virtual("can_retry").get(function () {
  return this.status === "failed" && this.retry_count < this.max_retries;
});

// Virtual to get execution duration
hvncCommandSchema.virtual("execution_duration_ms").get(function () {
  if (this.started_at && this.completed_at) {
    return this.completed_at - this.started_at;
  }
  return null;
});

// Indexes for performance
hvncCommandSchema.index({ device_id: 1, status: 1, createdAt: -1 });
hvncCommandSchema.index({ session_id: 1, status: 1 });
hvncCommandSchema.index({ user_email: 1, createdAt: -1 });
hvncCommandSchema.index({ type: 1, action: 1, status: 1 });
hvncCommandSchema.index({ priority: 1, createdAt: 1 });
hvncCommandSchema.index({ expires_at: 1 }); // For cleanup
hvncCommandSchema.index({ "metadata.batch_id": 1 });
hvncCommandSchema.index({ "metadata.correlation_id": 1 });

// Instance methods
hvncCommandSchema.methods.acknowledge = function () {
  if (this.status !== "sent") {
    throw new Error("Command must be in sent status to acknowledge");
  }

  this.status = "acknowledged";
  this.acknowledged_at = new Date();

  return this.save();
};

hvncCommandSchema.methods.start = function () {
  if (!["acknowledged", "pending"].includes(this.status)) {
    throw new Error(
      "Command must be in acknowledged or pending status to start",
    );
  }

  this.status = "executing";
  this.started_at = new Date();

  return this.save();
};

hvncCommandSchema.methods.complete = function (result, executionTimeMs) {
  if (this.status !== "executing") {
    throw new Error("Command must be in executing status to complete");
  }

  this.status = "completed";
  this.completed_at = new Date();
  this.result = result;

  if (executionTimeMs !== undefined) {
    this.execution_time_ms = executionTimeMs;
  } else if (this.started_at) {
    this.execution_time_ms = this.completed_at - this.started_at;
  }

  return this.save();
};

hvncCommandSchema.methods.fail = function (errorMessage, errorCode) {
  this.status = "failed";
  this.completed_at = new Date();
  this.error_message = errorMessage;
  this.error_code = errorCode;

  if (this.started_at) {
    this.execution_time_ms = this.completed_at - this.started_at;
  }

  return this.save();
};

hvncCommandSchema.methods.timeout = function () {
  this.status = "timeout";
  this.completed_at = new Date();
  this.error_message = "Command execution timed out";
  this.error_code = "TIMEOUT";

  if (this.started_at) {
    this.execution_time_ms = this.completed_at - this.started_at;
  }

  return this.save();
};

hvncCommandSchema.methods.cancel = function (reason) {
  if (["completed", "failed", "timeout", "cancelled"].includes(this.status)) {
    throw new Error("Cannot cancel command that is already finished");
  }

  this.status = "cancelled";
  this.completed_at = new Date();
  this.error_message = reason || "Command cancelled";
  this.error_code = "CANCELLED";

  return this.save();
};

hvncCommandSchema.methods.retry = function () {
  if (!this.can_retry) {
    throw new Error("Command cannot be retried");
  }

  this.retry_count += 1;
  this.status = "pending";
  this.sent_at = null;
  this.acknowledged_at = null;
  this.started_at = null;
  this.completed_at = null;
  this.error_message = null;
  this.error_code = null;
  this.result = null;
  this.execution_time_ms = null;

  // Extend expiry time for retry
  this.expires_at = new Date(Date.now() + 5 * 60 * 1000);

  return this.save();
};

hvncCommandSchema.methods.markSent = function () {
  if (this.status !== "pending") {
    throw new Error("Command must be in pending status to mark as sent");
  }

  this.status = "sent";
  this.sent_at = new Date();

  return this.save();
};

// Static methods
hvncCommandSchema.statics.createCommand = function (commandData) {
  let expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Default 5 minutes

  if (commandData.timeout_seconds) {
    expiresAt = new Date(
      Date.now() + (commandData.timeout_seconds + 60) * 1000,
    ); // Add 1 minute buffer
  }

  return this.create({
    ...commandData,
    expires_at: expiresAt,
    user_email: commandData.user_email?.toLowerCase(),
  });
};

hvncCommandSchema.statics.getPendingCommands = function (deviceId, limit = 10) {
  return this.find({
    device_id: deviceId,
    status: { $in: ["pending", "sent"] },
    expires_at: { $gt: new Date() },
  })
    .sort({ priority: -1, createdAt: 1 }) // High priority first, then FIFO
    .limit(limit);
};

hvncCommandSchema.statics.getActiveCommands = function (sessionId) {
  return this.find({
    session_id: sessionId,
    status: { $in: ["pending", "sent", "acknowledged", "executing"] },
    expires_at: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

hvncCommandSchema.statics.expireCommands = function () {
  return this.updateMany(
    {
      status: { $in: ["pending", "sent", "acknowledged"] },
      expires_at: { $lt: new Date() },
    },
    {
      status: "timeout",
      completed_at: new Date(),
      error_message: "Command expired",
      error_code: "EXPIRED",
    },
  );
};

hvncCommandSchema.statics.getCommandHistory = function (
  userEmail,
  deviceId,
  limit = 50,
) {
  const query = {};

  if (userEmail) query.user_email = userEmail.toLowerCase();
  if (deviceId) query.device_id = deviceId;

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("session_id", "started_at ended_at");
};

hvncCommandSchema.statics.getBatchCommands = function (batchId) {
  return this.find({ "metadata.batch_id": batchId }).sort({ createdAt: 1 });
};

hvncCommandSchema.statics.getCommandStats = function (startDate, endDate) {
  const matchStage = {};

  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = startDate;
    if (endDate) matchStage.createdAt.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          status: "$status",
          type: "$type",
          action: "$action",
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        },
        count: { $sum: 1 },
        avg_execution_time: { $avg: "$execution_time_ms" },
        max_execution_time: { $max: "$execution_time_ms" },
        total_retries: { $sum: "$retry_count" },
        unique_users: { $addToSet: "$user_email" },
        unique_devices: { $addToSet: "$device_id" },
      },
    },
    {
      $addFields: {
        unique_user_count: { $size: "$unique_users" },
        unique_device_count: { $size: "$unique_devices" },
      },
    },
    { $sort: { "_id.date": -1, count: -1 } },
  ]);
};

hvncCommandSchema.statics.cancelUserCommands = function (userEmail, reason) {
  return this.updateMany(
    {
      user_email: userEmail.toLowerCase(),
      status: { $in: ["pending", "sent", "acknowledged", "executing"] },
    },
    {
      status: "cancelled",
      completed_at: new Date(),
      error_message: reason || "User commands cancelled",
      error_code: "USER_CANCELLED",
    },
  );
};

hvncCommandSchema.statics.cancelDeviceCommands = function (deviceId, reason) {
  return this.updateMany(
    {
      device_id: deviceId,
      status: { $in: ["pending", "sent", "acknowledged", "executing"] },
    },
    {
      status: "cancelled",
      completed_at: new Date(),
      error_message: reason || "Device commands cancelled",
      error_code: "DEVICE_CANCELLED",
    },
  );
};
 
hvncCommandSchema.statics.cancelSessionCommands = function (sessionId, reason) {
  return this.updateMany(
    {
      session_id: sessionId,
      status: { $in: ["pending", "sent", "acknowledged", "executing"] },
    },
    {
      status: "cancelled",
      completed_at: new Date(),
      error_message: reason || "Session commands cancelled",
      error_code: "SESSION_CANCELLED",
    },
  );
};

hvncCommandSchema.statics.cleanupOldCommands = function (daysOld = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    status: { $in: ["completed", "failed", "timeout", "cancelled"] },
  });
};

// Pre-save middleware
hvncCommandSchema.pre("save", function (next) {
  if (this.user_email) {
    this.user_email = this.user_email.toLowerCase();
  }

  // Generate command_id if not provided
  if (!this.command_id) {
    this.command_id = `cmd_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  }

  // Set correlation_id if not provided
  if (!this.metadata.correlation_id && this.session_id) {
    this.metadata.correlation_id = this.session_id;
  }

  next();
});

// TTL index for automatic cleanup
hvncCommandSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days
    partialFilterExpression: {
      status: { $in: ["completed", "failed", "timeout", "cancelled"] },
    },
  },
);

module.exports = mongoose.model("HVNCCommand", hvncCommandSchema);
