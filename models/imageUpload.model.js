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
  },
  { timestamps: true }
);

const TaskImageUpload = mongoose.model("task_image_upload", TaskImageUploadSchema);

module.exports = TaskImageUpload;