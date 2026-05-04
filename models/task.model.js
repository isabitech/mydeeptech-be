const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    taskTitle: {
        type: String,
        minlength: 4,
        required: true,
        trim: true,
    },
    status: {
        type: String,
        enum: ["pending", "draft", "ongoing", "processing", 'active', 'paused', 'completed', 'cancelled'],
        default: 'pending',
    },
    description: {
        type: String,
        trim: true,
    },
    taskLink: {
        type: String,
    },
    taskGuidelineLink: {
        type: String,
        minlength: 4,
    },
    category: { type: String, enum: ['mask_collection', 'text_annotation', 'audio_annotation', 'video_annotation', 'age_progression'], required: true },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DTUser',
        required: true,
    },
    payRate: {
        type: Number,
        required: true,
        min: [0, 'Pay rate must be a positive number'],
    },
    currency: {
        type: String,
        required: true,
        enum: ['USD', 'NGN', 'EUR', 'GBP'],
        default: 'USD',
    },

   instructions: {
        type: String,
        minlength: 10,
        required: [true, 'Instructions are required'],
        trim: true,
    },
    
    quality_guidelines: {
        type: String,
        minlength: 10,
        required: [true, 'Quality guidelines are required'],
        trim: true,
    },
    maxParticipants: {
        type: Number,
        required: false,
        min: [1, 'Max participants must be at least 1'],
    },
    dueDate: {
        type: Date,
        required: [true, 'Due date is required'],
        validate: {
            validator: (value) => value > Date.now(),
            message: 'Due date must be in the future',
        },
    },
    // Defines the image categories and required count per category
    imageRequirements: {
        type: [
            {
                label: { type: String, enum: ['Front', 'Right', 'Left', 'Bottom'], required: true, },
                requiredCount: { type: Number, default: 4 },
            },
        ],
        default: [
            { label: 'Front',  requiredCount: 4 },
            { label: 'Right',  requiredCount: 4 },
            { label: 'Left',   requiredCount: 4 },
            { label: 'Bottom', requiredCount: 4 },
        ],
    },
    totalImagesRequired: {
        type: Number,
        default: 20,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true }); // use timestamps instead of manual dateCreated

const Task = mongoose.model('Task', TaskSchema);
module.exports = Task;