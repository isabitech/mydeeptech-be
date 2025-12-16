const mongoose = require('mongoose');
require('dotenv').config();

async function testInvoicePaymentInfo() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const Invoice = require('./models/invoice.model.js');
    const DTUser = require('./models/dtUser.model.js');
    const AnnotationProject = require('./models/annotationProject.model.js');
    
    // Test the getAllInvoices query with payment info
    const invoices = await Invoice.find({ paymentStatus: 'unpaid' })
      .populate('projectId', 'projectName projectCategory')
      .populate('dtUserId', 'fullName email phone payment_info')
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(5);

    console.log(`📊 Found ${invoices.length} unpaid invoices`);
    
    invoices.forEach((invoice, index) => {
      console.log(`\n📋 Invoice ${index + 1}:`);
      console.log(`  ID: ${invoice._id}`);
      console.log(`  Amount: ${invoice.currency} ${invoice.invoiceAmount}`);
      console.log(`  User: ${invoice.dtUserId?.fullName} (${invoice.dtUserId?.email})`);
      console.log(`  Payment Info:`, {
        accountName: invoice.dtUserId?.payment_info?.account_name || 'N/A',
        accountNumber: invoice.dtUserId?.payment_info?.account_number || 'N/A', 
        bankName: invoice.dtUserId?.payment_info?.bank_name || 'N/A',
        paymentMethod: invoice.dtUserId?.payment_info?.payment_method || 'N/A',
        paymentCurrency: invoice.dtUserId?.payment_info?.payment_currency || 'N/A'
      });
    });
    
  } catch (error) {
    console.error('❌ Error testing invoice payment info:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

testInvoicePaymentInfo();