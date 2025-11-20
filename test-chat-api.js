const axios = require('axios');

// Test the chat API endpoint
async function testChatAPI() {
  const baseURL = 'http://localhost:5000';
  
  console.log('🧪 Testing Chat API Authentication Flow...\n');
  
  // Test 1: Server health check
  try {
    console.log('1️⃣ Testing server health...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ Server is running:', healthResponse.status, healthResponse.statusText);
  } catch (error) {
    console.log('❌ Server health check failed:', error.message);
    return;
  }
  
  // Test 2: Chat endpoint WITHOUT authentication (should fail with 401)
  try {
    console.log('\n2️⃣ Testing /api/chat/start without auth (should fail)...');
    const response = await axios.post(`${baseURL}/api/chat/start`, {
      message: "Hello, I need help",
      category: "general_inquiry",
      priority: "medium"
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('🤔 Unexpected success:', response.data);
  } catch (error) {
    console.log('✅ Expected auth error:', {
      status: error.response?.status,
      data: error.response?.data
    });
  }
  
  // Test 3: Chat endpoint WITH invalid token (should fail with 401)
  try {
    console.log('\n3️⃣ Testing /api/chat/start with invalid token (should fail)...');
    const response = await axios.post(`${baseURL}/api/chat/start`, {
      message: "Hello, I need help", 
      category: "general_inquiry",
      priority: "medium"
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token-123'
      }
    });
    console.log('🤔 Unexpected success:', response.data);
  } catch (error) {
    console.log('✅ Expected token error:', {
      status: error.response?.status,
      data: error.response?.data
    });
  }
  
  // Test 4: Try to login first to get a valid token
  try {
    console.log('\n4️⃣ Testing login to get valid token...');
    
    // Test with common email/password combination
    const loginResponse = await axios.post(`${baseURL}/auth/login`, {
      email: 'admin@mydeeptech.ng', // Try admin email
      password: 'password123' // Common test password
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful! Token obtained.');
    
    // Test 5: Now try chat with valid token
    try {
      console.log('\n5️⃣ Testing /api/chat/start with valid token...');
      const chatResponse = await axios.post(`${baseURL}/api/chat/start`, {
        message: "Hello, I need help with my account",
        category: "general_inquiry",
        priority: "medium"
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('🎉 Chat API SUCCESS:', chatResponse.data);
    } catch (chatError) {
      console.log('❌ Chat API error with valid token:', {
        status: chatError.response?.status,
        data: chatError.response?.data
      });
    }
    
  } catch (loginError) {
    console.log('❌ Login failed:', {
      status: loginError.response?.status,
      data: loginError.response?.data
    });
    
    // Test 6: Check what auth endpoints exist
    console.log('\n6️⃣ Checking available auth endpoints...');
    try {
      const authCheck = await axios.get(`${baseURL}/auth`);
      console.log('Auth endpoint response:', authCheck.data);
    } catch (authError) {
      console.log('Auth endpoint structure:', {
        status: authError.response?.status,
        data: authError.response?.data
      });
    }
  }
  
  console.log('\n📋 SUMMARY:');
  console.log('- Chat API requires Authentication: Bearer JWT token');
  console.log('- User must exist in database and have verified email');
  console.log('- Frontend should first login to get token, then use token for chat');
  console.log('- Check your frontend authentication flow!');
}

// Run the test
testChatAPI().catch(console.error);