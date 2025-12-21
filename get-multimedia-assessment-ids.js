/**
 * Script to get available multimedia assessment IDs
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function getMultimediaAssessmentIds() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    const MultimediaAssessmentConfig = require('./models/multimediaAssessmentConfig.model');
    
    const assessments = await MultimediaAssessmentConfig.find({ isActive: true })
      .select('_id title description createdAt')
      .sort({ createdAt: -1 });

    console.log('\n=== Available Multimedia Assessment IDs ===');
    
    if (assessments.length === 0) {
      console.log('❌ No active multimedia assessments found');
    } else {
      assessments.forEach((assessment, index) => {
        console.log(`\n${index + 1}. Assessment ID: ${assessment._id}`);
        console.log(`   Title: ${assessment.title}`);
        console.log(`   Description: ${assessment.description}`);
        console.log(`   Created: ${assessment.createdAt}`);
        console.log(`   Usage: POST /api/assessments/start/${assessment._id}`);
      });
    }

  } catch (error) {
    console.error('Error fetching multimedia assessments:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

getMultimediaAssessmentIds();