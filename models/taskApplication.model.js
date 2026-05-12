const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

const TaskApplicationSchema = new mongoose.Schema({
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true,
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DTUser',
    },
    applicant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DTUser',
        required: true,
    },
    images: {
        type: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "task_image_upload",
            },
        ],
        validate: {
            validator: function (images) {
                return images.length <= 20;
            },
            message: "A task application cannot have more than 20 images.",
        },
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DTUser',
    },
     approvedDate: {
        type: Date,
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DTUser',
    },
    status: {
        type: String,
        enum: ['pending', 'ongoing', 'approved', 'processing', 'active', 'paused', 'completed', 'cancelled', "rejected"],
        default: 'ongoing',
    },
    isComplete: {
        type: Boolean,
        default: false,
    },
    // Dynamic uploadProgress that will be set based on task category
    uploadProgress: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    // Snapshot of due date at assignment time (task due date may change later)
    dueDate: {
        type: Date,
        required: true,
    },
    submittedAt: {
        type: Date,
    },
    
    reviewedAt: {
        type: Date,
    },
    reviewNote: {
        type: String,
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DTUser',
    },
    rejectedAt: {
        type: Date,
    },
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DTUser',
    },
    rejectionMessage: {
        type: String,
    },
}, { timestamps: true });

// Auto-update uploadProgress whenever images array changes
// In your TaskApplication model's pre-save hook, update the metadata handling:
TaskApplicationSchema.pre('save', async function (next) {
    try {
        if (!this.isModified('images')) return next();

        // Fetch images with all fields including metadata
        const imageDocuments = await mongoose.model('task_image_upload')
            .find({ _id: { $in: this.images } })
            .lean(); // Remove the 'label' filter to get all fields

        // Get task category
        const task = await mongoose.model('Task').findById(this.task).lean();
        const isAgeProgression = task?.category === 'age_progression';

        if (isAgeProgression) {
            const view1Count = imageDocuments.filter(img => img.label === 'View 1').length;
            
            this.uploadProgress = {
                'View 1': view1Count,
                total: imageDocuments.length,
            };
            this.isComplete = view1Count >= 15 && imageDocuments.length >= 15;
        } else {
            const counts = { 'View 1': 0, 'View 2': 0, 'View 3': 0, 'View 4': 0 };

            imageDocuments.forEach(img => {
                if (counts[img.label] !== undefined) {
                    counts[img.label]++;
                }
            });

            this.uploadProgress = {
                ...counts,
                total: imageDocuments.length,
            };
            this.isComplete = Object.values(counts).every((count) => count >= 5) && imageDocuments.length >= 20;
        }

        next();
    } catch (err) {
        next(err);
    }
});

TaskApplicationSchema.pre(
    ['deleteOne', 'findOneAndDelete'],
    { document: false, query: true },
    async function (next) {
        try {
            const application = await this.model.findOne(this.getFilter()).lean();
            if (!application || !application.images?.length) return next();

            const imageDocuments = await mongoose.model('task_image_upload')
                .find({ _id: { $in: application.images } }, 'publicId')
                .lean();

            if (imageDocuments.length) {
                const publicIds = imageDocuments
                    .map((img) => img.publicId)
                    .filter(Boolean);

                if (publicIds.length) {
                    await cloudinary.api.delete_resources(publicIds);
                }

                await mongoose.model('task_image_upload').deleteMany({
                    _id: { $in: imageDocuments.map((img) => img._id) },
                });
            }

            next();
        } catch (err) {
            next(err);
        }
    }
);

// Prevent duplicate assignments of the same task to the same user
TaskApplicationSchema.index({ task: 1, assignedTo: 1, applicant: 1 }, { unique: true });

const TaskApplication = mongoose.model('TaskApplication', TaskApplicationSchema);
module.exports = TaskApplication;