const http = require('http');

// Test server connection
function testServerConnection() {
  console.log('🔍 Testing server connection...\n');
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/',
    method: 'GET'
  };
  
  const req = http.request(options, (res) => {
    console.log(`✅ Server responded with status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`📝 Response: ${data}`);
      testCreateDTUser();
    });
  });
  
  req.on('error', (e) => {
    console.error(`❌ Connection failed: ${e.message}`);
  });
  
  req.setTimeout(5000, () => {
    console.error('❌ Request timed out');
    req.destroy();
  });
  
  req.end();
}

// Test DTUser creation endpoint
function testCreateDTUser() {
  console.log('\n🧪 Testing DTUser creation endpoint...\n');
  
  const testData = JSON.stringify({
    fullName: "Test User",
    phone: "+1234567890",
    email: "test@example.com",
    domains: ["tech", "ai"],
    socialsFollowed: ["twitter", "linkedin"],
    consent: true
  });
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/createDTuser',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(testData)
    }
  };
  
  const startTime = Date.now();
  
  const req = http.request(options, (res) => {
    const endTime = Date.now();
    console.log(`✅ Response received in ${endTime - startTime}ms`);
    console.log(`📊 Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('📝 Response data:', response);
      } catch (e) {
        console.log('📝 Raw response:', data);
      }
    });
  });
  
  req.on('error', (e) => {
    const endTime = Date.now();
    console.error(`❌ Request failed in ${endTime - startTime}ms: ${e.message}`);
  });
  
  req.setTimeout(30000, () => {
    console.error('❌ Request timed out after 30 seconds');
    req.destroy();
  });
  
  req.write(testData);
  req.end();
}

// Run the test
testServerConnection();