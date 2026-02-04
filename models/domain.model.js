const mongoose = require('mongoose');
const domainSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    parent: { type: mongoose.Schema.Types.ObjectId, refPath: 'parentModel' },
    parentModel: { type: String, enum: ['Category', 'SubCategory'] }
},{
    timestamps: true // Enable automatic timestamps
});


module.exports = mongoose.model('Domain', domainSchema);
