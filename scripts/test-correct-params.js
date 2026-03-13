const mongoose = require('mongoose');
const HVNCUser = require('../models/hvnc-user.model');
const HVNCDevice = require('../models/hvnc-device.model');
const emailService = require('../services/hvnc-email.service');

async function testWithCorrectParams() {
  try {
    // Connect to database
    const MONGO_URI = process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected');

    // Correct parameters
    const email = 'dammykolaceo@gmail.com';
    const deviceId = 'HVNC_386792859'; // This is the ACTUAL device_id

    console.log('🎯 Testing with CORRECT parameters:');
    console.log('   Email:', email);
    console.log('   Device ID:', deviceId);

    // Find user and device
    const user = await HVNCUser.findByEmail(email);
    const device = await HVNCDevice.findByDeviceId(deviceId);

    console.log('\n✅ User found:', user.full_name);
    console.log('✅ Device found:', device.pc_name, '(ID:', device.device_id, ')');

    // Generate code and send email
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    console.log('\n📧 Sending email...');
    await emailService.sendAccessCode(user, device, code, expiresAt);
    
    console.log('🎉 SUCCESS! Email sent with correct parameters');
    console.log('\n📋 For your POST request, use:');
    console.log(JSON.stringify({
      email: email,
      device_id: deviceId
    }, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

// Load environment
require('dotenv').config();
testWithCorrectParams();