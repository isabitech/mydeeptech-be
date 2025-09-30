const mongoose = require("mongoose");

const dtUserSchema = new mongoose.Schema(
  {
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

    // Default statuses
    annotatorStatus: {
      type: String,
      enum: ["pending", "submitted", "verified", "approved"],
      default: "pending",
    },
    microTaskerStatus: {
      type: String,
      enum: ["pending", "submitted", "verified", "approved"],
      default: "pending",
    },

    resultLink: { type: String, default: "" },
    isEmailVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DTUser", dtUserSchema);
