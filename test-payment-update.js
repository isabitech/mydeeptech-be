const mongoose = require('mongoose');
require('dotenv').config();

async function testPaymentInfoUpdate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const DTUser = require('./models/dtUser.model.js');
    
    // Find a test user (let's use one from our exported data)
    const testUser = await DTUser.findOne({
      annotatorStatus: 'approved',
      email: { $exists: true }
    });
    
    if (!testUser) {
      console.log('❌ No test user found');
      return;
    }
    
    console.log(`📋 Testing with user: ${testUser.email}`);
    console.log(`💳 Current payment info:`, testUser.payment_info);
    
    // Test updating payment info
    const updateData = {
      payment_info: {
        ...testUser.payment_info?.toObject(),
        account_name: "Test Account Name",
        account_number: "1234567890",
        bank_name: "Test Bank",
        payment_method: "bank_transfer",
        payment_currency: "USD"
      }
    };
    
    console.log(`\n🔄 Updating payment info to:`, updateData.payment_info);
    
    const updatedUser = await DTUser.findByIdAndUpdate(
      testUser._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    console.log(`\n✅ Update successful!`);
    console.log(`💳 New payment info:`, updatedUser.payment_info);
    
    // Verify the update worked
    const verifyUser = await DTUser.findById(testUser._id);
    console.log(`\n🔍 Verification check:`, verifyUser.payment_info);
    
  } catch (error) {
    console.error('❌ Error testing payment info update:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

testPaymentInfoUpdate();