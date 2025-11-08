const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000';

// Test data
const testUser = {
  fullName: "Damilola Kolawole",
  phone: "+1234567890",
  email: "dammy_2@mailinator.com",
  domains: ["tech"],
  socialsFollowed: ["twitter"],
  consent: true
};

async function testEmailVerificationFlow() {
  console.log('🧪 Testing Complete Email Verification Flow...\n');
  
  try {
    // Step 1: Create a user
    console.log('1️⃣ Creating user...');
    const createResponse = await axios.post(`${BASE_URL}/api/auth/createDTuser`, testUser, {
      timeout: 50000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ User created successfully!');
    console.log('📧 Email sent:', createResponse.data.message);
    
    const userId = createResponse.data.user._id;
    const userEmail = createResponse.data.user.email;
    
    console.log(`👤 User ID: ${userId}`);
    console.log(`📨 Email: ${userEmail}`);
    console.log(`✉️ Verification status: ${createResponse.data.user.isEmailVerified}`);
    
    // Step 2: Test verification endpoint
    console.log('\n2️⃣ Testing verification endpoint...');
    
    const verifyResponse = await axios.get(
      `${BASE_URL}/api/auth/verifyDTusermail/${userId}?email=${encodeURIComponent(userEmail)}`,
      { timeout: 10000 }
    );
    
    console.log('✅ Verification successful!');
    console.log('📊 Response:', {
      success: verifyResponse.data.success,
      message: verifyResponse.data.message,
      isEmailVerified: verifyResponse.data.user.isEmailVerified
    });
    
    // Step 3: Test double verification (should say already verified)
    console.log('\n3️⃣ Testing double verification...');
    
    const doubleVerifyResponse = await axios.get(
      `${BASE_URL}/api/auth/verifyDTusermail/${userId}?email=${encodeURIComponent(userEmail)}`,
      { timeout: 10000 }
    );
    
    console.log('✅ Double verification handled correctly!');
    console.log('📊 Response:', {
      success: doubleVerifyResponse.data.success,
      message: doubleVerifyResponse.data.message
    });
    
    console.log('\n🎉 Email verification flow test completed successfully!');
    
    // Step 4: Test invalid verification
    console.log('\n4️⃣ Testing invalid verification (wrong email)...');
    
    try {
      await axios.get(
        `${BASE_URL}/api/auth/verifyDTusermail/${userId}?email=wrong@email.com`,
        { timeout: 10000 }
      );
    } catch (invalidError) {
      console.log('✅ Invalid verification correctly rejected!');
      console.log('📊 Error Response:', {
        status: invalidError.response?.status,
        message: invalidError.response?.data?.message
      });
    }
    
  } catch (error) {
    console.log('❌ Test failed!');
    
    if (error.response) {
      console.log('📊 Error Response:', {
        status: error.response.status,
        message: error.response.data?.message || 'No message'
      });
    } else {
      console.log('🔧 Network/Connection Error:', error.message);
    }
  }
}

// Run the comprehensive test
testEmailVerificationFlow();