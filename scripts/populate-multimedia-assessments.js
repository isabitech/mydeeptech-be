const mongoose = require('mongoose');
const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');
const AnnotationProject = require('../models/annotationProject.model');
require('dotenv').config();

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

// Sample multimedia assessment configurations
const sampleMultimediaAssessments = [
  {
    title: 'Video Annotation Assessment',
    description: 'Create engaging conversations from Instagram-style video reels to demonstrate advanced annotation skills.',
    instructions: 'Watch the provided video reels and create natural, engaging conversations that could realistically happen based on the video content. Focus on creating authentic dialogue that matches the video context.',
    requirements: {
      tasksPerAssessment: 5,
      timeLimit: 45, // 45 minutes
      allowPausing: true,
      retakePolicy: {
        allowed: true,
        maxAttempts: 3,
        cooldownPeriod: 24 // hours
      }
    },
    taskSettings: {
      conversationTurns: {
        min: 4,
        max: 8,
        recommended: 6
      },
      videoSegmentLength: {
        min: 5,
        max: 20,
        recommended: 12
      },
      allowVideoAsStartingPoint: true,
      allowPromptAsStartingPoint: false
    },
    scoring: {
      passingScore: 75,
      maxScore: 100,
      criteria: {
        conversationFlow: { weight: 30, description: 'Natural conversation flow and coherence' },
        contextRelevance: { weight: 25, description: 'Relevance to video content' },
        creativity: { weight: 20, description: 'Creative and engaging dialogue' },
        grammarAndStyle: { weight: 15, description: 'Proper grammar and writing style' },
        timeManagement: { weight: 10, description: 'Completion within time limits' }
      }
    },
    videoReels: {
      totalReels: 25,
      reelsPerNiche: {
        'lifestyle': 8,
        'food': 7,
        'technology': 5,
        'travel': 5
      },
      selectionCriteria: {
        minDuration: 10, // seconds
        maxDuration: 30, // seconds
        qualityStandard: 'HD',
        contentRating: 'family-friendly'
      }
    },
    isActive: true,
    createdBy: 'system',
    maxAttempts: 3,
    cooldownHours: 24,
    projectName: 'Social Media Content Creation',
    validCategory: 'Video Annotation' // Use valid enum value
  },
  {
    title: 'E-commerce Product Review Assessment',
    description: 'Analyze product demonstration videos and create compelling review conversations for e-commerce platforms.',
    instructions: 'Watch product demonstration videos and create realistic customer review conversations. Focus on highlighting product features, benefits, and potential concerns that real customers might discuss.',
    requirements: {
      tasksPerAssessment: 4,
      timeLimit: 35, // 35 minutes
      allowPausing: true,
      retakePolicy: {
        allowed: true,
        maxAttempts: 2,
        cooldownPeriod: 48 // hours
      }
    },
    taskSettings: {
      conversationTurns: {
        min: 3,
        max: 6,
        recommended: 4
      },
      videoSegmentLength: {
        min: 8,
        max: 25,
        recommended: 15
      },
      allowVideoAsStartingPoint: true,
      allowPromptAsStartingPoint: true
    },
    scoring: {
      passingScore: 70,
      maxScore: 100,
      criteria: {
        productUnderstanding: { weight: 35, description: 'Accurate understanding of product features' },
        customerPerspective: { weight: 25, description: 'Realistic customer viewpoint and concerns' },
        conversationRealism: { weight: 20, description: 'Natural and believable dialogue' },
        persuasiveness: { weight: 12, description: 'Effective communication of product benefits' },
        technicalAccuracy: { weight: 8, description: 'Accurate technical information' }
      }
    },
    videoReels: {
      totalReels: 20,
      reelsPerNiche: {
        'electronics': 6,
        'fashion': 5,
        'home-goods': 4,
        'beauty': 3,
        'sports': 2
      },
      selectionCriteria: {
        minDuration: 15, // seconds
        maxDuration: 45, // seconds
        qualityStandard: 'HD',
        contentRating: 'product-focused'
      }
    },
    isActive: true,
    createdBy: 'system',
    maxAttempts: 2,
    cooldownHours: 48,
    projectName: 'E-commerce Review Generation',
    validCategory: 'Content Moderation' // Use valid enum value
  },
  {
    title: 'Educational Content Assessment',
    description: 'Transform educational video content into interactive learning conversations suitable for tutoring platforms.',
    instructions: 'Watch educational videos and create engaging tutor-student conversations that explain concepts clearly. Focus on breaking down complex topics into understandable dialogue exchanges.',
    requirements: {
      tasksPerAssessment: 3,
      timeLimit: 30, // 30 minutes
      allowPausing: true,
      retakePolicy: {
        allowed: true,
        maxAttempts: 3,
        cooldownPeriod: 12 // hours
      }
    },
    taskSettings: {
      conversationTurns: {
        min: 4,
        max: 10,
        recommended: 7
      },
      videoSegmentLength: {
        min: 10,
        max: 40,
        recommended: 20
      },
      allowVideoAsStartingPoint: true,
      allowPromptAsStartingPoint: true
    },
    scoring: {
      passingScore: 80,
      maxScore: 100,
      criteria: {
        conceptClarity: { weight: 30, description: 'Clear explanation of concepts' },
        pedagogicalApproach: { weight: 25, description: 'Effective teaching methodology in dialogue' },
        studentEngagement: { weight: 20, description: 'Engaging and interactive conversation' },
        accuracyAndDepth: { weight: 15, description: 'Factual accuracy and appropriate depth' },
        communicationStyle: { weight: 10, description: 'Appropriate communication for target audience' }
      }
    },
    videoReels: {
      totalReels: 18,
      reelsPerNiche: {
        'mathematics': 5,
        'science': 5,
        'language': 4,
        'history': 2,
        'programming': 2
      },
      selectionCriteria: {
        minDuration: 20, // seconds
        maxDuration: 60, // seconds
        qualityStandard: 'HD',
        contentRating: 'educational'
      }
    },
    isActive: true,
    createdBy: 'system',
    maxAttempts: 3,
    cooldownHours: 12,
    projectName: 'Educational Content Creation',
    validCategory: 'Video Annotation' // Use valid enum value
  }
];

async function createSampleProject(projectData) {
  try {
    // Check if project already exists
    const existingProject = await AnnotationProject.findOne({ 
      projectName: projectData.projectName 
    });
    
    if (existingProject) {
      console.log(`📋 Project "${projectData.projectName}" already exists`);
      return existingProject;
    }

    // Get the first DTUser to use as creator (or create a system user reference)
    const DTUser = require('../models/dtUser.model');
    let systemUser = await DTUser.findOne({ email: { $exists: true } }).select('_id');
    
    if (!systemUser) {
      console.log('⚠️  No DTUsers found. Cannot create project without a valid creator.');
      return null;
    }

    // Create new project with proper required fields
    const project = new AnnotationProject({
      projectName: projectData.projectName,
      projectDescription: `Sample project for ${projectData.projectName} assessments`,
      projectCategory: projectData.validCategory, // Use the valid enum category
      payRate: 15.0, // Default pay rate
      payRateCurrency: 'USD',
      payRateType: 'per_task',
      status: 'active',
      isPublic: true,
      createdBy: systemUser._id, // Use actual DTUser ObjectId
      projectGuidelineLink: 'https://example.com/guidelines', // Required field
      guidelines: `Guidelines for ${projectData.projectName} assessment`,
      applicationDeadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      estimatedDuration: '30 days',
      difficultyLevel: 'intermediate',
      maxAnnotators: 50
    });

    await project.save();
    console.log(`✅ Created project: ${projectData.projectName}`);
    return project;
  } catch (error) {
    console.error(`❌ Error creating project ${projectData.projectName}:`, error.message);
    return null;
  }
}

async function populateMultimediaAssessments() {
  try {
    console.log('🔍 Checking existing multimedia assessments...');
    
    const existingCount = await MultimediaAssessmentConfig.countDocuments({});
    console.log(`📊 Found ${existingCount} existing multimedia assessment configurations`);
    
    if (existingCount >= 3) {
      console.log('✅ Already have sufficient multimedia assessments. Skipping population.');
      return;
    }

    console.log('🏗️  Creating sample multimedia assessment configurations...');

    const createdAssessments = [];

    for (const assessmentData of sampleMultimediaAssessments) {
      try {
        // Check if this assessment already exists
        const existingAssessment = await MultimediaAssessmentConfig.findOne({
          title: assessmentData.title
        });

        if (existingAssessment) {
          console.log(`📋 Assessment "${assessmentData.title}" already exists`);
          createdAssessments.push(existingAssessment);
          continue;
        }

        // Create or find the associated project
        const project = await createSampleProject({
          projectName: assessmentData.projectName,
          validCategory: assessmentData.validCategory
        });

        if (!project) {
          console.log(`⚠️  Skipping assessment "${assessmentData.title}" - could not create/find project`);
          continue;
        }

        // Create the multimedia assessment configuration (exclude fields that don't belong)
        const { projectName, validCategory, ...assessmentFields } = assessmentData;
        
        // Get the system user for createdBy field
        const DTUser = require('../models/dtUser.model');
        let systemUser = await DTUser.findOne({ email: { $exists: true } }).select('_id');
        
        if (!systemUser) {
          console.log(`⚠️  No DTUsers found. Cannot create assessment "${assessmentData.title}"`);
          continue;
        }
        
        const assessmentConfig = new MultimediaAssessmentConfig({
          ...assessmentFields,
          projectId: project._id,
          createdBy: systemUser._id
        });

        await assessmentConfig.save();
        console.log(`✅ Created multimedia assessment: ${assessmentData.title}`);
        createdAssessments.push(assessmentConfig);

      } catch (assessmentError) {
        console.error(`❌ Error creating assessment "${assessmentData.title}":`, assessmentError.message);
      }
    }

    console.log('\n🎉 Multimedia Assessment Population Complete!');
    console.log('════════════════════════════════════════════');
    console.log(`📊 Total Assessments Created: ${createdAssessments.length}`);
    console.log(`🎯 Assessment Types:`);
    createdAssessments.forEach((assessment, index) => {
      console.log(`   ${index + 1}. ${assessment.title}`);
      console.log(`      - Passing Score: ${assessment.scoring.passingScore}%`);
      console.log(`      - Time Limit: ${assessment.requirements.timeLimit} minutes`);
      console.log(`      - Tasks: ${assessment.requirements.tasksPerAssessment}`);
      console.log(`      - Active: ${assessment.isActive ? '✅' : '❌'}`);
    });
    console.log('════════════════════════════════════════════');
    
    console.log('\n🔗 Now test your admin overview:');
    console.log('📊 GET /api/assessments/admin/overview');
    console.log('📊 GET /api/admin/assessments/overview');
    console.log('\n✨ Your admin dashboard should now show all assessment types!');
    
  } catch (error) {
    console.error('❌ Error populating multimedia assessments:', error);
  }
}

async function main() {
  await connectDB();
  await populateMultimediaAssessments();
  
  console.log('\n🏁 Script completed. Closing database connection...');
  await mongoose.connection.close();
  console.log('✅ Database connection closed.');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { populateMultimediaAssessments };