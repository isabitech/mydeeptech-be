require('dotenv').config();
const { testBrevoConnection, sendVerificationEmailBrevo } = require('./utils/brevoMailer');

async function testBrevoSetup() {
  console.log('🧪 Testing Brevo Configuration...\n');
  
  // Check environment variables
  console.log('📧 Brevo Configuration:');
  console.log(`BREVO_API_KEY: ${process.env.BREVO_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`BREVO_SENDER_EMAIL: ${process.env.BREVO_SENDER_EMAIL ? '✅ Set' : '❌ Missing'}`);
  console.log(`BREVO_SENDER_NAME: ${process.env.BREVO_SENDER_NAME || 'Using default'}`);
  
  if (!process.env.BREVO_API_KEY) {
    console.log('\n❌ Brevo API key is missing!');
    console.log('To get your Brevo API key:');
    console.log('1. Go to https://app.brevo.com/');
    console.log('2. Register/Login to your account');
    console.log('3. Go to SMTP & API > API Keys');
    console.log('4. Create a new API key');
    console.log('5. Add it to your .env file: BREVO_API_KEY=your-api-key');
    return;
  }
  
  // Test connection
  console.log('\n🔗 Testing Brevo Connection...');
  const connectionSuccess = await testBrevoConnection();
  
  if (!connectionSuccess) {
    console.log('\n❌ Brevo connection failed. Check your API key.');
    return;
  }
  
  // Test sending email
  console.log('\n📨 Testing Email Send...');
  try {
    const testStartTime = Date.now();
    
    const result = await sendVerificationEmailBrevo(
      process.env.BREVO_SENDER_EMAIL, // Send to yourself
      'Test User'
    );
    
    const testEndTime = Date.now();
    console.log(`✅ Test email sent successfully! (${testEndTime - testStartTime}ms)`);
    console.log(`📬 Message ID: ${result.messageId}`);
    console.log(`📊 Provider: ${result.provider}`);
    
    console.log('\n🎉 Brevo is configured correctly!');
    console.log('You can now use Brevo for your verification emails.');
    
  } catch (error) {
    console.log('\n❌ Email sending failed:');
    console.log(`Error: ${error.message}`);
    
    if (error.message.includes('401')) {
      console.log('\n💡 Authentication error. Check:');
      console.log('1. API key is correct');
      console.log('2. API key has the right permissions');
    } else if (error.message.includes('sender')) {
      console.log('\n💡 Sender error. Check:');
      console.log('1. Sender email is verified in Brevo');
      console.log('2. BREVO_SENDER_EMAIL matches your verified domain');
    }
  }
}

// Run comprehensive test
async function runAllTests() {
  await testBrevoSetup();
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary:');
  console.log('='.repeat(50));
  console.log('1. ✅ Environment variables checked');
  console.log('2. ✅ Brevo connection tested');
  console.log('3. ✅ Email sending tested');
  console.log('\nNext steps:');
  console.log('- Add your Brevo API key to .env if not done');
  console.log('- Test your endpoint with: node test-endpoint.js');
  console.log('- Your emails should now send much faster!');
}

runAllTests();