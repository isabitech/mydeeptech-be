const axios = require('axios');

async function testChatAPI() {
  try {
    console.log('🧪 Testing Chat API with actual authentication...\n');
    
    // Get your JWT token by making a login request first
    console.log('1️⃣ Attempting to login...');
    const loginResponse = await axios.post('http://localhost:5000/auth/login', {
      email: 'damilolamiraclek@gmail.com',
      password: 'password123' // Update with actual password if different
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful! Got token.');
    
    // Now test the chat API
    console.log('\n2️⃣ Testing chat API with valid token...');
    const chatResponse = await axios.post('http://localhost:5000/api/chat/start', {
      message: "Hello, I need help with my account",
      category: "general_inquiry",
      priority: "medium"
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🎉 CHAT API SUCCESS!');
    console.log('Response:', JSON.stringify(chatResponse.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      console.log('❌ API Error:', {
        status: error.response.status,
        data: error.response.data
      });
    } else {
      console.log('❌ Request Error:', error.message);
    }
  }
}

testChatAPI();