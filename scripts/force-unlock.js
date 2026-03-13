const mongoose = require('mongoose');

async function forceUnlockAccount() {
  try {
    // Connect to database
    const MONGO_URI = process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected');

    const email = 'dammykolaceo@gmail.com';

    console.log('🔓 Force unlocking account...');

    // Direct MongoDB update to unlock account
    const result = await mongoose.connection.db.collection('hvncusers').updateOne(
      { email: email },
      { 
        $set: {
          is_account_locked: false,
          failed_login_attempts: 0,
          last_failed_attempt: null,
          account_locked_until: null
        }
      }
    );

    console.log('📋 Update result:', result);

    // Verify the change
    const user = await mongoose.connection.db.collection('hvncusers').findOne({ email: email });
    console.log('\n✅ Verified account status:');
    console.log('   Email:', user.email);
    console.log('   Name:', user.full_name);
    console.log('   Account locked:', user.is_account_locked);
    console.log('   Failed attempts:', user.failed_login_attempts);

    console.log('\n🎉 Account should now be unlocked!');

  } catch (error) {
    console.error('❌ Force unlock failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

// Load environment
require('dotenv').config();
forceUnlockAccount();