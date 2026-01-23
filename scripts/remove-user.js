// scripts/remove-user.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const envConfig = require('../config/envConfig');
const DTUser = require('../models/dtUser.model');

dotenv.config({ path: './.env' });


async function removeUser() {
  const mongoUri = envConfig.mongo.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI not set in envConfig.');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);

  const query = {
    $or: [
      { email: 'blessing_fedev@mydeeptech.ng' },
      { phone: '+2348144808482' },
      { username: 'blessing_fedev@mydeeptech.ng' }
    ]
  };


  const users = await DTUser.find(query);
  if (users.length === 0) {
    console.log('No matching users found.');
  } else {
    console.log('Matching user(s) found:');
    users.forEach(u => {
      console.log({
        _id: u._id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone
      });
    });
  }

  const result = await DTUser.deleteMany(query);
  console.log(`Deleted ${result.deletedCount} user(s).`);

  await mongoose.disconnect();
}

removeUser().catch(err => {
  console.error(err);
  process.exit(1);
});
