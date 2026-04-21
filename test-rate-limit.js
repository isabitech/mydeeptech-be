/**
 * Simple Rate Limiting Test
 * 
 * Quick test to verify rate limiting is working.
 * Run: node test-rate-limit.js
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';

async function testRateLimit() {
  console.log('🧪 Testing Rate Limiting...');
  console.log(`📍 Testing against: ${BASE_URL}`);
  
  try {
    // Test auth endpoint (should have strict 5 req/15min limit)
    console.log('\n🔐 Testing Auth Rate Limiting...');
    
    let successCount = 0;
    let rateLimitedCount = 0;
    
    // Send 7 requests quickly (should trigger rate limit)
    for (let i = 0; i < 7; i++) {
      try {
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
          email: `test${i}@example.com`,
          password: 'testpassword'
        });
        
        successCount++;
        console.log(`  Request ${i + 1}: Success`);
        
      } catch (error) {
        if (error.response?.status === 429) {
          rateLimitedCount++;
          console.log(`  Request ${i + 1}: Rate Limited ✅`);
          console.log(`    Error: ${error.response.data.error}`);
          console.log(`    Retry After: ${error.response.data.retryAfter}`);
        } else {
          // Other errors (auth errors are expected)
          console.log(`  Request ${i + 1}: Auth Error (expected)`);
        }
      }
    }
    
    console.log('\n📊 Results:');
    console.log(`  - Successful requests: ${successCount}`);
    console.log(`  - Rate limited requests: ${rateLimitedCount}`);
    
    if (rateLimitedCount > 0) {
      console.log('✅ Rate limiting is working!');
    } else {
      console.log('⚠️ Rate limiting may not be active');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('Make sure your server is running on port 4000');
  }
}

// Check if Redis is available
async function checkRedis() {
  try {
    const { getRedisClient } = require('./config/redis');
    const client = getRedisClient();
    
    if (client?.isReady) {
      await client.ping();
      console.log('✅ Redis is connected');
    } else {
      console.log('⚠️ Redis not available - using memory storage');
    }
  } catch (error) {
    console.log('⚠️ Could not check Redis status');
  }
}

// Run test
async function run() {
  await checkRedis();
  await testRateLimit();
}

run();