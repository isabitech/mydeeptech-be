const mongoose = require('mongoose');
const Invoice = require('./models/invoice.model');
const dotenv = require('dotenv');

dotenv.config();

async function testInvoiceDirectly() {
    try {
        // Connect to MongoDB using the same URI as the app
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB Atlas');

        // Test creating an invoice without invoiceNumber
        console.log('\n📋 Creating test invoice...');
        const testInvoice = new Invoice({
            projectId: new mongoose.Types.ObjectId(),
            dtUserId: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId(),
            invoiceAmount: 2500,
            currency: 'USD',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            description: 'Test invoice creation',
            invoiceType: 'project_completion'
        });

        console.log('📋 Invoice before save:');
        console.log('  - invoiceNumber:', testInvoice.invoiceNumber);
        console.log('  - invoiceAmount:', testInvoice.invoiceAmount);
        console.log('  - isNew:', testInvoice.isNew);

        // Save the invoice
        const savedInvoice = await testInvoice.save();
        
        console.log('\n✅ Invoice saved successfully!');
        console.log('📋 Invoice after save:');
        console.log('  - _id:', savedInvoice._id);
        console.log('  - invoiceNumber:', savedInvoice.invoiceNumber);
        console.log('  - formattedInvoiceNumber:', savedInvoice.formattedInvoiceNumber);
        console.log('  - invoiceAmount:', savedInvoice.invoiceAmount);
        console.log('  - createdAt:', savedInvoice.createdAt);

        // Clean up - delete the test invoice
        await Invoice.findByIdAndDelete(savedInvoice._id);
        console.log('\n🗑️ Test invoice cleaned up');

        console.log('\n🎉 Pre-save middleware is working correctly!');

    } catch (error) {
        console.error('\n❌ Error testing invoice model:');
        console.error('  Message:', error.message);
        
        if (error.errors) {
            console.error('  Validation errors:');
            Object.keys(error.errors).forEach(key => {
                console.error(`    ${key}: ${error.errors[key].message}`);
            });
        }
        
        if (error.code) {
            console.error('  Error code:', error.code);
        }
    } finally {
        await mongoose.disconnect();
        console.log('\n📴 Disconnected from MongoDB');
    }
}

testInvoiceDirectly();