const mongoose = require('mongoose');
const Invoice = require('./models/invoice.model');

async function testInvoiceModel() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/mydeeptech');
        console.log('✅ Connected to MongoDB');

        // Test creating an invoice without invoiceNumber
        const testInvoice = new Invoice({
            projectId: new mongoose.Types.ObjectId(),
            dtUserId: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId(),
            invoiceAmount: 2500,
            currency: 'USD',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            description: 'Test invoice creation'
        });

        console.log('📋 Invoice before save:', {
            invoiceNumber: testInvoice.invoiceNumber,
            invoiceAmount: testInvoice.invoiceAmount
        });

        await testInvoice.save();
        
        console.log('✅ Invoice saved successfully!');
        console.log('📋 Invoice after save:', {
            _id: testInvoice._id,
            invoiceNumber: testInvoice.invoiceNumber,
            invoiceAmount: testInvoice.invoiceAmount,
            formattedInvoiceNumber: testInvoice.formattedInvoiceNumber
        });

        // Clean up - delete the test invoice
        await Invoice.findByIdAndDelete(testInvoice._id);
        console.log('🗑️ Test invoice cleaned up');

    } catch (error) {
        console.error('❌ Error testing invoice model:', error);
        console.error('Error details:', error.message);
        if (error.errors) {
            console.error('Validation errors:');
            Object.keys(error.errors).forEach(key => {
                console.error(`  ${key}: ${error.errors[key].message}`);
            });
        }
    } finally {
        await mongoose.disconnect();
        console.log('📴 Disconnected from MongoDB');
    }
}

testInvoiceModel();