const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    icon: {
      type: String,
      default: "",
      trim: true,
    },
    resourceKey: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      index: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resource",
      default: null,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

resourceSchema.index({ parent: 1, sortOrder: 1 });
resourceSchema.index({ isPublished: 1, resourceKey: 1 });

resourceSchema.pre("validate", function updateResourceKey(next) {
  const fromIcon = String(this.icon || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  if (fromIcon) {
    this.resourceKey = fromIcon;
    return next();
  }

  const link = String(this.link || "")
    .trim()
    .toLowerCase();
  const cleaned = link.replace(/\/+$/, "");
  const lastSegment = cleaned.split("/").filter(Boolean).pop() || "";
  this.resourceKey = lastSegment.replace(/-/g, "_");
  return next();
});

module.exports = mongoose.model("Resource", resourceSchema);
