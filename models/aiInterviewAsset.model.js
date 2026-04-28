const mongoose = require("mongoose");

const parsedResumeSchema = new mongoose.Schema(
  {
    headline: { type: String, default: "" },
    yearsOfExperience: { type: Number, default: 0 },
    primaryRoles: { type: [String], default: [] },
    keySkills: { type: [String], default: [] },
    notableProjects: { type: [String], default: [] },
    education: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    industries: { type: [String], default: [] },
    strengths: { type: [String], default: [] },
    summary: { type: String, default: "" },
    source: { type: String, default: "" },
  },
  { _id: false },
);

const aiMetadataSchema = new mongoose.Schema(
  {
    agent: { type: String, default: "" },
    provider: { type: String, default: "" },
    model: { type: String, default: "" },
    promptVersion: { type: String, default: "" },
    latencyMs: { type: Number, default: 0 },
    tokensUsed: { type: Number, default: 0 },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
  },
  { _id: false },
);

const aiInterviewAssetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["profile-resume", "ai-upload"],
      default: "profile-resume",
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      default: "",
      trim: true,
    },
    mimeType: {
      type: String,
      default: "",
      trim: true,
    },
    parseStatus: {
      type: String,
      enum: ["pending", "parsed", "failed"],
      default: "pending",
    },
    parseError: {
      type: String,
      default: "",
    },
    extractedText: {
      type: String,
      default: "",
    },
    parsedProfile: {
      type: parsedResumeSchema,
      default: () => ({}),
    },
    aiMetadata: {
      type: aiMetadataSchema,
      default: () => ({}),
    },
    parsedAt: {
      type: Date,
      default: null,
    },
    lastFetchedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

aiInterviewAssetSchema.index({ userId: 1, fileUrl: 1 });
aiInterviewAssetSchema.index({ parseStatus: 1, updatedAt: -1 });

module.exports = mongoose.model("AiInterviewAsset", aiInterviewAssetSchema);
