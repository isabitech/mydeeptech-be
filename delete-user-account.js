// Delete DTUser Account by Email
// This script completely removes a user account and all related data so they can register again

const mongoose = require('mongoose');
require('dotenv').config();

const DTUser = require('./models/dtUser.model');
const ProjectApplication = require('./models/projectApplication.model');
const TaskAssignment = require('./models/taskAssignment.model');
// Add other models that might reference the user


async function deleteUserAccount(userEmail) {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    if (!userEmail) {
      console.log('❌ Please provide a user email address');
      console.log('Usage: node delete-user-account.js user@example.com');
      return;
    }

    console.log(`🔍 Searching for user: ${userEmail}`);

    // Find the user first
    const user = await DTUser.findOne({ email: userEmail });
    
    if (!user) {
      console.log(`❌ User not found with email: ${userEmail}`);
      return;
    }

    console.log(`\n👤 Found user:`);
    console.log(`   📧 Email: ${user.email}`);
    console.log(`   👤 Name: ${user.fullName}`);
    console.log(`   📱 Phone: ${user.phone}`);
    console.log(`   📅 Registered: ${user.createdAt}`);
    console.log(`   📊 Annotator Status: ${user.annotatorStatus}`);
    console.log(`   🔧 MicroTasker Status: ${user.microTaskerStatus}`);
    console.log(`   ✅ Email Verified: ${user.isEmailVerified}`);

    const userId = user._id;

    console.log(`\n🔍 Checking related data for user ID: ${userId}`);

    // Check for project applications
    const applications = await ProjectApplication.find({ applicantId: userId });
    console.log(`📝 Project Applications: ${applications.length}`);
    
    if (applications.length > 0) {
      console.log(`   Applications found in projects:`);
      for (const app of applications) {
        await app.populate('projectId', 'projectName');
        console.log(`   - ${app.projectId?.projectName || 'Unknown Project'} (Status: ${app.status})`);
      }
    }

    // Check for task assignments
    const taskAssignments = await TaskAssignment.find({ assignedTo: userId });
    console.log(`📋 Task Assignments: ${taskAssignments.length}`);

    // Check for any result submissions
    const resultSubmissions = user.resultSubmissions?.length || 0;
    console.log(`📄 Result Submissions: ${resultSubmissions}`);

    // Ask for confirmation
    console.log(`\n⚠️  WARNING: This will permanently delete:`);
    console.log(`   👤 User account: ${user.fullName} (${user.email})`);
    console.log(`   📝 ${applications.length} project applications`);
    console.log(`   📋 ${taskAssignments.length} task assignments`);
    console.log(`   📄 ${resultSubmissions} result submissions`);
    console.log(`   🗂️  All associated profile data`);
    console.log(`\n✅ After deletion, they can register again with the same email.`);
    
    // For safety, require manual confirmation in production
    const isTestEmail = userEmail.includes('@mailinator.com') || 
                       userEmail.includes('@example.com') || 
                       userEmail.includes('test');

    if (!isTestEmail) {
      console.log(`\n🛡️  SAFETY CHECK: This appears to be a real user account.`);
      console.log(`   To proceed, please confirm by adding --confirm flag:`);
      console.log(`   node delete-user-account.js ${userEmail} --confirm`);
      
      // Check if --confirm flag is provided
      const confirmFlag = process.argv.includes('--confirm');
      if (!confirmFlag) {
        console.log(`\n❌ Deletion cancelled for safety. Use --confirm to proceed.`);
        return;
      }
    }

    console.log(`\n🗑️  Starting deletion process...`);

    // Start deletion process
    let deletedCount = 0;

    // 1. Delete project applications
    if (applications.length > 0) {
      const appResult = await ProjectApplication.deleteMany({ applicantId: userId });
      deletedCount += appResult.deletedCount;
      console.log(`   ✅ Deleted ${appResult.deletedCount} project applications`);
    }

    // 2. Delete task assignments
    if (taskAssignments.length > 0) {
      const taskResult = await TaskAssignment.deleteMany({ assignedTo: userId });
      deletedCount += taskResult.deletedCount;
      console.log(`   ✅ Deleted ${taskResult.deletedCount} task assignments`);
    }

    // 3. Delete any result submissions from cloud storage if needed
    // Note: You might want to add Cloudinary cleanup here if user has uploaded files
    if (user.resultSubmissions && user.resultSubmissions.length > 0) {
      console.log(`   📄 Found ${user.resultSubmissions.length} result submissions`);
      // Add Cloudinary deletion logic here if needed
      console.log(`   ⚠️  Note: Cloud storage files may need manual cleanup`);
    }

    // 4. Finally, delete the user account
    const userResult = await DTUser.deleteOne({ _id: userId });
    console.log(`   ✅ Deleted user account: ${userResult.deletedCount} user`);

    console.log(`\n🎯 Deletion Summary:`);
    console.log(`   👤 User: ${user.fullName} (${user.email})`);
    console.log(`   📝 Project Applications: ${applications.length} deleted`);
    console.log(`   📋 Task Assignments: ${taskAssignments.length} deleted`);
    console.log(`   🗂️  User Account: ${userResult.deletedCount} deleted`);
    console.log(`   📊 Total Records: ${deletedCount + userResult.deletedCount} deleted`);
    
    console.log(`\n✅ Account deletion completed successfully!`);
    console.log(`📧 ${userEmail} can now register again with the same email address.`);
    console.log(`🔄 They will start fresh with a new account and clean slate.`);

  } catch (error) {
    console.error('❌ Error during deletion:', error);
    console.log('\n🛡️  The account was NOT deleted due to the error above.');
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Get email from command line arguments
const userEmail = "confidencechiojiaku@gmail.com";

if (!userEmail) {
  console.log('❌ Please provide a user email address');
  console.log('Usage: node delete-user-account.js user@example.com');
  console.log('Usage: node delete-user-account.js user@example.com --confirm (for non-test emails)');
  process.exit(1);
}

// Run the script
deleteUserAccount(userEmail);

module.exports = deleteUserAccount;