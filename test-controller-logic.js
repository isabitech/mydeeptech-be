const mongoose = require('mongoose');
require('dotenv').config();

async function testControllerLogic() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const DTUser = require('./models/dtUser.model.js');
    
    // Find a test user
    const user = await DTUser.findOne({
      annotatorStatus: 'approved',
      email: { $exists: true }
    });
    
    if (!user) {
      console.log('❌ No test user found');
      return;
    }
    
    console.log(`📋 Testing with user: ${user.email}`);
    console.log(`💳 Current payment info:`, user.payment_info);
    
    // Simulate the request body format that comes from frontend
    const req = {
      body: {
        paymentInfo: {
          accountName: "Frontend Test Account",
          accountNumber: "9876543210", 
          bankName: "Frontend Test Bank",
          paymentMethod: "bank_transfer",
          paymentCurrency: "NGN"
        }
      }
    };
    
    console.log(`\n📝 Request body:`, req.body);
    
    // Replicate the controller logic exactly
    const updateData = {};
    
    if (req.body.paymentInfo) {
      updateData.payment_info = {
        ...user.payment_info?.toObject(),
        account_name: req.body.paymentInfo.accountName !== undefined ? req.body.paymentInfo.accountName : user.payment_info?.account_name,
        account_number: req.body.paymentInfo.accountNumber !== undefined ? req.body.paymentInfo.accountNumber : user.payment_info?.account_number,
        bank_name: req.body.paymentInfo.bankName !== undefined ? req.body.paymentInfo.bankName : user.payment_info?.bank_name,
        payment_method: req.body.paymentInfo.paymentMethod !== undefined ? req.body.paymentInfo.paymentMethod : user.payment_info?.payment_method,
        payment_currency: req.body.paymentInfo.paymentCurrency !== undefined ? req.body.paymentInfo.paymentCurrency : user.payment_info?.payment_currency
      };
    }
    
    console.log(`\n🔄 Update data being sent:`, updateData);
    
    // Perform the update
    const updatedUser = await DTUser.findByIdAndUpdate(
      user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    console.log(`\n✅ Update successful!`);
    console.log(`💳 New payment info:`, updatedUser.payment_info);
    
  } catch (error) {
    console.error('❌ Error testing controller logic:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

testControllerLogic();