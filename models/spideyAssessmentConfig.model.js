import mongoose from 'mongoose';

// Spidey Assessment Configuration - extends existing assessment infrastructure
// This plugs into the existing assessment framework as required
const spideyAssessmentConfigSchema = new mongoose.Schema({
  // Integration with existing project system (mandatory)
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnnotationProject',
    required: true
  },

  // Assessment metadata
  title: {
    type: String,
    default: 'Spidey High-Discipline Assessment',
    required: true
  },
  description: {
    type: String,
    default: 'High-discipline, multi-stage assessment for Prompt Instantiation Project',
    required: true
  },

  // Assessment type integration (uses existing enum)
  assessmentType: {
    type: String,
    enum: ['annotator_qualification', 'skill_assessment', 'project_specific', 'spidey_assessment'],
    default: 'spidey_assessment',
    required: true
  },

  // 4-Stage configuration (state machine architecture)
  stages: {
    stage1: {
      name: { type: String, default: 'Guideline Comprehension' },
      enabled: { type: Boolean, default: true },
      timeLimit: { type: Number, default: 30 }, // minutes
      passingScore: { type: Number, default: 80 }, // hard requirement
      questions: [{
        questionId: String,
        questionText: String,
        questionType: {
          type: String,
          enum: ['multiple_choice', 'true_false', 'text_input'],
          default: 'multiple_choice'
        },
        options: [{
          optionId: String,
          optionText: String,
          isCorrect: Boolean
        }],
        correctAnswer: mongoose.Schema.Types.Mixed,
        isCritical: { type: Boolean, default: false }, // Auto-fail if wrong
        points: { type: Number, default: 1 }
      }]
    },

    stage2: {
      name: { type: String, default: 'Mini Task Validation' },
      enabled: { type: Boolean, default: true },
      timeLimit: { type: Number, default: 45 }, // minutes
      validation: {
        requiresFileReference: { type: Boolean, default: true },
        forbiddenKeywords: [String], // e.g., ['summarize']
        requiredElements: [String], // e.g., ['domain', 'failure_explanation']
        minResponseLength: { type: Number, default: 100 }
      }
    },

    stage3: {
      name: { type: String, default: 'Golden Solution & Rubric' },
      enabled: { type: Boolean, default: true },
      timeLimit: { type: Number, default: 60 }, // minutes
      fileValidation: {
        allowedTypes: [String], // whitelist only
        maxFileSize: { type: Number, default: 10485760 }, // 10MB in bytes
        minContentLength: { type: Number, default: 500 },
        virusScanRequired: { type: Boolean, default: true }
      },
      rubricRequirements: {
        positiveRubricRequired: { type: Boolean, default: true },
        negativeRubricRequired: { type: Boolean, default: true },
        rubricMinLength: { type: Number, default: 200 }
      }
    },

    stage4: {
      name: { type: String, default: 'Integrity Trap' },
      enabled: { type: Boolean, default: true },
      timeLimit: { type: Number, default: 30 }, // minutes
      trapValidation: {
        blindComplianceCheck: { type: Boolean, default: true },
        flaggingRequired: { type: Boolean, default: true }
      }
    }
  },

  // Hard rules configuration (zero tolerance)
  hardRules: {
    forbiddenFiles: [String], // Any presence = immediate fail
    hallucinationDetection: { type: Boolean, default: true },
    ruleViolationPolicy: {
      type: String,
      enum: ['immediate_fail', 'warning', 'deduction'],
      default: 'immediate_fail'
    }
  },

  // Scoring system (only after hard rules pass)
  scoring: {
    totalPoints: { type: Number, default: 100 },
    passingScore: { type: Number, default: 85 }, // Higher threshold
    weights: {
      stage1: { type: Number, default: 0.2 },
      stage2: { type: Number, default: 0.3 },
      stage3: { type: Number, default: 0.3 },
      stage4: { type: Number, default: 0.2 }
    },
    autoApprovalThreshold: { type: Number, default: 95 } // Rare auto-approval
  },

  // Security and audit settings
  security: {
    immutableSubmissions: { type: Boolean, default: true },
    auditTrail: { type: Boolean, default: true },
    sessionTracking: { type: Boolean, default: true }
  },

  // Integration with existing QA system
  qaRequirements: {
    qaRequired: { type: Boolean, default: true },
    reviewerCount: { type: Number, default: 2 }, // Double review
    consensusRequired: { type: Boolean, default: true }
  },

  // Retake policy (stricter than standard assessments)
  retakePolicy: {
    allowed: { type: Boolean, default: false }, // Default no retakes
    cooldownDays: { type: Number, default: 30 },
    maxAttempts: { type: Number, default: 1 }
  },

  // Status tracking
  isActive: { type: Boolean, default: false }, // Feature flag
  version: { type: String, default: '1.0.0' },

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DTUser',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DTUser'
  }
}, {
  timestamps: true,
  collection: 'spideyassessmentconfigs'
});

// Indexes for performance and querying
spideyAssessmentConfigSchema.index({ projectId: 1, isActive: 1 });
spideyAssessmentConfigSchema.index({ assessmentType: 1 });
spideyAssessmentConfigSchema.index({ 'stages.stage1.enabled': 1 });

// Method to validate stage progression
spideyAssessmentConfigSchema.methods.validateStageTransition = function (fromStage, toStage) {
  const validTransitions = {
    null: 'stage1',
    'stage1': 'stage2',
    'stage2': 'stage3',
    'stage3': 'stage4',
    'stage4': 'completed'
  };

  return validTransitions[fromStage] === toStage;
};

// Method to get stage configuration
spideyAssessmentConfigSchema.methods.getStageConfig = function (stageNumber) {
  return this.stages[`stage${stageNumber}`];
};

// Static method to find active Spidey assessments
spideyAssessmentConfigSchema.statics.findActiveSpideyAssessments = function () {
  return this.find({
    isActive: true,
    assessmentType: 'spidey_assessment'
  }).populate('projectId');
};

const SpideyAssessmentConfig = mongoose.model('SpideyAssessmentConfig', spideyAssessmentConfigSchema);

export default SpideyAssessmentConfig;