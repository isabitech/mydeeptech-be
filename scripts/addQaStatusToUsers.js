const mongoose = require('mongoose');
const DTUser = require('../models/dtUser.model');
require('dotenv').config();

/**
 * Script to add qaStatus field to all existing DTUsers
 * Sets default value to "pending" for users without this field
 */
const addQaStatusToAllUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📦 Connected to MongoDB');

    // Find all users that don't have qaStatus field or have null/undefined qaStatus
    const usersWithoutQaStatus = await DTUser.find({
      $or: [
        { qaStatus: { $exists: false } },
        { qaStatus: null },
        { qaStatus: undefined }
      ]
    });

    console.log(`🔍 Found ${usersWithoutQaStatus.length} users without qaStatus field`);

    if (usersWithoutQaStatus.length === 0) {
      console.log('✅ All users already have qaStatus field');
      process.exit(0);
    }

    // Update all users without qaStatus to have "pending" status
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
    const totalUsers = await DTUser.countDocuments();
    const usersWithQaStatus = await DTUser.countDocuments({ 
      qaStatus: { $exists: true, $ne: null } 
    });

    console.log(`📊 Total users: ${totalUsers}`);
    console.log(`📊 Users with qaStatus: ${usersWithQaStatus}`);

    if (totalUsers === usersWithQaStatus) {
      console.log('🎉 All users now have qaStatus field!');
    } else {
      console.log('⚠️ Some users still missing qaStatus field');
    }

  } catch (error) {
    console.error('❌ Error updating users:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('📦 Database connection closed');
  }
};

/**
 * Check current qaStatus distribution
 */
const checkQaStatusDistribution = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📦 Connected to MongoDB');

    const distribution = await DTUser.aggregate([
      {
        $group: {
          _id: "$qaStatus",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    console.log('📊 QA Status Distribution:');
    distribution.forEach(item => {
      console.log(`   ${item._id || 'null/undefined'}: ${item.count} users`);
    });

    const totalUsers = await DTUser.countDocuments();
    console.log(`📊 Total users: ${totalUsers}`);

  } catch (error) {
    console.error('❌ Error checking distribution:', error);
  } finally {
    await mongoose.connection.close();
  }
};

// Run the script based on command line argument
const command = process.argv[2];

switch (command) {
  case 'update':
    console.log('🚀 Adding qaStatus field to all users...');
    addQaStatusToAllUsers();
    break;
  case 'check':
    console.log('🔍 Checking qaStatus distribution...');
    checkQaStatusDistribution();
    break;
  default:
    console.log('Usage:');
    console.log('  node scripts/addQaStatusToUsers.js update  - Add qaStatus to all users');
    console.log('  node scripts/addQaStatusToUsers.js check   - Check current distribution');
    process.exit(1);
}