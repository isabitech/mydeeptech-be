// Test script to create expired applications for manual testing
const mongoose = require('mongoose');
const envConfig = require('../config/envConfig');

// Import models
require('../models/dtUser.model');
require('../models/annotationProject.model');
require('../models/projectApplication.model');

const DTUser = mongoose.model('DTUser');
const AnnotationProject = mongoose.model('AnnotationProject');
const ProjectApplication = mongoose.model('ProjectApplication');

async function createTestExpiredApplication() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(envConfig.mongo.MONGO_URI);
        console.log('✅ MongoDB connected');

        // Create test user if doesn't exist
        let testUser = await DTUser.findOne({ email: 'test@example.com' });
        if (!testUser) {
            testUser = new DTUser({
                username: 'testuser',
                email: 'test@example.com',
                first_name: 'Test',
                last_name: 'User',
                fullName: 'Test User',
                phone: '+1234567890',
                personal_info: {
                    country: 'Nigeria'
                },
                email_verified: true,
                account_status: 'active',
                consent: true
            });
            await testUser.save();
            console.log('✅ Test user created');
        }

        // Create test project with 1-week duration
        let testProject = await AnnotationProject.findOne({ projectName: 'Test Expiry Project' });
        if (!testProject) {
            testProject = new AnnotationProject({
                projectName: 'Test Expiry Project',
                projectDescription: 'A project for testing expiry functionality',
                projectCategory: 'Text Annotation',
                applicationDuration: 1, // 1 week
                payRate: 10,
                status: 'active',
                createdBy: testUser._id,
                projectGuidelineLink: 'https://example.com/guidelines'
            });
            await testProject.save();
            console.log('✅ Test project created');
        }

        // Create application that expired 2 days ago
        const expiredDate = new Date();
        expiredDate.setDate(expiredDate.getDate() - 9); // 9 days ago (expired by 2 days for 1-week duration)

        const expiryDate = new Date(expiredDate);
        expiryDate.setDate(expiryDate.getDate() + 7); // Add 1 week duration

        const existingApp = await ProjectApplication.findOne({
            applicantId: testUser._id,
            projectId: testProject._id
        });

        if (!existingApp) {
            const expiredApplication = new ProjectApplication({
                applicantId: testUser._id,
                projectId: testProject._id,
                status: 'pending',
                appliedAt: expiredDate,
                expiryDate: expiryDate,
                coverLetter: 'This is a test application for expiry testing',
                resumeUrl: 'https://example.com/test-resume.pdf'
            });

            await expiredApplication.save();
            console.log('✅ Test expired application created');
            console.log(`📅 Application Date: ${expiredDate.toISOString()}`);
            console.log(`⏰ Expiry Date: ${expiryDate.toISOString()}`);
            console.log(`📧 User Email: ${testUser.email}`);
        } else {
            console.log('ℹ️ Test application already exists');
        }

        console.log('\n🎯 Test Setup Complete!');
        console.log('Now run: npm run expiry:process');
        
    } catch (error) {
        console.error('❌ Error creating test data:', error.message);
    } finally {
        mongoose.disconnect();
    }
}

createTestExpiredApplication();