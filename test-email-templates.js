// Load environment variables
require('dotenv').config();

const { sendAnnotatorApprovalEmail, sendAnnotatorRejectionEmail } = require('./utils/annotatorMailer');

/**
 * Quick Email Template Test
 */
const quickEmailTest = async () => {
    console.log('🧪 Testing Annotator Email Templates...\n');
    
    try {
        console.log('📧 Sending test annotator approval email...');
        await sendAnnotatorApprovalEmail('dammykolaceo@gmail.com', 'Test User');
        console.log('✅ Annotator approval email sent successfully!\n');
        
        console.log('📧 Sending test micro tasker approval email...');
        await sendAnnotatorRejectionEmail('dammykolaceo@gmail.com', 'Test User');
        console.log('✅ Micro tasker approval email sent successfully!\n');
        
        console.log('🎉 Email template test completed!');
        console.log('Check your Brevo dashboard for sent emails');
        
    } catch (error) {
        console.error('❌ Email test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
};

console.log('📝 Quick Annotator Email Test');
console.log('=============================');
console.log('This will send test emails using the new templates');
console.log('Check your Brevo dashboard to confirm delivery');
console.log('=============================\n');

quickEmailTest();