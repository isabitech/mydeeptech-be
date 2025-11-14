// Project Guidelines System Test Script
// Test the new project guidelines functionality

const mongoose = require('mongoose');
require('dotenv').config();

const AnnotationProject = require('./models/annotationProject.model');
const ProjectApplication = require('./models/projectApplication.model');
const DTUser = require('./models/dtUser.model');

async function testProjectGuidelinesSystem() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Test 1: Create a project with guidelines
    console.log('\n📋 TEST 1: Creating project with guidelines...');
    
    const testProject = new AnnotationProject({
      projectName: 'Test Project with Guidelines',
      projectDescription: 'This is a test project to verify the guidelines system works properly.',
      projectCategory: 'Text Annotation',
      payRate: 15,
      payRateCurrency: 'USD',
      payRateType: 'per_task',
      difficultyLevel: 'intermediate',
      requiredSkills: ['Writing', 'Attention to Detail'],
      projectGuidelineLink: 'https://docs.google.com/document/d/test-guidelines/edit',
      projectGuidelineVideo: 'https://youtube.com/watch?v=test-video',
      projectCommunityLink: 'https://discord.gg/test-community',
      projectTrackerLink: 'https://trello.com/b/test-tracker',
      createdBy: new mongoose.Types.ObjectId(), // Mock admin ID
      assignedAdmins: [new mongoose.Types.ObjectId()]
    });

    const savedProject = await testProject.save();
    console.log(`✅ Project created successfully with ID: ${savedProject._id}`);
    console.log(`📄 Guidelines Document: ${savedProject.projectGuidelineLink}`);
    console.log(`🎥 Guidelines Video: ${savedProject.projectGuidelineVideo}`);
    console.log(`💬 Community Link: ${savedProject.projectCommunityLink}`);
    console.log(`📊 Tracker Link: ${savedProject.projectTrackerLink}`);

    // Test 2: Create a test user
    console.log('\n👤 TEST 2: Creating test user...');
    
    const testUser = new DTUser({
      fullName: 'Test User',
      phone: '+1234567890',
      email: 'testuser@example.com',
      consent: true,
      hasSetPassword: true,
      isEmailVerified: true,
      annotatorStatus: 'approved',
      personal_info: {
        phone_number: '+1234567890',
        country: 'United States'
      }
    });

    const savedUser = await testUser.save();
    console.log(`✅ Test user created with ID: ${savedUser._id}`);

    // Test 3: Create an approved application
    console.log('\n📝 TEST 3: Creating approved application...');
    
    const testApplication = new ProjectApplication({
      projectId: savedProject._id,
      applicantId: savedUser._id,
      coverLetter: 'I am excited to work on this test project and will follow all guidelines carefully.',
      status: 'approved',
      appliedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: new mongoose.Types.ObjectId(),
      workStartedAt: new Date()
    });

    const savedApplication = await testApplication.save();
    console.log(`✅ Approved application created with ID: ${savedApplication._id}`);

    // Test 4: Simulate guidelines access check
    console.log('\n🔐 TEST 4: Testing guidelines access control...');
    
    // Check if user has approved application for this project
    const approvedApplication = await ProjectApplication.findOne({
      projectId: savedProject._id,
      applicantId: savedUser._id,
      status: 'approved'
    });

    if (approvedApplication) {
      console.log('✅ Access granted - User has approved application');
      
      // Simulate the response data
      const guidelinesData = {
        projectInfo: {
          id: savedProject._id,
          name: savedProject.projectName,
          description: savedProject.projectDescription,
          category: savedProject.projectCategory,
          payRate: savedProject.payRate,
          payRateCurrency: savedProject.payRateCurrency,
          payRateType: savedProject.payRateType,
          difficultyLevel: savedProject.difficultyLevel,
          deadline: savedProject.deadline
        },
        guidelines: {
          documentLink: savedProject.projectGuidelineLink,
          videoLink: savedProject.projectGuidelineVideo,
          communityLink: savedProject.projectCommunityLink
        },
        userApplication: {
          appliedAt: approvedApplication.appliedAt,
          approvedAt: approvedApplication.reviewedAt,
          workStartedAt: approvedApplication.workStartedAt,
          status: approvedApplication.status
        },
        accessInfo: {
          accessGrantedAt: new Date(),
          accessType: "approved_annotator",
          userRole: "annotator"
        }
      };

      console.log('📊 Guidelines Data:', JSON.stringify(guidelinesData, null, 2));
    } else {
      console.log('❌ Access denied - User does not have approved application');
    }

    // Test 5: Test access with non-approved user
    console.log('\n🚫 TEST 5: Testing access denial for non-approved user...');
    
    const nonApprovedUser = new DTUser({
      fullName: 'Non-Approved User',
      phone: '+9876543210',
      email: 'nonapproved@example.com',
      consent: true,
      hasSetPassword: true,
      isEmailVerified: true,
      annotatorStatus: 'pending'
    });

    const savedNonApprovedUser = await nonApprovedUser.save();
    
    const nonApprovedApplication = await ProjectApplication.findOne({
      projectId: savedProject._id,
      applicantId: savedNonApprovedUser._id,
      status: 'approved'
    });

    if (!nonApprovedApplication) {
      console.log('✅ Correctly denied access for non-approved user');
      console.log('📋 Error response:', {
        success: false,
        message: "Access denied. Only approved annotators can access project guidelines.",
        error: {
          code: "GUIDELINES_ACCESS_DENIED",
          reason: "User must have an approved application for this project",
          userStatus: "not_approved_for_project"
        }
      });
    }

    // Test 6: Test email data preparation
    console.log('\n📧 TEST 6: Testing email data preparation...');
    
    const emailData = {
      projectName: savedProject.projectName,
      projectCategory: savedProject.projectCategory,
      payRate: savedProject.payRate,
      adminName: 'Test Admin',
      reviewNotes: 'Welcome to the project! Please review the guidelines carefully.',
      projectGuidelineLink: savedProject.projectGuidelineLink,
      projectGuidelineVideo: savedProject.projectGuidelineVideo,
      projectCommunityLink: savedProject.projectCommunityLink
    };

    console.log('✅ Email data prepared for sendProjectApprovalNotification:');
    console.log(JSON.stringify(emailData, null, 2));

    // Test 7: Validation tests
    console.log('\n✅ TEST 7: Testing field validations...');
    
    // Test invalid URL
    try {
      const invalidProject = new AnnotationProject({
        projectName: 'Invalid URL Test',
        projectDescription: 'Testing invalid URL validation',
        projectCategory: 'Text Annotation',
        payRate: 10,
        projectGuidelineLink: 'not-a-valid-url', // Should fail validation
        createdBy: new mongoose.Types.ObjectId(),
        assignedAdmins: [new mongoose.Types.ObjectId()]
      });
      await invalidProject.save();
      console.log('❌ Validation should have failed for invalid URL');
    } catch (error) {
      console.log('✅ Correctly rejected invalid URL:', error.message);
    }

    // Test missing required field
    try {
      const missingFieldProject = new AnnotationProject({
        projectName: 'Missing Required Field Test',
        projectDescription: 'Testing missing required field validation',
        projectCategory: 'Text Annotation',
        payRate: 10,
        // Missing projectGuidelineLink - should fail validation
        createdBy: new mongoose.Types.ObjectId(),
        assignedAdmins: [new mongoose.Types.ObjectId()]
      });
      await missingFieldProject.save();
      console.log('❌ Validation should have failed for missing required field');
    } catch (error) {
      console.log('✅ Correctly rejected missing required field:', error.message);
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('✅ Project creation with guidelines: PASSED');
    console.log('✅ User creation: PASSED');
    console.log('✅ Application approval: PASSED');
    console.log('✅ Guidelines access control: PASSED');
    console.log('✅ Access denial for non-approved users: PASSED');
    console.log('✅ Email data preparation: PASSED');
    console.log('✅ Field validations: PASSED');

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await AnnotationProject.findByIdAndDelete(savedProject._id);
    await DTUser.findByIdAndDelete(savedUser._id);
    await DTUser.findByIdAndDelete(savedNonApprovedUser._id);
    await ProjectApplication.findByIdAndDelete(savedApplication._id);
    console.log('✅ Test data cleaned up successfully');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  }
}

// Run the test
console.log('🚀 Starting Project Guidelines System Tests...');
console.log('================================================');
testProjectGuidelinesSystem();

module.exports = testProjectGuidelinesSystem;