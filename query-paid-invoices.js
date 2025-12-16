const mongoose = require('mongoose');
const Invoice = require('./models/invoice.model');
require('dotenv').config();

async function queryPaidInvoices() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const paidInvoices = await Invoice.find({ paymentStatus: 'paid' })
      .populate('dtUserId', 'fullName email')
      .populate('projectId', 'projectName')
      .sort({ paidAt: -1 });
    
    console.log(`📊 Found ${paidInvoices.length} paid invoices:\n`);
    
    paidInvoices.forEach((invoice, index) => {
      console.log(`${index + 1}. Invoice: ${invoice.invoiceNumber}`);
      console.log(`   Amount: ${invoice.currency} ${invoice.invoiceAmount}`);
      console.log(`   User: ${invoice.dtUserId?.fullName || 'Unknown'} (${invoice.dtUserId?.email || 'No email'})`);
      console.log(`   Project: ${invoice.projectId?.projectName || 'Unknown'}`);
      console.log(`   Paid At: ${invoice.paidAt || 'Unknown'}`);
      console.log(`   Payment Method: ${invoice.paymentMethod || 'Not specified'}\n`);
    });
    
  } catch (error) {
    console.error('❌ Error querying invoices:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

queryPaidInvoices();