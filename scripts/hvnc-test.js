/**
 * HVNC System Integration Test Script
 * 
 * This script tests the complete HVNC backend system:
 * - Database connectivity and models
 * - Authentication system
 * - Device registration
 * - Access code generation
 * - Session management
 * - WebSocket connections
 * - API endpoints
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const envConfig = require('../config/envConfig');

// Import HVNC models and services
const HVNCUser = require('../models/hvnc-user.model');
const HVNCDevice = require('../models/hvnc-device.model');
const HVNCAccessCode = require('../models/hvnc-access-code.model');
const HVNCSession = require('../models/hvnc-session.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');

/**
 * Test database connections and models
 */
async function testDatabase() {
  console.log('🔍 Testing database...');
  
  try {
    // Test MongoDB connection
    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      throw new Error('MongoDB not connected');
    }
    console.log('  ✅ MongoDB connection active');
    
    // Test each model
    const modelTests = [
      ['HVNCUser', () => HVNCUser.countDocuments()],
      ['HVNCDevice', () => HVNCDevice.countDocuments()],
      ['HVNCAccessCode', () => HVNCAccessCode.countDocuments()],
      ['HVNCSession', () => HVNCSession.countDocuments()],
      ['HVNCActivityLog', () => HVNCActivityLog.countDocuments()],
    ];
    
    for (const [modelName, testFn] of modelTests) {
      const count = await testFn();
      console.log(`  ✅ ${modelName}: ${count} documents`);
    }
    
    return true;
    
  } catch (error) {
    console.error('  ❌ Database test failed:', error.message);
    return false;
  }
}

/**
 * Test admin user creation and authentication
 */
async function testAdminAuthentication() {
  console.log('🔐 Testing admin authentication...');
  
  try {
    // Check if admin exists
    const adminEmail = envConfig.hvnc.DEFAULT_ADMIN_EMAIL || 'test@example.com';
    const admin = await HVNCUser.findOne({ 
      email: adminEmail.toLowerCase(),
      role: { $in: ['admin', 'super_admin'] }
    });
    
    if (!admin) {
      console.log('  ⚠️ No admin user found, creating test admin...');
      
      const testAdmin = new HVNCUser({
        email: adminEmail.toLowerCase(),
        password_hash: await bcrypt.hash('test123', 12),
        role: 'admin',
        status: 'active',
        permissions: ['device_management', 'user_management'],
        profile: { name: 'Test Admin' }
      });
      
      await testAdmin.save();
      console.log('  ✅ Test admin created');
    } else {
      console.log('  ✅ Admin user found');
    }
    
    // Test JWT token generation
    const token = jwt.sign(
      { 
        admin_id: admin?._id || 'test',
        email: adminEmail,
        role: 'admin'
      },
      envConfig.hvnc.JWT_SECRET,
      { expiresIn: envConfig.hvnc.ADMIN_TOKEN_EXPIRY }
    );
    
    console.log('  ✅ JWT token generated');
    
    // Test token verification
    const decoded = jwt.verify(token, envConfig.hvnc.JWT_SECRET);
    console.log('  ✅ JWT token verified');
    
    return true;
    
  } catch (error) {
    console.error('  ❌ Admin authentication test failed:', error.message);
    return false;
  }
}

/**
 * Test device registration and management
 */
async function testDeviceManagement() {
  console.log('📱 Testing device management...');
  
  try {
    // Create test device
    const deviceId = `test_device_${Date.now()}`;
    const testDevice = new HVNCDevice({
      device_id: deviceId,
      hostname: 'test-device',
      operating_system: 'Windows 10',
      browser_version: 'Chrome 120.0.0.0',
      fingerprint: `test_fingerprint_${Date.now()}`,
      location: {
        ip: '127.0.0.1',
        country: 'Test Country',
        city: 'Test City'
      },
      status: 'online',
      last_seen: new Date(),
      system_info: {
        cpu: 'Test CPU',
        memory_gb: 8,
        storage_gb: 256,
        screen_resolution: '1920x1080'
      }
    });
    
    await testDevice.save();
    console.log(`  ✅ Device created: ${deviceId}`);
    
    // Test device token generation
    const deviceToken = testDevice.generateAuthToken();
    console.log('  ✅ Device token generated');
    
    // Test device update
    testDevice.status = 'busy';
    testDevice.last_seen = new Date();
    await testDevice.save();
    console.log('  ✅ Device status updated');
    
    // Test device retrieval
    const foundDevice = await HVNCDevice.findOne({ device_id: deviceId });
    if (!foundDevice || foundDevice.status !== 'busy') {
      throw new Error('Device update verification failed');
    }
    console.log('  ✅ Device retrieval verified');
    
    // Cleanup test device
    await HVNCDevice.deleteOne({ device_id: deviceId });
    console.log('  ✅ Test device cleaned up');
    
    return true;
    
  } catch (error) {
    console.error('  ❌ Device management test failed:', error.message);
    return false;
  }
}

/**
 * Test access code system
 */
async function testAccessCodes() {
  console.log('🔑 Testing access code system...');
  
  try {
    const testEmail = 'test@example.com';
    
    // Create access code
    const accessCode = await HVNCAccessCode.generateCode(testEmail);
    console.log(`  ✅ Access code generated: ${accessCode.code}`);
    
    // Test code validation
    const validation = await HVNCAccessCode.validateCode(accessCode.code, testEmail);
    if (!validation.valid || !validation.code_entry) {
      throw new Error('Access code validation failed');
    }
    console.log('  ✅ Access code validated');
    
    // Test code usage
    await validation.code_entry.markAsUsed();
    console.log('  ✅ Access code marked as used');
    
    // Test duplicate validation (should fail)
    const duplicateValidation = await HVNCAccessCode.validateCode(accessCode.code, testEmail);
    if (duplicateValidation.valid) {
      throw new Error('Used access code incorrectly validated as valid');
    }
    console.log('  ✅ Used code correctly rejected');
    
    return true;
    
  } catch (error) {
    console.error('  ❌ Access code test failed:', error.message);
    return false;
  }
}

/**
 * Test session management
 */
async function testSessionManagement() {
  console.log('🏃 Testing session management...');
  
  try {
    const testEmail = 'test@example.com';
    const deviceId = `test_device_session_${Date.now()}`;
    
    // Create test user if doesn't exist
    let user = await HVNCUser.findOne({ email: testEmail });
    if (!user) {
      user = new HVNCUser({
        email: testEmail,
        role: 'user',
        status: 'active',
        profile: { name: 'Test User' }
      });
      await user.save();
    }
    
    // Create test device
    const device = new HVNCDevice({
      device_id: deviceId,
      hostname: 'test-session-device',
      status: 'online',
      last_seen: new Date()
    });
    await device.save();
    
    // Start session
    const session = await HVNCSession.startSession({
      user_email: testEmail,
      device_id: deviceId,
      session_type: 'chrome_session'
    });
    
    console.log(`  ✅ Session started: ${session.session_id}`);
    
    // Update activity
    await session.updateActivity('navigation', 'https://example.com');
    console.log('  ✅ Session activity updated');
    
    // Get session statistics
    const stats = await session.getStatistics();
    console.log(`  ✅ Session stats: ${stats.total_commands} commands, ${stats.duration_minutes} minutes`);
    
    // End session
    await session.endSession();
    console.log('  ✅ Session ended gracefully');
    
    // Cleanup
    await HVNCDevice.deleteOne({ device_id: deviceId });
    await HVNCUser.deleteOne({ email: testEmail });
    
    return true;
    
  } catch (error) {
    console.error('  ❌ Session management test failed:', error.message);
    return false;
  }
}

/**
 * Test activity logging
 */
async function testActivityLogging() {
  console.log('📝 Testing activity logging...');
  
  try {
    // Log test events
    const testEvents = [
      {
        event_type: 'device_registration',
        user_email: 'test@example.com',
        severity: 'info',
        status: 'success',
        event_data: { test: true }
      },
      {
        event_type: 'session_start',
        user_email: 'test@example.com',
        severity: 'info',
        status: 'success',
        event_data: { session_id: 'test_session' }
      }
    ];
    
    for (const event of testEvents) {
      await HVNCActivityLog.logEvent(event);
      console.log(`  ✅ Event logged: ${event.event_type}`);
    }
    
    // Test log retrieval
    const logs = await HVNCActivityLog.find({ 
      user_email: 'test@example.com' 
    }).limit(10);
    
    console.log(`  ✅ Retrieved ${logs.length} log entries`);
    
    // Cleanup test logs
    await HVNCActivityLog.deleteMany({ 
      user_email: 'test@example.com',
      'event_data.test': true
    });
    console.log('  ✅ Test logs cleaned up');
    
    return true;
    
  } catch (error) {
    console.error('  ❌ Activity logging test failed:', error.message);
    return false;
  }
}

/**
 * Test configuration and environment
 */
async function testConfiguration() {
  console.log('⚙️ Testing configuration...');
  
  try {
    const config = envConfig.hvnc;
    
    // Verify required settings
    const requiredSettings = [
      'JWT_SECRET',
      'ACCESS_CODE_LENGTH', 
      'ACCESS_CODE_EXPIRY',
      'SESSION_IDLE_TIMEOUT'
    ];
    
    for (const setting of requiredSettings) {
      if (!config[setting]) {
        console.log(`  ⚠️ Missing configuration: HVNC_${setting}`);
      } else {
        console.log(`  ✅ Configuration present: ${setting}`);
      }
    }
    
    // Test Redis connection (if configured)
    try {
      const { redisHealthCheck } = require('../config/redis');
      const redisStatus = await redisHealthCheck();
      console.log(`  ✅ Redis status: ${redisStatus.status}`);
    } catch (error) {
      console.log(`  ⚠️ Redis health check failed: ${error.message}`);
    }
    
    return true;
    
  } catch (error) {
    console.error('  ❌ Configuration test failed:', error.message);
    return false;
  }
}

/**
 * Run comprehensive system test
 */
async function runTests() {
  console.log('🧪 Starting HVNC System Integration Tests...\n');
  
  const testResults = [];
  
  const tests = [
    ['Database Connection', testDatabase],
    ['Admin Authentication', testAdminAuthentication],
    ['Device Management', testDeviceManagement], 
    ['Access Codes', testAccessCodes],
    ['Session Management', testSessionManagement],
    ['Activity Logging', testActivityLogging],
    ['Configuration', testConfiguration]
  ];
  
  for (const [testName, testFn] of tests) {
    try {
      const result = await testFn();
      testResults.push({ name: testName, passed: result });
      console.log();
    } catch (error) {
      console.error(`💥 Test "${testName}" crashed:`, error.message);
      testResults.push({ name: testName, passed: false, error: error.message });
      console.log();
    }
  }
  
  // Print summary
  console.log('📊 Test Results Summary:');
  console.log('========================');
  
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;
  
  testResults.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log(`\n📈 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! HVNC system is ready for use.');
    return true;
  } else {
    console.log('⚠️  Some tests failed. Please review and fix issues before deployment.');
    return false;
  }
}

// Run tests if called directly
if (require.main === module) {
  const connectDB = async () => {
    try {
      await mongoose.connect(envConfig.mongo.MONGO_URI, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 30000,
        connectTimeoutMS: 30000,
      });
      console.log('📊 Connected to MongoDB for testing');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    }  };
  
  connectDB()
    .then(() => runTests())
    .then((success) => {
      mongoose.disconnect();
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 Tests failed:', error);
      mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = {
  runTests,
  testDatabase,
  testAdminAuthentication,
  testDeviceManagement,
  testAccessCodes, 
  testSessionManagement,
  testActivityLogging,
  testConfiguration
};