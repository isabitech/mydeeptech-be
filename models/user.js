const mongoose = require('mongoose');
const {RoleType} = require('../utils/role');

const userSchema = new mongoose.Schema({
    firstname: {
        type: String,
        minlenght: 3,
        required: 'Fristname is required'
    },
    lastname: {
        type: String,
        minlenght: 3,
        required: 'Lastname is required'
    },
    username: {
        type: String,
        minlenght: 3,
        required: 'Username is required' 
    },
    email: { 
        type: String, 
        minlength: 3,
        unique: true,
        lowercase: true,
        required: "Email is required" 
        },
    password: {
         type: String, 
         minlength: 8, 
         required: "Password is required" 
        },
    phone: {
       type: String, 
       required: true 
    },
    role: {
        type: String,
        required: "Role name is required",
        enum: [RoleType.USER, RoleType.ADMIN],
        default: RoleType.USER
    },
    // Password reset fields
    passwordResetToken: {
        type: String,
        default: null
    },
    passwordResetExpires: {
        type: Date,
        default: null
    },
    passwordResetAttempts: {
        type: Number,
        default: 0
    }
  });

  const User = mongoose.model('User', userSchema); // Defining the model here

  module.exports = User; 