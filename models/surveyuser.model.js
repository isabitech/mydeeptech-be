const mongoose = require('mongoose');

const SuserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  }
  // You can add more fields like name, access level, etc.
});

module.exports = mongoose.model('Suser', SuserSchema);
