const mongoose = require('mongoose');
const HVNCUser = require('../models/hvnc-user.model');
const HVNCDevice = require('../models/hvnc-device.model');
const HVNCShift = require('../models/hvnc-shift.model');

async function debugRealScenario() {
  try {
    // Connect to database
    const MONGO_URI = process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected');

    const email = 'dammykolaceo@gmail.com';
    const deviceId = 'CEO';

    console.log('🔍 DEBUG: Step by step validation (exactly like the controller)...\n');

    // Step 1: Find user
    console.log('1️⃣ Finding user...');
    const user = await HVNCUser.findByEmail(email);
    if (!user || user.is_account_locked) {
      console.log('❌ User issue:', user ? 'Account locked' : 'Not found');
      console.log('   This would return the generic message you got');
      return;
    }
    console.log('✅ User found:', user.full_name);
    console.log('   Account locked:', user.is_account_locked);

    // Step 2: Find device  
    console.log('\n2️⃣ Finding device...');
    const device = await HVNCDevice.findByDeviceId(deviceId);
    if (!device || device.status === 'disabled') {
      console.log('❌ Device issue:', device ? `Status: ${device.status}` : 'Not found');
      console.log('   This would return an error, not the generic message');
      return;
    }
    console.log('✅ Device found:', device.pc_name);
    console.log('   Status:', device.status);

    // Step 3: Check shifts
    console.log('\n3️⃣ Checking active shifts...');
    const shifts = await HVNCShift.findActiveShiftsForUser(email, deviceId);
    console.log('   Active shifts found:', shifts.length);
    
    if (shifts.length === 0) {
      console.log('❌ No active shifts - this explains the generic message!');
      console.log('   Controller returns generic success for security');
      
      // Check if shift enforcement is disabled
      console.log('\n🔍 Checking shift enforcement...');
      console.log('   HVNC_ENFORCE_SHIFTS:', process.env.HVNC_ENFORCE_SHIFTS);
      
      if (process.env.HVNC_ENFORCE_SHIFTS === 'false') {
        console.log('✅ Shift enforcement disabled - should bypass shift check');
      } else {
        console.log('⚠️ Shift enforcement enabled - requires active shifts');
      }
    } else {
      console.log('✅ Active shifts found');
      shifts.forEach((shift, i) => {
        console.log(`   Shift ${i+1}:`, {
          start: shift.start_time,
          end: shift.end_time, 
          timezone: shift.timezone
        });
      });
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

// Load environment
require('dotenv').config();
debugRealScenario();