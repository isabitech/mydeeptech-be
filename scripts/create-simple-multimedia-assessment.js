const mongoose = require('mongoose');
const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');
const AnnotationProject = require('../models/annotationProject.model');
const DTUser = require('../models/dtUser.model');
require('dotenv').config();

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function createSimpleMultimediaAssessment() {
  try {
    // Check if we already have multimedia assessments
    const existingCount = await MultimediaAssessmentConfig.countDocuments({});
    if (existingCount > 0) {
      console.log(`✅ Already have ${existingCount} multimedia assessments`);
      return;
    }

    // Get a DTUser for createdBy
    const user = await DTUser.findOne({}).select('_id');
    if (!user) {
      console.log('❌ No DTUsers found. Cannot create multimedia assessment.');
      return;
    }

    // Get or create a project
    let project = await AnnotationProject.findOne({});
    
    if (!project) {
      console.log('📋 Creating a sample project...');
      project = new AnnotationProject({
        projectName: 'Sample Video Annotation Project',
        projectDescription: 'Sample project for multimedia assessments',
        projectCategory: 'Video Annotation',
        payRate: 10.0,
        payRateCurrency: 'USD',
        payRateType: 'per_task',
        status: 'active',
        createdBy: user._id,
        projectGuidelineLink: 'https://example.com/guidelines',
        estimatedDuration: '30 days',
        difficultyLevel: 'intermediate'
      });
      await project.save();
      console.log('✅ Sample project created');
    }

    // Create a simple multimedia assessment config
    console.log('📋 Creating multimedia assessment configuration...');
    
    const assessmentConfig = new MultimediaAssessmentConfig({
      title: 'Video Annotation Assessment',
      description: 'Create engaging conversations from video reels to demonstrate annotation skills.',
      instructions: 'Watch the provided video reels and create natural conversations based on the content.',
      projectId: project._id,
      
      requirements: {
        tasksPerAssessment: 5,
        timeLimit: 45,
        allowPausing: true,
        retakePolicy: {
          allowed: true,
          maxAttempts: 3,
          cooldownPeriod: 24
        }
      },
      
      taskSettings: {
        conversationTurns: {
          min: 3,
          max: 8,
          recommended: 5
        },
        videoSegmentLength: {
          min: 5,
          max: 30,
          recommended: 15
        },
        allowVideoAsStartingPoint: true,
        allowPromptAsStartingPoint: false
      },
      
      scoring: {
        passingScore: 75,
        maxScore: 100,
        criteria: {
          conversationFlow: { weight: 30, description: 'Natural conversation flow' },
          contextRelevance: { weight: 25, description: 'Relevance to video content' },
          creativity: { weight: 20, description: 'Creative dialogue' },
          grammarAndStyle: { weight: 15, description: 'Grammar and style' },
          timeManagement: { weight: 10, description: 'Time management' }
        }
      },
      
      videoReels: {
        totalReels: 20,
        reelsPerNiche: {
          'lifestyle': 8,
          'food': 6,
          'technology': 6
        },
        selectionCriteria: {
          minDuration: 10,
          maxDuration: 30,
          qualityStandard: 'HD',
          contentRating: 'family-friendly'
        }
      },
      
      isActive: true,
      createdBy: user._id,
      maxAttempts: 3,
      cooldownHours: 24
    });

    await assessmentConfig.save();
    console.log('✅ Multimedia assessment created successfully!');
    
    console.log('\n📊 Assessment Details:');
    console.log(`   ID: ${assessmentConfig._id}`);
    console.log(`   Title: ${assessmentConfig.title}`);
    console.log(`   Passing Score: ${assessmentConfig.scoring.passingScore}%`);
    console.log(`   Time Limit: ${assessmentConfig.requirements.timeLimit} minutes`);
    console.log(`   Active: ${assessmentConfig.isActive}`);
    
  } catch (error) {
    console.error('❌ Error creating multimedia assessment:', error);
  }
}

async function main() {
  await connectDB();
  await createSimpleMultimediaAssessment();
  
  console.log('\n🏁 Simple setup complete. Closing database connection...');
  await mongoose.connection.close();
  console.log('✅ Database connection closed.');
}

if (require.main === module) {
  main().catch(console.error);
}