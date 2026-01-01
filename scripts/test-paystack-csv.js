#!/usr/bin/env node

/**
 * Paystack CSV Generation Test
 * Tests the CSV generation functionality directly
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Invoice = require('../models/invoice.model');
const DTUser = require('../models/dtUser.model');
const AnnotationProject = require('../models/annotationProject.model'); // Add this required model
const { convertUSDToNGN } = require('../utils/exchangeRateService');
const { getBankCode, validatePaymentInfo } = require('../utils/bankCodeMapping');

const testPaystackCSVGeneration = async () => {
  console.log('🧪 Testing Paystack CSV Generation...');
  console.log('📅 Date:', new Date().toISOString());
  console.log('');

  try {
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    console.log('');

    // Get unpaid invoices
    console.log('📊 Fetching unpaid invoices...');
    const unpaidInvoices = await Invoice.find({ 
      paymentStatus: { $in: ['unpaid', 'overdue'] }
    }).populate([
      { path: 'dtUserId', select: 'fullName email personal_info payment_info' },
      { path: 'projectId', select: 'projectName' }
    ]);

    console.log(`✅ Found ${unpaidInvoices.length} unpaid invoices`);
    console.log('');

    if (unpaidInvoices.length === 0) {
      console.log('ℹ️ No unpaid invoices found in the system');
      await mongoose.connection.close();
      return;
    }

    // Test exchange rate API first
    console.log('💱 Testing exchange rate conversion...');
    try {
      const testRate = await convertUSDToNGN(1);
      console.log(`✅ Exchange rate working: $1 USD = ₦${testRate.toFixed(2)} NGN`);
    } catch (rateError) {
      console.error('❌ Exchange rate API failed:', rateError.message);
      await mongoose.connection.close();
      return;
    }
    console.log('');

    const csvRows = [];
    const results = {
      totalInvoices: unpaidInvoices.length,
      nigerianFreelancers: 0,
      totalAmountUSD: 0,
      totalAmountNGN: 0,
      errors: []
    };

    // CSV Header
    csvRows.push([
      'Transfer Amount',
      'Transfer Note (Optional)',
      'Transfer Reference (Optional)', 
      'Recipient Code (This overrides all other details if available)',
      'Bank Code or Slug',
      'Account Number',
      'Account Name (Optional)',
      'Email Address (Optional)'
    ]);

    console.log('🔄 Processing invoices...');

    // Process each invoice
    for (const invoice of unpaidInvoices) {
      try {
        const user = invoice.dtUserId;
        
        console.log(`📝 Processing invoice ${invoice.invoiceNumber} for ${user.email}`);
        
        // Check if user is Nigerian
        const isNigerian = user.personal_info?.country?.toLowerCase() === 'nigeria' ||
                          user.personal_info?.country?.toLowerCase() === 'ng';

        console.log(`   Country: ${user.personal_info?.country || 'Not set'} | Nigerian: ${isNigerian}`);

        if (!isNigerian) {
          console.log(`   ⏭️ Skipping non-Nigerian user`);
          continue;
        }

        // Validate payment info
        const validation = validatePaymentInfo(user.payment_info);
        if (!validation.isValid) {
          console.log(`   ❌ Invalid payment info: ${validation.errors.join(', ')}`);
          results.errors.push({
            userId: user._id,
            userEmail: user.email,
            invoiceNumber: invoice.invoiceNumber,
            error: 'Invalid payment info',
            details: validation.errors.join(', ')
          });
          continue;
        }

        // Convert USD to NGN
        const amountNGN = await convertUSDToNGN(invoice.invoiceAmount);
        console.log(`   💰 Converted $${invoice.invoiceAmount} USD to ₦${amountNGN.toFixed(2)} NGN`);
        
        // Get bank code
        const bankCode = user.payment_info.bank_code || getBankCode(user.payment_info.bank_name);
        console.log(`   🏦 Bank: ${user.payment_info.bank_name} | Code: ${bankCode}`);
        
        if (!bankCode) {
          console.log(`   ❌ Bank code not found`);
          results.errors.push({
            userId: user._id,
            userEmail: user.email,
            invoiceNumber: invoice.invoiceNumber,
            error: 'Bank code not found',
            details: `Unable to map bank: ${user.payment_info.bank_name}`
          });
          continue;
        }

        // Add CSV row
        csvRows.push([
          amountNGN.toFixed(2),
          `${invoice.description || 'Project completion payment'} for ${user.fullName}`,
          invoice.invoiceNumber,
          '', // Leave recipient code empty
          bankCode,
          user.payment_info.account_number,
          user.payment_info.account_name,
          user.email
        ]);

        results.nigerianFreelancers++;
        results.totalAmountUSD += invoice.invoiceAmount;
        results.totalAmountNGN += amountNGN;

        console.log(`   ✅ Added to CSV`);

      } catch (invoiceError) {
        console.error(`   ❌ Failed to process: ${invoiceError.message}`);
        results.errors.push({
          invoiceNumber: invoice.invoiceNumber,
          error: 'Processing failed',
          details: invoiceError.message
        });
      }
    }

    console.log('');
    console.log('📋 CSV Generation Results:');
    console.log(`   Total Invoices: ${results.totalInvoices}`);
    console.log(`   Nigerian Freelancers: ${results.nigerianFreelancers}`);
    console.log(`   Total USD: $${results.totalAmountUSD.toFixed(2)}`);
    console.log(`   Total NGN: ₦${results.totalAmountNGN.toFixed(2)}`);
    console.log(`   Errors: ${results.errors.length}`);
    console.log('');

    if (results.errors.length > 0) {
      console.log('❌ Errors encountered:');
      results.errors.forEach(error => {
        console.log(`   - Invoice ${error.invoiceNumber}: ${error.error} (${error.details})`);
      });
      console.log('');
    }

    if (csvRows.length > 1) { // More than just header
      console.log('📄 Generated CSV Preview (first 3 rows):');
      console.log('');
      csvRows.slice(0, 3).forEach(row => {
        console.log(`   ${row.join(' | ')}`);
      });
      console.log('');

      // Save to file for inspection
      const csvContent = csvRows.map(row => 
        row.map(field => `"${String(field).replace(/"/g, '""')}"`)
          .join(',')
      ).join('\n');

      const fs = require('fs');
      const filename = `paystack-test-${new Date().toISOString().split('T')[0]}.csv`;
      fs.writeFileSync(filename, csvContent);
      console.log(`💾 CSV saved as: ${filename}`);
    } else {
      console.log('ℹ️ No Nigerian freelancers found with valid payment info');
    }

    console.log('');
    console.log('🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Run the test
testPaystackCSVGeneration();