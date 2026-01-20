const mongoose = require('mongoose');
const SpideyAssessmentConfig = require('../models/spideyAssessmentConfig.model');
const AnnotationProject = require('../models/annotationProject.model');
const DTUser = require('../models/dtUser.model');
require('dotenv').config();

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Disconnect from database
async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error disconnecting:', error);
  }
}

// Load the Spidey Assessment configuration from JSON
function loadSpideyAssessmentData() {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const filePath = path.join(__dirname, '..', 'assessment', 'spidey-assessment', 'spidey-assessment.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Assessment file not found: ${filePath}`);
    }
    
    const rawData = fs.readFileSync(filePath, 'utf8');
    const assessmentData = JSON.parse(rawData);
    
    console.log(`📋 Loaded assessment: ${assessmentData.title}`);
    console.log(`🎯 Assessment ID: ${assessmentData.assessmentId}`);
    console.log(`📊 Stages: ${assessmentData.stages.length}`);
    
    return assessmentData;
    
  } catch (error) {
    console.error('❌ Error loading assessment data:', error);
    throw error;
  }
}

// Transform JSON data to match SpideyAssessmentConfig model structure
function transformToConfigFormat(jsonData) {
  return {
    title: jsonData.title,
    description: jsonData.description,
    assessmentType: 'spidey_assessment',
    
    // 4-Stage configuration mapped from JSON
    stages: {
      stage1: {
        name: jsonData.stages[0].title,
        enabled: true,
        timeLimit: jsonData.stages[0].timeLimitMinutes,
        passingScore: Math.round(jsonData.stages[0].passThreshold * 100),
        questions: jsonData.stages[0].questions.map(q => ({
          questionId: q.questionId,
          questionText: q.prompt,
          questionType: q.type,
          options: q.options ? q.options.map((opt, idx) => ({
            optionId: String.fromCharCode(65 + idx),
            optionText: opt,
            isCorrect: opt === q.correctAnswer
          })) : [],
          correctAnswer: q.correctAnswer || null,
          isRequired: q.isCritical || false,
          points: q.isCritical ? 10 : 5
        }))
      },
      
      stage2: {
        name: jsonData.stages[1].title,
        enabled: true,
        timeLimit: jsonData.stages[1].timeLimitMinutes,
        passingScore: 80,
        submissionType: 'structured_form',
        requiredFields: jsonData.stages[1].requiredFields.map(field => ({
          fieldName: field.fieldId,
          fieldType: field.type,
          isRequired: true,
          minLength: field.minLength || 0,
          validation: field.allowedValues || []
        })),
        forbiddenKeywords: jsonData.stages[1].automatedValidations.forbiddenKeywords,
        hardFailConditions: jsonData.stages[1].hardFailConditions
      },
      
      stage3: {
        name: jsonData.stages[2].title,
        enabled: true,
        timeLimit: jsonData.stages[2].timeLimitMinutes,
        passingScore: 85,
        submissionType: 'file_and_rubric',
        allowedFormats: jsonData.stages[2].requiredSubmissions.goldenSolution.allowedFormats,
        minFileSize: jsonData.stages[2].requiredSubmissions.goldenSolution.minFileSizeKB,
        requiredSubmissions: Object.keys(jsonData.stages[2].requiredSubmissions),
        hardFailConditions: jsonData.stages[2].hardFailConditions
      },
      
      stage4: {
        name: jsonData.stages[3].title,
        enabled: true,
        timeLimit: jsonData.stages[3].timeLimitMinutes,
        passingScore: 100, // Must pass integrity trap
        submissionType: 'integrity_check',
        trapPrompt: jsonData.stages[3].trapPrompt,
        expectedBehavior: jsonData.stages[3].expectedCorrectBehavior,
        evaluationLogic: jsonData.stages[3].evaluationLogic
      }
    },
    
    // Hard rules from global constraints
    hardRules: {
      forbiddenFiles: jsonData.globalConstraints.forbiddenOutputFormats.map(format => `.${format}`),
      hallucinationDetection: jsonData.globalConstraints.hallucinationTolerance === 0,
      ruleViolationPolicy: jsonData.hardFailEnabled ? 'immediate_fail' : 'warning'
    },
    
    // Scoring system
    scoring: {
      totalPoints: 100,
      passingScore: jsonData.expectedPassRate * 1000, // Convert 0.1 to 100 scale
      weights: {
        stage1: 0.2,
        stage2: 0.3,
        stage3: 0.3,
        stage4: 0.2
      },
      autoApprovalThreshold: 95
    },
    
    // Security and audit
    security: {
      immutableSubmissions: true,
      auditTrail: jsonData.audit.logAllSubmissions,
      sessionTracking: jsonData.audit.logTimePerStage
    },
    
    // QA requirements
    qaRequirements: {
      qaRequired: true,
      reviewerCount: 2,
      consensusRequired: true
    },
    
    // Strict retake policy
    retakePolicy: {
      allowed: false,
      cooldownDays: 30,
      maxAttempts: 1
    },
    
    // Status
    isActive: jsonData.status === 'active',
    version: jsonData.version
  };
}

// Find or create project for Spidey Assessment
async function findOrCreateProject(systemUser) {
  try {
    console.log('🔍 Looking for existing Prompt Instantiation Project...');
    
    // Look for existing project
    let project = await AnnotationProject.findOne({
      projectName: { $regex: /Prompt Instantiation/i }
    });
    
    if (project) {
      console.log(`✅ Found existing project: ${project.projectName} (${project._id})`);
      return project;
    }
    
    // Create new project
    console.log('📝 Creating new Prompt Instantiation Project...');
    
    project = new AnnotationProject({
      projectName: 'Prompt Instantiation Project - Spidey Assessment',
      projectDescription: 'Elite file-based AI task design and evaluation project. High-discipline assessment for advanced prompt instantiation skills.',
      projectCategory: 'Data Labeling',
      payRate: 50,
      payRateCurrency: 'USD',
      payRateType: 'per_project',
      status: 'active',
      maxAnnotators: 10,
      difficultyLevel: 'expert',
      requiredSkills: ['AI', 'Prompt Engineering', 'Task Design', 'Quality Control'],
      tags: ['spidey', 'high-discipline', 'prompt-instantiation', 'elite'],
      createdBy: systemUser._id,
      assignedAdmins: [systemUser._id]
    });
    
    await project.save();
    console.log(`✅ Created new project: ${project.projectName} (${project._id})`);
    
    return project;
    
  } catch (error) {
    console.error('❌ Error finding/creating project:', error);
    throw error;
  }
}

// Main function to persist Spidey Assessment
async function persistSpideyAssessment() {
  try {
    await connectDB();
    
    console.log('🚀 Starting Spidey Assessment persistence...');
    
    // Load assessment data
    const jsonData = loadSpideyAssessmentData();
    
    // Get system user for createdBy field
    console.log('👤 Finding system user...');
    const systemUser = await DTUser.findOne({ 
      email: { $exists: true },
      annotatorStatus: 'approved' 
    }).select('_id email fullName');
    
    if (!systemUser) {
      throw new Error('No system user found. Cannot create assessment.');
    }
    
    console.log(`✅ Using system user: ${systemUser.email} (${systemUser._id})`);
    
    // Find or create project
    const project = await findOrCreateProject(systemUser);
    
    // Check if Spidey Assessment already exists for this project
    console.log('🔍 Checking for existing Spidey Assessment...');
    const existingAssessment = await SpideyAssessmentConfig.findOne({
      projectId: project._id,
      assessmentType: 'spidey_assessment'
    });
    
    if (existingAssessment) {
      console.log(`⚠️ Spidey Assessment already exists for project ${project.projectName}`);
      console.log(`📋 Existing assessment ID: ${existingAssessment._id}`);
      console.log('🔄 Updating existing assessment with new data...');
      
      // Transform and update existing assessment
      const configData = transformToConfigFormat(jsonData);
      Object.assign(existingAssessment, configData);
      existingAssessment.updatedBy = systemUser._id;
      
      await existingAssessment.save();
      console.log('✅ Updated existing Spidey Assessment configuration');
      
      return existingAssessment;
    }
    
    // Transform JSON to config format
    console.log('🔄 Transforming assessment data to config format...');
    const configData = transformToConfigFormat(jsonData);
    
    // Add required fields
    configData.projectId = project._id;
    configData.createdBy = systemUser._id;
    
    // Create new Spidey Assessment Config
    console.log('💾 Creating new Spidey Assessment configuration...');
    const spideyConfig = new SpideyAssessmentConfig(configData);
    
    await spideyConfig.save();
    
    console.log('✅ Successfully persisted Spidey Assessment to database!');
    console.log(`📋 Assessment Config ID: ${spideyConfig._id}`);
    console.log(`🔗 Linked to Project: ${project.projectName} (${project._id})`);
    
    // Populate for display
    await spideyConfig.populate('projectId', 'projectName projectDescription');
    await spideyConfig.populate('createdBy', 'fullName email');
    
    console.log('\n📊 Assessment Summary:');
    console.log(`   Title: ${spideyConfig.title}`);
    console.log(`   Type: ${spideyConfig.assessmentType}`);
    console.log(`   Project: ${spideyConfig.projectId.projectName}`);
    console.log(`   Version: ${spideyConfig.version}`);
    console.log(`   Active: ${spideyConfig.isActive}`);
    console.log(`   Stages: ${Object.keys(spideyConfig.stages).length}`);
    console.log(`   Created By: ${spideyConfig.createdBy.fullName} (${spideyConfig.createdBy.email})`);
    
    return spideyConfig;
    
  } catch (error) {
    console.error('❌ Error persisting Spidey Assessment:', error);
    throw error;
  }
}

// Verify persistence
async function verifyPersistence() {
  try {
    console.log('\n🔍 Verifying persistence...');
    
    const assessments = await SpideyAssessmentConfig.find({ 
      assessmentType: 'spidey_assessment' 
    })
    .populate('projectId', 'projectName')
    .populate('createdBy', 'fullName email');
    
    console.log(`✅ Found ${assessments.length} Spidey Assessment(s) in database:`);
    
    assessments.forEach((assessment, index) => {
      console.log(`\n${index + 1}. ${assessment.title}`);
      console.log(`   ID: ${assessment._id}`);
      console.log(`   Project: ${assessment.projectId?.projectName || 'Not linked'}`);
      console.log(`   Version: ${assessment.version}`);
      console.log(`   Active: ${assessment.isActive}`);
      console.log(`   Created: ${assessment.createdAt.toISOString()}`);
    });
    
  } catch (error) {
    console.error('❌ Error verifying persistence:', error);
  }
}

// Main execution
async function main() {
  try {
    const assessment = await persistSpideyAssessment();
    await verifyPersistence();
    
    console.log('\n🎉 Spidey Assessment successfully persisted to database!');
    console.log('📌 The assessment is now ready to be used in the system.');
    
  } catch (error) {
    console.error('❌ Failed to persist Spidey Assessment:', error);
  } finally {
    await disconnectDB();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { 
  persistSpideyAssessment, 
  transformToConfigFormat, 
  loadSpideyAssessmentData 
};