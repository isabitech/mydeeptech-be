const mongoose = require("mongoose");

const TaskImageUploadSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    metadata: {
      angle: { type: String, default: null },
      taskCategory: { type: String, default: null },
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
    },
  },
  { timestamps: true }
);

const TaskImageUpload = mongoose.model("task_image_upload", TaskImageUploadSchema);

module.exports = TaskImageUpload;