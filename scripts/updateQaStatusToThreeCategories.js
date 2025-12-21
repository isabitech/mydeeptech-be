#!/usr/bin/env node

/**
 * Update QA Status to Three Categories Migration Script
 * 
 * This script updates the qaStatus field for all users to use only 3 categories:
 * - "pending" (default)
 * - "approved" (admin approved)
 * - "rejected" (admin rejected)
 * 
 * Migration Logic:
 * - "pending", "submitted", "verified" → "pending"
 * - "approved" → "approved" 
 * - "rejected" → "rejected"
 * - null/undefined → "pending"
 */

const mongoose = require('mongoose');
const DTUser = require('../models/dtUser.model');
require('dotenv').config();

const updateQAStatusToThreeCategories = async () => {
  try {
    console.log('🚀 Starting QA Status Three Categories Migration...');
    console.log('📅 Date:', new Date().toISOString());

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get all users and their current qaStatus
    console.log('🔍 Analyzing current qaStatus distribution...');
    
    const statusDistribution = await DTUser.aggregate([
      {
        $group: {
          _id: '$qaStatus',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    console.log('📊 Current qaStatus distribution:');
    statusDistribution.forEach(item => {
      console.log(`   ${item._id || 'null/undefined'}: ${item.count} users`);
    });

    // Define migration mappings
    const migrations = [
      {
        description: 'Set null/undefined qaStatus to "pending"',
        filter: { $or: [{ qaStatus: { $exists: false } }, { qaStatus: null }, { qaStatus: "" }] },
        update: { $set: { qaStatus: 'pending' } }
      },
      {
        description: 'Convert "submitted" to "pending"',
        filter: { qaStatus: 'submitted' },
        update: { $set: { qaStatus: 'pending' } }
      },
      {
        description: 'Convert "verified" to "pending"',
        filter: { qaStatus: 'verified' },
        update: { $set: { qaStatus: 'pending' } }
      }
    ];

    // Execute migrations
    let totalUpdated = 0;
    
    for (const migration of migrations) {
      console.log(`\\n🔄 ${migration.description}...`);
      
      const result = await DTUser.updateMany(migration.filter, migration.update);
      
      console.log(`   ✅ Updated ${result.modifiedCount} users`);
      totalUpdated += result.modifiedCount;
    }

    // Verify final distribution
    console.log('\\n🔍 Verifying final qaStatus distribution...');
    
    const finalDistribution = await DTUser.aggregate([
      {
        $group: {
          _id: '$qaStatus',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    console.log('📊 Final qaStatus distribution:');
    finalDistribution.forEach(item => {
      console.log(`   ${item._id}: ${item.count} users`);
    });

    // Validation check
    const invalidStatuses = await DTUser.find({
      qaStatus: { $nin: ['pending', 'approved', 'rejected'] }
    }).select('_id email qaStatus');

    if (invalidStatuses.length > 0) {
      console.log('\\n⚠️  WARNING: Found users with invalid qaStatus:');
      invalidStatuses.forEach(user => {
        console.log(`   - ${user.email}: "${user.qaStatus}"`);
      });
    } else {
      console.log('\\n✅ All users have valid qaStatus values');
    }

    // Summary
    console.log('\\n📈 MIGRATION SUMMARY:');
    console.log(`   • Total users updated: ${totalUpdated}`);
    console.log(`   • Valid statuses: pending, approved, rejected`);
    console.log(`   • Migration completed successfully!`);

    await mongoose.connection.close();
    console.log('\\n✅ MongoDB connection closed');
    console.log('🎉 QA Status migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

// Run migration if called directly
if (require.main === module) {
  updateQAStatusToThreeCategories()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = updateQAStatusToThreeCategories;