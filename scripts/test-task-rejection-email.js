/**
 * Test script for task application rejection email functionality
 * This script demonstrates how the rejection email feature works
 */

const ProjectMailService = require('../services/mail-service/project.service');

async function testTaskRejectionEmail() {
    try {
        console.log('🧪 Testing task application rejection email...');
        
        const testData = {
            taskTitle: 'Sample Image Labeling Task',
            category: 'Computer Vision',
            rejectionReason: 'Insufficient experience in the required domain. Please consider applying for beginner-level tasks to build your portfolio.',
            adminName: 'MyDeepTech Admin Team'
        };

        // Test with sample recipient
        await ProjectMailService.sendTaskApplicationRejectionNotification(
            'test@example.com',
            'John Doe',
            testData
        );

        console.log('✅ Task rejection email test completed successfully!');
        console.log('📧 Email content preview:');
        console.log(`   To: test@example.com`);
        console.log(`   Subject: Task Application Update - MyDeepTech`);
        console.log(`   Task: ${testData.taskTitle}`);
        console.log(`   Category: ${testData.category}`);
        console.log(`   Reason: ${testData.rejectionReason}`);

    } catch (error) {
        console.error('❌ Task rejection email test failed:', error);
        console.log('\n📋 Troubleshooting:');
        console.log('1. Check email service configuration');
        console.log('2. Verify email template exists at emailTemplates/sendTaskApplicationRejectionNotification.html');
        console.log('3. Ensure SMTP settings are properly configured');
    }
}

// Usage example for the controller:
function exampleUsage() {
    console.log('\n📝 Example API Request to reject a task application:');
    console.log('POST /api/task/approve-reject-application');
    console.log('Body:');
    console.log(JSON.stringify({
        applicationId: "64a1b2c3d4e5f6789abcdef0",
        action: "reject",
        rejectionReason: "Your skills don't match the requirements for this specific task. We encourage you to apply for other available tasks."
    }, null, 2));

    console.log('\n📧 This will automatically send a rejection email to the applicant with:');
    console.log('- Professional rejection notification');
    console.log('- Task details (title, category)');
    console.log('- Specific rejection reason (if provided)');
    console.log('- Encouragement to apply for other tasks');
    console.log('- Support contact information');
}

// Run the test
if (require.main === module) {
    testTaskRejectionEmail().then(() => {
        exampleUsage();
        process.exit(0);
    }).catch((error) => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = { testTaskRejectionEmail };