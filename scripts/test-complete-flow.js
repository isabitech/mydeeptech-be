const axios = require('axios');

async function testCompleteFlow() {
  try {
    console.log('🔍 Testing complete HVNC flow (request + validate)...\n');
    
    const baseUrl = 'http://localhost:4000/api/hvnc/codes';
    const email = 'dammykolaceo@gmail.com';
    const deviceId = 'CEO'; // Using friendly name
    
    // Step 1: Request access code
    console.log('1️⃣ Requesting access code...');
    const requestResponse = await axios.post(`${baseUrl}/request`, {
      email: email,
      device_id: deviceId
    });
    
    console.log('✅ Request successful:');
    console.log('   Status:', requestResponse.status);
    console.log('   Response:', requestResponse.data);
    
    if (!requestResponse.data.success) {
      console.log('❌ Request failed, stopping test');
      return;
    }
    
    // Wait a moment for email to be sent
    console.log('\n⏳ Waiting 2 seconds for email processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Test validation with a sample code
    console.log('\n2️⃣ Testing validation with sample code...');
    
    // Use a sample code for testing (in real scenario, you'd get this from email)
    const sampleCode = '123456';
    
    try {
      const validateResponse = await axios.post(`${baseUrl}/validate`, {
        email: email,
        code: sampleCode,
        device_id: deviceId
      });
      
      console.log('✅ Validation response:');
      console.log('   Status:', validateResponse.status);
      console.log('   Response:', validateResponse.data);
      
    } catch (validateError) {
      console.log('📋 Validation response (expected failure with wrong code):');
      if (validateError.response) {
        console.log('   Status:', validateError.response.status);
        console.log('   Response:', validateError.response.data);
        
        // Check if it's the right kind of error
        if (validateError.response.status === 401) {
          const errorCode = validateError.response.data.error?.code;
          if (errorCode === 'INVALID_CODE' || errorCode === 'CODE_EXPIRED' || errorCode === 'CODE_NOT_FOUND') {
            console.log('✅ Good! Getting proper code validation error (not shift error)');
          } else if (errorCode === 'OUTSIDE_SHIFT') {
            console.log('❌ Still getting shift error - fix not working');
          } else {
            console.log('📋 Different error:', errorCode);
          }
        }
      } else {
        console.log('   Error:', validateError.message);
      }
    }
    
    console.log('\n🎯 Test Summary:');
    console.log('   - Request access code: ✅ Working');
    console.log('   - Device resolution: ✅ Should be working');
    console.log('   - Validation flow: See response above');
    console.log('\n📧 Check your email for the real access code to test complete validation!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testCompleteFlow();