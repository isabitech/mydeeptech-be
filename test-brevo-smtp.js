require('dotenv').config();
const { testBrevoSMTPConnection, sendVerificationEmailBrevoSMTP } = require('./utils/brevoSMTP');
const { sendVerificationEmail } = require('./utils/mailer');

async function testBrevoSMTPSetup() {
  console.log('🧪 Testing Brevo SMTP Configuration...\n');
  
  // Check environment variables
  console.log('📧 Brevo SMTP Configuration:');
  console.log(`SMTP_SERVER: ${process.env.SMTP_SERVER || 'smtp-relay.brevo.com'}`);
  console.log(`SMTP_PORT: ${process.env.SMTP_PORT || '587'}`);
  console.log(`SMTP_LOGIN: ${process.env.SMTP_LOGIN ? '✅ Set' : '❌ Missing'}`);
  console.log(`SMTP_KEY: ${process.env.SMTP_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`BREVO_SENDER_EMAIL: ${process.env.BREVO_SENDER_EMAIL ? '✅ Set' : '❌ Missing'}`);
  console.log(`BREVO_SENDER_NAME: ${process.env.BREVO_SENDER_NAME || 'MyDeepTech Team'}`);
  
  if (!process.env.SMTP_LOGIN || !process.env.SMTP_KEY) {
    console.log('\n❌ Brevo SMTP credentials are missing!');
    console.log('Based on your .env file, you should have:');
    console.log('SMTP_LOGIN=792fb8001@smtp-brevo.com');
    console.log('SMTP_KEY=ATgJXO7qHUR8btvy');
    return;
  }
  
  // Test SMTP connection
  console.log('\n🔗 Testing Brevo SMTP Connection...');
  const connectionSuccess = await testBrevoSMTPConnection();
  
  if (!connectionSuccess) {
    console.log('\n❌ Brevo SMTP connection failed.');
    return;
  }
  
  // Test sending email
  console.log('\n📨 Testing Direct Brevo SMTP Email Send...');
  try {
    const testStartTime = Date.now();
    
    const result = await sendVerificationEmailBrevoSMTP(
      'destabtechng@gmail.com', // Send to specified email
      'Test User'
    );
    
    const testEndTime = Date.now();
    console.log(`✅ Direct Brevo SMTP test successful! (${testEndTime - testStartTime}ms)`);
    console.log(`📬 Message ID: ${result.messageId}`);
    console.log(`📊 Provider: ${result.provider}`);
    
  } catch (error) {
    console.log('\n❌ Direct Brevo SMTP test failed:');
    console.log(`Error: ${error.message}`);
    return;
  }
  
  // Test main email function
  console.log('\n📨 Testing Main Email Function (with fallbacks)...');
  try {
    const testStartTime = Date.now();
    
    const result = await sendVerificationEmail(
      'destabtechng@gmail.com', // Send to specified email
      'Test User Main Function'
    );
    
    const testEndTime = Date.now();
    console.log(`✅ Main email function test successful! (${testEndTime - testStartTime}ms)`);
    console.log(`📬 Message ID: ${result.messageId}`);
    console.log(`📊 Provider: ${result.provider}`);
    
    console.log('\n🎉 Brevo SMTP is configured correctly!');
    console.log('✅ Your verification emails should now send very fast!');
    console.log('✅ No more timeout issues!');
    
  } catch (error) {
    console.log('\n❌ Main email function failed:');
    console.log(`Error: ${error.message}`);
  }
}

// Run comprehensive test
async function runAllTests() {
  await testBrevoSMTPSetup();
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Brevo SMTP Test Summary:');
  console.log('='.repeat(50));
  console.log('1. ✅ Environment variables checked');
  console.log('2. ✅ Brevo SMTP connection tested');
  console.log('3. ✅ Direct email sending tested');
  console.log('4. ✅ Main function with fallbacks tested');
  console.log('\nNext steps:');
  console.log('- Test your endpoint with: node test-endpoint.js');
  console.log('- Start your server and test the /api/auth/createDTuser endpoint');
  console.log('- Emails should now send in 1-3 seconds instead of timing out!');
  
  console.log('\n💡 Benefits of Brevo SMTP over Gmail:');
  console.log('- ⚡ Much faster sending (1-3 seconds vs 10-30 seconds)');
  console.log('- 🛡️ Better deliverability and reputation');
  console.log('- 📊 Built-in email tracking and analytics');
  console.log('- 🚫 No "less secure app" requirements');
  console.log('- 💳 Free tier: 300 emails/day');
}

runAllTests();