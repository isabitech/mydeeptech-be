const mongoose = require("mongoose");

const TaskImageUploadSchema = new mongoose.Schema(
    {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        label: { type: String, required: true },
        dateTaken: { type: Date, default: null }, // For age_progression
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
            required: true,
        },
        rejectionMessage: { type: String, default: null, trim: true },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        reviewedAt: { type: Date, default: null },
        metadata: {
            angle: { type: String, default: null },
            taskCategory: { type: String, default: null },
            sceneTitle: { type: String, default: null },
            imageSequence: { type: Number, default: null },
            uploadTimestamp: { type: Date, default: null },
            fileSize: { type: Number, default: null },
            fileName: { type: String, default: null },
            fileType: { type: String, default: null },
            resolution: {
                width: { type: Number, default: null },
                height: { type: Number, default: null },
            },
            fileUrl: { type: String, default: null },
            publicId: { type: String, default: null },
            dateTaken: { type: Date, default: null },
            // New EXIF fields
            exif: {
                make: { type: String, default: null },
                model: { type: String, default: null },
                dateTimeOriginal: { type: String, default: null },
                dateTimeDigitized: { type: String, default: null },
                exposureTime: { type: Number, default: null },
                fNumber: { type: Number, default: null },
                iso: { type: Number, default: null },
                focalLength: { type: Number, default: null },
                flash: { type: Number, default: null },
                gpsLatitude: { type: Number, default: null },
                gpsLongitude: { type: Number, default: null },
            },
            imageFormat: { type: String, default: null },
            imageOrientation: { type: Number, default: null },
        },
    },
    { timestamps: true }
);

// Add index for better query performance
TaskImageUploadSchema.index({ status: 1, label: 1 });
TaskImageUploadSchema.index({ taskApplication: 1, status: 1 });

const TaskImageUpload = mongoose.model("task_image_upload", TaskImageUploadSchema);

module.exports = TaskImageUpload;