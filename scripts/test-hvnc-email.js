/**
 * Test HVNC Email Functionality
 * Run with: node scripts/test-hvnc-email.js
 */

const emailService = require('../services/hvnc-email.service');

async function testHVNCEmail() {
  console.log('🧪 Testing HVNC Email Service...\n');

  // Test data
  const testUser = {
    full_name: 'Dammy Kolaceo',
    email: 'dammykolaceo@gmail.com'
  };

  const testDevice = {
    pc_name: 'CEO',
    device_id: 'HVNC_386792859'
  };

  const testCode = '123456';
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

  try {
    console.log('📧 Sending test HVNC access code email...');
    console.log('   To:', testUser.email);
    console.log('   Device:', testDevice.pc_name);
    console.log('   Code:', testCode);
    console.log('   Expires:', expiresAt.toLocaleString());

    const result = await emailService.sendAccessCode(testUser, testDevice, testCode, expiresAt);
    
    console.log('\n✅ Email sent successfully!');
    console.log('   Service Response:', result ? 'Success' : 'Failed');
    
    console.log('\n📋 Next Steps:');
    console.log('   1. Check your email inbox (may take 1-2 minutes)');
    console.log('   2. Check spam/junk folder if not in inbox');
    console.log('   3. Look for subject: "Your HVNC Access Code for CEO"');
    
    return true;

  } catch (error) {
    console.error('\n❌ Email sending failed:');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   - Check your internet connection');
    console.log('   - Verify Brevo API key in .env file');
    console.log('   - Check email service configuration');
    
    return false;
  }
}

async function testEmailConfig() {
  console.log('\n🔧 Testing Email Configuration...');
  
  try {
    const result = await emailService.testEmailConfig();
    console.log('   Config test result:', result);
    return result.success;
  } catch (error) {
    console.error('   Config test failed:', error.message);
    return false;
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  (async () => {
    try {
      const configOk = await testEmailConfig();
      if (!configOk) {
        console.log('\n⚠️  Email configuration issues detected. Please check your setup.');
        process.exit(1);
      }
      
      const emailSent = await testHVNCEmail();
      process.exit(emailSent ? 0 : 1);
      
    } catch (error) {
      console.error('\n🔥 Test execution failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = { testHVNCEmail, testEmailConfig };