const mongoose = require('mongoose');
const SpideyAssessmentConfig = require('./models/spideyAssessmentConfig.model');
const AnnotationProject = require('./models/annotationProject.model');
require('dotenv').config();

/**
 * Spidey Assessment Configuration Seeder
 * Creates the initial Spidey High-Discipline Assessment configuration
 * Integrates with existing Prompt Instantiation Project
 */

const seedSpideyConfig = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {});
    console.log('✅ Connected to MongoDB');

    // Find the Prompt Instantiation Project
    const promptProject = await AnnotationProject.findOne({ 
      title: { $regex: /prompt.*instantiation/i } 
    });

    if (!promptProject) {
      console.log('❌ Prompt Instantiation Project not found. Creating one...');
      
      // Create the project if it doesn't exist
      const newProject = new AnnotationProject({
        title: 'Prompt Instantiation Project',
        description: 'High-discipline assessment project for quality enforcement',
        status: 'active',
        isActive: true,
        projectType: 'assessment',
        requirements: {
          minQualificationScore: 85,
          experience: 'advanced',
          specialSkills: ['prompt_engineering', 'quality_assessment', 'integrity_testing']
        }
      });
      
      await newProject.save();
      console.log('✅ Created Prompt Instantiation Project');
      promptProject = newProject;
    }

    // Check if Spidey config already exists
    const existingConfig = await SpideyAssessmentConfig.findOne({
      assessmentType: 'spidey_assessment'
    });

    if (existingConfig) {
      console.log('⚠️ Spidey assessment configuration already exists');
      console.log(`Config ID: ${existingConfig._id}`);
      console.log(`Status: ${existingConfig.isActive ? 'Active' : 'Inactive'}`);
      process.exit(0);
    }

    // Create Spidey Assessment Configuration
    const spideyConfig = new SpideyAssessmentConfig({
      projectId: promptProject._id,
      title: 'Spidey High-Discipline Assessment',
      description: 'Multi-stage assessment designed to enforce strict quality standards and protect partner accounts through comprehensive validation.',
      assessmentType: 'spidey_assessment',
      
      // Configure all 4 stages
      stages: {
        stage1: {
          name: 'Guideline Comprehension',
          enabled: true,
          timeLimit: 30, // minutes
          passingScore: 80,
          questions: [
            {
              questionId: 'comp_001',
              questionText: 'What is the primary purpose of the Spidey assessment?',
              questionType: 'multiple_choice',
              options: [
                { optionId: 'A', optionText: 'To quickly approve all candidates', isCorrect: false },
                { optionId: 'B', optionText: 'To enforce quality standards and protect partner accounts', isCorrect: true },
                { optionId: 'C', optionText: 'To test technical skills only', isCorrect: false },
                { optionId: 'D', optionText: 'To evaluate writing speed', isCorrect: false }
              ],
              correctAnswer: 'B',
              isCritical: true,
              points: 1
            },
            {
              questionId: 'comp_002',
              questionText: 'When you encounter a rule violation, what should you do?',
              questionType: 'multiple_choice',
              options: [
                { optionId: 'A', optionText: 'Ignore it and continue', isCorrect: false },
                { optionId: 'B', optionText: 'Flag it immediately and refuse to proceed', isCorrect: true },
                { optionId: 'C', optionText: 'Proceed but mention it later', isCorrect: false },
                { optionId: 'D', optionText: 'Ask someone else to handle it', isCorrect: false }
              ],
              correctAnswer: 'B',
              isCritical: true,
              points: 1
            },
            {
              questionId: 'comp_003',
              questionText: 'What happens if you use forbidden keywords like "summarize"?',
              questionType: 'multiple_choice',
              options: [
                { optionId: 'A', optionText: 'Warning is issued', isCorrect: false },
                { optionId: 'B', optionText: 'Points are deducted', isCorrect: false },
                { optionId: 'C', optionText: 'Immediate assessment failure', isCorrect: true },
                { optionId: 'D', optionText: 'No consequences', isCorrect: false }
              ],
              correctAnswer: 'C',
              isCritical: true,
              points: 1
            },
            {
              questionId: 'comp_004',
              questionText: 'How many attempts are allowed for the Spidey assessment?',
              questionType: 'multiple_choice',
              options: [
                { optionId: 'A', optionText: 'Unlimited', isCorrect: false },
                { optionId: 'B', optionText: 'Three attempts', isCorrect: false },
                { optionId: 'C', optionText: 'Two attempts', isCorrect: false },
                { optionId: 'D', optionText: 'One attempt only', isCorrect: true }
              ],
              correctAnswer: 'D',
              isCritical: false,
              points: 1
            },
            {
              questionId: 'comp_005',
              questionText: 'File validation in Stage 3 requires:',
              questionType: 'multiple_choice',
              options: [
                { optionId: 'A', optionText: 'Any file type is acceptable', isCorrect: false },
                { optionId: 'B', optionText: 'Only whitelisted file types are allowed', isCorrect: true },
                { optionId: 'C', optionText: 'File type doesn\'t matter', isCorrect: false },
                { optionId: 'D', optionText: 'Only images are allowed', isCorrect: false }
              ],
              correctAnswer: 'B',
              isCritical: false,
              points: 1
            }
          ]
        },
        
        stage2: {
          name: 'Mini Task Validation',
          enabled: true,
          timeLimit: 45,
          validation: {
            requiresFileReference: true,
            forbiddenKeywords: ['summarize', 'summary', 'tldr', 'brief'],
            requiredElements: ['domain', 'failure_explanation'],
            minResponseLength: 100
          }
        },
        
        stage3: {
          name: 'Golden Solution & Rubric',
          enabled: true,
          timeLimit: 60,
          fileValidation: {
            allowedTypes: ['.pdf', '.doc', '.docx', '.txt', '.md'],
            maxFileSize: 10485760, // 10MB
            minContentLength: 500,
            virusScanRequired: true
          },
          rubricRequirements: {
            positiveRubricRequired: true,
            negativeRubricRequired: true,
            rubricMinLength: 200
          }
        },
        
        stage4: {
          name: 'Integrity Trap',
          enabled: true,
          timeLimit: 30,
          trapValidation: {
            blindComplianceCheck: true,
            flaggingRequired: true
          }
        }
      },
      
      // Hard rules (zero tolerance)
      hardRules: {
        forbiddenFiles: ['.exe', '.bat', '.sh', '.js', '.py'],
        hallucinationDetection: true,
        ruleViolationPolicy: 'immediate_fail'
      },
      
      // Scoring configuration
      scoring: {
        totalPoints: 100,
        passingScore: 85,
        weights: {
          stage1: 0.2,
          stage2: 0.3,
          stage3: 0.3,
          stage4: 0.2
        },
        autoApprovalThreshold: 95
      },
      
      // Security settings
      security: {
        immutableSubmissions: true,
        auditTrail: true,
        sessionTracking: true
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
      
      // Feature flag (disabled by default for safety)
      isActive: false, // Enable manually when ready
      version: '1.0.0',
      
      createdBy: new mongoose.Types.ObjectId('000000000000000000000000') // Placeholder admin ID
    });

    await spideyConfig.save();

    console.log('🎯 Spidey Assessment Configuration Created Successfully!');
    console.log(`📋 Config ID: ${spideyConfig._id}`);
    console.log(`🏗️ Project ID: ${promptProject._id}`);
    console.log('⚠️ Assessment is INACTIVE by default for safety');
    console.log('');
    console.log('🔧 To activate the assessment:');
    console.log(`   db.spideyassessmentconfigs.updateOne({_id: ObjectId("${spideyConfig._id}")}, {$set: {isActive: true}})`);
    console.log('');
    console.log('📊 Assessment Configuration:');
    console.log(`   - 4 Stages: ${Object.keys(spideyConfig.stages).length}`);
    console.log(`   - Passing Score: ${spideyConfig.scoring.passingScore}%`);
    console.log(`   - Auto-Approval: ${spideyConfig.scoring.autoApprovalThreshold}%`);
    console.log(`   - Retakes: ${spideyConfig.retakePolicy.allowed ? 'Allowed' : 'Not Allowed'}`);
    console.log(`   - QA Required: ${spideyConfig.qaRequirements.qaRequired ? 'Yes' : 'No'}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding Spidey configuration:', error);
    process.exit(1);
  }
};

// Run the seeder
seedSpideyConfig();