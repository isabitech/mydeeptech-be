#!/usr/bin/env node

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config({ path: './.env' });

// Import the AssessmentQuestion model
const AssessmentQuestion = require('../models/assessmentQuestion.model.js');

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

// Load questions from assessment.json file
const loadQuestionsFromFile = () => {
  try {
    const filePath = path.join(__dirname, '..', 'assessment', 'assessment.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error('assessment.json file not found at: ' + filePath);
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Find all complete JSON arrays using regex
    const arrayMatches = fileContent.match(/\[\s*\{[\s\S]*?\}\s*\]/g);
    
    let allQuestions = [];
    
    if (arrayMatches) {
      arrayMatches.forEach((jsonString, index) => {
        try {
          const questions = JSON.parse(jsonString);
          
          if (Array.isArray(questions)) {
            allQuestions.push(...questions);
            console.log(`📚 Loaded ${questions.length} questions from section ${index + 1} (${questions[0]?.section || 'Unknown'})`);
          }
        } catch (parseError) {
          console.error(`❌ Error parsing JSON section ${index + 1}:`, parseError.message);
          console.error('Section content preview:', jsonString.substring(0, 200) + '...');
        }
      });
    } else {
      // Fallback: try to parse the entire file as one array
      try {
        const questions = JSON.parse(fileContent);
        if (Array.isArray(questions)) {
          allQuestions = questions;
          console.log(`📚 Loaded ${questions.length} questions from single array`);
        }
      } catch (parseError) {
        throw new Error('Unable to parse assessment.json file: ' + parseError.message);
      }
    }

    console.log(`📖 Total questions loaded from file: ${allQuestions.length}`);
    
    // Group by section to verify structure
    const sectionCounts = {};
    allQuestions.forEach(q => {
      sectionCounts[q.section] = (sectionCounts[q.section] || 0) + 1;
    });
    
    console.log('📊 Questions by section:');
    Object.entries(sectionCounts).forEach(([section, count]) => {
      console.log(`  ${section}: ${count} questions`);
    });

    return allQuestions;

  } catch (error) {
    console.error('❌ Error loading questions from file:', error.message);
    throw error;
  }
};

// Seed questions from the JSON file
const seedQuestionsFromFile = async () => {
  try {
    console.log('🌱 Starting seeding process from assessment.json...');

    // Load questions from file
    const questions = loadQuestionsFromFile();
    
    if (!questions || questions.length === 0) {
      throw new Error('No questions found in assessment.json file');
    }

    // Clear existing questions
    const deleteResult = await AssessmentQuestion.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing questions`);

    // Validate question structure
    const validQuestions = questions.filter(q => {
      const isValid = q.id && q.section && q.question && q.options && q.answer;
      if (!isValid) {
        console.warn(`⚠️ Skipping invalid question: ${JSON.stringify(q)}`);
      }
      return isValid;
    });

    console.log(`✅ ${validQuestions.length} valid questions ready for insertion`);

    // Insert questions in batches to handle large datasets
    const batchSize = 50;
    let totalInserted = 0;

    for (let i = 0; i < validQuestions.length; i += batchSize) {
      const batch = validQuestions.slice(i, i + batchSize);
      
      try {
        const result = await AssessmentQuestion.insertMany(batch, { ordered: false });
        totalInserted += result.length;
        console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}: Inserted ${result.length} questions`);
      } catch (batchError) {
        // Handle duplicate key errors gracefully
        if (batchError.code === 11000) {
          console.warn(`⚠️ Some questions in batch ${Math.floor(i/batchSize) + 1} already exist, continuing...`);
        } else {
          throw batchError;
        }
      }
    }

    console.log(`\n🎯 Seeding completed! Total questions inserted: ${totalInserted}`);

    // Verify the insertion with final count by section
    const finalStats = await AssessmentQuestion.aggregate([
      { $group: { _id: '$section', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n📊 Final database statistics:');
    finalStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} questions`);
    });

    const totalCount = await AssessmentQuestion.countDocuments({});
    console.log(`📈 Total questions in database: ${totalCount}`);

  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
    throw error;
  }
};

// List all questions from database
const listAllQuestions = async () => {
  try {
    const questions = await AssessmentQuestion.find({}).sort({ section: 1, id: 1 });
    
    if (questions.length === 0) {
      console.log('📝 No questions found in database');
      return;
    }

    console.log(`\n📋 Found ${questions.length} questions in database:\n`);
    
    let currentSection = '';
    questions.forEach((q, index) => {
      if (q.section !== currentSection) {
        currentSection = q.section;
        console.log(`\n🔸 ${currentSection} Section:`);
        console.log('─'.repeat(50));
      }
      
      console.log(`${index + 1}. [ID: ${q.id}] ${q.question.substring(0, 80)}...`);
      console.log(`   Options: ${q.options.join(' | ')}`);
      console.log(`   Answer: ${q.answer}\n`);
    });

    // Show section summary
    const sectionCounts = await AssessmentQuestion.aggregate([
      { $group: { _id: '$section', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n📊 Summary by section:');
    sectionCounts.forEach(item => {
      console.log(`  ${item._id}: ${item.count} questions`);
    });

  } catch (error) {
    console.error('❌ Error listing questions:', error);
  }
};

// Get random sample questions (for testing the randomization)
const getRandomSample = async () => {
  try {
    console.log('🎲 Testing randomization - getting 5 questions per section...\n');
    
    const sections = ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'];
    
    for (const section of sections) {
      const questions = await AssessmentQuestion.aggregate([
        { $match: { section: section, isActive: true } },
        { $sample: { size: 5 } },
        { $project: { id: 1, question: 1, options: 1, answer: 1, _id: 0 } }
      ]);

      console.log(`🔸 ${section} Sample Questions (${questions.length}/5):`);
      questions.forEach((q, index) => {
        console.log(`${index + 1}. [ID: ${q.id}] ${q.question.substring(0, 60)}...`);
        console.log(`   Options: ${q.options.join(' | ')}`);
        console.log(`   Answer: ${q.answer}\n`);
      });
    }

  } catch (error) {
    console.error('❌ Error getting random sample:', error);
  }
};

// Show statistics about the database
const showStatistics = async () => {
  try {
    const totalQuestions = await AssessmentQuestion.countDocuments({});
    const activeQuestions = await AssessmentQuestion.countDocuments({ isActive: true });
    
    const sectionStats = await AssessmentQuestion.aggregate([
      { $group: { _id: '$section', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const idRanges = await AssessmentQuestion.aggregate([
      {
        $group: {
          _id: '$section',
          minId: { $min: '$id' },
          maxId: { $max: '$id' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n📊 Assessment Question Database Statistics');
    console.log('==========================================');
    console.log(`Total Questions: ${totalQuestions}`);
    console.log(`Active Questions: ${activeQuestions}`);
    console.log(`Inactive Questions: ${totalQuestions - activeQuestions}`);
    
    console.log('\n📈 Questions by Section:');
    sectionStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} questions`);
    });

    console.log('\n🔢 ID Ranges by Section:');
    idRanges.forEach(range => {
      console.log(`  ${range._id}: IDs ${range.minId}-${range.maxId} (${range.count} questions)`);
    });

    // Check for missing IDs in expected ranges
    console.log('\n🔍 Validation Check:');
    const expectedRanges = {
      'Grammar': { min: 1, max: 30 },
      'Vocabulary': { min: 31, max: 60 },
      'Comprehension': { min: 61, max: 90 },
      'Writing': { min: 91, max: 120 }
    };

    for (const [section, expected] of Object.entries(expectedRanges)) {
      const actualRange = idRanges.find(r => r._id === section);
      if (actualRange) {
        const isCorrect = actualRange.minId === expected.min && 
                         actualRange.maxId === expected.max && 
                         actualRange.count === (expected.max - expected.min + 1);
        console.log(`  ${section}: ${isCorrect ? '✅' : '⚠️'} Expected ${expected.min}-${expected.max} (30), Got ${actualRange.minId}-${actualRange.maxId} (${actualRange.count})`);
      } else {
        console.log(`  ${section}: ❌ Section missing from database`);
      }
    }

  } catch (error) {
    console.error('❌ Error getting statistics:', error);
  }
};

// Command line interface
const main = async () => {
  await connectDB();
  
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'seed':
        await seedQuestionsFromFile();
        break;
      case 'list':
        await listAllQuestions();
        break;
      case 'sample':
        await getRandomSample();
        break;
      case 'stats':
        await showStatistics();
        break;
      case 'validate':
        console.log('🔍 Validating assessment.json file structure...');
        const questions = loadQuestionsFromFile();
        console.log(`✅ File validation complete. Found ${questions.length} valid questions.`);
        break;
      default:
        console.log('📖 Assessment Question Seeder (from assessment.json)');
        console.log('Usage:');
        console.log('  node seedFromFile.js seed      - Load questions from assessment.json into database');
        console.log('  node seedFromFile.js list      - List all questions in database');
        console.log('  node seedFromFile.js sample    - Get random sample (5 per section)');
        console.log('  node seedFromFile.js stats     - Show detailed database statistics');
        console.log('  node seedFromFile.js validate  - Validate assessment.json file structure');
        console.log('');
        console.log('📁 Expected file location: assessment/assessment.json');
    }
  } catch (error) {
    console.error('❌ Command failed:', error.message);
  } finally {
    await disconnectDB();
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { 
  loadQuestionsFromFile, 
  seedQuestionsFromFile, 
  listAllQuestions,
  connectDB, 
  disconnectDB 
};