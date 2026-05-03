const mongoose = require('mongoose');

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
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DTUser',
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DTUser',
    },
    status: {
        type: String,
        enum: ['pending', 'ongoing', 'approved', 'processing', 'active', 'paused', 'completed', 'cancelled'],
        default: 'pending',
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
        type: String, // Admin feedback on rejection or approval
    },
}, { timestamps: true });

// Prevent duplicate assignments of the same task to the same user
TaskApplicationSchema.index({ task: 1, assignedTo: 1, applicant: 1 }, { unique: true });

const TaskApplication = mongoose.model('TaskApplication', TaskApplicationSchema);
module.exports = TaskApplication;