const mongoose = require('mongoose');
const Invoice = require('./models/invoice.model');
require('dotenv').config();

async function deletePaidInvoices() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    
    console.log('✅ Connected to MongoDB');
    
    // First, count how many paid invoices exist
    console.log('🔍 Counting paid invoices...');
    const paidInvoicesCount = await Invoice.countDocuments({ paymentStatus: 'paid' });
    console.log(`📊 Found ${paidInvoicesCount} paid invoices`);
    
    if (paidInvoicesCount === 0) {
      console.log('ℹ️ No paid invoices found. Nothing to delete.');
      return;
    }
    
    // Get details of paid invoices before deletion (for backup info)
    console.log('📋 Getting paid invoices details...');
    const paidInvoices = await Invoice.find({ paymentStatus: 'paid' })
      .select('invoiceNumber invoiceAmount currency dtUserId projectId paidAt createdAt');
    
    console.log('💰 Paid invoices to be deleted:');
    paidInvoices.forEach(invoice => {
      console.log(`  - Invoice ${invoice.invoiceNumber}: ${invoice.currency} ${invoice.invoiceAmount} (User ID: ${invoice.dtUserId}) - Project ID: ${invoice.projectId}`);
    });
    
    // Calculate total amount that will be deleted
    const totalAmount = paidInvoices.reduce((sum, invoice) => sum + invoice.invoiceAmount, 0);
    console.log(`💸 Total amount in paid invoices: ${totalAmount} (mixed currencies)`);
    
    // Confirm before deletion
    console.log('\n⚠️ WARNING: This will permanently delete all paid invoices!');
    console.log('🚨 Make sure you have backed up your data before proceeding!');
    
    // Perform the deletion
    console.log('🗑️ Deleting paid invoices...');
    const deleteResult = await Invoice.deleteMany({ paymentStatus: 'paid' });
    
    console.log(`✅ Successfully deleted ${deleteResult.deletedCount} paid invoices`);
    console.log('🎉 Cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error deleting paid invoices:', error);
  } finally {
    console.log('🔌 Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

// Add safety check for production
if (process.argv.includes('--confirm')) {
  deletePaidInvoices();
} else {
  console.log('⚠️ SAFETY CHECK: This script will delete ALL paid invoices permanently!');
  console.log('📋 To confirm deletion, run: node delete-paid-invoices.js --confirm');
  console.log('💡 Make sure to backup your database first!');
  process.exit(0);
}