const mongoose = require("mongoose");

const hvncDeviceSchema = new mongoose.Schema(
  {
    device_id: {
      type: String,
      required: true,
      unique: true,
      maxLength: 64,
      index: true,
    },
    pc_name: {
      type: String,
      required: true,
      maxLength: 255,
    },
    hostname: {
      type: String,
      maxLength: 255,
    },
    os_version: {
      type: String,
      maxLength: 255,
    },
    public_ip: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(v);
        },
        message: "Invalid IP address format",
      },
    },
    mac_address: {
      type: String,
      maxLength: 17,
      validate: {
        validator: function (v) {
          return !v || /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(v);
        },
        message: "Invalid MAC address format",
      },
    },
    hubstaff_installed: {
      type: Boolean,
      default: false,
    },
    hubstaff_version: {
      type: String,
      maxLength: 50,
    },
    status: {
      type: String,
      enum: ["online", "offline", "maintenance", "disabled"],
      default: "offline",
      index: true,
    },
    initial_access_code: {
      type: String,
      maxLength: 20,
    },
    installed_at: {
      type: Date,
      default: Date.now,
    },
    last_seen: {
      type: Date,
      default: Date.now,
      index: true,
    },
    auth_token_hash: {
      type: String,
      maxLength: 255,
    },
    config: {
      server_url: String,
      heartbeat_interval: { type: Number, default: 60 },
      encryption_key: String,
    },
    system_info: {
      cpu_usage: Number,
      memory_usage: Number,
      disk_free_gb: Number,
      last_updated: { type: Date, default: Date.now },
    },
    chrome_status: {
      running: { type: Boolean, default: false },
      profile: String,
      current_url: String,
      window_title: String,
      last_updated: { type: Date, default: Date.now },
    },
    desktop_status: {
      hidden_desktop_active: { type: Boolean, default: false },
      session_count: { type: Number, default: 0 },
      last_updated: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual for checking if device is online (last seen within 5 minutes)
hvncDeviceSchema.virtual("is_online").get(function () {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return (
    this.last_seen &&
    this.last_seen > fiveMinutesAgo &&
    this.status === "online"
  );
});

// Index for performance
hvncDeviceSchema.index({ device_id: 1, status: 1 });
hvncDeviceSchema.index({ last_seen: 1 });

// Instance methods
hvncDeviceSchema.methods.updateHeartbeat = function (statusData) {
  this.last_seen = new Date();

  // Validate and set status - only allow valid enum values
  const validStatuses = ["online", "offline", "maintenance", "disabled"];
  const incomingStatus = statusData.status;

  if (incomingStatus && validStatuses.includes(incomingStatus)) {
    this.status = incomingStatus;
  } else if (incomingStatus) {
    console.warn(
      `⚠️ Invalid device status '${incomingStatus}' received. Using 'online' instead.`,
    );
    this.status = "online"; // Default to online for invalid statuses like 'busy'
  } else {
    this.status = "online"; // Default when no status provided
  }

  if (statusData.system_info) {
    this.system_info = {
      ...this.system_info,
      ...statusData.system_info,
      last_updated: new Date(),
    };
  }

  if (statusData.chrome_status) {
    this.chrome_status = {
      ...this.chrome_status,
      ...statusData.chrome_status,
      last_updated: new Date(),
    };
  }

  if (statusData.desktop_status) {
    this.desktop_status = {
      ...this.desktop_status,
      ...statusData.desktop_status,
      last_updated: new Date(),
    };
  }

  return this.save();
};

hvncDeviceSchema.methods.generateAuthToken = function () {
  const jwt = require("jsonwebtoken");
  const envConfig = require("../config/envConfig");

  const token = jwt.sign(
    {
      device_id: this.device_id,
      type: "device",
      id: this._id,
    },
    envConfig.jwt.JWT_SECRET,
    { expiresIn: "30d" },
  );

  return token;
};

// Static methods
hvncDeviceSchema.statics.findByDeviceId = async function (deviceId) {
  // First try to find by device_id (exact match)
  let device = await this.findOne({ device_id: deviceId });

  // If not found, try to find by pc_name (for backward compatibility)
  if (!device) {
    device = await this.findOne({ pc_name: deviceId });
  }

  return device;
};

hvncDeviceSchema.statics.getOnlineDevices = function () {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.find({
    last_seen: { $gt: fiveMinutesAgo },
    status: "online",
  });
};

module.exports = mongoose.model("HVNCDevice", hvncDeviceSchema);
