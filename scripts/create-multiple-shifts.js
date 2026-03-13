const mongoose = require('mongoose');
const HVNCShift = require('../models/hvnc-shift.model');

async function createMultipleShifts() {
  try {
    // Connect to database
    const MONGO_URI = process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected');

    const email = 'dammykolaceo@gmail.com';
    const deviceId = 'HVNC_386792859';

    console.log('📅 Creating multiple shifts to cover 24/7...\n');

    // Delete existing shifts first
    await HVNCShift.deleteMany({ user_email: email, device_id: deviceId });
    console.log('🗑️  Deleted existing shifts');

    // Create two 12-hour shifts to cover 24 hours
    const shifts = [
      {
        start_time: '00:00',
        end_time: '11:59', // 12 hours
        description: 'Night/Morning shift'
      },
      {
        start_time: '12:00', 
        end_time: '23:59', // 12 hours
        description: 'Afternoon/Evening shift'
      }
    ];

    for (let i = 0; i < shifts.length; i++) {
      const shiftData = shifts[i];
      
      const shift = new HVNCShift({
        user_email: email,
        device_id: deviceId,
        start_date: new Date(),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        start_time: shiftData.start_time,
        end_time: shiftData.end_time,
        timezone: 'UTC',
        is_recurring: true,
        days_of_week: [0, 1, 2, 3, 4, 5, 6], // All days
        status: 'active'
      });

      await shift.save();
      console.log(`✅ Created shift ${i + 1}: ${shiftData.start_time}-${shiftData.end_time} (${shiftData.description})`);
    }

    console.log('\n🎉 24/7 coverage created with multiple shifts!');
    console.log('📧 Your access codes should now work at any time');

  } catch (error) {
    console.error('❌ Failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

// Load environment
require('dotenv').config();
createMultipleShifts();