const mongoose = require('mongoose');
const HVNCShift = require('../models/hvnc-shift.model');

async function createFullDayShift() {
  try {
    // Connect to database
    const MONGO_URI = process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected');

    const email = 'dammykolaceo@gmail.com';
    const deviceId = 'HVNC_386792859';

    console.log('⏰ Current time:', new Date().toISOString());
    console.log('⏰ Current UTC time:', new Date().toUTCString());

    console.log('\n🔍 Checking current shifts...');
    const shifts = await HVNCShift.findActiveShiftsForUser(email, deviceId);
    console.log('📋 Active shifts:', shifts.length);

    shifts.forEach((shift, i) => {
      console.log(`   Shift ${i+1}:`, {
        start: shift.start_time,
        end: shift.end_time,
        timezone: shift.timezone,
        days: shift.days_of_week,
        startDate: shift.start_date,
        endDate: shift.end_date
      });
    });

    // Check if current time is in shift
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    
    console.log(`\n⏰ Current UTC time: ${currentTimeStr}`);
    
    const inShift = shifts.some(shift => {
      return shift.start_time <= currentTimeStr && currentTimeStr <= shift.end_time;
    });
    
    console.log('✳️  Currently in shift window:', inShift);

    if (!inShift) {
      console.log('\n📅 Creating 24/7 shift to fix access issues...');
      
      // Delete existing limited shift
      await HVNCShift.deleteMany({ user_email: email, device_id: deviceId });
      console.log('🗑️  Deleted existing limited shifts');

      // Create 24/7 shift
      const shift = new HVNCShift({
        user_email: email,
        device_id: deviceId,
        start_date: new Date(),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        start_time: '00:00',
        end_time: '23:59',
        timezone: 'UTC',
        is_recurring: true,
        days_of_week: [0, 1, 2, 3, 4, 5, 6], // All days
        status: 'active'
      });

      await shift.save();
      console.log('🎉 24/7 shift created successfully!');
    } else {
      console.log('✅ Already in active shift window');
    }

  } catch (error) {
    console.error('❌ Failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

// Load environment
require('dotenv').config();
createFullDayShift();