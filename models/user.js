const mongoose = require('mongoose');

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
    }
  });

  const User = mongoose.model('User', userSchema); // Defining the model here

  module.exports = User; 