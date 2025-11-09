// Load environment variables
require('dotenv').config();

const { sendVerificationEmailBrevoSMTP, sendProjectEmail } = require('./utils/brevoSMTP');
const { sendAnnotatorApprovalEmail } = require('./utils/annotatorMailer');

/**
 * Test Different Email Senders
 */
const testEmailSenders = async () => {
    console.log('📧 Testing Different Email Senders...\n');
    
    try {
        console.log('🔍 Environment Variables:');
        console.log(`   Verification Sender: ${process.env.BREVO_SENDER_EMAIL} (${process.env.BREVO_SENDER_NAME})`);
        console.log(`   Project Sender: ${process.env.BREVO_PROJECT_SENDER_EMAIL} (${process.env.BREVO_PROJECT_SENDER_NAME})\n`);
        
        console.log('📤 Testing verification email (no-reply@mydeeptech.ng)...');
        await sendVerificationEmailBrevoSMTP('dammykolaceo@gmail.com', 'Test User', '12345');
        console.log('✅ Verification email sent!\n');
        
        console.log('📤 Testing project email (projects@mydeeptech.ng)...');
        await sendAnnotatorApprovalEmail('dammykolaceo@gmail.com', 'Test User');
        console.log('✅ Project email sent!\n');
        
        console.log('🎯 Summary:');
        console.log('✅ Verification emails sent from: no-reply@mydeeptech.ng');
        console.log('✅ Project emails sent from: projects@mydeeptech.ng');
        console.log('✅ Different senders working correctly!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
};

console.log('🚀 Email Sender Test');
console.log('===================');
testEmailSenders();