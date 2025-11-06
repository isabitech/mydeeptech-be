require('dotenv').config();

async function checkEmailConfig() {
  console.log('🔍 Checking Email Configuration...\n');
  
  // Check environment variables
  console.log('📧 Email Configuration:');
  console.log(`EMAIL_USER: ${process.env.EMAIL_USER ? '✅ Set' : '❌ Missing'}`);
  console.log(`EMAIL_PASS: ${process.env.EMAIL_PASS ? '✅ Set' : '❌ Missing'}`);
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('\n❌ Email credentials are missing!');
    console.log('Make sure your .env file contains:');
    console.log('EMAIL_USER=your-gmail@gmail.com');
    console.log('EMAIL_PASS=your-app-password');
    return;
  }
  
  // Test email connection
  console.log('\n🔗 Testing Email Connection...');
  
  try {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 15000,
    });
    
    // Verify connection
    const startTime = Date.now();
    await transporter.verify();
    const endTime = Date.now();
    
    console.log(`✅ Email connection successful! (${endTime - startTime}ms)`);
    
    // Test sending email
    console.log('\n📨 Testing Email Send...');
    const testStartTime = Date.now();
    
    const info = await transporter.sendMail({
      from: `"Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: 'Test Email - Connection Check',
      html: '<h2>Test Email</h2><p>If you receive this, your email configuration is working!</p>'
    });
    
    const testEndTime = Date.now();
    console.log(`✅ Test email sent successfully! (${testEndTime - testStartTime}ms)`);
    console.log(`📬 Message ID: ${info.messageId}`);
    
  } catch (error) {
    console.log('❌ Email connection failed:');
    console.log(`Error: ${error.message}`);
    
    if (error.code === 'EAUTH') {
      console.log('\n💡 Authentication failed. Check:');
      console.log('1. Gmail account credentials are correct');
      console.log('2. You\'re using an App Password (not your regular password)');
      console.log('3. 2-Factor Authentication is enabled');
      console.log('4. "Less secure app access" is enabled (if not using App Password)');
    }
  }
}

checkEmailConfig();