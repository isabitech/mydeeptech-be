const mongoose = require('mongoose');
const HVNCUser = require('../models/hvnc-user.model');
const HVNCDevice = require('../models/hvnc-device.model');
const HVNCShift = require('../models/hvnc-shift.model');
const emailService = require('../services/hvnc-email.service');
const hvncVerificationStore = require('../utils/hvncVerificationStore');

async function exactControllerDebug() {
  try {
    // Connect to database
    const MONGO_URI = process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected');

    console.log('🔍 EXACT CONTROLLER LOGIC DEBUG\n');

    // Controller parameters
    const email = 'dammykolaceo@gmail.com';
    const deviceId = 'CEO';

    console.log('📋 Request Parameters:');
    console.log('   email:', email);
    console.log('   device_id:', deviceId);

    // Step 1: Validate required fields
    console.log('\n1️⃣ Validate required fields...');
    if (!email || !deviceId) {
      console.log('❌ Missing required fields');
      return;
    }
    console.log('✅ Required fields present');

    // Step 2: Find the user
    console.log('\n2️⃣ Finding user...');
    const user = await HVNCUser.findByEmail(email);
    console.log('   Raw user query result:', !!user);
    
    if (!user) {
      console.log('❌ User not found - would return generic message');
      return;
    }
    
    console.log('   User found:', user.full_name);
    console.log('   Account locked:', user.is_account_locked);
    
    if (user.is_account_locked) {
      console.log('❌ Account is locked - would return generic message');
      return;
    }
    console.log('✅ User account is active');

    // Step 3: Check if device exists
    console.log('\n3️⃣ Finding device...');
    const device = await HVNCDevice.findByDeviceId(deviceId);
    console.log('   Raw device query result:', !!device);
    
    if (!device) {
      console.log('❌ Device not found - would return error');
      return;
    }
    
    console.log('   Device found:', device.pc_name);
    console.log('   Device status:', device.status);
    
    if (device.status === 'disabled') {
      console.log('❌ Device disabled - would return error');
      return;
    }
    console.log('✅ Device is active');

    // Step 4: Check if user has any shifts for this device
    console.log('\n4️⃣ Checking shifts...');
    const shifts = await HVNCShift.findActiveShiftsForUser(email, device.device_id); // Use device.device_id!
    console.log('   Shifts found:', shifts.length);
    
    if (shifts.length === 0) {
      console.log('❌ No active shifts - would return 403 error');
      return;
    }
    
    shifts.forEach((shift, i) => {
      console.log(`   Shift ${i+1}: ${shift.start_time}-${shift.end_time} (${shift.timezone})`);
    });
    console.log('✅ Active shifts found');

    // Step 5: Generate access code
    console.log('\n5️⃣ Would generate access code and send email...');
    console.log('✅ All validations passed - email should be sent!');

    console.log('\n🔎 ANALYSIS:');
    console.log('   The controller should reach the email sending part');
    console.log('   If this debug shows success but API still returns generic message,');
    console.log('   there might be a caching issue or different database state');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

// Load environment
require('dotenv').config();
exactControllerDebug();