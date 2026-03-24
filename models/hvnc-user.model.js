const mongoose = require("mongoose");

const hvncUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxLength: 255,
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Invalid email format",
      },
      index: true,
    },
    full_name: {
      type: String,
      required: true,
      trim: true,
      maxLength: 255,
    },
    password_hash: {
      type: String,
      required: function () {
        return this.role === "admin" || this.role === "supervisor";
      },
      minLength: 8,
    },
    role: {
      type: String,
      enum: ["remote_worker", "admin", "supervisor"],
      default: "remote_worker",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      index: true,
    },
    permissions: [
      {
        type: String,
        enum: [
          "chrome_control",
          "hubstaff_control",
          "device_management",
          "user_management",
          "admin_dashboard",
        ],
      },
    ],
    shift_preferences: {
      timezone: {
        type: String,
        default: "UTC",
      },
      preferred_devices: [String], // device_ids
      notification_email: {
        type: Boolean,
        default: true,
      },
    },
    hubstaff_info: {
      hubstaff_user_id: String,
      default_project_id: String,
      default_project_name: String,
      is_hubstaff_enabled: {
        type: Boolean,
        default: true,
      },
    },
    last_login: {
      type: Date,
    },
    login_count: {
      type: Number,
      default: 0,
    },
    failed_login_attempts: {
      type: Number,
      default: 0,
    },
    last_failed_login: Date,
    is_locked: {
      type: Boolean,
      default: false,
    },
    lock_until: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual for checking if account is locked
hvncUserSchema.virtual("is_account_locked").get(function () {
  return this.is_locked || (this.lock_until && this.lock_until > Date.now());
});

// Indexes for performance
hvncUserSchema.index({ email: 1, status: 1 });
hvncUserSchema.index({ role: 1, status: 1 });
hvncUserSchema.index({ last_login: 1 });

// Instance methods
hvncUserSchema.methods.recordLogin = function (ip_address) {
  this.last_login = new Date();
  this.login_count += 1;
  this.failed_login_attempts = 0;
  this.is_locked = false;
  this.lock_until = undefined;

  return this.save();
};

hvncUserSchema.methods.recordFailedLogin = function () {
  this.failed_login_attempts += 1;
  this.last_failed_login = new Date();

  // Lock account after 5 failed attempts
  if (this.failed_login_attempts >= 5) {
    this.is_locked = true;
    this.lock_until = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }

  return this.save();
};

hvncUserSchema.methods.unlockAccount = function () {
  this.is_locked = false;
  this.lock_until = undefined;
  this.failed_login_attempts = 0;

  return this.save();
};

hvncUserSchema.methods.hasPermission = function (permission) {
  if (this.role === "admin") return true; // Admin has all permissions
  return this.permissions.includes(permission);
};

hvncUserSchema.methods.getActiveShifts = function () {
  const HVNCShift = require("./hvnc-shift.model");
  return HVNCShift.find({
    user_email: this.email,
    $or: [{ end_date: null }, { end_date: { $gte: new Date() } }],
  });
};

// Static methods
hvncUserSchema.statics.findByEmail = function (email) {
  return this.findOne({
    email: email.toLowerCase(),
    status: "active",
  });
};

hvncUserSchema.statics.getActiveUsers = function () {
  return this.find({
    status: "active",
    is_locked: { $ne: true },
  });
};

hvncUserSchema.statics.getUsersWithRole = function (role) {
  return this.find({
    role: role,
    status: "active",
  });
};

// Pre-save middleware
hvncUserSchema.pre("save", function (next) {
  // Ensure email is lowercase
  if (this.email) {
    this.email = this.email.toLowerCase();
  }

  // Set default permissions based on role
  if (this.isNew || this.isModified("role")) {
    switch (this.role) {
      case "admin":
        this.permissions = [
          "chrome_control",
          "hubstaff_control",
          "device_management",
          "user_management",
          "admin_dashboard",
        ];
        break;
      case "supervisor":
        this.permissions = [
          "chrome_control",
          "hubstaff_control",
          "device_management",
        ];
        break;
      case "remote_worker":
      default:
        this.permissions = ["chrome_control", "hubstaff_control"];
        break;
    }
  }

  next();
});

module.exports = mongoose.model("HVNCUser", hvncUserSchema);
