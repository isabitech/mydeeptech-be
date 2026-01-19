import mongoose from 'mongoose';

// Assessment Question Schema - Matches the provided JSON structure
const assessmentQuestionSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  section: {
    type: String,
    required: true,
    enum: ['Comprehension', 'Vocabulary', 'Grammar', 'Writing']
  },
  question: {
    type: String,
    required: true
  },
  options: [{
    type: String,
    required: true
  }],
  answer: {
    type: String,
    required: true
  },
  points: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    default: 'system'
  },
  order: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Indexes for efficient querying
assessmentQuestionSchema.index({ section: 1, isActive: 1 });
assessmentQuestionSchema.index({ id: 1 });
assessmentQuestionSchema.index({ order: 1 });

// Static method to get randomized questions per section
assessmentQuestionSchema.statics.getRandomizedQuestions = function (questionsPerSection = 5) {
  const sections = ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'];

  const pipeline = sections.map(section => ({
    $facet: {
      [section]: [
        { $match: { section: section, isActive: true } },
        { $sample: { size: questionsPerSection } },
        {
          $project: {
            id: 1,
            section: 1,
            question: 1,
            options: 1,
            // Don't include the answer in the response
            points: 1,
            _id: 0
          }
        }
      ]
    }
  }));

  return this.aggregate(pipeline);
};

// Static method to get questions by section
assessmentQuestionSchema.statics.getQuestionsBySection = function (section, limit = null) {
  const query = { section: section, isActive: true };
  let mongoQuery = this.find(query).sort({ order: 1, id: 1 });

  if (limit) {
    mongoQuery = mongoQuery.limit(limit);
  }

  return mongoQuery;
};

// Static method to get question count by section
assessmentQuestionSchema.statics.getQuestionCountBySection = function () {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$section',
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        sections: {
          $push: {
            section: '$_id',
            count: '$count'
          }
        },
        totalQuestions: { $sum: '$count' }
      }
    }
  ]);
};

// Instance method to validate answer
assessmentQuestionSchema.methods.validateAnswer = function (userAnswer) {
  // Trim and compare case-insensitively
  const correctAnswer = this.answer.trim().toLowerCase();
  const providedAnswer = userAnswer.trim().toLowerCase();

  return correctAnswer === providedAnswer;
};

// Instance method to get question without answer (for client)
assessmentQuestionSchema.methods.toClientObject = function () {
  return {
    id: this.id,
    section: this.section,
    question: this.question,
    options: this.options,
    points: this.points
  };
};

const AssessmentQuestion = mongoose.model('AssessmentQuestion', assessmentQuestionSchema);
export default AssessmentQuestion;