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
}\n\nasync function testGetAccessCodeData() {\n  console.log('\\n🔧 Testing getAccessCodeData...');\n  try {\n    const data = await hvncVerificationStore.getAccessCodeData(\n      testData.email,\n      testData.deviceId\n    );\n    \n    if (data) {\n      console.log('✅ Access code retrieved successfully');\n      console.log('   Code:', data.code);\n      console.log('   Email:', data.email);\n      console.log('   Device:', data.deviceId);\n      console.log('   Expires in:', Math.round((data.expiresAt - Date.now()) / 1000), 'seconds');\n    } else {\n      console.log('❌ No access code data found');\n    }\n    \n    return !!data;\n  } catch (error) {\n    console.error('❌ Error retrieving access code data:', error.message);\n    return false;\n  }\n}\n\nasync function testValidateCorrectCode() {\n  console.log('\\n🔧 Testing validateCode (correct code)...');\n  try {\n    const result = await hvncVerificationStore.validateCode(\n      testData.email,\n      testData.deviceId,\n      testData.code\n    );\n    \n    console.log('Validation result:', result);\n    \n    if (result.valid) {\n      console.log('✅ Correct code validated successfully');\n    } else {\n      console.log('❌ Correct code validation failed:', result.message);\n    }\n    \n    return result.valid;\n  } catch (error) {\n    console.error('❌ Error validating correct code:', error.message);\n    return false;\n  }\n}\n\nasync function testValidateIncorrectCode() {\n  console.log('\\n🔧 Testing validateCode (incorrect code)...');\n  \n  // First, set a new code for testing\n  await hvncVerificationStore.setAccessCode(\n    testData.email,\n    testData.deviceId,\n    testData.code,\n    testData.userData\n  );\n  \n  try {\n    const result = await hvncVerificationStore.validateCode(\n      testData.email,\n      testData.deviceId,\n      '999999' // Wrong code\n    );\n    \n    console.log('Validation result:', result);\n    \n    if (!result.valid && result.reason === 'INVALID_CODE') {\n      console.log('✅ Incorrect code properly rejected');\n    } else {\n      console.log('❌ Incorrect code validation behaved unexpectedly');\n    }\n    \n    return !result.valid;\n  } catch (error) {\n    console.error('❌ Error validating incorrect code:', error.message);\n    return false;\n  }\n}\n\nasync function testAttemptLimiting() {\n  console.log('\\n🔧 Testing attempt limiting...');\n  \n  // Set a new code\n  await hvncVerificationStore.setAccessCode(\n    testData.email,\n    testData.deviceId,\n    testData.code,\n    testData.userData\n  );\n  \n  try {\n    let result;\n    \n    // Make 3 failed attempts\n    for (let i = 1; i <= 3; i++) {\n      result = await hvncVerificationStore.validateCode(\n        testData.email,\n        testData.deviceId,\n        'wrong-code'\n      );\n      \n      console.log(`   Attempt ${i}:`, result.message, `(${result.attemptsRemaining || 0} remaining)`);\n    }\n    \n    // 4th attempt should be blocked\n    result = await hvncVerificationStore.validateCode(\n      testData.email,\n      testData.deviceId,\n      'wrong-code'\n    );\n    \n    if (result.reason === 'TOO_MANY_ATTEMPTS') {\n      console.log('✅ Attempt limiting works correctly');\n      return true;\n    } else {\n      console.log('❌ Attempt limiting not working:', result);\n      return false;\n    }\n    \n  } catch (error) {\n    console.error('❌ Error testing attempt limiting:', error.message);\n    return false;\n  }\n}\n\nasync function testStorageStats() {\n  console.log('\\n🔧 Testing storage statistics...');\n  try {\n    const stats = await hvncVerificationStore.getStorageStats();\n    \n    console.log('Storage stats:', stats);\n    console.log('✅ Storage statistics retrieved successfully');\n    \n    return true;\n  } catch (error) {\n    console.error('❌ Error getting storage stats:', error.message);\n    return false;\n  }\n}\n\nasync function cleanup() {\n  console.log('\\n🧹 Cleaning up test data...');\n  try {\n    await hvncVerificationStore.removeAccessCode(testData.email, testData.deviceId);\n    console.log('✅ Test data cleaned up');\n  } catch (error) {\n    console.error('❌ Error cleaning up:', error.message);\n  }\n}\n\nasync function runAllTests() {\n  console.log('🚀 Starting HVNC Redis Integration Tests\\n');\n  \n  const testResults = [];\n  \n  try {\n    testResults.push({ name: 'Redis Connection', passed: await testRedisConnection() });\n    testResults.push({ name: 'Set Access Code', passed: await testSetAccessCode() });\n    testResults.push({ name: 'Get Access Code Data', passed: await testGetAccessCodeData() });\n    testResults.push({ name: 'Validate Correct Code', passed: await testValidateCorrectCode() });\n    testResults.push({ name: 'Validate Incorrect Code', passed: await testValidateIncorrectCode() });\n    testResults.push({ name: 'Attempt Limiting', passed: await testAttemptLimiting() });\n    testResults.push({ name: 'Storage Statistics', passed: await testStorageStats() });\n    \n  } finally {\n    await cleanup();\n  }\n  \n  // Print summary\n  console.log('\\n📊 Test Results Summary');\n  console.log('========================');\n  \n  let passedCount = 0;\n  testResults.forEach(test => {\n    const status = test.passed ? '✅ PASS' : '❌ FAIL';\n    console.log(`${status} ${test.name}`);\n    if (test.passed) passedCount++;\n  });\n  \n  console.log(`\\n📈 ${passedCount}/${testResults.length} tests passed`);\n  \n  if (passedCount === testResults.length) {\n    console.log('\\n🎉 All tests passed! HVNC Redis integration is working correctly.\\n');\n  } else {\n    console.log('\\n⚠️  Some tests failed. Please review the errors above.\\n');\n  }\n  \n  return passedCount === testResults.length;\n}\n\n// Run tests if this script is executed directly\nif (require.main === module) {\n  runAllTests()\n    .then(success => {\n      process.exit(success ? 0 : 1);\n    })\n    .catch(error => {\n      console.error('🔥 Critical test error:', error);\n      process.exit(1);\n    });\n}\n\nmodule.exports = {\n  runAllTests,\n  testRedisConnection,\n  testSetAccessCode,\n  testGetAccessCodeData,\n  testValidateCorrectCode,\n  testValidateIncorrectCode,\n  testAttemptLimiting,\n  testStorageStats\n};"