const mongoose = require("mongoose");
const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true }
},{
  timestamps: true // Enable automatic timestamps
});

module.exports = mongoose.model('Category', categorySchema);
