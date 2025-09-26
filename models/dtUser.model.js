const mongoose = require("mongoose");

const dtUserSchema = new mongoose.Schema(
  {
    fullName: {     
        type: String, 
        required: true, 
        trim: true
    },
    phone: { 
        type: String, 
        required: true, 
        trim: true
    },
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true 
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
  },
  { timestamps: true }
);

const DTUser = mongoose.model("DTUser", dtUserSchema);

module.exports = DTUser;
