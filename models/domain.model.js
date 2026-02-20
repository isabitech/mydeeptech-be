const mongoose = require('mongoose');
const domainSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' },
},{
    timestamps: true // Enable automatic timestamps
});


module.exports = mongoose.model('Domain', domainSchema);
