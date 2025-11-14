const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './.env' });

// Assessment Question Model
const assessmentQuestionSchema = new mongoose.Schema({
  questionId: { type: String, required: true, unique: true },
  questionText: { type: String, required: true },
  questionType: {
    type: String,
    enum: ['multiple_choice', 'true_false', 'text_input', 'image_annotation'],
    required: true
  },
  category: {
    type: String,
    default: 'general',
    enum: ['general', 'data_annotation', 'image_labeling', 'text_processing', 'quality_control']
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'intermediate'
  },
  options: [{
    optionId: String,
    optionText: String,
    isCorrect: { type: Boolean, default: false }
  }],
  correctAnswer: { type: mongoose.Schema.Types.Mixed, required: true },
  explanation: { type: String, default: '' },
  points: { type: Number, default: 1 },
  tags: [String],
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, default: 'system' },
  order: { type: Number, default: 0 } // For question ordering
}, { timestamps: true });

const AssessmentQuestion = mongoose.model('AssessmentQuestion', assessmentQuestionSchema);

// Sample Questions Database
const sampleQuestions = [
  // Data Annotation Fundamentals
  {
    questionId: 'DA001',
    questionText: 'What is the primary purpose of data annotation in machine learning?',
    questionType: 'multiple_choice',
    category: 'data_annotation',
    difficulty: 'beginner',
    options: [
      { optionId: 'a', optionText: 'To prepare training data by adding labels', isCorrect: true },
      { optionId: 'b', optionText: 'To delete unnecessary data points', isCorrect: false },
      { optionId: 'c', optionText: 'To compress data files', isCorrect: false },
      { optionId: 'd', optionText: 'To encrypt sensitive information', isCorrect: false }
    ],
    correctAnswer: 'a',
    explanation: 'Data annotation involves adding labels to raw data to create training datasets for machine learning models.',
    points: 1,
    tags: ['fundamentals', 'machine_learning', 'labeling'],
    order: 1
  },
  {
    questionId: 'DA002',
    questionText: 'Consistency in annotation is crucial for model accuracy.',
    questionType: 'true_false',
    category: 'quality_control',
    difficulty: 'beginner',
    correctAnswer: true,
    explanation: 'Consistent annotations ensure that machine learning models learn the correct patterns and relationships.',
    points: 1,
    tags: ['consistency', 'quality', 'accuracy'],
    order: 2
  },
  {
    questionId: 'DA003',
    questionText: 'What does "IAA" stand for in annotation quality assessment?',
    questionType: 'multiple_choice',
    category: 'quality_control',
    difficulty: 'intermediate',
    options: [
      { optionId: 'a', optionText: 'Internal Annotation Assessment', isCorrect: false },
      { optionId: 'b', optionText: 'Inter-Annotator Agreement', isCorrect: true },
      { optionId: 'c', optionText: 'Intelligent Annotation Algorithm', isCorrect: false },
      { optionId: 'd', optionText: 'Individual Annotation Accuracy', isCorrect: false }
    ],
    correctAnswer: 'b',
    explanation: 'Inter-Annotator Agreement measures how much different annotators agree on the same data.',
    points: 1,
    tags: ['quality_control', 'metrics', 'agreement'],
    order: 3
  },
  {
    questionId: 'DA004',
    questionText: 'Which file format is commonly used for image annotation bounding boxes?',
    questionType: 'multiple_choice',
    category: 'image_labeling',
    difficulty: 'intermediate',
    options: [
      { optionId: 'a', optionText: 'XML (Pascal VOC format)', isCorrect: true },
      { optionId: 'b', optionText: 'PDF', isCorrect: false },
      { optionId: 'c', optionText: 'DOC', isCorrect: false },
      { optionId: 'd', optionText: 'ZIP', isCorrect: false }
    ],
    correctAnswer: 'a',
    explanation: 'Pascal VOC XML format is a standard for storing bounding box annotations.',
    points: 1,
    tags: ['image_annotation', 'formats', 'bounding_boxes'],
    order: 4
  },
  {
    questionId: 'DA005',
    questionText: 'What is the minimum acceptable accuracy threshold for most annotation projects?',
    questionType: 'multiple_choice',
    category: 'quality_control',
    difficulty: 'intermediate',
    options: [
      { optionId: 'a', optionText: '50%', isCorrect: false },
      { optionId: 'b', optionText: '70%', isCorrect: false },
      { optionId: 'c', optionText: '85%', isCorrect: true },
      { optionId: 'd', optionText: '100%', isCorrect: false }
    ],
    correctAnswer: 'c',
    explanation: 'Most annotation projects require at least 85% accuracy to ensure quality training data.',
    points: 1,
    tags: ['quality_control', 'accuracy', 'thresholds'],
    order: 5
  },
  {
    questionId: 'DA006',
    questionText: 'What should you do if you encounter ambiguous or unclear data during annotation?',
    questionType: 'multiple_choice',
    category: 'general',
    difficulty: 'beginner',
    options: [
      { optionId: 'a', optionText: 'Skip the data point', isCorrect: false },
      { optionId: 'b', optionText: 'Guess the correct label', isCorrect: false },
      { optionId: 'c', optionText: 'Flag it for review and ask for clarification', isCorrect: true },
      { optionId: 'd', optionText: 'Delete the data point', isCorrect: false }
    ],
    correctAnswer: 'c',
    explanation: 'Always flag unclear data for review to maintain annotation quality and consistency.',
    points: 1,
    tags: ['best_practices', 'quality', 'clarification'],
    order: 6
  },
  {
    questionId: 'DA007',
    questionText: 'Bias in training data can negatively impact machine learning model performance.',
    questionType: 'true_false',
    category: 'general',
    difficulty: 'intermediate',
    correctAnswer: true,
    explanation: 'Biased training data leads to biased models that may not perform well on diverse real-world data.',
    points: 1,
    tags: ['bias', 'fairness', 'model_performance'],
    order: 7
  },
  {
    questionId: 'DA008',
    questionText: 'What is "active learning" in the context of data annotation?',
    questionType: 'multiple_choice',
    category: 'general',
    difficulty: 'advanced',
    options: [
      { optionId: 'a', optionText: 'Annotating data very quickly', isCorrect: false },
      { optionId: 'b', optionText: 'Letting models select which data to annotate next', isCorrect: true },
      { optionId: 'c', optionText: 'Annotating while standing up', isCorrect: false },
      { optionId: 'd', optionText: 'Group annotation sessions', isCorrect: false }
    ],
    correctAnswer: 'b',
    explanation: 'Active learning uses model uncertainty to prioritize which data points need annotation most.',
    points: 1,
    tags: ['active_learning', 'efficiency', 'machine_learning'],
    order: 8
  },
  {
    questionId: 'DA009',
    questionText: 'What does NER stand for in text annotation?',
    questionType: 'text_input',
    category: 'text_processing',
    difficulty: 'intermediate',
    correctAnswer: 'Named Entity Recognition',
    explanation: 'Named Entity Recognition involves identifying and classifying named entities in text.',
    points: 1,
    tags: ['text_annotation', 'ner', 'entities'],
    order: 9
  },
  {
    questionId: 'DA010',
    questionText: 'Which of these is NOT a common type of image annotation?',
    questionType: 'multiple_choice',
    category: 'image_labeling',
    difficulty: 'intermediate',
    options: [
      { optionId: 'a', optionText: 'Bounding boxes', isCorrect: false },
      { optionId: 'b', optionText: 'Semantic segmentation', isCorrect: false },
      { optionId: 'c', optionText: 'Audio transcription', isCorrect: true },
      { optionId: 'd', optionText: 'Keypoint detection', isCorrect: false }
    ],
    correctAnswer: 'c',
    explanation: 'Audio transcription is related to audio data, not image annotation.',
    points: 1,
    tags: ['image_annotation', 'types', 'classification'],
    order: 10
  },
  {
    questionId: 'DA011',
    questionText: 'What is the recommended break frequency during long annotation sessions?',
    questionType: 'multiple_choice',
    category: 'general',
    difficulty: 'beginner',
    options: [
      { optionId: 'a', optionText: 'Every 15 minutes', isCorrect: false },
      { optionId: 'b', optionText: 'Every hour', isCorrect: true },
      { optionId: 'c', optionText: 'Every 4 hours', isCorrect: false },
      { optionId: 'd', optionText: 'No breaks needed', isCorrect: false }
    ],
    correctAnswer: 'b',
    explanation: 'Taking breaks every hour helps maintain focus and annotation quality.',
    points: 1,
    tags: ['best_practices', 'productivity', 'quality'],
    order: 11
  },
  {
    questionId: 'DA012',
    questionText: 'Double-checking your work before submission is always recommended.',
    questionType: 'true_false',
    category: 'quality_control',
    difficulty: 'beginner',
    correctAnswer: true,
    explanation: 'Quality control through self-review significantly improves annotation accuracy.',
    points: 1,
    tags: ['quality_control', 'review', 'accuracy'],
    order: 12
  }
];

// Seeder Functions
const seedQuestions = async () => {
  try {
    console.log('🌱 Starting assessment questions seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing questions (optional - remove this line if you want to keep existing)
    await AssessmentQuestion.deleteMany({});
    console.log('🗑️  Cleared existing questions');

    // Insert sample questions
    const result = await AssessmentQuestion.insertMany(sampleQuestions);
    console.log(`✅ Successfully seeded ${result.length} assessment questions`);

    // Display summary
    const stats = await AssessmentQuestion.aggregate([
      {
        $group: {
          _id: '$difficulty',
          count: { $sum: 1 }
        }
      }
    ]);
    
    console.log('\n📊 Questions by difficulty:');
    stats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} questions`);
    });

    const categories = await AssessmentQuestion.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n📁 Questions by category:');
    categories.forEach(cat => {
      console.log(`   ${cat._id}: ${cat.count} questions`);
    });

    console.log('\n🎉 Seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding questions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Function to add individual questions
const addQuestion = async (questionData) => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const question = new AssessmentQuestion(questionData);
    await question.save();
    
    console.log(`✅ Added question: ${questionData.questionId}`);
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error adding question:', error);
    await mongoose.disconnect();
  }
};

// Function to list all questions
const listQuestions = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const questions = await AssessmentQuestion.find({})
      .select('questionId questionText difficulty category isActive')
      .sort({ order: 1 });
    
    console.log(`\n📋 Found ${questions.length} questions:\n`);
    questions.forEach((q, index) => {
      console.log(`${index + 1}. [${q.questionId}] ${q.questionText.substring(0, 60)}...`);
      console.log(`   Category: ${q.category} | Difficulty: ${q.difficulty} | Active: ${q.isActive}\n`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error listing questions:', error);
    await mongoose.disconnect();
  }
};

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'seed':
    seedQuestions();
    break;
  case 'list':
    listQuestions();
    break;
  case 'add':
    console.log('Use addQuestion function with your question data');
    break;
  default:
    console.log(`
🚀 Assessment Questions Seeder

Available commands:
  node scripts/seedQuestions.js seed    - Seed all sample questions
  node scripts/seedQuestions.js list    - List all questions in database
  node scripts/seedQuestions.js add     - Add individual question (modify script)

Examples:
  npm run seed-questions
  node scripts/seedQuestions.js seed
  node scripts/seedQuestions.js list
    `);
}

module.exports = { AssessmentQuestion, seedQuestions, addQuestion, listQuestions };