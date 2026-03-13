const mongoose = require('mongoose');
const brevo = require('@getbrevo/brevo');
require('dotenv').config();

/**
 * Test script to verify webinar email template and Brevo configuration
 * before sending to all users
 */

// Initialize Brevo API client
const apiInstance = new brevo.TransactionalEmailsApi();
if (process.env.BREVO_API_KEY) {
  apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
}

// Import the webinar email function from the main script
const { sendWebinarEmail } = require('./send-webinar-announcements');

const testWebinarEmail = async () => {
  try {
    console.log('🧪 Testing Webinar Email Configuration');
    console.log('═'.repeat(50));

    // Check environment variables
    console.log('🔍 Checking environment configuration...');
    
    const requiredVars = [
      'BREVO_API_KEY',
      'MONGO_URI'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('❌ Missing environment variables:', missingVars.join(', '));
      process.exit(1);
    }

    console.log('✅ All required environment variables are present');
    
    // Test email configuration
    console.log('\n📧 Testing email configuration...');
    console.log(`   API Key: ${process.env.BREVO_API_KEY.substring(0, 10)}...`);
    console.log('   Sender: events@mydeeptech.ng (MyDeepTech Events)');

    // Prompt for test email
    console.log('\n🎯 TEST EMAIL SETUP');
    console.log('Enter a test email address to receive the webinar announcement:');
    console.log('(This should be YOUR email address to verify the template)');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const testEmail = await new Promise(resolve => {
      rl.question('✉️  Test email address: ', resolve);
    });

    const testName = await new Promise(resolve => {
      rl.question('👤 Test recipient name (optional): ', resolve);
    });

    rl.close();

    if (!testEmail || !testEmail.includes('@')) {
      console.error('❌ Invalid email address provided');
      process.exit(1);
    }

    console.log('\n📤 Sending test email...');
    console.log(`   To: ${testEmail}`);
    console.log(`   Name: ${testName || 'Tech Enthusiast'}`);

    // Send test email
    const result = await sendWebinarEmail(testEmail, testName || 'Test User');

    if (result.success) {
      console.log('\n✅ TEST EMAIL SENT SUCCESSFULLY!');
      console.log(`   Message ID: ${result.messageId}`);
      console.log('\n📋 Next Steps:');
      console.log('   1. Check your email inbox (and spam folder)');
      console.log('   2. Verify the email template looks good');
      console.log('   3. Test the registration link');
      console.log('   4. If everything looks good, run the main script:');
      console.log('      node scripts/send-webinar-announcements.js');
    } else {
      console.error('\n❌ TEST EMAIL FAILED');
      console.error(`   Error: ${result.error}`);
      console.log('\n🔧 Troubleshooting:');
      console.log('   1. Check your BREVO_API_KEY is valid');
      console.log('   2. Verify your Brevo account is active');
      console.log('   3. Check if events@mydeeptech.ng is configured in Brevo');
    }

  } catch (error) {
    console.error('\n💥 Test failed with error:', error.message);
    console.log('\n🔧 Common issues:');
    console.log('   1. Invalid BREVO_API_KEY');
    console.log('   2. Sender email not verified in Brevo');
    console.log('   3. Network connectivity issues');
  }
};

// Additional function to preview the HTML template
const previewEmailTemplate = () => {
  const { createWebinarEmailHTML } = require('./send-webinar-announcements');
  const fs = require('fs');
  const path = require('path');

  console.log('📖 Creating email template preview...');
  
  // Create preview HTML file
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Webinar Email Preview</title>
</head>
<body>
  <div style="background: #f4f4f4; padding: 20px;">
    <h1 style="text-align: center; color: #333;">EMAIL TEMPLATE PREVIEW</h1>
    <div style="background: white; margin: 20px 0; border-radius: 10px;">
      ${createWebinarEmailHTML('Test User')}
    </div>
  </div>
</body>
</html>`;

  const previewPath = path.join(__dirname, '..', 'exports', 'webinar-email-preview.html');
  fs.writeFileSync(previewPath, html);
  
  console.log(`✅ Preview saved to: ${previewPath}`);
  console.log('🌐 Open this file in your browser to preview the email template');
};

// Main test function
const runTests = async () => {
  console.log('🧪 MyDeepTech Webinar Email Test Suite');
  console.log('═'.repeat(50));
  
  const args = process.argv.slice(2);
  
  if (args.includes('--preview')) {
    previewEmailTemplate();
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Available commands:');
    console.log('  node scripts/test-webinar-email.js           # Send test email');
    console.log('  node scripts/test-webinar-email.js --preview # Generate HTML preview');
    console.log('  node scripts/test-webinar-email.js --help    # Show this help');
    return;
  }

  await testWebinarEmail();
};

// Run the test
if (require.main === module) {
  runTests();
}

module.exports = { testWebinarEmail, previewEmailTemplate };