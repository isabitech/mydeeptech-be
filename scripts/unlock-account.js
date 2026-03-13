const mongoose = require('mongoose');
const HVNCUser = require('../models/hvnc-user.model');

async function unlockUserAccount() {
  try {
    // Connect to database
    const MONGO_URI = process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected');

    const email = 'dammykolaceo@gmail.com';

    console.log('🔓 Unlocking user account...');
    
    // Find and unlock the user
    const user = await HVNCUser.findByEmail(email);
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('📋 Current user status:');
    console.log('   Name:', user.full_name);
    console.log('   Email:', user.email);
    console.log('   Account locked:', user.is_account_locked);
    console.log('   Failed attempts:', user.failed_login_attempts);
    console.log('   Last failed attempt:', user.last_failed_attempt);

    if (user.is_account_locked) {
      // Unlock the account
      user.is_account_locked = false;
      user.failed_login_attempts = 0;
      user.last_failed_attempt = null;
      user.account_locked_until = null;
      
      await user.save();
      
      console.log('\n🎉 Account unlocked successfully!');
    } else {
      console.log('\n✅ Account was not locked');
    }

    console.log('\n📧 You can now try requesting the access code again');

  } catch (error) {
    console.error('❌ Failed to unlock account:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

// Load environment
require('dotenv').config();
unlockUserAccount();