const mongoose = require('mongoose');
const HVNCUser = require('../models/hvnc-user.model');

async function properUnlock() {
  try {
    // Connect to database
    const MONGO_URI = process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected');

    const email = 'dammykolaceo@gmail.com';

    console.log('🔓 Proper account unlock...');
    
    const user = await HVNCUser.findByEmail(email);
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('📋 Current state:');
    console.log('   is_locked (actual field):', user.is_locked);
    console.log('   lock_until:', user.lock_until);
    console.log('   is_account_locked (virtual):', user.is_account_locked);

    // Use the built-in unlockAccount method
    await user.unlockAccount();
    
    console.log('✅ Account unlocked using proper method');
    
    // Verify the fix
    const verifyUser = await HVNCUser.findByEmail(email);
    console.log('\n📋 Verified state:');
    console.log('   is_locked:', verifyUser.is_locked);
    console.log('   lock_until:', verifyUser.lock_until);
    console.log('   is_account_locked (virtual):', verifyUser.is_account_locked);
    console.log('   failed_login_attempts:', verifyUser.failed_login_attempts);

    console.log('\n🎉 Account should now be properly unlocked!');

  } catch (error) {
    console.error('❌ Proper unlock failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

// Load environment
require('dotenv').config();
properUnlock();