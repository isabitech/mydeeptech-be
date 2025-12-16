const mongoose = require('mongoose');
require('dotenv').config();

async function testPartialUpdate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const DTUser = require('./models/dtUser.model.js');
    
    // Find a test user
    const user = await DTUser.findOne({
      annotatorStatus: 'approved',
      email: { $exists: true }
    });
    
    console.log(`📋 Testing with user: ${user.email}`);
    console.log(`💳 Current payment info:`, user.payment_info);
    
    // Test case 1: Update only some fields
    console.log(`\n🧪 Test 1: Partial update (only accountName and bankName)`);
    const req1 = {
      body: {
        paymentInfo: {
          accountName: "Partial Update Name",
          bankName: "Partial Update Bank"
          // Note: Not providing accountNumber, paymentMethod, paymentCurrency
        }
      }
    };
    
    const updateData1 = {};
    if (req1.body.paymentInfo) {
      updateData1.payment_info = {
        ...user.payment_info?.toObject(),
        account_name: req1.body.paymentInfo.accountName !== undefined ? req1.body.paymentInfo.accountName : user.payment_info?.account_name,
        account_number: req1.body.paymentInfo.accountNumber !== undefined ? req1.body.paymentInfo.accountNumber : user.payment_info?.account_number,
        bank_name: req1.body.paymentInfo.bankName !== undefined ? req1.body.paymentInfo.bankName : user.payment_info?.bank_name,
        payment_method: req1.body.paymentInfo.paymentMethod !== undefined ? req1.body.paymentInfo.paymentMethod : user.payment_info?.payment_method,
        payment_currency: req1.body.paymentInfo.paymentCurrency !== undefined ? req1.body.paymentInfo.paymentCurrency : user.payment_info?.payment_currency
      };
    }
    
    console.log(`🔄 Update data 1:`, updateData1);
    
    const updatedUser1 = await DTUser.findByIdAndUpdate(
      user._id,
      { $set: updateData1 },
      { new: true, runValidators: true }
    );
    
    console.log(`✅ Result 1:`, updatedUser1.payment_info);
    
    // Test case 2: Update with empty values
    console.log(`\n🧪 Test 2: Update with empty strings`);
    const req2 = {
      body: {
        paymentInfo: {
          accountName: "",
          accountNumber: "",
          bankName: "",
          paymentMethod: "",
          paymentCurrency: ""
        }
      }
    };
    
    const updateData2 = {};
    if (req2.body.paymentInfo) {
      updateData2.payment_info = {
        ...updatedUser1.payment_info?.toObject(),
        account_name: req2.body.paymentInfo.accountName !== undefined ? req2.body.paymentInfo.accountName : updatedUser1.payment_info?.account_name,
        account_number: req2.body.paymentInfo.accountNumber !== undefined ? req2.body.paymentInfo.accountNumber : updatedUser1.payment_info?.account_number,
        bank_name: req2.body.paymentInfo.bankName !== undefined ? req2.body.paymentInfo.bankName : updatedUser1.payment_info?.bank_name,
        payment_method: req2.body.paymentInfo.paymentMethod !== undefined ? req2.body.paymentInfo.paymentMethod : updatedUser1.payment_info?.payment_method,
        payment_currency: req2.body.paymentInfo.paymentCurrency !== undefined ? req2.body.paymentInfo.paymentCurrency : updatedUser1.payment_info?.payment_currency
      };
    }
    
    console.log(`🔄 Update data 2:`, updateData2);
    
    const updatedUser2 = await DTUser.findByIdAndUpdate(
      updatedUser1._id,
      { $set: updateData2 },
      { new: true, runValidators: true }
    );
    
    console.log(`✅ Result 2:`, updatedUser2.payment_info);
    
    // Test case 3: undefined vs null values
    console.log(`\n🧪 Test 3: Testing undefined and null handling`);
    const req3 = {
      body: {
        paymentInfo: {
          accountName: "Final Test Name",
          accountNumber: undefined,  // This should preserve existing value
          bankName: null,            // This should set to null
          paymentMethod: "paypal",
          paymentCurrency: undefined // This should preserve existing value
        }
      }
    };
    
    console.log(`📝 Request 3 body:`, req3.body);
    
    const updateData3 = {};
    if (req3.body.paymentInfo) {
      updateData3.payment_info = {
        ...updatedUser2.payment_info?.toObject(),
        account_name: req3.body.paymentInfo.accountName !== undefined ? req3.body.paymentInfo.accountName : updatedUser2.payment_info?.account_name,
        account_number: req3.body.paymentInfo.accountNumber !== undefined ? req3.body.paymentInfo.accountNumber : updatedUser2.payment_info?.account_number,
        bank_name: req3.body.paymentInfo.bankName !== undefined ? req3.body.paymentInfo.bankName : updatedUser2.payment_info?.bank_name,
        payment_method: req3.body.paymentInfo.paymentMethod !== undefined ? req3.body.paymentInfo.paymentMethod : updatedUser2.payment_info?.payment_method,
        payment_currency: req3.body.paymentInfo.paymentCurrency !== undefined ? req3.body.paymentInfo.paymentCurrency : updatedUser2.payment_info?.payment_currency
      };
    }
    
    console.log(`🔄 Update data 3:`, updateData3);
    
    const updatedUser3 = await DTUser.findByIdAndUpdate(
      updatedUser2._id,
      { $set: updateData3 },
      { new: true, runValidators: true }
    );
    
    console.log(`✅ Result 3:`, updatedUser3.payment_info);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

testPartialUpdate();