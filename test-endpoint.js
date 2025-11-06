const axios = require('axios');

// Test endpoint configuration
const BASE_URL = 'http://localhost:5000'; // Adjust port if different
const ENDPOINT = '/api/auth/createDTuser';

// Test data
const testUser = {
  fullName: "Peace Oluwatayo",
  phone: "+1234567890",
  email: "peaceoluwatayo7@gmail.com", // Change this for each test
  domains: ["tech", "ai"],
  socialsFollowed: ["twitter", "linkedin"],
  consent: true
};

async function testEndpoint() {
  console.log('🧪 Testing DTUser creation endpoint...\n');
  
  const startTime = Date.now();
  
  try {
    const response = await axios.post(`${BASE_URL}${ENDPOINT}`, testUser, {
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ Success!');
    console.log(`⏱️  Response time: ${duration}ms`);
    console.log('📊 Response:', {
      status: response.status,
      message: response.data.message,
      emailSent: response.data.emailSent !== false
    });
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('❌ Error!');
    console.log(`⏱️  Time until error: ${duration}ms`);
    
    if (error.code === 'ECONNABORTED') {
      console.log('🕐 Request timed out');
    } else if (error.response) {
      console.log('📊 Error Response:', {
        status: error.response.status,
        message: error.response.data?.message || 'No message'
      });
    } else {
      console.log('🔧 Network/Connection Error:', error.message);
    }
  }
}

// Run the test
testEndpoint();