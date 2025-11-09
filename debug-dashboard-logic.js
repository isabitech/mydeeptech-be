const mongoose = require('mongoose');
const Invoice = require('./models/invoice.model');
const DTUser = require('./models/dtUser.model');
const dotenv = require('dotenv');

dotenv.config();

async function testDashboardLogic() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Find a real DTUser to test with
        const user = await DTUser.findOne({});
        if (!user) {
            console.log('❌ No DTUser found in database');
            return;
        }

        const userId = user._id;
        console.log('🔍 Testing with real user ID:', userId);
        console.log('👤 User:', user.fullName, '(' + user.email + ')');

        // Test each part of the dashboard function
        console.log('\n1️⃣ Testing Invoice.getInvoiceStats...');
        const stats = await Invoice.getInvoiceStats(userId);
        console.log('✅ Stats:', stats);

        console.log('\n2️⃣ Testing recent invoices query...');
        const recentInvoices = await Invoice.find({ dtUserId: userId })
            .sort({ createdAt: -1 })
            .limit(5);
        console.log('✅ Recent invoices found:', recentInvoices.length);

        console.log('\n3️⃣ Testing overdue invoices query...');
        const overdueInvoices = await Invoice.find({ 
            dtUserId: userId, 
            paymentStatus: 'overdue' 
        }).sort({ dueDate: 1 });
        console.log('✅ Overdue invoices found:', overdueInvoices.length);

        console.log('\n4️⃣ Testing monthly earnings aggregate...');
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyEarnings = await Invoice.aggregate([
            {
                $match: {
                    dtUserId: new mongoose.Types.ObjectId(userId),
                    paymentStatus: 'paid',
                    paidAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$paidAt' },
                        month: { $month: '$paidAt' }
                    },
                    totalEarnings: { $sum: '$invoiceAmount' },
                    invoiceCount: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);
        console.log('✅ Monthly earnings:', monthlyEarnings);

        console.log('\n🎉 All dashboard queries working! Issue must be elsewhere.');

    } catch (error) {
        console.error('❌ Error in dashboard logic:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('📴 Disconnected from MongoDB');
    }
}

testDashboardLogic();