// Load environment variables
require('dotenv').config();

const { sendAnnotatorApprovalEmail, sendAnnotatorRejectionEmail } = require('./utils/annotatorMailer');

/**
 * Test HTML Email Content with Real Email
 */
const testRealEmail = async () => {
    console.log('📧 Testing HTML Email Content...\n');
    
    try {
        // Test with a real email to verify HTML content
        const testEmail = 'damilola@mydeeptech.ng'; // Use your email to check the HTML
        const testName = 'Test User';
        
        console.log('📤 Sending annotator approval email with HTML content...');
        await sendAnnotatorApprovalEmail(testEmail, testName);
        console.log('✅ Annotator approval email sent! Check your email inbox.\n');
        
        // Wait a moment between emails
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('📤 Sending micro tasker approval email with HTML content...');
        await sendAnnotatorRejectionEmail(testEmail, testName);
        console.log('✅ Micro tasker approval email sent! Check your email inbox.\n');
        
        console.log('🎉 HTML Email Content Test completed!');
        console.log('Check your email inbox to verify:');
        console.log('✅ HTML formatting is properly rendered');
        console.log('✅ Professional styling and layout');
        console.log('✅ Gradient headers and proper typography');
        console.log('✅ Call-to-action buttons are working');
        console.log('✅ MyDeeptech branding is displayed correctly');
        
    } catch (error) {
        console.error('❌ Email test failed:', error.message);
    }
};

console.log('🎨 HTML Email Content Test');
console.log('==========================');
console.log('This will send HTML emails to verify proper formatting');
console.log('==========================\n');

testRealEmail();