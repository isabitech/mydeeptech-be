const mongoose = require('mongoose');

const taskAssignmentSchema = new mongoose.Schema({
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true,
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DTUser',
        required: true,
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DTUser',
        required: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Submitted', 'Approved', 'Rejected'],
        default: 'Pending',
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
taskAssignmentSchema.index({ task: 1, assignedTo: 1 }, { unique: true });

const TaskAssignment = mongoose.model('TaskAssignment', taskAssignmentSchema);
module.exports = TaskAssignment;