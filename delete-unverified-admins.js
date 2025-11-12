#!/usr/bin/env node

/**
 * MongoDB Script to Delete Unverified Admin Accounts
 * 
 * This script connects to your MongoDB database and deletes all admin accounts
 * that have not verified their email addresses.
 * 
 * Admin accounts are identified by:
 * - Email ending with @mydeeptech.ng
 * - isEmailVerified: false
 * 
 * Usage: node delete-unverified-admins.js
 */

const mongoose = require('mongoose');
const DTUser = require('./models/dtUser.model');
require('dotenv').config();

// MongoDB connection
const connectToMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is not set!');
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully!');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// Function to delete unverified admin accounts
const deleteUnverifiedAdmins = async () => {
  try {
    console.log('\n🔍 Searching for unverified admin accounts...');
    
    // Query to find unverified admin accounts
    const query = {
      email: { $regex: /@mydeeptech\.ng$/i }, // Admin emails end with @mydeeptech.ng
      isEmailVerified: false                   // Not email verified
    };

    // First, let's see what we'll delete
    const unverifiedAdmins = await DTUser.find(query).select('fullName email createdAt');
    
    if (unverifiedAdmins.length === 0) {
      console.log('✅ No unverified admin accounts found!');
      console.log('📊 All admin accounts are properly verified.');
      return;
    }

    console.log(`\n⚠️  Found ${unverifiedAdmins.length} unverified admin account(s):`);
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ Unverified Admin Accounts to be Deleted                    │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    
    unverifiedAdmins.forEach((admin, index) => {
      const createdDate = new Date(admin.createdAt).toLocaleDateString();
      console.log(`│ ${index + 1}. ${admin.fullName.padEnd(25)} │ ${admin.email.padEnd(25)} │ ${createdDate} │`);
    });
    
    console.log('└─────────────────────────────────────────────────────────────┘');

    // Add confirmation prompt
    console.log('\n🚨 WARNING: This action cannot be undone!');
    console.log('These admin accounts will be permanently deleted from the database.');
    
    // In a real script, you might want to add readline for confirmation
    // For now, we'll proceed with a timeout to allow manual cancellation
    console.log('\n⏳ Starting deletion in 5 seconds... (Press Ctrl+C to cancel)');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Perform the deletion
    console.log('\n🗑️  Deleting unverified admin accounts...');
    const result = await DTUser.deleteMany(query);
    
    console.log(`\n✅ Successfully deleted ${result.deletedCount} unverified admin account(s)!`);
    
    // Show summary
    console.log('\n📊 Deletion Summary:');
    console.log(`   • Accounts searched: Admin emails ending with @mydeeptech.ng`);
    console.log(`   • Filter criteria: isEmailVerified = false`);
    console.log(`   • Accounts deleted: ${result.deletedCount}`);
    console.log(`   • Remaining verified admins: Still in database`);

    // Optional: Show remaining admin accounts
    const remainingAdmins = await DTUser.find({ 
      email: { $regex: /@mydeeptech\.ng$/i } 
    }).select('fullName email isEmailVerified createdAt');

    if (remainingAdmins.length > 0) {
      console.log(`\n✅ Remaining admin accounts (${remainingAdmins.length}):`);
      remainingAdmins.forEach((admin, index) => {
        const status = admin.isEmailVerified ? '✅ Verified' : '⚠️ Unverified';
        console.log(`   ${index + 1}. ${admin.fullName} (${admin.email}) - ${status}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error deleting unverified admin accounts:', error.message);
    throw error;
  }
};

// Main execution function
const main = async () => {
  try {
    console.log('🧹 MongoDB Cleanup: Delete Unverified Admin Accounts');
    console.log('═══════════════════════════════════════════════════════════');
    
    await connectToMongoDB();
    await deleteUnverifiedAdmins();
    
    console.log('\n🎉 Cleanup completed successfully!');
    console.log('💡 You can run this script again anytime to clean up unverified admins.');
    
  } catch (error) {
    console.error('\n💥 Script failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n🔌 MongoDB connection closed.');
    }
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { deleteUnverifiedAdmins, connectToMongoDB };