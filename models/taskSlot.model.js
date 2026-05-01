const mongoose = require("mongoose");

const taskSlotSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MicroTask",
      required: true
    },
    slot_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    sequence: {
      type: Number,
      required: true,
      min: 1
    },
    // Slot metadata for automatic tagging
    metadata: {
      angle: {
        type: String,
        enum: [
          "Front", "Left 45°", "Right 45°", "Left Profile", "Right Profile",
          "Up", "Down", "Indoor", "Outdoor", "Different Background",
          "Year 2021", "Year 2022", "Year 2023", "Year 2024", "Year 2025", "Year 2026"
        ],
        default: null
      },
      mask_type: {
        type: String,
        enum: ["A", "B"],
        default: null
      },
      background_type: {
        type: String,
        enum: ["Indoor", "Outdoor", "Different Background"],
        default: null
      },
      time_period: {
        type: String,
        default: null // e.g., "2021", "2022-Q1", etc.
      },
      image_category: {
        type: String,
        enum: ["mask", "age_progression"],
        required: true
      }
    },
    // Validation requirements for this slot
    validation_rules: {
      required_face_size: {
        type: Number,
        default: 240 // minimum pixels
      },
      lighting_requirements: {
        type: String,
        enum: ["good", "any"],
        default: "good"
      },
      face_visibility: {
        type: Boolean,
        default: true
      },
      background_requirements: {
        type: String,
        default: null
      }
    },
    // Instructions specific to this slot
    slot_instructions: {
      type: String,
      default: ""
    },
    // Example image for reference
    example_image_url: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

// Index for efficient querying
taskSlotSchema.index({ taskId: 1, sequence: 1 });
taskSlotSchema.index({ taskId: 1 });

// Static method to generate slots for mask collection
taskSlotSchema.statics.generateMaskCollectionSlots = function(taskId) {
  const slots = [];
  const angles = [
    { name: "Front Mask A", angle: "Front", mask_type: "A" },
    { name: "Left 45° Mask A", angle: "Left 45°", mask_type: "A" },
    { name: "Right 45° Mask A", angle: "Right 45°", mask_type: "A" },
    { name: "Left Profile Mask A", angle: "Left Profile", mask_type: "A" },
    { name: "Right Profile Mask A", angle: "Right Profile", mask_type: "A" },
    { name: "Up Mask A", angle: "Up", mask_type: "A" },
    { name: "Down Mask A", angle: "Down", mask_type: "A" },
    { name: "Front Indoor Mask A", angle: "Front", mask_type: "A", background_type: "Indoor" },
    { name: "Front Outdoor Mask A", angle: "Front", mask_type: "A", background_type: "Outdoor" },
    { name: "Front Different Background Mask A", angle: "Front", mask_type: "A", background_type: "Different Background" },
    { name: "Front Mask B", angle: "Front", mask_type: "B" },
    { name: "Left 45° Mask B", angle: "Left 45°", mask_type: "B" },
    { name: "Right 45° Mask B", angle: "Right 45°", mask_type: "B" },
    { name: "Left Profile Mask B", angle: "Left Profile", mask_type: "B" },
    { name: "Right Profile Mask B", angle: "Right Profile", mask_type: "B" },
    { name: "Up Mask B", angle: "Up", mask_type: "B" },
    { name: "Down Mask B", angle: "Down", mask_type: "B" },
    { name: "Front Indoor Mask B", angle: "Front", mask_type: "B", background_type: "Indoor" },
    { name: "Front Outdoor Mask B", angle: "Front", mask_type: "B", background_type: "Outdoor" },
    { name: "Front Different Background Mask B", angle: "Front", mask_type: "B", background_type: "Different Background" }
  ];

  angles.forEach((slot, index) => {
    slots.push({
      taskId,
      slot_name: slot.name,
      sequence: index + 1,
      metadata: {
        angle: slot.angle,
        mask_type: slot.mask_type,
        background_type: slot.background_type || null,
        image_category: "mask"
      },
      validation_rules: {
        required_face_size: 240,
        lighting_requirements: "good",
        face_visibility: true
      },
      slot_instructions: `Upload ${slot.name} - Ensure good lighting and face visibility`
    });
  });

  return slots;
};

// Static method to generate slots for age progression
taskSlotSchema.statics.generateAgeProgressionSlots = function(taskId) {
  const slots = [];
  const years = ["2021", "2022", "2023", "2024", "2025", "2026"];
  let sequence = 1;

  years.forEach(year => {
    // Multiple slots per year to reach 15 total
    const slotsPerYear = year === "2021" || year === "2022" ? 3 : 2;
    
    for (let i = 1; i <= slotsPerYear; i++) {
      if (sequence <= 15) {
        slots.push({
          taskId,
          slot_name: `${year} Image ${i}`,
          sequence: sequence,
          metadata: {
            time_period: year,
            image_category: "age_progression"
          },
          validation_rules: {
            required_face_size: 240,
            lighting_requirements: "good",
            face_visibility: true
          },
          slot_instructions: `Upload image from ${year} - No selfies, face must be > 240px, at least 1 month gap between images`
        });
        sequence++;
      }
    }
  });

  return slots;
};

module.exports = mongoose.model("TaskSlot", taskSlotSchema);