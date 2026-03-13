/**
 * HVNC Redis Integration Test Script
 * 
 * Tests the new Redis-based verification system for HVNC access codes
 * Run with: node scripts/test-hvnc-redis.js
 */

const { getRedisClient } = require('../config/redis');
const hvncVerificationStore = require('../utils/hvncVerificationStore');

// Test data
const testData = {
  email: 'test@mydeeptech.ng',
  deviceId: 'test-device-001',
  code: '123456',
  userData: {
    userId: 'test-user-id',
    email: 'test@mydeeptech.ng',
    fullName: 'Test User',
    role: 'user',
    deviceId: 'test-device-001',
    deviceName: 'Test Device',
    purpose: 'hvnc_access'
  }
};

async function testRedisConnection() {
  console.log('\n🔧 Testing Redis Connection...');
  try {
    const redisClient = getRedisClient();
    if (!redisClient) {
      throw new Error('Redis client not available');
    }
    
    await redisClient.ping();
    console.log('✅ Redis connection successful');
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    return false;
  }
}

async function testSetAccessCode() {
  console.log('\n🔧 Testing setAccessCode...');
  try {
    const success = await hvncVerificationStore.setAccessCode(
      testData.email,
      testData.deviceId,
      testData.code,
      testData.userData
    );
    
    if (success) {
      console.log('✅ Access code stored successfully');
    } else {
      console.log('❌ Failed to store access code');
    }
    
    return success;
  } catch (error) {
    console.error('❌ Error storing access code:', error.message);
    return false;
  }
}

async function testGetAccessCodeData() {
  console.log('\n🔧 Testing getAccessCodeData...');
  try {
    const data = await hvncVerificationStore.getAccessCodeData(
      testData.email,
      testData.deviceId
    );
    
    if (data) {
      console.log('✅ Access code retrieved successfully');
      console.log('   Code:', data.code);
      console.log('   Email:', data.email);
      console.log('   Device:', data.deviceId);
      console.log('   Expires in:', Math.round((data.expiresAt - Date.now()) / 1000), 'seconds');
    } else {
      console.log('❌ No access code data found');
    }
    
    return !!data;
  } catch (error) {
    console.error('❌ Error retrieving access code data:', error.message);
    return false;
  }
}

async function testValidateCorrectCode() {
  console.log('\n🔧 Testing validateCode (correct code)...');
  try {
    const result = await hvncVerificationStore.validateCode(
      testData.email,
      testData.deviceId,
      testData.code
    );
    
    console.log('Validation result:', result);
    
    if (result.valid) {
      console.log('✅ Correct code validated successfully');
    } else {
      console.log('❌ Correct code validation failed:', result.message);
    }
    
    return result.valid;
  } catch (error) {
    console.error('❌ Error validating correct code:', error.message);
    return false;
  }
}

async function testValidateIncorrectCode() {
  console.log('\n🔧 Testing validateCode (incorrect code)...');
  
  // First, set a new code for testing
  await hvncVerificationStore.setAccessCode(
    testData.email,
    testData.deviceId,
    testData.code,
    testData.userData
  );
  
  try {
    const result = await hvncVerificationStore.validateCode(
      testData.email,
      testData.deviceId,
      '999999' // Wrong code
    );
    
    console.log('Validation result:', result);
    
    if (!result.valid && result.reason === 'INVALID_CODE') {
      console.log('✅ Incorrect code properly rejected');
    } else {
      console.log('❌ Incorrect code validation behaved unexpectedly');
    }
    
    return !result.valid;
  } catch (error) {
    console.error('❌ Error validating incorrect code:', error.message);
    return false;
  }
}

async function testAttemptLimiting() {
  console.log('\n🔧 Testing attempt limiting...');
  
  // Set a new code
  await hvncVerificationStore.setAccessCode(
    testData.email,
    testData.deviceId,
    testData.code,
    testData.userData
  );
  
  try {
    let result;
    
    // Make 3 failed attempts
    for (let i = 1; i <= 3; i++) {
      result = await hvncVerificationStore.validateCode(
        testData.email,
        testData.deviceId,
        'wrong-code'
      );
      
      console.log(`   Attempt ${i}:`, result.message, `(${result.attemptsRemaining || 0} remaining)`);
    }
    
    // 4th attempt should be blocked
    result = await hvncVerificationStore.validateCode(
      testData.email,
      testData.deviceId,
      'wrong-code'
    );
    
    if (result.reason === 'TOO_MANY_ATTEMPTS') {
      console.log('✅ Attempt limiting works correctly');
      return true;
    } else {
      console.log('❌ Attempt limiting not working:', result);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error testing attempt limiting:', error.message);
    return false;
  }
}

async function testStorageStats() {
  console.log('\n🔧 Testing storage statistics...');
  try {
    const stats = await hvncVerificationStore.getStorageStats();
    
    console.log('Storage stats:', stats);
    console.log('✅ Storage statistics retrieved successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Error getting storage stats:', error.message);
    return false;
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  try {
    await hvncVerificationStore.removeAccessCode(testData.email, testData.deviceId);
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('❌ Error cleaning up:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting HVNC Redis Integration Tests\n');
  
  const testResults = [];
  
  try {
    testResults.push({ name: 'Redis Connection', passed: await testRedisConnection() });
    testResults.push({ name: 'Set Access Code', passed: await testSetAccessCode() });
    testResults.push({ name: 'Get Access Code Data', passed: await testGetAccessCodeData() });
    testResults.push({ name: 'Validate Correct Code', passed: await testValidateCorrectCode() });
    testResults.push({ name: 'Validate Incorrect Code', passed: await testValidateIncorrectCode() });
    testResults.push({ name: 'Attempt Limiting', passed: await testAttemptLimiting() });
    testResults.push({ name: 'Storage Statistics', passed: await testStorageStats() });
    
  } finally {
    await cleanup();
  }
  
  // Print summary
  console.log('\n📊 Test Results Summary');
  console.log('========================');
  
  let passedCount = 0;
  testResults.forEach(test => {
    const status = test.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.name}`);
    if (test.passed) passedCount++;
  });
  
  console.log(`\n📈 ${passedCount}/${testResults.length} tests passed`);
  
  if (passedCount === testResults.length) {
    console.log('\n🎉 All tests passed! HVNC Redis integration is working correctly.\n');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.\n');
  }
  
  return passedCount === testResults.length;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('🔥 Critical test error:', error);
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  testRedisConnection,
  testSetAccessCode,
  testGetAccessCodeData,
  testValidateCorrectCode,
  testValidateIncorrectCode,
  testAttemptLimiting,
  testStorageStats
};