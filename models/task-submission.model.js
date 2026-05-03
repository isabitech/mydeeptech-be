const mongoose = require('mongoose');

// Sub-schema for each individual uploaded image
const uploadedImageSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true, // e.g. S3 / Cloudinary URL
    },
    label: {
        type: String,
        enum: ['Front', 'Right', 'Left', 'Bottom'],
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
    assignment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TaskApplication',
        required: true,
        unique: true, // One submission document per assignment
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
        Front:  { type: Number, default: 0, max: 4 },
        Right:  { type: Number, default: 0, max: 4 },
        Left:   { type: Number, default: 0, max: 4 },
        Bottom: { type: Number, default: 0, max: 4 },
        total:  { type: Number, default: 0, max: 20 },
    },
    isComplete: {
        type: Boolean,
        default: false, // true when all 20 images are uploaded
    },
}, { timestamps: true });

// Auto-update uploadProgress whenever images array changes
taskSubmissionSchema.pre('save', function (next) {
    const counts = { Front: 0, Right: 0, Left: 0, Bottom: 0 };
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