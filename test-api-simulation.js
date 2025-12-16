const mongoose = require('mongoose');
require('dotenv').config();
const jwt = require('jsonwebtoken');

// Simulate the complete API flow
async function simulateAPICall() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const DTUser = require('./models/dtUser.model.js');
    
    // Find a verified test user
    const user = await DTUser.findOne({
      annotatorStatus: { $in: ['verified', 'approved'] },
      email: { $exists: true }
    });
    
    if (!user) {
      console.log('❌ No verified test user found');
      return;
    }
    
    console.log(`📋 Testing with user: ${user.email}`);
    console.log(`📊 User status: ${user.annotatorStatus}`);
    console.log(`💳 Current payment info:`, user.payment_info);
    
    // Simulate the complete request object structure
    const mockReq = {
      params: {
        userId: user._id.toString()
      },
      user: {
        userId: user._id.toString(),
        email: user.email
      },
      body: {
        paymentInfo: {
          accountName: "API Test Account Name",
          accountNumber: "1234567890",
          bankName: "API Test Bank",
          paymentMethod: "bank_transfer",
          paymentCurrency: "USD"
        }
      }
    };
    
    console.log(`\n📝 Mock request:`, {
      params: mockReq.params,
      user: mockReq.user,
      body: mockReq.body
    });
    
    // Import and test the validation schema directly
    const { dtUserProfileUpdateSchema } = require('./utils/authValidator.js');
    
    console.log(`\n🔍 Validating request body...`);
    const { error } = dtUserProfileUpdateSchema.validate(mockReq.body);
    if (error) {
      console.log(`❌ Validation error:`, error.details[0].message);
      return;
    }
    console.log(`✅ Validation passed`);
    
    // Check authorization (user can only update own profile)
    if (mockReq.user.userId !== mockReq.params.userId) {
      console.log(`❌ Authorization failed`);
      return;
    }
    console.log(`✅ Authorization passed`);
    
    // Check if user is verified
    if (user.annotatorStatus !== 'verified' && user.annotatorStatus !== 'approved') {
      console.log(`❌ User not verified for profile updates`);
      return;
    }
    console.log(`✅ User verification status ok`);
    
    // Simulate the exact controller logic
    const updateData = {};
    
    if (mockReq.body.paymentInfo) {
      updateData.payment_info = {
        ...user.payment_info?.toObject(),
        account_name: mockReq.body.paymentInfo.accountName !== undefined ? mockReq.body.paymentInfo.accountName : user.payment_info?.account_name,
        account_number: mockReq.body.paymentInfo.accountNumber !== undefined ? mockReq.body.paymentInfo.accountNumber : user.payment_info?.account_number,
        bank_name: mockReq.body.paymentInfo.bankName !== undefined ? mockReq.body.paymentInfo.bankName : user.payment_info?.bank_name,
        payment_method: mockReq.body.paymentInfo.paymentMethod !== undefined ? mockReq.body.paymentInfo.paymentMethod : user.payment_info?.payment_method,
        payment_currency: mockReq.body.paymentInfo.paymentCurrency !== undefined ? mockReq.body.paymentInfo.paymentCurrency : user.payment_info?.payment_currency
      };
    }
    
    console.log(`\n🔄 Final update data:`, updateData);
    
    // Perform the update with validation
    const updatedUser = await DTUser.findByIdAndUpdate(
      mockReq.params.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    console.log(`\n✅ Update successful!`);
    console.log(`💳 New payment info:`, updatedUser.payment_info);
    
    // Test the response format (like in controller)
    const paymentInfoResponse = {
      accountName: updatedUser.payment_info?.account_name || "",
      accountNumber: updatedUser.payment_info?.account_number || "",
      bankName: updatedUser.payment_info?.bank_name || "",
      paymentMethod: updatedUser.payment_info?.payment_method || "",
      paymentCurrency: updatedUser.payment_info?.payment_currency || ""
    };
    
    console.log(`\n📤 Response format:`, paymentInfoResponse);
    
  } catch (error) {
    console.error('❌ Error in API simulation:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

simulateAPICall();