// HVNC WebSocket Test Scripts for Node.js
// Usage: node hvnc-test.js

const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

// Configuration
const config = {
  serverUrl: 'http://localhost:4000',
  jwtSecret: 'your_jwt_secret', // Replace with your actual JWT secret
  testDeviceId: 'test_device_123',
  testUserEmail: 'test@mydeeptech.ng'
};

// Helper function to create test tokens
function createTestToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
}

// Test tokens
const adminToken = createTestToken({
  email: 'admin@mydeeptech.ng',
  role: 'admin',
  userId: 'admin123'
});

const userToken = createTestToken({
  userId: 'user123',
  email: 'user@test.com',
  fullName: 'Test User'
});

const deviceToken = createTestToken({
  id: 'device123',
  device_id: config.testDeviceId,
  type: 'device'
});

// Test functions
class HVNCTester {
  constructor() {
    this.sockets = new Map();
    this.testResults = [];
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}] ${message}`);
    this.testResults.push({ timestamp, type, message });
  }

  async connectNamespace(namespace, token, testName) {
    return new Promise((resolve, reject) => {
      this.log(`Starting test: ${testName}`, 'TEST');
      
      const socket = io(`${config.serverUrl}/hvnc-${namespace}`, {
        path: '/hvnc/socket.io',
        auth: { token },
        query: { namespace, testMode: true },
        transports: ['websocket', 'polling'],
        timeout: 10000
      });

      this.sockets.set(namespace, socket);

      socket.on('connect', () => {
        this.log(`✅ ${testName} - Connected to ${namespace} namespace`, 'SUCCESS');
        this.log(`Socket ID: ${socket.id}`);
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        this.log(`❌ ${testName} - Connection failed: ${error.message}`, 'ERROR');
        reject(error);
      });

      socket.on('disconnect', (reason) => {
        this.log(`🔌 ${testName} - Disconnected: ${reason}`, 'WARNING');
        this.sockets.delete(namespace);
      });

      socket.on('error', (error) => {
        this.log(`💥 ${testName} - Socket error: ${JSON.stringify(error)}`, 'ERROR');
      });
    });
  }

  async testAdminNamespace() {
    try {
      const socket = await this.connectNamespace('admin', adminToken, 'Admin Connection Test');
      
      // Test device states event
      socket.on('device_states', (data) => {
        this.log(`📊 Received device states: ${data.length} devices`);
      });

      socket.on('device_online', (data) => {
        this.log(`🟢 Device online event: ${data.device_id}`);
      });

      socket.on('command_sent', (data) => {
        this.log(`⚡ Command sent: ${data.command_id}`);
      });

      socket.on('command_error', (data) => {
        this.log(`❌ Command error: ${data.error}`, 'ERROR');
      });

      // Test sending a command
      setTimeout(() => {
        this.log('📡 Testing send_command...');
        socket.emit('send_command', {
          device_id: config.testDeviceId,
          type: 'system',
          action: 'get_status',
          parameters: {},
          priority: 'normal'
        });
      }, 2000);

      return socket;
    } catch (error) {
      this.log(`Admin test failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  async testUserNamespace() {
    try {
      const socket = await this.connectNamespace('user', userToken, 'User Connection Test');

      socket.on('assigned_devices', (data) => {
        this.log(`📱 Assigned devices: ${data.devices.length} devices`);
      });

      socket.on('session_started', (data) => {
        this.log(`🚀 Session started: ${data.session_id}`);
      });

      socket.on('session_error', (data) => {
        this.log(`❌ Session error: ${data.error}`, 'ERROR');
      });

      // Test getting assigned devices
      setTimeout(() => {
        this.log('📡 Testing get_assigned_devices...');
        socket.emit('get_assigned_devices');
      }, 2000);

      return socket;
    } catch (error) {
      this.log(`User test failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  async testDeviceNamespace() {
    try {
      const socket = await this.connectNamespace('device', deviceToken, 'Device Connection Test');

      socket.on('command', (data) => {
        this.log(`📝 Command received: ${data.action}`);
        
        // Simulate command response
        setTimeout(() => {
          socket.emit('command_result', {
            command_id: data.id,
            status: 'success',
            result: { message: 'Command executed successfully' },
            execution_time: Math.floor(Math.random() * 1000)
          });
        }, 1000);
      });

      socket.on('session_started', (data) => {
        this.log(`🎮 Session started on device: ${data.session_id}`);
      });

      socket.on('status_ack', (data) => {
        this.log(`✅ Status acknowledged: ${data.success}`);
      });

      // Test sending device status
      setTimeout(() => {
        this.log('📡 Testing device_status...');
        socket.emit('device_status', {
          cpu_usage: 45,
          memory_usage: 68,
          disk_usage: 32,
          screen_resolution: '1920x1080',
          active_windows: ['Chrome', 'VS Code'],
          last_activity: new Date()
        });
      }, 2000);

      // Test Hubstaff update
      setTimeout(() => {
        this.log('📡 Testing hubstaff_update...');
        socket.emit('hubstaff_update', {
          timer_running: true,
          project_id: 'project123',
          project_name: 'Test Project',
          elapsed_minutes: 45
        });
      }, 3000);

      return socket;
    } catch (error) {
      this.log(`Device test failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  async runAllTests() {
    this.log('🚀 Starting HVNC WebSocket tests...', 'TEST');
    
    try {
      // Test all namespaces in parallel
      const tests = [
        this.testAdminNamespace(),
        this.testUserNamespace(),
        this.testDeviceNamespace()
      ];

      await Promise.allSettled(tests);
      
      this.log('⏱️  Running tests for 30 seconds...', 'TEST');
      await new Promise(resolve => setTimeout(resolve, 30000));

      this.log('🧹 Cleaning up connections...', 'TEST');
      this.cleanup();

      this.log('✅ All tests completed!', 'SUCCESS');
      this.printSummary();

    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'ERROR');
    }
  }

  cleanup() {
    for (const [namespace, socket] of this.sockets.entries()) {
      this.log(`Disconnecting ${namespace}...`);
      socket.disconnect();
    }
    this.sockets.clear();
  }

  printSummary() {
    const summary = this.testResults.reduce((acc, result) => {
      acc[result.type] = (acc[result.type] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📊 Test Summary:');
    console.log('================');
    Object.entries(summary).forEach(([type, count]) => {
      console.log(`${type}: ${count}`);
    });
    console.log(`Total events: ${this.testResults.length}`);
  }
}

// Quick test functions for individual namespaces
async function quickTestAdmin() {
  const tester = new HVNCTester();
  await tester.testAdminNamespace();
  setTimeout(() => tester.cleanup(), 10000);
}

async function quickTestUser() {
  const tester = new HVNCTester();
  await tester.testUserNamespace();
  setTimeout(() => tester.cleanup(), 10000);
}

async function quickTestDevice() {
  const tester = new HVNCTester();
  await tester.testDeviceNamespace();
  setTimeout(() => tester.cleanup(), 10000);
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'admin') {
    quickTestAdmin();
  } else if (args[0] === 'user') {
    quickTestUser();
  } else if (args[0] === 'device') {
    quickTestDevice();
  } else {
    const tester = new HVNCTester();
    tester.runAllTests();
  }
}

module.exports = { HVNCTester, quickTestAdmin, quickTestUser, quickTestDevice };