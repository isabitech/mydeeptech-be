const mongoose = require('mongoose');
const domainSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null }, // optional
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory', default: null } // optional
});

module.exports = mongoose.model('Domain', domainSchema);
