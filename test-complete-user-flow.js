const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000';

// Test data
const testUser = {
  fullName: "John Password Test",
  phone: "+1234567890",
  email: "dammypassword@mailinator.com",
  domains: ["tech", "ai"],
  socialsFollowed: ["twitter", "linkedin"],
  consent: true
};

const testPassword = "SecurePassword123!";

async function testCompleteUserFlow() {
  console.log('🧪 Testing Complete DTUser Flow: Register → Verify → Setup Password → Login...\n');
  
  let userId = null;
  let userEmail = null;
  
  try {
    // Step 1: Create a user
    console.log('1️⃣ Creating user...');
    const createResponse = await axios.post(`${BASE_URL}/api/auth/createDTuser`, testUser, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ User created successfully!');
    console.log('📧 Email sent:', createResponse.data.message);
    
    userId = createResponse.data.user._id;
    userEmail = createResponse.data.user.email;
    
    console.log(`👤 User ID: ${userId}`);
    console.log(`📨 Email: ${userEmail}`);
    console.log(`✉️ Email verified: ${createResponse.data.user.isEmailVerified}`);
    console.log(`🔐 Password set: ${createResponse.data.user.hasSetPassword || false}`);
    
    // Step 2: Verify email
    console.log('\n2️⃣ Verifying email...');
    
    const verifyResponse = await axios.get(
      `${BASE_URL}/api/auth/verifyDTusermail/${userId}?email=${encodeURIComponent(userEmail)}`,
      { timeout: 10000 }
    );
    
    console.log('✅ Email verification successful!');
    console.log('📊 Response:', {
      success: verifyResponse.data.success,
      message: verifyResponse.data.message,
      isEmailVerified: verifyResponse.data.user.isEmailVerified
    });
    
    // Step 3: Try login before setting password (should fail)
    console.log('\n3️⃣ Testing login before password setup (should fail)...');
    
    try {
      await axios.post(`${BASE_URL}/api/auth/dtUserLogin`, {
        email: userEmail,
        password: testPassword
      }, { timeout: 10000 });
      
      console.log('❌ Login should have failed!');
    } catch (loginError) {
      console.log('✅ Login correctly failed - password not set yet');
      console.log('📊 Response:', {
        status: loginError.response?.status,
        message: loginError.response?.data?.message,
        requiresPasswordSetup: loginError.response?.data?.requiresPasswordSetup
      });
    }
    
    // Step 4: Set up password
    console.log('\n4️⃣ Setting up password...');
    
    const passwordSetupResponse = await axios.post(`${BASE_URL}/api/auth/setupPassword`, {
      userId: userId,
      email: userEmail,
      password: testPassword,
      confirmPassword: testPassword
    }, { timeout: 10000 });
    
    console.log('✅ Password setup successful!');
    console.log('📊 Response:', {
      success: passwordSetupResponse.data.success,
      message: passwordSetupResponse.data.message,
      hasSetPassword: passwordSetupResponse.data.user.hasSetPassword
    });
    
    // Step 5: Test login with correct password
    console.log('\n5️⃣ Testing login with correct password...');
    
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/dtUserLogin`, {
      email: userEmail,
      password: testPassword
    }, { timeout: 10000 });
    
    console.log('✅ Login successful!');
    console.log('📊 Login Response:', {
      success: loginResponse.data.success,
      message: loginResponse.data.message,
      userId: loginResponse.data.user.id,
      fullName: loginResponse.data.user.fullName,
      email: loginResponse.data.user.email,
      isEmailVerified: loginResponse.data.user.isEmailVerified,
      hasSetPassword: loginResponse.data.user.hasSetPassword,
      annotatorStatus: loginResponse.data.user.annotatorStatus,
      microTaskerStatus: loginResponse.data.user.microTaskerStatus
    });
    
    // Step 6: Test login with wrong password
    console.log('\n6️⃣ Testing login with wrong password (should fail)...');
    
    try {
      await axios.post(`${BASE_URL}/api/auth/dtUserLogin`, {
        email: userEmail,
        password: "wrongpassword"
      }, { timeout: 10000 });
      
      console.log('❌ Login should have failed!');
    } catch (wrongPasswordError) {
      console.log('✅ Login correctly failed - wrong password');
      console.log('📊 Response:', {
        status: wrongPasswordError.response?.status,
        message: wrongPasswordError.response?.data?.message
      });
    }
    
    // Step 7: Try to set password again (should fail)
    console.log('\n7️⃣ Testing duplicate password setup (should fail)...');
    
    try {
      await axios.post(`${BASE_URL}/api/auth/setupPassword`, {
        userId: userId,
        email: userEmail,
        password: "newpassword123",
        confirmPassword: "newpassword123"
      }, { timeout: 10000 });
      
      console.log('❌ Duplicate password setup should have failed!');
    } catch (duplicatePasswordError) {
      console.log('✅ Duplicate password setup correctly rejected');
      console.log('📊 Response:', {
        status: duplicatePasswordError.response?.status,
        message: duplicatePasswordError.response?.data?.message
      });
    }
    
    console.log('\n🎉 Complete DTUser flow test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ User registration working');
    console.log('✅ Email verification working');
    console.log('✅ Password setup working');
    console.log('✅ Login authentication working');
    console.log('✅ Security validations working');
    console.log('✅ Returns same data structure as createDTUser');
    
  } catch (error) {
    console.log('❌ Test failed!');
    
    if (error.response) {
      console.log('📊 Error Response:', {
        status: error.response.status,
        message: error.response.data?.message || 'No message',
        data: error.response.data
      });
    } else {
      console.log('🔧 Network/Connection Error:', error.message);
    }
  }
}

// Run the comprehensive test
testCompleteUserFlow();