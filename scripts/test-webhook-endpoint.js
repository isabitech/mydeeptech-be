#!/usr/bin/env node

/**
 * Test script to verify webhook endpoint is accessible
 * Run this to ensure your webhook URL is reachable by Paystack
 */

const axios = require('axios');
const envConfig = require('../config/envConfig');

async function testWebhookEndpoint() {
  try {
    const webhookUrl = `${envConfig.app.BASE_URL || 'http://localhost:5000'}/api/payments/webhook`;
    
    console.log('🔍 Testing webhook endpoint...');
    console.log('📍 URL:', webhookUrl);
    
    // Test if endpoint responds to OPTIONS (for CORS)
    try {
      const optionsResponse = await axios.options(webhookUrl);
      console.log('✅ OPTIONS request successful:', optionsResponse.status);
    } catch (err) {
      console.log('⚠️ OPTIONS request failed (this might be normal):', err.response?.status);
    }
    
    // Test basic POST (without signature - should fail with 400 but endpoint should be reachable)
    try {
      const postResponse = await axios.post(webhookUrl, {
        event: 'test',
        data: { test: true }
      });
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('✅ Endpoint reachable - returned 400 as expected (missing signature)');
        console.log('🎯 Webhook endpoint is working correctly!');
        return true;
      } else {
        console.log('❌ Unexpected response:', err.response?.status, err.message);
        return false;
      }
    }
    
  } catch (error) {
    console.error('❌ Webhook endpoint test failed:', error.message);
    console.log('\n📋 Troubleshooting:');
    console.log('1. Ensure your server is running');
    console.log('2. Check if BASE_URL is correctly set');
    console.log('3. Verify firewall/network settings');
    console.log('4. For local development, use ngrok or similar service');
    return false;
  }
}

// Add webhook configuration checker
function checkWebhookConfig() {
  console.log('\n🔧 Webhook Configuration:');
  console.log('📍 Base URL:', envConfig.app.BASE_URL || 'Not set (using localhost)');
  console.log('🔐 Paystack Secret:', envConfig.paystack.PAYSTACK_SECRET_KEY ? 'Set ✅' : 'Missing ❌');
  console.log('📧 Email Service:', envConfig.email ? 'Configured ✅' : 'Check config ⚠️');
  
  const webhookUrl = `${envConfig.app.BASE_URL || 'http://localhost:5000'}/api/payments/webhook`;
  console.log('\n📋 Add this URL to your Paystack Dashboard > Settings > Webhooks:');
  console.log(`🔗 ${webhookUrl}`);
  
  console.log('\n📤 Required Webhook Events:');
  console.log('✅ transfer.success');
  console.log('✅ transfer.failed');
  console.log('✅ charge.success (optional)');
}

if (require.main === module) {
  checkWebhookConfig();
  testWebhookEndpoint().then((success) => {
    if (success) {
      console.log('\n🎉 All checks passed! Remember to configure the webhook URL in Paystack Dashboard.');
    } else {
      console.log('\n❌ Webhook endpoint has issues. Please fix before configuring in Paystack.');
    }
  });
}

module.exports = { testWebhookEndpoint, checkWebhookConfig };