const mongoose = require('mongoose');
const DTUser = require('../models/dtUser.model');
require('dotenv').config();

const updateUsersWithQAStatus = async () => {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('✅ Connected to database');
    console.log('🔍 Checking users without qaStatus field...');
    
    // Find users that don't have qaStatus field or have null/undefined qaStatus
    const usersWithoutQAStatus = await DTUser.find({
      $or: [
        { qaStatus: { $exists: false } },
        { qaStatus: null },
        { qaStatus: undefined }
      ]
    });
    
    console.log(`📊 Found ${usersWithoutQAStatus.length} users without qaStatus field`);
    
    if (usersWithoutQAStatus.length === 0) {
      console.log('✅ All users already have qaStatus field');
      return;
    }
    
    console.log('🔧 Updating users to include qaStatus field...');
    
    // Update all users without qaStatus to have default "pending" status
    const updateResult = await DTUser.updateMany(
      {
        $or: [
          { qaStatus: { $exists: false } },
          { qaStatus: null },
          { qaStatus: undefined }
        ]
      },
      {
        $set: { qaStatus: "pending" }
      }
    );
    
    console.log(`✅ Updated ${updateResult.modifiedCount} users with qaStatus: "pending"`);
    
    // Verify the update
    const verifyCount = await DTUser.countDocuments({ qaStatus: { $exists: true } });
    const totalCount = await DTUser.countDocuments({});
    
    console.log(`📊 Verification: ${verifyCount}/${totalCount} users now have qaStatus field`);
    
    if (verifyCount === totalCount) {
      console.log('✅ All users now have qaStatus field!');
    } else {
      console.log('⚠️  Some users still missing qaStatus field');
    }
    
  } catch (error) {
    console.error('❌ Error updating users with qaStatus:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Run the script if called directly
if (require.main === module) {
  updateUsersWithQAStatus()
    .then(() => {
      console.log('🎉 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = updateUsersWithQAStatus;