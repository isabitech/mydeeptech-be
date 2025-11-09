// Load environment variables
require('dotenv').config();

const { testBrevoSMTPConnection } = require('./utils/brevoSMTP');

/**
 * Test Brevo SMTP Connection
 */
const testConnection = async () => {
    console.log('🔌 Testing Brevo SMTP Connection...\n');
    
    console.log('📋 SMTP Configuration:');
    console.log(`   Server: ${process.env.SMTP_SERVER}`);
    console.log(`   Port: ${process.env.SMTP_PORT}`);
    console.log(`   Login: ${process.env.SMTP_LOGIN}`);
    console.log(`   Key: ${process.env.SMTP_KEY ? '***' + process.env.SMTP_KEY.slice(-4) : 'NOT SET'}`);
    console.log(`   Sender: ${process.env.BREVO_SENDER_EMAIL}\n`);
    
    try {
        const isConnected = await testBrevoSMTPConnection();
        if (isConnected) {
            console.log('🎉 Brevo SMTP connection test successful!');
            console.log('✅ Email service is ready for production use');
        } else {
            console.log('❌ Brevo SMTP connection test failed');
        }
    } catch (error) {
        console.error('❌ Connection test error:', error.message);
    }
};

console.log('🔧 Brevo SMTP Connection Test');
console.log('============================');
testConnection();