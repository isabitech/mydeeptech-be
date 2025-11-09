const mongoose = require('mongoose');
const Invoice = require('./models/invoice.model');
const dotenv = require('dotenv');

dotenv.config();

async function testInvoiceQueries() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Test user ID (replace with a real one)
        const testUserId = new mongoose.Types.ObjectId();
        console.log('🔍 Testing with user ID:', testUserId);

        // Test the queries used in dashboard
        console.log('\n1️⃣ Testing Invoice.getInvoiceStats...');
        const stats = await Invoice.getInvoiceStats(testUserId);
        console.log('✅ Stats:', stats);

        console.log('\n2️⃣ Testing basic find query...');
        const invoices = await Invoice.find({ dtUserId: testUserId }).limit(1);
        console.log('✅ Find query works, found:', invoices.length, 'invoices');

        console.log('\n3️⃣ Testing aggregate query...');
        const aggregateResult = await Invoice.aggregate([
            { 
                $match: { 
                    dtUserId: new mongoose.Types.ObjectId(testUserId), 
                    paymentStatus: 'paid'
                }
            },
            {
                $group: {
                    _id: null,
                    totalEarnings: { $sum: '$invoiceAmount' }
                }
            }
        ]);
        console.log('✅ Aggregate query works:', aggregateResult);

        console.log('\n🎉 All queries working!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('📴 Disconnected from MongoDB');
    }
}

testInvoiceQueries();