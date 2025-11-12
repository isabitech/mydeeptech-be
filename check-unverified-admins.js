#!/usr/bin/env node

/**
 * MongoDB Query Script - Check Unverified Admin Accounts
 * 
 * This script only QUERIES (doesn't delete) to show you which admin accounts
 * would be deleted. Use this to verify before running the deletion script.
 * 
 * Usage: node check-unverified-admins.js
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

// Function to check unverified admin accounts (READ ONLY)
const checkUnverifiedAdmins = async () => {
  try {
    console.log('\n🔍 Analyzing admin accounts in your database...');
    
    // Query all admin accounts
    const allAdmins = await DTUser.find({ 
      email: { $regex: /@mydeeptech\.ng$/i }
    }).select('fullName email isEmailVerified createdAt');

    // Split into verified and unverified
    const verifiedAdmins = allAdmins.filter(admin => admin.isEmailVerified);
    const unverifiedAdmins = allAdmins.filter(admin => !admin.isEmailVerified);

    console.log('\n📊 Admin Account Analysis:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📁 Total admin accounts: ${allAdmins.length}`);
    console.log(`✅ Verified admin accounts: ${verifiedAdmins.length}`);
    console.log(`⚠️  Unverified admin accounts: ${unverifiedAdmins.length}`);

    if (unverifiedAdmins.length > 0) {
      console.log('\n🚨 UNVERIFIED ADMIN ACCOUNTS (Would be deleted):');
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
    }

    if (verifiedAdmins.length > 0) {
      console.log('\n✅ VERIFIED ADMIN ACCOUNTS (Would be kept):');
      console.log('┌────┬─────────────────────────┬─────────────────────────────┬─────────────┐');
      console.log('│ #  │ Name                    │ Email                       │ Created     │');
      console.log('├────┼─────────────────────────┼─────────────────────────────┼─────────────┤');
      
      verifiedAdmins.forEach((admin, index) => {
        const createdDate = new Date(admin.createdAt).toLocaleDateString();
        const name = admin.fullName.slice(0, 23);
        const email = admin.email.slice(0, 27);
        console.log(`│ ${(index + 1).toString().padStart(2)} │ ${name.padEnd(23)} │ ${email.padEnd(27)} │ ${createdDate.padEnd(11)} │`);
      });
      
      console.log('└────┴─────────────────────────┴─────────────────────────────┴─────────────┘');
    }

    console.log('\n🎯 Summary:');
    if (unverifiedAdmins.length === 0) {
      console.log('✅ All admin accounts are properly verified - no cleanup needed!');
    } else {
      console.log(`⚠️  ${unverifiedAdmins.length} unverified admin account(s) can be deleted`);
      console.log('💡 Run "node delete-unverified-admins.js" to delete them');
    }

    // Show the exact MongoDB query that would be used
    console.log('\n🔍 MongoDB Query Used:');
    console.log('Collection: DTUser');
    console.log('Filter: {');
    console.log('  email: { $regex: /@mydeeptech\\.ng$/i },');
    console.log('  isEmailVerified: false');
    console.log('}');

  } catch (error) {
    console.error('\n❌ Error checking admin accounts:', error.message);
    throw error;
  }
};

// Main execution function
const main = async () => {
  try {
    console.log('🔍 MongoDB Analysis: Check Unverified Admin Accounts');
    console.log('════════════════════════════════════════════════════════════');
    console.log('📋 This script only READS data - no changes will be made');
    
    await connectToMongoDB();
    await checkUnverifiedAdmins();
    
    console.log('\n✨ Analysis completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Script failed:', error.message);
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

module.exports = { checkUnverifiedAdmins };