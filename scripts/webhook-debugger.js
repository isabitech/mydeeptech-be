#!/usr/bin/env node

/**
 * Debug script to check webhook logs and test webhook connectivity
 * This will help identify why emails aren't being sent after successful payments
 */

const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const envConfig = require('../config/envConfig');

// Define connectDB locally instead of importing
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(envConfig.mongo.MONGO_URI, {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    return false;
  }
};

const Invoice = require('../models/invoice.model');
// Load required models for populate to work
require('../models/dtUser.model');
require('../models/project.model');

class WebhookDebugger {
  constructor() {
    this.webhookUrl = 'https://mydeeptech-be-lmrk.onrender.com/api/payments/webhook';
  }

  // Test if webhook endpoint is reachable
  async testWebhookConnectivity() {
    console.log('🔍 Testing webhook connectivity...');
    console.log('📍 URL:', this.webhookUrl);
    
    try {
      // Test basic connectivity (this should return 400 - missing signature)
      const response = await axios.post(this.webhookUrl, {
        event: 'test',
        data: { test: true }
      }, {
        timeout: 10000,
        validateStatus: (status) => status < 500 // Accept 4xx responses
      });
      
      console.log('✅ Webhook endpoint reachable');
      console.log('📊 Response status:', response.status);
      console.log('📧 Response:', response.data);
      
      return true;
    } catch (error) {
      console.error('❌ Webhook connectivity failed:', error.message);
      if (error.response) {
        console.log('📊 Status:', error.response.status);
        console.log('📧 Response:', error.response.data);
      }
      return false;
    }
  }

  // Generate a proper webhook signature
  generateSignature(payload, secret) {
    return crypto
      .createHmac('sha512', secret)
      .update(payload)
      .digest('hex');
  }

  // Send a test transfer success webhook
  async sendTestTransferWebhook(testReference = null) {
    console.log('🧪 Sending test transfer success webhook...');
    
    const reference = testReference || `TEST-${Date.now()}`;
    
    const webhookPayload = {
      event: 'transfer.success',
      data: {
        reference: reference,
        amount: 165000, // 1650 NGN
        status: 'success',
        recipient: {
          name: 'Test User',
          email: 'test@example.com'
        },
        created_at: new Date().toISOString()
      }
    };
    
    const payloadString = JSON.stringify(webhookPayload);
    const signature = this.generateSignature(payloadString, envConfig.paystack.PAYSTACK_SECRET_KEY);
    
    console.log('📋 Test payload:', webhookPayload);
    console.log('🔐 Signature:', signature);
    
    try {
      const response = await axios.post(this.webhookUrl, payloadString, {
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': signature
        },
        timeout: 15000
      });
      
      console.log('✅ Test webhook sent successfully');
      console.log('📊 Response status:', response.status);
      console.log('📧 Response:', response.data);
      
      return true;
    } catch (error) {
      console.error('❌ Test webhook failed:', error.message);
      if (error.response) {
        console.log('📊 Status:', error.response.status);
        console.log('📧 Response:', error.response.data);
      }
      return false;
    }
  }

  // Find recent payment-initiated invoices
  async findRecentPaymentInitiatedInvoices() {
    try {
      await connectDB();
      
      console.log('🔍 Looking for recent payment_initiated invoices...');
      
      const recentInvoices = await Invoice.find({
        paymentStatus: 'payment_initiated',
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }).populate([
        { path: 'dtUserId', select: 'fullName email' },
        { path: 'projectId', select: 'projectName' }
      ]).sort({ createdAt: -1 }).limit(10);
      
      if (recentInvoices.length === 0) {
        console.log('📋 No recent payment_initiated invoices found');
        return [];
      }
      
      console.log(`📋 Found ${recentInvoices.length} recent payment_initiated invoices:`);
      
      recentInvoices.forEach((invoice, index) => {
        console.log(`${index + 1}. ${invoice.invoiceNumber}`);
        console.log(`   - Status: ${invoice.paymentStatus}`);
        console.log(`   - User: ${invoice.dtUserId?.fullName} (${invoice.dtUserId?.email})`);
        console.log(`   - Transfer Reference: ${invoice.paymentMetadata?.transferReference || 'N/A'}`);
        console.log(`   - Batch ID: ${invoice.paymentMetadata?.batchId || 'N/A'}`);
        console.log('');
      });
      
      return recentInvoices;
    } catch (error) {
      console.error('❌ Error finding invoices:', error);
      return [];
    }
  }

  // Test webhook with real invoice transfer reference
  async testWithRealInvoice() {
    const invoices = await this.findRecentPaymentInitiatedInvoices();
    
    if (invoices.length === 0) {
      console.log('❌ No payment_initiated invoices to test with');
      return false;
    }
    
    const invoice = invoices[0];
    const transferReference = invoice.paymentMetadata?.transferReference;
    
    if (!transferReference) {
      console.log('❌ No transfer reference found for latest invoice');
      return false;
    }
    
    console.log(`🎯 Testing webhook with real transfer reference: ${transferReference}`);
    console.log(`📋 Invoice: ${invoice.invoiceNumber}`);
    
    return await this.sendTestTransferWebhook(transferReference);
  }

  // Check webhook configuration
  checkWebhookConfig() {
    console.log('\n🔧 Webhook Configuration Check:');
    console.log('📍 Webhook URL:', this.webhookUrl);
    console.log('🔐 Paystack Secret Key:', envConfig.paystack.PAYSTACK_SECRET_KEY ? 'Configured ✅' : 'Missing ❌');
    console.log('📧 Email Service:', envConfig.email ? 'Configured ✅' : 'Check config ⚠️');
    
    console.log('\n📋 Required Paystack Dashboard Settings:');
    console.log('1. Go to Settings > Developers > Webhooks');
    console.log('2. Add webhook URL:', this.webhookUrl);
    console.log('3. Select events: transfer.success, transfer.failed');
    console.log('4. Save and test');
  }
}

// Command line interface
async function main() {
  const webhookDebug = new WebhookDebugger();
  const command = process.argv[2];

  console.log('🐛 Webhook Debugger\n');

  switch (command) {
    case 'config':
      webhookDebug.checkWebhookConfig();
      break;
      
    case 'connectivity':
      await webhookDebug.testWebhookConnectivity();
      break;
      
    case 'test-webhook':
      await webhookDebug.sendTestTransferWebhook();
      break;
      
    case 'find-invoices':
      await webhookDebug.findRecentPaymentInitiatedInvoices();
      break;
      
    case 'test-real':
      await webhookDebug.testWithRealInvoice();
      break;
      
    case 'full-debug':
      console.log('🔍 Running full debug suite...\n');
      webhookDebug.checkWebhookConfig();
      console.log('\n' + '='.repeat(50) + '\n');
      await webhookDebug.testWebhookConnectivity();
      console.log('\n' + '='.repeat(50) + '\n');
      await webhookDebug.findRecentPaymentInitiatedInvoices();
      console.log('\n' + '='.repeat(50) + '\n');
      await webhookDebug.testWithRealInvoice();
      break;
      
    default:
      console.log('Available commands:');
      console.log('  config          - Check webhook configuration');
      console.log('  connectivity    - Test webhook endpoint connectivity');
      console.log('  test-webhook    - Send test transfer success webhook');
      console.log('  find-invoices   - Find recent payment_initiated invoices');
      console.log('  test-real       - Test webhook with real invoice reference');
      console.log('  full-debug      - Run all debug tests');
      console.log('\nUsage: node scripts/webhook-debugger.js <command>');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = WebhookDebugger;