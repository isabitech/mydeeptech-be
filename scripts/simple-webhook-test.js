#!/usr/bin/env node

/**
 * Simplified webhook tester that simulates what should happen
 * when a transfer webhook is received for your recent payment
 */

const axios = require('axios');
const crypto = require('crypto');

// Your webhook URL from earlier
const WEBHOOK_URL = 'https://mydeeptech-be-lmrk.onrender.com/api/payments/webhook';
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || 'sk_test_your_key_here';

// Generate proper webhook signature
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha512', secret)
    .update(payload)
    .digest('hex');
}

// Test with the actual invoice reference from your logs
async function testWithRecentInvoice() {
  // From your logs: "Payment initiated for invoice 2026030008"
  const recentInvoiceNumber = '2026030008';
  const transferReference = `TXN-${recentInvoiceNumber}-${Date.now()}`;
  
  console.log('🧪 Testing webhook with recent invoice details:');
  console.log(`📋 Invoice Number: ${recentInvoiceNumber}`);
  console.log(`🔗 Transfer Reference: ${transferReference}`);
  
  const webhookPayload = {
    event: 'transfer.success',
    data: {
      reference: transferReference,
      amount: 150000, // 1500 NGN (your exchange rate) * $100
      status: 'success',
      recipient: {
        name: 'Test Recipient',
        email: 'recipient@example.com'
      },
      created_at: new Date().toISOString(),
      transfer_code: 'TRF_test123',
      currency: 'NGN'
    }
  };
  
  const payloadString = JSON.stringify(webhookPayload);
  const signature = generateSignature(payloadString, PAYSTACK_SECRET);
  
  console.log('📨 Sending transfer success webhook...');
  
  try {
    const response = await axios.post(WEBHOOK_URL, payloadString, {
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': signature,
        'User-Agent': 'Paystack/1.0'
      },
      timeout: 15000
    });
    
    console.log('✅ Webhook processed successfully!');
    console.log('📊 Response:', response.status);
    console.log('📧 Data:', response.data);
    
    return true;
  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
    if (error.response) {
      console.log('📊 Status:', error.response.status);
      console.log('📧 Response:', error.response.data);
    }
    return false;
  }
}

// Check Paystack webhook configuration
function checkPaystackConfig() {
  console.log('🔧 Paystack Webhook Configuration Check:');
  console.log('');
  console.log('📍 Your webhook URL:', WEBHOOK_URL);
  console.log('🔐 Secret Key configured:', PAYSTACK_SECRET ? 'Yes ✅' : 'No ❌');
  console.log('');
  console.log('📋 Required steps in Paystack Dashboard:');
  console.log('1. Go to Settings → Developers → Webhooks');
  console.log('2. Click "Add Endpoint"');
  console.log(`3. URL: ${WEBHOOK_URL}`);
  console.log('4. Events to select:');
  console.log('   ✅ transfer.success');
  console.log('   ✅ transfer.failed');
  console.log('   ✅ transfer.reversed (optional)');
  console.log('5. Save and test the endpoint');
  console.log('');
  console.log('🚨 Important: Make sure the webhook is ACTIVE in your dashboard!');
}

// Check webhook delivery logs in Paystack
function checkWebhookLogs() {
  console.log('🔍 How to check Paystack webhook logs:');
  console.log('');
  console.log('1. Log into your Paystack Dashboard');
  console.log('2. Go to Settings → Developers → Webhooks');
  console.log('3. Click on your webhook URL');
  console.log('4. Check the "Recent Deliveries" section');
  console.log('5. Look for transfer.success events');
  console.log('');
  console.log('❓ Common issues:');
  console.log('• No transfer events = Webhook not configured for transfers');
  console.log('• Failed deliveries = Check URL accessibility');
  console.log('• No recent entries = Paystack not sending webhooks');
}

async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'test':
      await testWithRecentInvoice();
      break;
    case 'config':
      checkPaystackConfig();
      break;
    case 'logs':
      checkWebhookLogs();
      break;
    default:
      console.log('🔍 Webhook Troubleshooter');
      console.log('');
      console.log('Commands:');
      console.log('  test    - Test webhook with recent payment data');
      console.log('  config  - Show Paystack configuration instructions');
      console.log('  logs    - Show how to check Paystack delivery logs');
      console.log('');
      console.log('Usage: node scripts/simple-webhook-test.js <command>');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testWithRecentInvoice, checkPaystackConfig };