const mongoose = require("mongoose");
const {
  ALL_AI_INTERVIEW_STATUSES,
  FINAL_DECISIONS,
  TRACK_TYPES,
} = require("../services/ai-interview/constants");

const questionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    sectionTitle: { type: String, default: "" },
    prompt: { type: String, required: true },
    placeholder: { type: String, default: "" },
    tip: { type: String, default: "" },
    suggestedMinutes: { type: Number, default: 0 },
    basePrompt: { type: String, default: "" },
    generatedByAi: { type: Boolean, default: false },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false },
);

const answerScoreSchema = new mongoose.Schema(
  {
    clarity: { type: Number, min: 0, max: 10, default: null },
    instructionFidelity: { type: Number, min: 0, max: 10, default: null },
    reasoning: { type: Number, min: 0, max: 10, default: null },
    domainFit: { type: Number, min: 0, max: 10, default: null },
    overallScore: { type: Number, min: 0, max: 100, default: null },
    flags: { type: [String], default: [] },
    notes: { type: String, default: "" },
  },
  { _id: false },
);

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    questionPrompt: { type: String, default: "" },
    sectionTitle: { type: String, default: "" },
    answer: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
    score: {
      type: answerScoreSchema,
      default: () => ({}),
    },
  },
  {
    _id: true,
  },
);

const dimensionScoreSchema = new mongoose.Schema(
  {
    key: { type: String, default: "" },
    label: { type: String, required: true },
    score: { type: Number, min: 0, max: 10, default: 0 },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const resultStrengthSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
  },
  { _id: false },
);

const resultSchema = new mongoose.Schema(
  {
    score: { type: Number, min: 0, max: 100, default: 0 },
    status: {
      type: String,
      enum: FINAL_DECISIONS,
      default: null,
    },
    badgeLabel: { type: String, default: "" },
    qualificationLabel: { type: String, default: "" },
    percentileLabel: { type: String, default: "" },
    summary: { type: String, default: "" },
    strengths: { type: [resultStrengthSchema], default: [] },
    concerns: { type: [String], default: [] },
    nextStepTitle: { type: String, default: "" },
    nextStepDescription: { type: String, default: "" },
    moduleProgress: { type: Number, min: 0, max: 100, default: 0 },
    recommendation: { type: String, default: "" },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    generatedAt: { type: Date, default: null },
  },
  { _id: false },
);

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

const aiCallSchema = new mongoose.Schema(
  {
    agent: { type: String, default: "" },
    provider: { type: String, default: "" },
    model: { type: String, default: "" },
    promptVersion: { type: String, default: "" },
    latencyMs: { type: Number, default: 0 },
    tokensUsed: { type: Number, default: 0 },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    status: { type: String, default: "success" },
    errorMessage: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const focusLossEventSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["tab-hidden", "window-blur"],
      required: true,
    },
    occurredAt: { type: Date, required: true },
    label: { type: String, default: "" },
  },
  { _id: false },
);

const focusLossAssessmentSchema = new mongoose.Schema(
  {
    hasFocusLoss: { type: Boolean, default: false },
    automaticFailure: { type: Boolean, default: false },
    eventCount: { type: Number, default: 0, min: 0 },
    distinctEventTypes: {
      type: [
        {
          type: String,
          enum: ["tab-hidden", "window-blur"],
        },
      ],
      default: [],
    },
    classification: { type: String, default: "" },
    riskLevel: { type: String, default: "none" },
    summary: { type: String, default: "" },
    recommendation: { type: String, default: "" },
    concerns: { type: [String], default: [] },
    previousStatus: { type: String, default: "" },
    previousScore: { type: Number, min: 0, max: 100, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { _id: false },
);

const aiInterviewSessionSchema = new mongoose.Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      required: true,
      index: true,
    },
    createdByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      default: null,
    },
    reviewedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      default: null,
    },
    sessionSource: {
      type: String,
      enum: ["catalog", "project-application"],
      default: "catalog",
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnnotationProject",
      default: null,
      index: true,
    },
    projectName: {
      type: String,
      default: "",
      trim: true,
    },
    projectApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectApplication",
      default: null,
      index: true,
    },
    candidateName: {
      type: String,
      required: true,
      trim: true,
    },
    candidateEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    trackId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    trackTitle: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(TRACK_TYPES),
      required: true,
    },
    languageCode: {
      type: String,
      default: "en-US",
      trim: true,
    },
    status: {
      type: String,
      enum: ALL_AI_INTERVIEW_STATUSES,
      default: "not-started",
      index: true,
    },
    aiName: {
      type: String,
      default: "Dr. Myra",
      trim: true,
    },
    targetRole: {
      type: String,
      default: "",
      trim: true,
    },
    specialization: {
      type: String,
      default: "",
      trim: true,
    },
    resumeAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AiInterviewAsset",
      default: null,
    },
    resumeName: {
      type: String,
      default: "",
      trim: true,
    },
    resumeUrl: {
      type: String,
      default: "",
      trim: true,
    },
    parsedResume: {
      type: parsedResumeSchema,
      default: () => ({}),
    },
    trackSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    questions: {
      type: [questionSchema],
      default: [],
    },
    currentQuestionIndex: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },
    answers: {
      type: [answerSchema],
      default: [],
    },
    draftAnswer: {
      type: String,
      default: "",
    },
    applicationContext: {
      coverLetter: { type: String, default: "" },
      proposedRate: { type: Number, default: null },
      availability: { type: String, default: "" },
      estimatedCompletionTime: { type: String, default: "" },
      submittedAt: { type: Date, default: null },
    },
    focusLossEvents: {
      type: [focusLossEventSchema],
      default: [],
    },
    focusLossAssessment: {
      type: focusLossAssessmentSchema,
      default: null,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    dimensionScores: {
      type: [dimensionScoreSchema],
      default: [],
    },
    result: {
      type: resultSchema,
      default: null,
    },
    adminNote: {
      type: String,
      default: "",
    },
    adminNoteUpdatedAt: {
      type: Date,
      default: null,
    },
    providerMetadata: {
      provider: { type: String, default: "" },
      mainModel: { type: String, default: "" },
      scoreModel: { type: String, default: "" },
      promptVersion: { type: String, default: "" },
      totalTokensUsed: { type: Number, default: 0 },
      aiCallLog: { type: [aiCallSchema], default: [] },
    },
  },
  {
    timestamps: true,
  },
);

aiInterviewSessionSchema.index({ candidateId: 1, trackId: 1, createdAt: -1 });
aiInterviewSessionSchema.index({ candidateId: 1, projectId: 1, createdAt: -1 });
aiInterviewSessionSchema.index({ candidateEmail: 1, createdAt: -1 });
aiInterviewSessionSchema.index({ completedAt: -1 });

aiInterviewSessionSchema.pre("save", function syncQuestionMetadata(next) {
  if (Array.isArray(this.questions)) {
    this.totalQuestions = this.questions.length;
  }

  if (this.totalQuestions === 0) {
    this.currentQuestionIndex = 0;
  } else if (
    typeof this.currentQuestionIndex === "number" &&
    this.currentQuestionIndex > this.totalQuestions - 1 &&
    !FINAL_DECISIONS.includes(this.status)
  ) {
    this.currentQuestionIndex = this.totalQuestions - 1;
  }

  next();
});

module.exports = mongoose.model("AiInterviewSession", aiInterviewSessionSchema);
