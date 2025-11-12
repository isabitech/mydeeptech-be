#!/usr/bin/env node

/**
 * MongoDB Cleanup Script - Delete Unverified Admin Accounts (SAFE VERSION)
 * 
 * This script safely deletes admin accounts that haven't verified their email.
 * It includes confirmation prompts and detailed logging.
 * 
 * Safety Features:
 * - Shows what will be deleted before proceeding
 * - Requires manual confirmation
 * - Detailed logging and error handling
 * - Backup suggestion before deletion
 * 
 * Usage: node delete-unverified-admins-safe.js
 */

const mongoose = require('mongoose');
const DTUser = require('./models/dtUser.model');
const readline = require('readline');
require('dotenv').config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

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

// Function to safely delete unverified admin accounts
const deleteUnverifiedAdminsSafe = async () => {
  try {
    console.log('\n🔍 Analyzing admin accounts...');
    
    // Query to find unverified admin accounts
    const query = {
      email: { $regex: /@mydeeptech\.ng$/i }, // Admin emails end with @mydeeptech.ng
      isEmailVerified: false                   // Not email verified
    };

    // Get detailed information about what will be deleted
    const unverifiedAdmins = await DTUser.find(query).select('fullName email createdAt domains');
    
    if (unverifiedAdmins.length === 0) {
      console.log('✅ No unverified admin accounts found!');
      console.log('📊 All admin accounts are properly verified.');
      return 0;
    }

    console.log(`\n⚠️  Found ${unverifiedAdmins.length} unverified admin account(s):`);
    console.log('┌────┬─────────────────────────┬─────────────────────────────┬─────────────┐');
    console.log('│ #  │ Name                    │ Email                       │ Created     │');
    console.log('├────┼─────────────────────────┼─────────────────────────────┼─────────────┤');
    
    unverifiedAdmins.forEach((admin, index) => {
      const createdDate = new Date(admin.createdAt).toLocaleDateString();
      const name = admin.fullName.slice(0, 23);
      const email = admin.email.slice(0, 27);
      console.log(`│ ${(index + 1).toString().padStart(2)} │ ${name.padEnd(23)} │ ${email.padEnd(27)} │ ${createdDate.padEnd(11)} │`);
    });
    
    console.log('└────┴─────────────────────────┴─────────────────────────────┴─────────────┘');

    // Safety warnings
    console.log('\n🚨 SAFETY NOTICE:');
    console.log('  • This action will PERMANENTLY delete these admin accounts');
    console.log('  • Deleted accounts cannot be recovered');
    console.log('  • Consider backing up your database first');
    console.log('  • Only unverified admin accounts will be deleted');

    // First confirmation
    const confirm1 = await askQuestion('\n❓ Do you want to proceed with deletion? (yes/no): ');
    if (confirm1.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled by user.');
      return 0;
    }

    // Second confirmation with exact count
    const confirm2 = await askQuestion(`\n❓ Are you sure you want to delete ${unverifiedAdmins.length} unverified admin account(s)? Type "DELETE" to confirm: `);
    if (confirm2 !== 'DELETE') {
      console.log('❌ Operation cancelled. Required confirmation not provided.');
      return 0;
    }

    // Final countdown
    console.log('\n⏳ Starting deletion in:');
    for (let i = 3; i > 0; i--) {
      console.log(`   ${i}... (Press Ctrl+C to cancel)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Perform the deletion
    console.log('\n🗑️  Executing deletion...');
    const startTime = Date.now();
    const result = await DTUser.deleteMany(query);
    const endTime = Date.now();
    
    console.log(`\n✅ Successfully deleted ${result.deletedCount} unverified admin account(s)!`);
    
    // Show detailed summary
    console.log('\n📊 Operation Summary:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   🎯 Target: Admin emails ending with @mydeeptech.ng`);
    console.log(`   🔍 Filter: isEmailVerified = false`);
    console.log(`   📦 Found: ${unverifiedAdmins.length} accounts`);
    console.log(`   🗑️  Deleted: ${result.deletedCount} accounts`);
    console.log(`   ⏱️  Duration: ${endTime - startTime}ms`);
    console.log(`   📅 Date: ${new Date().toISOString()}`);

    // Show remaining admin accounts for verification
    console.log('\n🔍 Verifying remaining admin accounts...');
    const remainingAdmins = await DTUser.find({ 
      email: { $regex: /@mydeeptech\.ng$/i } 
    }).select('fullName email isEmailVerified');

    if (remainingAdmins.length > 0) {
      console.log(`\n✅ Remaining admin accounts (${remainingAdmins.length}):`);
      remainingAdmins.forEach((admin, index) => {
        const status = admin.isEmailVerified ? '✅ Verified' : '⚠️ Still Unverified';
        console.log(`   ${index + 1}. ${admin.fullName} (${admin.email}) - ${status}`);
      });
    } else {
      console.log('\n🚨 No admin accounts remaining! This might not be intended.');
    }

    return result.deletedCount;

  } catch (error) {
    console.error('\n❌ Error during deletion operation:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
};

// Main execution function
const main = async () => {
  try {
    console.log('🧹 MongoDB Cleanup: Safe Delete Unverified Admin Accounts');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🛡️  This is the SAFE version with confirmations');
    
    await connectToMongoDB();
    const deletedCount = await deleteUnverifiedAdminsSafe();
    
    if (deletedCount > 0) {
      console.log('\n🎉 Cleanup completed successfully!');
      console.log(`📊 ${deletedCount} unverified admin accounts were removed.`);
    } else {
      console.log('\n✨ No cleanup needed!');
    }
    
  } catch (error) {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  } finally {
    // Close readline and MongoDB connection
    rl.close();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n🔌 MongoDB connection closed.');
    }
  }
};

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n❌ Operation cancelled by user (Ctrl+C)');
  rl.close();
  mongoose.connection.close();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { deleteUnverifiedAdminsSafe };