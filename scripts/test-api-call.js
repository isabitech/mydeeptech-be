const axios = require('axios');

async function testActualAPI() {
  try {
    console.log('🔍 Testing the actual API endpoint...\n');

    const url = 'http://localhost:4000/api/hvnc/codes/request';
    const data = {
      email: 'dammykolaceo@gmail.com',
      device_id: 'CEO'
    };

    console.log('📤 Making POST request to:', url);
    console.log('📋 Request data:', data);

    const response = await axios.post(url, data, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('\n✅ API Response:');
    console.log('   Status:', response.status);
    console.log('   Data:', response.data);

    if (response.data.success) {
      console.log('\n📧 API says email was sent successfully!');
      console.log('📋 Next steps:');
      console.log('   1. Check your email inbox (dammykolaceo@gmail.com)');
      console.log('   2. Check spam/junk folder');
      console.log('   3. If still no email, there may be a delivery delay');
    } else {
      console.log('❌ API returned success: false');
    }

  } catch (error) {
    console.error('❌ API request failed:', error.response?.data || error.message);
    
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', error.response.data);
    }
  }
}

testActualAPI();