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
    dateTaken: {
        type: Date,
        required: false, // Required for age_progression, optional for mask_collection
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
                // This = the parent document (taskSubmission)
                // If no task, fallback to mask_collection rules
                const task = this.task || (this._doc && this._doc.task);
                let category = 'mask_collection';
                if (task && task.category) {
                    category = task.category;
                } else if (this.category) {
                    category = this.category;
                }
                if (category === 'age_progression') {
                    // 15 images, each must have a dateTaken
                    if (images.length > 15) return false;
                    return images.every(img => img.label && img.dateTaken);
                } else {
                    // mask_collection: 20 images, 5 per label, label required
                    if (images.length > 20) return false;
                    const labelCounts = { 'View 1': 0, 'View 2': 0, 'View 3': 0, 'View 4': 0 };
                    for (const img of images) {
                        if (!img.label || !labelCounts.hasOwnProperty(img.label)) return false;
                        labelCounts[img.label]++;
                    }
                    return Object.values(labelCounts).every(count => count <= 5);
                }
            },
            message: function(props) {
                // Custom error message based on category
                const task = this.task || (this._doc && this._doc.task);
                let category = 'mask_collection';
                if (task && task.category) {
                    category = task.category;
                } else if (this.category) {
                    category = this.category;
                }
                if (category === 'age_progression') {
                    return 'A submission for age progression must have at most 15 images, each with a label and date taken.';
                } else {
                    return 'A submission for mask collection must have at most 20 images, with no more than 5 per label.';
                }
            },
        },
    },
    // Derived progress counts — easy to query without aggregation
    uploadProgress: {
        'View 1':  { type: Number, default: 0, max: 5 },
        'View 2':  { type: Number, default: 0, max: 5 },
        'View 3':  { type: Number, default: 0, max: 5 },
        'View 4': { type: Number, default: 0, max: 5 },
        total:  { type: Number, default: 0, max: 20 },
    },
    isComplete: {
        type: Boolean,
        default: false, // true when all 20 images are uploaded
    },
}, { timestamps: true });

// Auto-update uploadProgress and isComplete for both categories
taskSubmissionSchema.pre('save', function (next) {
    // Default: mask_collection logic
    let category = 'mask_collection';
    if (this.task && this.task.category) {
        category = this.task.category;
    } else if (this.category) {
        category = this.category;
    }
    if (category === 'age_progression') {
        // No per-label progress, just total
        this.uploadProgress = {
            total: this.images.length,
        };
        this.isComplete = this.images.length === 15 && this.images.every(img => img.label && img.dateTaken);
    } else {
        // mask_collection
        const counts = { 'View 1': 0, 'View 2': 0, 'View 3': 0, 'View 4': 0 };
        this.images.forEach(img => {
            if (counts[img.label] !== undefined) counts[img.label]++;
        });
        this.uploadProgress = {
            ...counts,
            total: this.images.length,
        };
        this.isComplete = Object.values(counts).every((counter) => counter >= 5) && this.images.length >= 20;
    }
    next();
});

const TaskSubmission = mongoose.model('TaskSubmission', taskSubmissionSchema);
module.exports = TaskSubmission;