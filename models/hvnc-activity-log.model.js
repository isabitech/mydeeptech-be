const mongoose = require("mongoose");

const hvncActivityLogSchema = new mongoose.Schema(
  {
    device_id: {
      type: String,
      ref: "HVNCDevice",
      index: true,
    },
    session_id: {
      type: String,
      ref: "HVNCSession",
      index: true,
    },
    user_email: {
      type: String,
      lowercase: true,
      trim: true,
      ref: "HVNCUser",
      index: true,
    },
    event_type: {
      type: String,
      required: true,
      enum: [
        // Authentication events
        "device_registration",
        "device_heartbeat",
        "access_code_requested",
        "access_code_validated",
        "user_login",
        "user_logout",
        "authentication_failed",

        // Session events
        "session_started",
        "session_ended",
        "session_timeout",
        "session_idle",
        "session_resumed",

        // Command events
        "command_received",
        "command_executed",
        "command_failed",
        "chrome_navigate",
        "chrome_action",

        // Hubstaff events
        "hubstaff_timer_start",
        "hubstaff_timer_started", // Added missing enum value
        "hubstaff_timer_stop",
        "hubstaff_timer_pause",
        "hubstaff_timer_paused", // Added missing enum value
        "hubstaff_project_change",
        "hubstaff_status_update",

        // System events
        "device_online",
        "device_offline",
        "device_disconnected",
        "device_reconnected",
        "system_maintenance",
        "configuration_change",

        // Security events
        "suspicious_activity",
        "multiple_login_attempt",
        "rate_limit_exceeded",
        "unauthorized_access_attempt",
        "security_violation",

        // Admin events
        "admin_action",
        "user_created",
        "user_modified",
        "shift_created",
        "shift_modified",
        "device_disabled",
        "force_logout",
      ],
      index: true,
    },
    event_data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip_address: {
      type: String,
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow empty/undefined
          // Allow IPv4, IPv6, IPv6-mapped IPv4, and localhost formats
          return (
            /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(v) || // IPv4
            /^::1$/.test(v) || // IPv6 localhost
            /^::ffff:(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(v) || // IPv6-mapped IPv4
            /^127\.0\.0\.1$/.test(v) || // IPv4 localhost
            v === "localhost"
          );
        },
        message: "Invalid IP address format",
      },
    },
    user_agent: {
      type: String,
      maxLength: 500,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
      index: true,
    },
    status: {
      type: String,
      enum: ["success", "failure", "warning", "info"],
      default: "info",
      index: true,
    },
    error_message: {
      type: String,
      maxLength: 1000,
    },
    request_id: {
      type: String,
      index: true,
    },
    duration_ms: {
      type: Number,
      min: 0,
    },
    metadata: {
      // Additional structured data specific to event type
      command_id: String,
      url: String,
      application: String,
      file_path: String,
      feature: String,
      api_endpoint: String,
      response_code: Number,
      affected_users: [String],
      affected_devices: [String],
      admin_user: String,
      approval_required: Boolean,
      expires_at: Date,
    },
    location: {
      country: String,
      region: String,
      city: String,
      timezone: String,
    },
    correlation_id: {
      type: String,
    },
    tags: [String],
    is_flagged: {
      type: Boolean,
      default: false,
      index: true,
    },
    reviewed_by: {
      type: String,
      ref: "HVNCUser",
    },
    reviewed_at: Date,
    review_notes: String,
  },
  {
    timestamps: { createdAt: "timestamp" },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual to check if log is recent (within last hour)
hvncActivityLogSchema.virtual("is_recent").get(function () {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return this.timestamp > oneHourAgo;
});

// Virtual to get formatted duration
hvncActivityLogSchema.virtual("duration_formatted").get(function () {
  if (!this.duration_ms) return null;

  if (this.duration_ms < 1000) {
    return `${this.duration_ms}ms`;
  } else if (this.duration_ms < 60000) {
    return `${(this.duration_ms / 1000).toFixed(1)}s`;
  } else {
    return `${(this.duration_ms / 60000).toFixed(1)}m`;
  }
});

// Compound indexes for performance
hvncActivityLogSchema.index({ event_type: 1, timestamp: -1 });
hvncActivityLogSchema.index({ device_id: 1, timestamp: -1 });
hvncActivityLogSchema.index({ user_email: 1, timestamp: -1 });
hvncActivityLogSchema.index({ session_id: 1, timestamp: -1 });
hvncActivityLogSchema.index({ severity: 1, is_flagged: 1, timestamp: -1 });
hvncActivityLogSchema.index({ status: 1, event_type: 1, timestamp: -1 });
hvncActivityLogSchema.index({ correlation_id: 1 });
hvncActivityLogSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 60 * 24 * 60 * 60 },
); // 60 days TTL

// Static methods for logging different types of events
hvncActivityLogSchema.statics.logDeviceEvent = function (
  deviceId,
  eventType,
  eventData,
  options = {},
) {
  return this.create({
    device_id: deviceId,
    event_type: eventType,
    event_data: eventData,
    severity: options.severity || "low",
    status: options.status || "info",
    ip_address: options.ip_address,
    user_agent: options.user_agent,
    correlation_id: options.correlation_id,
    request_id: options.request_id,
    duration_ms: options.duration_ms,
    metadata: options.metadata || {},
    tags: options.tags || [],
  });
};

hvncActivityLogSchema.statics.logUserEvent = function (
  userEmail,
  eventType,
  eventData,
  options = {},
) {
  return this.create({
    user_email: userEmail?.toLowerCase(),
    event_type: eventType,
    event_data: eventData,
    severity: options.severity || "low",
    status: options.status || "info",
    ip_address: options.ip_address,
    user_agent: options.user_agent,
    device_id: options.device_id,
    session_id: options.session_id,
    correlation_id: options.correlation_id,
    request_id: options.request_id,
    duration_ms: options.duration_ms,
    metadata: options.metadata || {},
    tags: options.tags || [],
  });
};

hvncActivityLogSchema.statics.logSessionEvent = function (
  sessionId,
  eventType,
  eventData,
  options = {},
) {
  return this.create({
    session_id: sessionId,
    event_type: eventType,
    event_data: eventData,
    severity: options.severity || "low",
    status: options.status || "info",
    user_email: options.user_email?.toLowerCase(),
    device_id: options.device_id,
    ip_address: options.ip_address,
    user_agent: options.user_agent,
    correlation_id: options.correlation_id,
    request_id: options.request_id,
    duration_ms: options.duration_ms,
    metadata: options.metadata || {},
    tags: options.tags || [],
  });
};

hvncActivityLogSchema.statics.logSecurityEvent = function (
  eventType,
  eventData,
  options = {},
) {
  return this.create({
    event_type: eventType,
    event_data: eventData,
    severity: options.severity || "high",
    status: options.status || "warning",
    user_email: options.user_email?.toLowerCase(),
    device_id: options.device_id,
    session_id: options.session_id,
    ip_address: options.ip_address,
    user_agent: options.user_agent,
    correlation_id: options.correlation_id,
    request_id: options.request_id,
    error_message: options.error_message,
    metadata: options.metadata || {},
    tags: options.tags || ["security"],
    is_flagged: true,
  });
};

hvncActivityLogSchema.statics.logCommandEvent = function (
  commandId,
  eventType,
  eventData,
  options = {},
) {
  return this.create({
    event_type: eventType,
    event_data: eventData,
    severity: options.severity || "low",
    status: options.status || "info",
    user_email: options.user_email?.toLowerCase(),
    device_id: options.device_id,
    session_id: options.session_id,
    ip_address: options.ip_address,
    correlation_id: options.correlation_id,
    request_id: options.request_id,
    duration_ms: options.duration_ms,
    metadata: {
      command_id: commandId,
      ...(options.metadata || {}),
    },
    tags: options.tags || ["command"],
  });
};

// Query helper methods
hvncActivityLogSchema.statics.getRecentEvents = function (
  limit = 100,
  eventTypes = null,
) {
  const query = {};
  if (eventTypes && eventTypes.length > 0) {
    query.event_type = { $in: eventTypes };
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate("user_email", "full_name email")
    .populate("device_id", "pc_name hostname");
};

hvncActivityLogSchema.statics.getEventsByUser = function (
  userEmail,
  startDate,
  endDate,
  limit = 100,
) {
  const query = {
    user_email: userEmail.toLowerCase(),
  };

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate) query.timestamp.$lte = endDate;
  }

  return this.find(query).sort({ timestamp: -1 }).limit(limit);
};

hvncActivityLogSchema.statics.getEventsByDevice = function (
  deviceId,
  startDate,
  endDate,
  limit = 100,
) {
  const query = {
    device_id: deviceId,
  };

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate) query.timestamp.$lte = endDate;
  }

  return this.find(query).sort({ timestamp: -1 }).limit(limit);
};

hvncActivityLogSchema.statics.getSecurityEvents = function (
  startDate,
  endDate,
  limit = 100,
) {
  const query = {
    $or: [
      { is_flagged: true },
      { severity: { $in: ["high", "critical"] } },
      { event_type: { $regex: /security|unauthorized|suspicious/ } },
    ],
  };

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate) query.timestamp.$lte = endDate;
  }

  return this.find(query).sort({ timestamp: -1 }).limit(limit);
};

hvncActivityLogSchema.statics.getEventStatistics = function (
  startDate,
  endDate,
) {
  const matchStage = {};

  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) matchStage.timestamp.$gte = startDate;
    if (endDate) matchStage.timestamp.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          event_type: "$event_type",
          status: "$status",
          severity: "$severity",
          date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
        },
        count: { $sum: 1 },
        avg_duration: { $avg: "$duration_ms" },
        max_duration: { $max: "$duration_ms" },
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

hvncActivityLogSchema.statics.flagEvent = function (
  eventId,
  reviewedBy,
  notes,
) {
  return this.findByIdAndUpdate(
    eventId,
    {
      is_flagged: true,
      reviewed_by: reviewedBy,
      reviewed_at: new Date(),
      review_notes: notes,
    },
    { new: true },
  );
};

hvncActivityLogSchema.statics.bulkCleanup = function (daysOld = 60) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  return this.deleteMany({
    timestamp: { $lt: cutoffDate },
    is_flagged: { $ne: true }, // Keep flagged events longer
    severity: { $nin: ["high", "critical"] }, // Keep important events longer
  });
};

// Pre-save middleware
hvncActivityLogSchema.pre("save", function (next) {
  if (this.user_email) {
    this.user_email = this.user_email.toLowerCase();
  }

  // Auto-flag suspicious events
  const suspiciousEventTypes = [
    "authentication_failed",
    "unauthorized_access_attempt",
    "rate_limit_exceeded",
    "security_violation",
    "suspicious_activity",
  ];

  if (suspiciousEventTypes.includes(this.event_type)) {
    this.is_flagged = true;
    this.severity = "high";
  }

  // Auto-correlate related events
  if (!this.correlation_id && (this.session_id || this.request_id)) {
    this.correlation_id = this.session_id || this.request_id;
  }

  next();
});

module.exports = mongoose.model("HVNCActivityLog", hvncActivityLogSchema);
