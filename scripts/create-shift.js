const mongoose = require('mongoose');
const HVNCShift = require('../models/hvnc-shift.model');

async function createShiftForUser() {
  try {
    // Connect to database
    const MONGO_URI = process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected');

    const email = 'dammykolaceo@gmail.com';
    const deviceId = 'HVNC_386792859'; // Use actual device_id, not device name

    console.log('📅 Creating active shift for user...');
    
    // Check existing shifts
    const existingShifts = await HVNCShift.findActiveShiftsForUser(email, deviceId);
    console.log('📋 Existing shifts:', existingShifts.length);

    if (existingShifts.length > 0) {
      console.log('✅ User already has shifts:');
      existingShifts.forEach((shift, i) => {
        console.log(`   Shift ${i+1}:`, {
          start: shift.start_time,
          end: shift.end_time,
          timezone: shift.timezone
        });
      });
    } else {
      // Create a 24/7 shift for testing
      const shift = new HVNCShift({
        user_email: email,
        device_id: deviceId,
        start_date: new Date(), // Today
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        start_time: '00:00',
        end_time: '23:59',
        timezone: 'UTC',
        is_recurring: true,
        days_of_week: [0, 1, 2, 3, 4, 5, 6], // Sunday=0 to Saturday=6
        status: 'active'
      });

      await shift.save();
      console.log('🎉 24/7 shift created successfully!');
      console.log('   Start:', shift.start_time);
      console.log('   End:', shift.end_time);
      console.log('   Days:', shift.days_of_week.join(', '));
    }

    console.log('\n📧 You can now try requesting the access code again');

  } catch (error) {
    console.error('❌ Failed to create shift:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

// Load environment
require('dotenv').config();
createShiftForUser();