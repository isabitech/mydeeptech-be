import mongoose from 'mongoose';

const multimediaAssessmentConfigSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  instructions: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['video', 'audio', 'image', 'text', 'mixed'],
    default: 'mixed'
  },
  category: {
    type: String,
    required: true
  },
  numberOfTasks: {
    type: Number,
    required: true,
    min: 1
  },
  estimatedDuration: {
    type: Number, // in minutes
    required: true
  },
  passingScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  maxRetries: {
    type: Number,
    default: 2
  },
  isActive: {
    type: Boolean,
    default: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnnotationProject',
    default: null
  },
  tasks: [{
    type: {
      type: String,
      enum: ['video', 'audio', 'image', 'text'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    options: [String],
    correctAnswer: mongoose.Schema.Types.Mixed,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],
  videoReels: {
    reelsPerNiche: {
      lifestyle: { type: Number, default: 0 },
      fashion: { type: Number, default: 0 },
      food: { type: Number, default: 0 },
      travel: { type: Number, default: 0 },
      fitness: { type: Number, default: 0 },
      beauty: { type: Number, default: 0 },
      comedy: { type: Number, default: 0 },
      education: { type: Number, default: 0 },
      technology: { type: Number, default: 0 },
      music: { type: Number, default: 0 },
      dance: { type: Number, default: 0 },
      art: { type: Number, default: 0 },
      pets: { type: Number, default: 0 },
      nature: { type: Number, default: 0 },
      business: { type: Number, default: 0 },
      motivation: { type: Number, default: 0 },
      diy: { type: Number, default: 0 },
      gaming: { type: Number, default: 0 },
      sports: { type: Number, default: 0 },
      other: { type: Number, default: 0 }
    }
  },
  scoring: {
    scoreWeights: {
      conversationQuality: { type: Number, default: 20 },
      videoSegmentation: { type: Number, default: 20 },
      promptRelevance: { type: Number, default: 20 },
      creativityAndCoherence: { type: Number, default: 20 },
      technicalExecution: { type: Number, default: 20 }
    }
  },
  statistics: {
    totalAttempts: { type: Number, default: 0 },
    totalCompletions: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    averageTimeSpent: { type: Number, default: 0 },
    passRate: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

multimediaAssessmentConfigSchema.index({ projectId: 1 });
multimediaAssessmentConfigSchema.index({ isActive: 1 });

const MultimediaAssessmentConfig = mongoose.model('MultimediaAssessmentConfig', multimediaAssessmentConfigSchema);
export default MultimediaAssessmentConfig;