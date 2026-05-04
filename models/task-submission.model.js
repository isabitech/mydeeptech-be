const mongoose = require('mongoose');

// Sub-schema for each individual uploaded image
const uploadedImageSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true, // e.g. S3 / Cloudinary URL
    },
    label: {
        type: String,
        enum: ['View 1', 'View 2', 'View 3', 'View 4'],
        required: true,
    },
    uploadedAt: {
        type: Date,
        default: Date.now,
    },
    // Useful for re-uploads or identifying the file on cloud storage
    publicId: { type: String },
}, { _id: true });

const taskSubmissionSchema = new mongoose.Schema({
    taskApplication: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TaskApplication',
    },
    task:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true,
        unique: true,
    },    
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DTUser',
        required: true,
    },
    images: {
        type: [uploadedImageSchema],
        validate: {
            validator: function (images) {
                // Enforce max 20 images total
                return images.length <= 20;
            },
            message: 'A submission cannot have more than 20 images.',
        },
    },
    // Derived progress counts — easy to query without aggregation
    uploadProgress: {
        'View 1':  { type: Number, default: 0, max: 4 },
        'View 2':  { type: Number, default: 0, max: 4 },
        'View 3':  { type: Number, default: 0, max: 4 },
        'View 4': { type: Number, default: 0, max: 4 },
        total:  { type: Number, default: 0, max: 20 },
    },
    isComplete: {
        type: Boolean,
        default: false, // true when all 20 images are uploaded
    },
}, { timestamps: true });

// Auto-update uploadProgress whenever images array changes
taskSubmissionSchema.pre('save', function (next) {
    const counts = { 'View 1': 0, 'View 2': 0, 'View 3': 0, 'View 4': 0 };
    this.images.forEach(img => {
        if (counts[img.label] !== undefined) counts[img.label]++;
    });

    this.uploadProgress = {
        ...counts,
        total: this.images.length,
    };

    this.isComplete = Object.values(counts).every((counter) => counter >= 4) && this.images.length >= 20;
    next();
});

const TaskSubmission = mongoose.model('TaskSubmission', taskSubmissionSchema);
module.exports = TaskSubmission;