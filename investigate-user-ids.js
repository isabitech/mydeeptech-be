// Check User IDs and Find Applications
// This script helps find the correct user IDs and their applications

const mongoose = require('mongoose');
require('dotenv').config();

const DTUser = require('./models/dtUser.model');
const ProjectApplication = require('./models/projectApplication.model');

const TARGET_USER_IDS = [
  '691486674b9960cf4217665c',
  '69148bed4b9960cf421766b7', 
  '6916df4e8d8e029c01a1c441',
  '69149269ada25252bd8e8957'
];

async function investigateUserIds() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🔍 Investigating user IDs and applications...\n');

    // Check if these IDs exist in DTUser collection
    console.log('📋 Checking DTUser collection:');
    for (const userId of TARGET_USER_IDS) {
      const user = await DTUser.findById(userId);
      if (user) {
        console.log(`   ✅ Found user: ${user.fullName} (${user.email})`);
      } else {
        console.log(`   ❌ User ID not found: ${userId}`);
      }
    }

    // Check recent applications to understand the ID format
    console.log('\n📊 Recent applications in the system:');
    const recentApps = await ProjectApplication.find({})
      .populate('applicantId', 'fullName email')
      .populate('projectId', 'projectName')
      .sort({ createdAt: -1 })
      .limit(10);

    if (recentApps.length === 0) {
      console.log('❌ No applications found in the system');
    } else {
      console.log(`Found ${recentApps.length} recent applications:`);
      for (const app of recentApps) {
        console.log(`   👤 User: ${app.applicantId?.fullName || 'Unknown'} (ID: ${app.applicantId?._id})`);
        console.log(`      📧 Email: ${app.applicantId?.email || 'No email'}`);
        console.log(`      📋 Project: ${app.projectId?.projectName || 'Unknown project'}`);
        console.log(`      📊 Status: ${app.status}`);
        console.log(`      📄 Resume: ${app.resumeUrl ? 'Has Resume' : 'No Resume'}`);
        console.log(`      📅 Applied: ${app.appliedAt}`);
        console.log('');
      }
    }

    // Check if there are any users without resume in their profile
    console.log('📋 Checking users without resume in profile:');
    const usersWithoutResume = await DTUser.find({
      $or: [
        { resumeUrl: { $exists: false } },
        { resumeUrl: null },
        { resumeUrl: '' }
      ]
    }).select('_id fullName email resumeUrl').limit(10);

    if (usersWithoutResume.length > 0) {
      console.log(`Found ${usersWithoutResume.length} users without resume:`);
      for (const user of usersWithoutResume) {
        console.log(`   👤 ${user.fullName} (${user.email})`);
        console.log(`      🆔 ID: ${user._id}`);
        console.log(`      📄 Resume: ${user.resumeUrl || 'None'}`);
        
        // Check if this user has any applications
        const userApps = await ProjectApplication.find({ applicantId: user._id });
        console.log(`      📝 Applications: ${userApps.length}`);
        console.log('');
      }
    } else {
      console.log('✅ All users have resume URLs');
    }

    // Search for applications by email or name if provided
    console.log('🔍 Would you like to search by email or name instead?');
    console.log('   You can provide user emails or names to find their applications');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
investigateUserIds();

module.exports = investigateUserIds;