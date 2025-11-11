const { sendAdminVerificationEmail } = require('./utils/adminMailer');

const testBrevoAPIFix = async () => {
  console.log('🧪 Testing Brevo API Fix for Admin Verification Email...\n');
  
  try {
    console.log('📋 Test Configuration:');
    console.log(`- BREVO_API_KEY: ${process.env.BREVO_API_KEY ? '✅ Present' : '❌ Missing'}`);
    console.log(`- BREVO_SENDER_EMAIL: ${process.env.BREVO_SENDER_EMAIL || '❌ Missing'}`);
    console.log(`- BREVO_SENDER_NAME: ${process.env.BREVO_SENDER_NAME || 'MyDeepTech Team'}\n`);

    if (!process.env.BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY environment variable is required');
    }

    if (!process.env.BREVO_SENDER_EMAIL) {
      throw new Error('BREVO_SENDER_EMAIL environment variable is required');
    }

    console.log('📧 Sending test admin verification email...');
    
    const result = await sendAdminVerificationEmail(
      'projects@mydeeptech.ng',
      '123456',
      'Projects Admin'
    );

    console.log('✅ Test Results:');
    console.log(`- Success: ${result.success}`);
    console.log(`- Provider: ${result.provider}`);
    console.log(`- Message ID: ${result.messageId}`);
    
    if (result.provider === 'brevo-api') {
      console.log('\n🎉 SUCCESS: Brevo API is working correctly!');
      console.log('The previous SMTP connection timeout issue should be resolved.');
    } else if (result.provider === 'brevo-smtp-fallback') {
      console.log('\n⚠️ WARNING: API failed, but SMTP fallback worked.');
      console.log('Consider checking your BREVO_API_KEY configuration.');
    }

  } catch (error) {
    console.error('\n❌ Test Failed:');
    console.error(`- Error: ${error.message}`);
    console.error(`- Stack: ${error.stack}`);
    
    console.log('\n🔧 Troubleshooting Steps:');
    console.log('1. Check your BREVO_API_KEY environment variable');
    console.log('2. Ensure BREVO_SENDER_EMAIL is configured');
    console.log('3. Verify your Brevo account has API access');
    console.log('4. Check if your Brevo account has sufficient credits');
  }
};

// Run the test
testBrevoAPIFix();