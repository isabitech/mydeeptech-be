#!/usr/bin/env node

/**
 * Test admin email notifications for transfer completion
 */

const PaymentNotificationService = require('../services/mail-service/payment-notification.service');

async function testAdminTransferNotification() {
  try {
    console.log('🧪 Testing admin transfer notification...');
    
    // Test data - replace with real values if needed
    const testTransferData = {
      invoiceNumber: 'INV-2026030008',
      projectName: 'Test Project Transfer',
      amountUSD: 100,
      amountNGN: 150000,
      exchangeRate: 1500,
      paymentReference: 'TXN-TEST-' + Date.now(),
      paymentDate: new Date(),
      recipientName: 'John Doe',
      recipientEmail: 'john@example.com',
      batchId: 'BATCH-TEST-001',
      invoiceStatus: 'paid'
    };
    
    const adminEmail = process.argv[2] || process.env.ADMIN_EMAIL || 'admin@mydeeptech.com';
    const adminName = process.argv[3] || 'Administrator';
    
    console.log(`📧 Sending admin notification to: ${adminEmail}`);
    console.log('📋 Transfer data:', JSON.stringify(testTransferData, null, 2));
    
    await PaymentNotificationService.sendAdminTransferNotification(
      adminEmail,
      adminName,
      testTransferData
    );
    
    console.log('✅ Admin transfer notification sent successfully!');
    console.log('');
    console.log('📋 Check your email inbox for:');
    console.log(`   Subject: 💰 Transfer Completed - Invoice #${testTransferData.invoiceNumber} (₦150,000.00)`);
    console.log(`   To: ${adminEmail}`);
    
  } catch (error) {
    console.error('❌ Admin notification test failed:', error);
    console.log('');
    console.log('📋 Troubleshooting:');
    console.log('1. Check email service configuration');
    console.log('2. Verify SMTP settings');
    console.log('3. Check admin email template exists');
    console.log('4. Verify environment variables');
  }
}

if (require.main === module) {
  testAdminTransferNotification();
}

module.exports = { testAdminTransferNotification };