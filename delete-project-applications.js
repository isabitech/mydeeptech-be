// Delete Project Applications Script
// This script deletes applications for a specific project so users can reapply with resumes

const mongoose = require('mongoose');
require('dotenv').config();

const ProjectApplication = require('./models/projectApplication.model');
const AnnotationProject = require('./models/annotationProject.model');
const DTUser = require('./models/dtUser.model');

async function deleteProjectApplications() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    const PROJECT_ID = '6915dbacf42225fa10bd6fae';
    
    console.log('🗑️ DELETING APPLICATIONS FOR PROJECT');
    console.log('=====================================');
    console.log(`📋 Project ID: ${PROJECT_ID}\n`);

    // Step 1: Verify project exists
    console.log('📋 Step 1: Verifying project exists...');
    const project = await AnnotationProject.findById(PROJECT_ID);
    
    if (!project) {
      console.log('❌ Project not found!');
      return;
    }

    console.log(`✅ Project found: "${project.projectName}"`);
    console.log(`📂 Category: ${project.projectCategory}`);
    console.log(`💰 Pay Rate: $${project.payRate} ${project.payRateCurrency || 'USD'}`);

    // Step 2: Get all applications for this project
    console.log('\n📋 Step 2: Fetching applications...');
    const applications = await ProjectApplication.find({ projectId: PROJECT_ID })
      .populate('applicantId', 'fullName email attachments.resume_url annotatorStatus')
      .sort({ appliedAt: -1 });

    if (applications.length === 0) {
      console.log('✅ No applications found for this project');
      return;
    }

    console.log(`📊 Found ${applications.length} applications for this project:`);

    // Step 3: Display applications details
    console.log('\n📋 Step 3: Application details:');
    console.log('==========================================');
    
    applications.forEach((app, index) => {
      const user = app.applicantId;
      const hasResume = !!(user?.attachments?.resume_url && user.attachments.resume_url.trim() !== '');
      
      console.log(`\n${index + 1}. ${user?.fullName || 'Unknown User'}`);
      console.log(`   📧 Email: ${user?.email || 'Unknown'}`);
      console.log(`   📄 Resume: ${hasResume ? '✅ Has Resume' : '❌ No Resume'}`);
      console.log(`   👤 Status: ${user?.annotatorStatus || 'Unknown'}`);
      console.log(`   📝 Application Status: ${app.status}`);
      console.log(`   📅 Applied: ${app.appliedAt.toLocaleDateString()}`);
      if (app.coverLetter) {
        console.log(`   💬 Cover Letter: "${app.coverLetter.substring(0, 100)}${app.coverLetter.length > 100 ? '...' : ''}"`);
      }
    });

    // Step 4: Confirm deletion
    console.log('\n🚨 Step 4: Deletion confirmation');
    console.log('=====================================');
    console.log(`⚠️ You are about to DELETE ${applications.length} applications for project: "${project.projectName}"`);
    console.log('⚠️ This action cannot be undone!');
    console.log('⚠️ Users will need to reapply with their resumes uploaded.');
    
    // For safety, require manual confirmation in the script
    const CONFIRM_DELETION = false; // Change to true when you want to actually delete
    
    if (!CONFIRM_DELETION) {
      console.log('\n🛑 DELETION STOPPED - Safety flag is set to false');
      console.log('📝 To proceed with deletion:');
      console.log('   1. Review the applications listed above');
      console.log('   2. Change CONFIRM_DELETION to true in this script');
      console.log('   3. Run the script again');
      console.log('\n💡 This ensures you have reviewed all applications before deletion.');
      return;
    }

    // Step 5: Perform deletion (only if confirmed)
    console.log('\n🗑️ Step 5: Deleting applications...');
    
    const deletionResult = await ProjectApplication.deleteMany({ 
      projectId: PROJECT_ID 
    });

    console.log(`✅ Successfully deleted ${deletionResult.deletedCount} applications`);

    // Step 6: Update project statistics
    console.log('\n📊 Step 6: Updating project statistics...');
    
    await AnnotationProject.findByIdAndUpdate(PROJECT_ID, {
      $set: { totalApplications: 0 }
    });

    console.log('✅ Project statistics updated');

    // Step 7: Summary
    console.log('\n🎉 DELETION COMPLETED SUCCESSFULLY');
    console.log('==================================');
    console.log(`📋 Project: ${project.projectName}`);
    console.log(`🗑️ Applications deleted: ${deletionResult.deletedCount}`);
    console.log(`📊 Project total applications reset to: 0`);
    
    console.log('\n📝 Next Steps for Users:');
    console.log('1. Users need to upload their resume in profile section');
    console.log('2. Users can then reapply to the project');
    console.log('3. New applications will include resume URLs for admin review');
    
    console.log('\n💡 Benefits of reapplication:');
    console.log('✅ Resume requirement enforced');
    console.log('✅ Admin gets resume links in notification emails');
    console.log('✅ Better application quality and review process');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Additional helper function to list applications without deleting
async function listApplicationsOnly() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const PROJECT_ID = '6915dbacf42225fa10bd6fae';
    
    const project = await AnnotationProject.findById(PROJECT_ID);
    const applications = await ProjectApplication.find({ projectId: PROJECT_ID })
      .populate('applicantId', 'fullName email attachments.resume_url annotatorStatus')
      .sort({ appliedAt: -1 });

    console.log('📊 APPLICATION SUMMARY');
    console.log('======================');
    console.log(`📋 Project: ${project?.projectName || 'Unknown Project'}`);
    console.log(`📊 Total Applications: ${applications.length}\n`);

    applications.forEach((app, index) => {
      const user = app.applicantId;
      const hasResume = !!(user?.attachments?.resume_url && user.attachments.resume_url.trim() !== '');
      
      console.log(`${index + 1}. ${user?.fullName} (${user?.email})`);
      console.log(`   Resume: ${hasResume ? '✅' : '❌'} | Status: ${app.status} | Applied: ${app.appliedAt.toLocaleDateString()}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--list-only')) {
  console.log('📋 Listing applications only (no deletion)...\n');
  listApplicationsOnly();
} else {
  console.log('🗑️ Running deletion script...\n');
  deleteProjectApplications();
}

module.exports = { deleteProjectApplications, listApplicationsOnly };