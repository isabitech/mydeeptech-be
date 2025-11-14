#!/usr/bin/env node

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const readline = require('readline');

// Load environment variables
dotenv.config({ path: './.env' });

// Assessment Question Schema (same as in seeder)
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
  order: { type: Number, default: 0 }
}, { timestamps: true });

const AssessmentQuestion = mongoose.model('AssessmentQuestion', assessmentQuestionSchema);

// Create readline interface for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Disconnect from database
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error disconnecting:', error);
  }
};

// Interactive question creator
const createQuestionInteractive = async () => {
  try {
    console.log('\n📝 Creating New Assessment Question');
    console.log('====================================');

    const questionId = await askQuestion('Question ID (e.g., DA013): ');
    const questionText = await askQuestion('Question Text: ');
    
    console.log('\nQuestion Types:');
    console.log('1. multiple_choice');
    console.log('2. true_false');
    console.log('3. text_input');
    console.log('4. image_annotation');
    
    const typeChoice = await askQuestion('Choose question type (1-4): ');
    const questionTypes = ['multiple_choice', 'true_false', 'text_input', 'image_annotation'];
    const questionType = questionTypes[parseInt(typeChoice) - 1];

    if (!questionType) {
      console.log('❌ Invalid question type');
      return;
    }

    console.log('\nCategories:');
    console.log('1. general');
    console.log('2. data_annotation');
    console.log('3. image_labeling');
    console.log('4. text_processing');
    console.log('5. quality_control');
    
    const catChoice = await askQuestion('Choose category (1-5): ');
    const categories = ['general', 'data_annotation', 'image_labeling', 'text_processing', 'quality_control'];
    const category = categories[parseInt(catChoice) - 1] || 'general';

    console.log('\nDifficulty Levels:');
    console.log('1. beginner');
    console.log('2. intermediate');
    console.log('3. advanced');
    
    const diffChoice = await askQuestion('Choose difficulty (1-3): ');
    const difficulties = ['beginner', 'intermediate', 'advanced'];
    const difficulty = difficulties[parseInt(diffChoice) - 1] || 'intermediate';

    let options = [];
    let correctAnswer;

    if (questionType === 'multiple_choice') {
      console.log('\n--- Creating Multiple Choice Options ---');
      const numOptions = parseInt(await askQuestion('Number of options (2-6): ')) || 4;
      
      for (let i = 0; i < numOptions; i++) {
        const optionId = String.fromCharCode(97 + i); // a, b, c, d...
        const optionText = await askQuestion(`Option ${optionId.toUpperCase()}: `);
        const isCorrect = (await askQuestion(`Is option ${optionId.toUpperCase()} correct? (y/n): `)).toLowerCase() === 'y';
        
        options.push({
          optionId,
          optionText,
          isCorrect
        });
        
        if (isCorrect) {
          correctAnswer = optionId;
        }
      }
    } else if (questionType === 'true_false') {
      console.log('\n--- True/False Question ---');
      const answer = await askQuestion('Correct answer (true/false): ');
      correctAnswer = answer.toLowerCase() === 'true';
    } else {
      console.log('\n--- Text Input Question ---');
      correctAnswer = await askQuestion('Correct answer: ');
    }

    const explanation = await askQuestion('Explanation (optional): ');
    const tags = await askQuestion('Tags (comma-separated, optional): ');
    const order = parseInt(await askQuestion('Order/Position (optional, 0 for auto): ')) || 0;

    // Create question object
    const questionData = {
      questionId,
      questionText,
      questionType,
      category,
      difficulty,
      correctAnswer,
      explanation: explanation || '',
      points: 1,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      isActive: true,
      createdBy: 'interactive',
      order
    };

    if (questionType === 'multiple_choice') {
      questionData.options = options;
    }

    // Save to database
    const question = new AssessmentQuestion(questionData);
    await question.save();

    console.log('\n✅ Question created successfully!');
    console.log(`Question ID: ${questionId}`);
    console.log(`Type: ${questionType}`);
    console.log(`Category: ${category}`);
    console.log(`Difficulty: ${difficulty}`);

  } catch (error) {
    if (error.code === 11000) {
      console.log('❌ Question ID already exists. Please use a unique ID.');
    } else {
      console.error('❌ Error creating question:', error.message);
    }
  }
};

// Import questions from JSON file
const importFromJSON = async () => {
  try {
    const filePath = await askQuestion('Enter path to JSON file: ');
    const fs = require('fs');
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ File not found');
      return;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!Array.isArray(data)) {
      console.log('❌ JSON file must contain an array of questions');
      return;
    }

    console.log(`📁 Found ${data.length} questions in file`);
    const confirm = await askQuestion('Import all questions? (y/n): ');
    
    if (confirm.toLowerCase() === 'y') {
      const result = await AssessmentQuestion.insertMany(data);
      console.log(`✅ Imported ${result.length} questions successfully`);
    }

  } catch (error) {
    console.error('❌ Error importing questions:', error.message);
  }
};

// Export questions to JSON file
const exportToJSON = async () => {
  try {
    const questions = await AssessmentQuestion.find({}).sort({ order: 1 });
    const filePath = `questions_export_${new Date().toISOString().slice(0, 10)}.json`;
    
    const fs = require('fs');
    fs.writeFileSync(filePath, JSON.stringify(questions, null, 2));
    
    console.log(`✅ Exported ${questions.length} questions to ${filePath}`);
  } catch (error) {
    console.error('❌ Error exporting questions:', error.message);
  }
};

// Delete question by ID
const deleteQuestion = async () => {
  try {
    const questionId = await askQuestion('Question ID to delete: ');
    const question = await AssessmentQuestion.findOne({ questionId });
    
    if (!question) {
      console.log('❌ Question not found');
      return;
    }

    console.log(`\nFound question: "${question.questionText}"`);
    const confirm = await askQuestion('Are you sure you want to delete this question? (y/n): ');
    
    if (confirm.toLowerCase() === 'y') {
      await AssessmentQuestion.deleteOne({ questionId });
      console.log('✅ Question deleted successfully');
    }
  } catch (error) {
    console.error('❌ Error deleting question:', error.message);
  }
};

// View question details
const viewQuestion = async () => {
  try {
    const questionId = await askQuestion('Question ID to view: ');
    const question = await AssessmentQuestion.findOne({ questionId });
    
    if (!question) {
      console.log('❌ Question not found');
      return;
    }

    console.log('\n📋 Question Details:');
    console.log(`ID: ${question.questionId}`);
    console.log(`Text: ${question.questionText}`);
    console.log(`Type: ${question.questionType}`);
    console.log(`Category: ${question.category}`);
    console.log(`Difficulty: ${question.difficulty}`);
    console.log(`Correct Answer: ${question.correctAnswer}`);
    console.log(`Explanation: ${question.explanation}`);
    console.log(`Active: ${question.isActive}`);
    
    if (question.options && question.options.length > 0) {
      console.log('\nOptions:');
      question.options.forEach(option => {
        const marker = option.isCorrect ? '✓' : ' ';
        console.log(`  ${marker} ${option.optionId}: ${option.optionText}`);
      });
    }
  } catch (error) {
    console.error('❌ Error viewing question:', error.message);
  }
};

// Main menu
const showMenu = async () => {
  console.log('\n🎯 Assessment Question Manager');
  console.log('==============================');
  console.log('1. Create new question (interactive)');
  console.log('2. List all questions');
  console.log('3. View specific question');
  console.log('4. Delete question');
  console.log('5. Import from JSON file');
  console.log('6. Export to JSON file');
  console.log('7. Show statistics');
  console.log('0. Exit');
  
  const choice = await askQuestion('\nChoose an option (0-7): ');
  return choice;
};

// Show statistics
const showStats = async () => {
  try {
    const total = await AssessmentQuestion.countDocuments({});
    const active = await AssessmentQuestion.countDocuments({ isActive: true });
    
    const byDifficulty = await AssessmentQuestion.aggregate([
      { $group: { _id: '$difficulty', count: { $sum: 1 } } }
    ]);
    
    const byCategory = await AssessmentQuestion.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    console.log('\n📊 Question Statistics:');
    console.log(`Total Questions: ${total}`);
    console.log(`Active Questions: ${active}`);
    console.log(`Inactive Questions: ${total - active}`);
    
    console.log('\nBy Difficulty:');
    byDifficulty.forEach(item => {
      console.log(`  ${item._id}: ${item.count}`);
    });
    
    console.log('\nBy Category:');
    byCategory.forEach(item => {
      console.log(`  ${item._id}: ${item.count}`);
    });
    
  } catch (error) {
    console.error('❌ Error getting statistics:', error.message);
  }
};

// List all questions
const listQuestions = async () => {
  try {
    const questions = await AssessmentQuestion.find({})
      .select('questionId questionText difficulty category isActive')
      .sort({ order: 1, createdAt: 1 });
    
    console.log(`\n📋 Found ${questions.length} questions:\n`);
    questions.forEach((q, index) => {
      const status = q.isActive ? '✓' : '✗';
      console.log(`${index + 1}. [${q.questionId}] ${status} ${q.questionText.substring(0, 60)}...`);
      console.log(`   Category: ${q.category} | Difficulty: ${q.difficulty}\n`);
    });
  } catch (error) {
    console.error('❌ Error listing questions:', error.message);
  }
};

// Main application
const main = async () => {
  await connectDB();
  
  console.log('Welcome to Assessment Question Manager! 🎯');
  
  try {
    while (true) {
      const choice = await showMenu();
      
      switch (choice) {
        case '1':
          await createQuestionInteractive();
          break;
        case '2':
          await listQuestions();
          break;
        case '3':
          await viewQuestion();
          break;
        case '4':
          await deleteQuestion();
          break;
        case '5':
          await importFromJSON();
          break;
        case '6':
          await exportToJSON();
          break;
        case '7':
          await showStats();
          break;
        case '0':
          console.log('👋 Goodbye!');
          rl.close();
          await disconnectDB();
          process.exit(0);
          break;
        default:
          console.log('❌ Invalid choice. Please try again.');
      }
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  } finally {
    rl.close();
    await disconnectDB();
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n\n👋 Exiting...');
  rl.close();
  await disconnectDB();
  process.exit(0);
});

// Run the application
if (require.main === module) {
  main();
}

module.exports = { AssessmentQuestion, main };