const mongoose = require('mongoose');

async function quickDatabaseTest() {
  try {
    // Connect to database first
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
      console.error('❌ MONGO_URI not found in environment');
      return;
    }

    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected successfully');

    // Quick test to see if we can query
    const HVNCUser = require('../models/hvnc-user.model');
    const HVNCDevice = require('../models/hvnc-device.model');

    console.log('\n🔍 Testing database queries...');
    
    // Test user query
    const userCount = await HVNCUser.countDocuments();
    console.log(`📊 Total HVNC users: ${userCount}`);

    if (userCount > 0) {
      // Get some sample users
      const users = await HVNCUser.find({}, { email: 1, full_name: 1 }).limit(5);
      console.log('📧 Sample users:', users.map(u => ({ email: u.email, name: u.full_name })));
    }

    // Test device query  
    const deviceCount = await HVNCDevice.countDocuments();
    console.log(`💻 Total HVNC devices: ${deviceCount}`);

    if (deviceCount > 0) {
      // Get some sample devices
      const devices = await HVNCDevice.find({}, { device_id: 1, pc_name: 1 }).limit(5);
      console.log('💻 Sample devices:', devices.map(d => ({ id: d.device_id, name: d.pc_name })));
    }

  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

// Load environment variables
require('dotenv').config();

// Run the test
quickDatabaseTest();