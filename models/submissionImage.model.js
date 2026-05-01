const mongoose = require("mongoose");

const submissionImageSchema = new mongoose.Schema(
  {
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MicroTaskSubmission",
      required: true
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskSlot",
      required: true
    },
    
    // Image storage information (Cloudinary)
    cloudinary_data: {
      publicId: { type: String, required: true },
      url: { type: String, required: true },
      secure_url: { type: String, required: true },
      optimized_url: { type: String, default: "" },
      thumbnail_url: { type: String, default: "" },
      original_filename: { type: String, default: "" },
      format: { type: String, default: "" },
      resource_type: { 
        type: String, 
        default: "image",
        enum: ["image", "video", "raw", "auto"]
      },
      bytes: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
      folder: { type: String, default: "micro-tasks" }
    },
    
    // Auto-generated metadata from slot
    image_metadata: {
      angle: { type: String, default: "" },
      mask_type: { type: String, default: "" },
      background_type: { type: String, default: "" },
      time_period: { type: String, default: "" },
      image_category: { 
        type: String, 
        enum: ["mask", "age_progression"],
        required: true
      },
      sequence: { type: Number, required: true },
      upload_timestamp: { type: Date, default: Date.now },
      file_size_bytes: { type: Number, default: 0 },
      resolution: { type: String, default: "" }, // e.g., "1920x1080"
      file_format: { type: String, default: "" }
    },
    
    // Quality validation results
    quality_check: {
      face_detected: { type: Boolean, default: null },
      face_size_pixels: { type: Number, default: null },
      lighting_quality: { 
        type: String,
        enum: ["poor", "acceptable", "good", "excellent"],
        default: null
      },
      image_clarity: {
        type: String,
        enum: ["blurry", "acceptable", "sharp"],
        default: null
      },
      background_appropriate: { type: Boolean, default: null },
      meets_requirements: { type: Boolean, default: null },
      validation_notes: { type: String, default: "" }
    },
    
    // Review status for this specific image
    review_status: {
      type: String,
      enum: ["pending", "approved", "rejected", "needs_replacement"],
      default: "pending"
    },
    rejection_reason: {
      type: String,
      default: ""
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      default: null
    },
    review_date: {
      type: Date,
      default: null
    },
    
    // Replacement tracking
    is_replacement: {
      type: Boolean,
      default: false
    },
    replaces_image: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubmissionImage",
      default: null
    },
    replacement_reason: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

// Indexes for efficient querying
submissionImageSchema.index({ submissionId: 1, slotId: 1 }, { unique: true });
submissionImageSchema.index({ submissionId: 1 });
submissionImageSchema.index({ review_status: 1 });
submissionImageSchema.index({ "cloudinary_data.publicId": 1 });

// Pre-save middleware to update image metadata from slot
submissionImageSchema.pre("save", async function(next) {
  // Populate slot information if not already done
  if (!this.populated("slotId")) {
    await this.populate("slotId");
  }
  
  // Auto-generate metadata from slot
  if (this.slotId && this.slotId.metadata) {
    this.image_metadata.angle = this.slotId.metadata.angle || "";
    this.image_metadata.mask_type = this.slotId.metadata.mask_type || "";
    this.image_metadata.background_type = this.slotId.metadata.background_type || "";
    this.image_metadata.time_period = this.slotId.metadata.time_period || "";
    this.image_metadata.image_category = this.slotId.metadata.image_category;
    this.image_metadata.sequence = this.slotId.sequence;
  }
  
  // Update file metadata from Cloudinary data
  if (this.cloudinary_data) {
    this.image_metadata.file_size_bytes = this.cloudinary_data.bytes || 0;
    this.image_metadata.file_format = this.cloudinary_data.format || "";
    
    if (this.cloudinary_data.width && this.cloudinary_data.height) {
      this.image_metadata.resolution = `${this.cloudinary_data.width}x${this.cloudinary_data.height}`;
    }
  }
  
  next();
});

// Method to get formatted metadata for export
submissionImageSchema.methods.getFormattedMetadata = function() {
  return {
    // Image metadata
    angle: this.image_metadata.angle,
    mask_type: this.image_metadata.mask_type,
    background_type: this.image_metadata.background_type,
    time_period: this.image_metadata.time_period,
    image_category: this.image_metadata.image_category,
    sequence: this.image_metadata.sequence,
    upload_timestamp: this.image_metadata.upload_timestamp,
    file_size: this.image_metadata.file_size_bytes,
    resolution: this.image_metadata.resolution,
    file_url: this.cloudinary_data.secure_url,
    
    // Quality info
    quality_score: this.quality_check.meets_requirements ? 100 : 0,
    review_status: this.review_status,
    
    // System metadata
    vendor_name: "MyDeep Technologies",
    image_id: this._id,
    slot_name: this.slotId?.slot_name
  };
};

// Static method to get images by submission
submissionImageSchema.statics.getBySubmission = function(submissionId) {
  return this.find({ submissionId }).populate("slotId").sort({ "image_metadata.sequence": 1 });
};

// Static method to get pending review images
submissionImageSchema.statics.getPendingReview = function() {
  return this.find({ review_status: "pending" }).populate("submissionId slotId");
};

module.exports = mongoose.model("SubmissionImage", submissionImageSchema);