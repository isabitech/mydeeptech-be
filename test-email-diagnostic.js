require('dotenv').config();
const { sendVerificationEmailBrevoSMTP } = require('./utils/brevoSMTP');

async function sendTestWithLogging() {
  console.log('🧪 Sending test email with detailed logging...\n');
  
  const testEmail = 'destabtechng@gmail.com';
  const testName = 'Diagnostic Test User';
  
  console.log(`📧 Sending to: ${testEmail}`);
  console.log(`👤 Name: ${testName}`);
  console.log(`📤 From: ${process.env.BREVO_SENDER_EMAIL}`);
  console.log(`🏷️ Sender Name: ${process.env.BREVO_SENDER_NAME}`);
  console.log(`🌐 SMTP Server: ${process.env.SMTP_SERVER}`);
  console.log(`🔌 SMTP Port: ${process.env.SMTP_PORT}`);
  console.log(`👤 SMTP Login: ${process.env.SMTP_LOGIN}`);
  
  try {
    const startTime = Date.now();
    console.log(`\n⏰ Starting send at: ${new Date().toISOString()}`);
    
    const result = await sendVerificationEmailBrevoSMTP(testEmail, testName);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`\n✅ EMAIL SENT SUCCESSFULLY!`);
    console.log(`⏱️ Duration: ${duration}ms`);
    console.log(`📬 Message ID: ${result.messageId}`);
    console.log(`📊 Provider: ${result.provider}`);
    console.log(`⏰ Completed at: ${new Date().toISOString()}`);
    
    console.log(`\n📋 IMPORTANT - Copy this Message ID for Brevo lookup:`);
    console.log(`🔍 ${result.messageId}`);
    
    console.log(`\n📍 Next Steps:`);
    console.log(`1. Login to https://app.brevo.com/`);
    console.log(`2. Go to Transactional > Statistics or Logs`);
    console.log(`3. Search for the Message ID above`);
    console.log(`4. Check the delivery status`);
    console.log(`5. Look for any bounce/error messages`);
    
    console.log(`\n📧 Email Details to Verify:`);
    console.log(`- Recipient: ${testEmail}`);
    console.log(`- Subject: "Verify Your Email Address - MyDeepTech"`);
    console.log(`- From: "${process.env.BREVO_SENDER_NAME}" <${process.env.BREVO_SENDER_EMAIL}>`);
    
  } catch (error) {
    console.log(`\n❌ EMAIL FAILED!`);
    console.log(`Error: ${error.message}`);
    console.log(`\nThis suggests a configuration issue.`);
  }
}

sendTestWithLogging();