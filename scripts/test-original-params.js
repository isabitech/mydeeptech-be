const mongoose = require('mongoose');
const HVNCUser = require('../models/hvnc-user.model');
const HVNCDevice = require('../models/hvnc-device.model');
const emailService = require('../services/hvnc-email.service');

async function testOriginalParams() {
  try {
    // Connect to database
    const MONGO_URI = process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected');

    // Your ORIGINAL parameters that should now work
    const email = 'dammykolaceo@gmail.com';
    const deviceId = 'CEO'; // This should now work with the fixed findByDeviceId

    console.log('🔄 Testing with your ORIGINAL parameters:');
    console.log('   Email:', email);
    console.log('   Device ID:', deviceId);

    // Find user and device using the fixed method
    console.log('\n🔍 Testing the fixed device lookup...');
    const user = await HVNCUser.findByEmail(email);
    const device = await HVNCDevice.findByDeviceId(deviceId); // This should now find "CEO" by pc_name

    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    if (!device) {
      console.log('❌ Device still not found with fixed method');
      return;
    }

    console.log('✅ User found:', user.full_name);
    console.log('✅ Device found:', device.pc_name, '(actual device_id:', device.device_id + ')');

    // Generate code and send email
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    console.log('\n📧 Sending email with your original parameters...');
    await emailService.sendAccessCode(user, device, code, expiresAt);
    
    console.log('🎉 SUCCESS! Your original request should now work again!');
    console.log('✅ You can keep using device_id: "CEO" in your POST requests');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

// Load environment
require('dotenv').config();
testOriginalParams();