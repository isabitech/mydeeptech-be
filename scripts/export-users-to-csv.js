const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const DTUser = require('../models/dtUser.model');
const User = require('../models/user');
require('dotenv').config();

/**
 * Script to export all DTUsers and Admin users emails to CSV
 * Generates separate CSV files for DTUsers and Admin Users
 */

const exportUsersToCSV = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📦 Connected to MongoDB');

    // Get current timestamp for file naming
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Create exports directory if it doesn't exist
    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir);
      console.log('📁 Created exports directory');
    }

    // Export DTUsers
    console.log('🔍 Fetching DTUsers...');
    const dtUsers = await DTUser.find({}, {
      fullName: 1,
      email: 1,
      phone: 1,
      isEmailVerified: 1,
      hasSetPassword: 1,
      qaStatus: 1,
      createdAt: 1
    }).lean();

    console.log(`✅ Found ${dtUsers.length} DTUsers`);

    // Prepare DTUsers CSV data
    const dtUsersCSVHeaders = [
      'Full Name',
      'Email', 
      'Phone',
      'Email Verified',
      'Has Set Password',
      'QA Status',
      'Registration Date'
    ];
    const dtUsersCSVRows = [dtUsersCSVHeaders.join(',')];

    // Process DTUsers data
    dtUsers.forEach(user => {
      const row = [
        `"${user.fullName || ''}"`,
        `"${user.email || ''}"`,
        `"${user.phone || ''}"`,
        user.isEmailVerified ? 'Yes' : 'No',
        user.hasSetPassword ? 'Yes' : 'No',
        `"${user.qaStatus || 'pending'}"`,
        user.createdAt ? `"${user.createdAt.toISOString().split('T')[0]}"` : ''
      ];
      dtUsersCSVRows.push(row.join(','));
    });

    // Generate DTUsers CSV content
    const dtUsersCSVContent = dtUsersCSVRows.join('\n');
    const dtUsersFilename = `dtusers_export_${timestamp}.csv`;
    const dtUsersFilePath = path.join(exportDir, dtUsersFilename);

    // Write DTUsers CSV file
    fs.writeFileSync(dtUsersFilePath, dtUsersCSVContent);
    console.log(`📄 DTUsers CSV exported to: ${dtUsersFilePath}`);

    // Export Admin Users
    console.log('🔍 Fetching Admin Users...');
    const adminUsers = await User.find({ role: 'admin' }, {
      firstname: 1,
      lastname: 1,
      username: 1,
      email: 1,
      phone: 1,
      role: 1,
      createdAt: 1
    }).lean();

    console.log(`✅ Found ${adminUsers.length} Admin Users`);

    // Prepare Admin Users CSV data
    const adminUsersCSVHeaders = [
      'First Name',
      'Last Name',
      'Username',
      'Email',
      'Phone',
      'Role',
      'Registration Date'
    ];
    const adminUsersCSVRows = [adminUsersCSVHeaders.join(',')];

    // Process Admin Users data
    adminUsers.forEach(user => {
      const row = [
        `"${user.firstname || ''}"`,
        `"${user.lastname || ''}"`,
        `"${user.username || ''}"`,
        `"${user.email || ''}"`,
        `"${user.phone || ''}"`,
        `"${user.role || ''}"`,
        user.createdAt ? `"${user.createdAt.toISOString().split('T')[0]}"` : ''
      ];
      adminUsersCSVRows.push(row.join(','));
    });

    // Generate Admin Users CSV content
    const adminUsersCSVContent = adminUsersCSVRows.join('\n');
    const adminUsersFilename = `admin_users_export_${timestamp}.csv`;
    const adminUsersFilePath = path.join(exportDir, adminUsersFilename);

    // Write Admin Users CSV file
    fs.writeFileSync(adminUsersFilePath, adminUsersCSVContent);
    console.log(`📄 Admin Users CSV exported to: ${adminUsersFilePath}`);

    // Export Combined Email List (for quick email extraction)
    console.log('📧 Creating combined email list...');
    const combinedEmails = [
      'Email,Type,Name',
      ...dtUsers.map(user => `"${user.email}","DTUser","${user.fullName}"`),
      ...adminUsers.map(user => `"${user.email}","Admin","${user.firstname} ${user.lastname}"`)
    ];

    const combinedEmailsContent = combinedEmails.join('\n');
    const combinedEmailsFilename = `combined_emails_export_${timestamp}.csv`;
    const combinedEmailsFilePath = path.join(exportDir, combinedEmailsFilename);

    fs.writeFileSync(combinedEmailsFilePath, combinedEmailsContent);
    console.log(`📧 Combined emails CSV exported to: ${combinedEmailsFilePath}`);

    // Summary
    console.log('\n📊 Export Summary:');
    console.log(`   DTUsers: ${dtUsers.length}`);
    console.log(`   Admin Users: ${adminUsers.length}`);
    console.log(`   Total Users: ${dtUsers.length + adminUsers.length}`);
    console.log(`   Files created:`);
    console.log(`     - ${dtUsersFilename}`);
    console.log(`     - ${adminUsersFilename}`);
    console.log(`     - ${combinedEmailsFilename}`);

    console.log('\n✅ Export completed successfully!');
    
  } catch (error) {
    console.error('❌ Error exporting users to CSV:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('📦 MongoDB connection closed');
    process.exit(0);
  }
};

// Check command line arguments
const command = process.argv[2];

if (!command || command === 'export') {
  exportUsersToCSV();
} else if (command === 'help') {
  console.log(`
🚀 User Export Script Usage:

Commands:
  node scripts/export-users-to-csv.js export    - Export all users to CSV files
  node scripts/export-users-to-csv.js help     - Show this help message

The script will create three CSV files in the exports/ directory:
  1. dtusers_export_[date].csv - All DTUsers with detailed information
  2. admin_users_export_[date].csv - All Admin Users with detailed information  
  3. combined_emails_export_[date].csv - Simple email list with user type and name

Examples:
  npm run export-users
  node scripts/export-users-to-csv.js export
  `);
} else {
  console.log(`❌ Unknown command: ${command}`);
  console.log('Run "node scripts/export-users-to-csv.js help" for usage information');
  process.exit(1);
}