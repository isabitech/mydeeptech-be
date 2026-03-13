const mongoose = require('mongoose');

async function checkDatabaseState() {
  try {
    // Connect to database
    const MONGO_URI = process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected\n');

    const email = 'dammykolaceo@gmail.com';

    // Check the raw document
    console.log('🔍 RAW DATABASE STATE:');
    const rawUser = await mongoose.connection.db.collection('hvncusers').findOne({ email: email });
    
    console.log('Raw document fields:');
    console.log('  _id:', rawUser._id);
    console.log('  email:', rawUser.email);
    console.log('  full_name:', rawUser.full_name);
    console.log('  is_account_locked:', rawUser.is_account_locked, '(type:', typeof rawUser.is_account_locked, ')');
    console.log('  failed_login_attempts:', rawUser.failed_login_attempts);
    console.log('  last_failed_attempt:', rawUser.last_failed_attempt);
    console.log('  account_locked_until:', rawUser.account_locked_until);

    // Check using Mongoose model
    console.log('\n🔍 MONGOOSE MODEL STATE:');
    const HVNCUser = require('../models/hvnc-user.model');
    const user = await HVNCUser.findByEmail(email);
    
    console.log('Mongoose model fields:');
    console.log('  email:', user.email);
    console.log('  full_name:', user.full_name);
    console.log('  is_account_locked:', user.is_account_locked, '(type:', typeof user.is_account_locked, ')');
    console.log('  failed_login_attempts:', user.failed_login_attempts);

    // Force set to false if needed
    if (user.is_account_locked) {
      console.log('\n🔧 FORCE FIXING THE LOCK STATE...');
      
      user.is_account_locked = false;
      user.failed_login_attempts = 0;
      user.last_failed_attempt = null;
      user.account_locked_until = null;
      
      await user.save();
      console.log('✅ Saved with model');
      
      // Verify again
      const verifyUser = await HVNCUser.findByEmail(email);
      console.log('✅ Verified: is_account_locked =', verifyUser.is_account_locked);
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

// Load environment
require('dotenv').config();
checkDatabaseState();