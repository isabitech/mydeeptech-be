const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000';

async function testLogin() {
  console.log('🔐 Testing DTUser Login Functionality...\n');
  
  // Test with an existing user (replace with actual email/password)
  const loginData = {
    email: "dammy_5@mailinator.com", // Change this to an existing user email
    password: "@Coolguy001" // Change this to the actual password
  };
  
  try {
    console.log('1️⃣ Testing DTUser Login...');
    console.log(`📧 Email: ${loginData.email}`);
    
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/dtUserLogin`, loginData, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Login successful!');
    console.log('📊 Login Response:', {
      success: loginResponse.data.success,
      message: loginResponse.data.message,
      userId: loginResponse.data.user?.id,
      fullName: loginResponse.data.user?.fullName,
      email: loginResponse.data.user?.email,
      isEmailVerified: loginResponse.data.user?.isEmailVerified,
      hasSetPassword: loginResponse.data.user?.hasSetPassword,
      annotatorStatus: loginResponse.data.user?.annotatorStatus,
      microTaskerStatus: loginResponse.data.user?.microTaskerStatus
    });
    
    console.log('\n🎉 Login test completed successfully!');
    
  } catch (error) {
    console.log('❌ Login test failed!');
    
    if (error.response) {
      console.log('📊 Error Response:', {
        status: error.response.status,
        message: error.response.data?.message || 'No message',
        requiresPasswordSetup: error.response.data?.requiresPasswordSetup,
        userId: error.response.data?.userId
      });
      
      // Provide helpful guidance based on the error
      if (error.response.status === 404) {
        console.log('\n💡 This means the user doesn\'t exist. You need to:');
        console.log('   1. Register first with: POST /api/auth/createDTuser');
        console.log('   2. Verify email');
        console.log('   3. Set up password');
        console.log('   4. Then login');
      } else if (error.response.data?.requiresPasswordSetup) {
        console.log('\n💡 User exists but password not set up. Use:');
        console.log(`   POST /api/auth/setupPassword with userId: ${error.response.data?.userId}`);
      } else if (error.response.status === 400 && error.response.data?.message?.includes('verify')) {
        console.log('\n💡 Email not verified yet. Check email and click verification link.');
      } else if (error.response.status === 400 && error.response.data?.message?.includes('credentials')) {
        console.log('\n💡 Wrong password. Check your password and try again.');
      }
    } else {
      console.log('🔧 Network/Connection Error:', error.message);
    }
  }
}

async function testWrongPassword() {
  console.log('\n🧪 Testing login with wrong password...');
  
  const wrongPasswordData = {
    email: "dammymydeeptech@mailinator.com",
    password: "wrongpassword"
  };
  
  try {
    await axios.post(`${BASE_URL}/api/auth/dtUserLogin`, wrongPasswordData, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('❌ Login should have failed with wrong password!');
  } catch (error) {
    if (error.response?.status === 400 && error.response.data?.message?.includes('credentials')) {
      console.log('✅ Wrong password correctly rejected');
      console.log('📊 Response:', error.response.data?.message);
    } else {
      console.log('❌ Unexpected error:', error.response?.data?.message);
    }
  }
}

async function runLoginTests() {
  await testLogin();
  await testWrongPassword();
  
  console.log('\n📋 Login Test Summary:');
  console.log('- Test correct login credentials');
  console.log('- Test wrong password rejection');
  console.log('- Show helpful error messages');
}

// Run the tests
runLoginTests();