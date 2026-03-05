#!/usr/bin/env node

/**
 * Manual test script to simulate webhook and test email notifications
 * Use this to test if email notifications work when webhook events are received
 */

const PaymentNotificationService = require('../services/mail-service/payment-notification.service');
const Invoice = require('../models/invoice.model');
const { connectDB } = require('../config/database');
const envConfig = require('../config/envConfig');

async function testEmailNotification() {
  try {
    await connectDB();
    
    console.log('🧪 Testing email notification system...');
    
    // Test data - replace with real invoice data if needed
    const testPaymentData = {
      invoiceNumber: 'INV-TEST-001',
      projectName: 'Test Project',
      amountUSD: 100,
      amountNGN: 165000,
      exchangeRate: 1650,
      paymentReference: 'TEST-REF-' + Date.now(),
      paymentDate: new Date(),
      batchId: 'TEST-BATCH-001'
    };
    
    const testEmail = process.argv[2] || 'test@example.com';
    const testName = process.argv[3] || 'Test User';
    
    console.log(`📧 Sending test email to: ${testEmail}`);
    console.log('📋 Payment data:', testPaymentData);
    
    await PaymentNotificationService.sendPaymentConfirmation(
      testEmail,
      testName,
      testPaymentData
    );
    
    console.log('✅ Test email sent successfully!');
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
    console.log('\n📋 Troubleshooting:');
    console.log('1. Check email service configuration');
    console.log('2. Verify SMTP settings in envConfig');
    console.log('3. Check if email template exists');
  }
}

async function simulateTransferWebhook(invoiceId) {
  try {
    await connectDB();
    
    console.log('🧪 Simulating transfer webhook...');
    
    // Find the invoice
    const invoice = await Invoice.findById(invoiceId).populate([
      { path: 'dtUserId', select: 'fullName email' },
      { path: 'projectId', select: 'projectName' }
    ]);
    
    if (!invoice) {
      console.error('❌ Invoice not found:', invoiceId);
      return;
    }
    
    console.log('📋 Found invoice:', invoice.invoiceNumber);
    
    // Simulate successful transfer
    const transferData = {
      reference: `TEST-${Date.now()}`,
      amount: invoice.paymentMetadata?.ngnAmount || invoice.invoiceAmount * 1650,
      recipient: {
        name: invoice.dtUserId?.fullName
      }
    };
    
    // Mock the webhook handler
    await invoice.markAsPaid({
      paymentMethod: 'bulk_transfer',
      paymentReference: transferData.reference,
      paymentNotes: 'Test payment via simulated webhook'
    });
    
    console.log('✅ Invoice marked as paid');
    
    // Send email notification
    if (invoice.dtUserId?.email) {
      const paymentData = {
        invoiceNumber: invoice.invoiceNumber,
        projectName: invoice.projectId?.projectName || 'Test Project',
        amountUSD: invoice.invoiceAmount,
        amountNGN: invoice.paymentMetadata?.ngnAmount || invoice.invoiceAmount * 1650,
        exchangeRate: invoice.paymentMetadata?.exchangeRate || 1650,
        paymentReference: transferData.reference,
        paymentDate: new Date(),
        batchId: invoice.paymentMetadata?.batchId || 'TEST-BATCH'
      };
      
      await PaymentNotificationService.sendPaymentConfirmation(
        invoice.dtUserId.email,
        invoice.dtUserId.fullName,
        paymentData
      );
      
      console.log('✅ Payment confirmation email sent');
    }
    
  } catch (error) {
    console.error('❌ Webhook simulation failed:', error);
  }
}

// Parse command line arguments
const command = process.argv[2];

if (command === 'test-email') {
  const email = process.argv[3];
  const name = process.argv[4];
  testEmailNotification(email, name);
} else if (command === 'simulate-webhook') {
  const invoiceId = process.argv[3];
  if (!invoiceId) {
    console.error('❌ Usage: node test-email-notifications.js simulate-webhook <invoiceId>');
    process.exit(1);
  }
  simulateTransferWebhook(invoiceId);
} else {
  console.log('📧 Email Notification Test Commands:');
  console.log('');
  console.log('Test email sending:');
  console.log('  node scripts/test-email-notifications.js test-email user@example.com "John Doe"');
  console.log('');
  console.log('Simulate webhook for specific invoice:');
  console.log('  node scripts/test-email-notifications.js simulate-webhook <invoiceId>');
  process.exit(0);
}