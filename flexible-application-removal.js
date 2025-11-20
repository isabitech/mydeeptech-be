// Flexible Application Removal Script with Resume Requirements
// This script can remove applications based on different criteria and resume status

const mongoose = require('mongoose');
require('dotenv').config();

const ProjectApplication = require('./models/projectApplication.model');
const AnnotationProject = require('./models/annotationProject.model');
const DTUser = require('./models/dtUser.model');
const { sendEmail } = require('./utils/mailer');

async function flexibleApplicationRemoval(options = {}) {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    const PROJECT_ID = '6915dbacf42225fa10bd6fae';
    const {
      statuses = ['pending'], // Which application statuses to consider
      requireResume = true,    // Whether to filter by resume requirement
      sendEmails = true,       // Whether to send notification emails
      dryRun = true           // Whether to actually perform the removal
    } = options;
    
    console.log('🎯 FLEXIBLE APPLICATION REMOVAL');
    console.log('==============================');
    console.log(`📋 Project ID: ${PROJECT_ID}`);
    console.log(`📊 Target statuses: ${statuses.join(', ')}`);
    console.log(`📄 Require resume check: ${requireResume ? 'Yes' : 'No'}`);
    console.log(`📧 Send emails: ${sendEmails ? 'Yes' : 'No'}`);
    console.log(`🧪 Dry run: ${dryRun ? 'Yes (no changes will be made)' : 'No (will make changes)'}`);
    console.log('');

    // Get project details
    const project = await AnnotationProject.findById(PROJECT_ID);
    if (!project) {
      console.log('❌ Project not found!');
      return;
    }

    console.log(`✅ Project: "${project.projectName}"`);
    console.log(`📂 Category: ${project.projectCategory}\n`);

    // Find applications matching criteria
    const applications = await ProjectApplication.find({ 
      projectId: PROJECT_ID,
      status: { $in: statuses }
    }).populate('applicantId', 'fullName email attachments.resume_url annotatorStatus');

    console.log(`📊 Found ${applications.length} applications with status: ${statuses.join(', ')}`);

    // Filter by resume requirement if needed
    let targetApplications = applications;
    if (requireResume) {
      targetApplications = applications.filter(app => {
        const user = app.applicantId;
        const hasResume = !!(user?.attachments?.resume_url && user.attachments.resume_url.trim() !== '');
        return !hasResume;
      });
      console.log(`🎯 Applications without resumes: ${targetApplications.length}`);
    }

    if (targetApplications.length === 0) {
      console.log('✅ No applications match the removal criteria!');
      if (requireResume) {
        console.log('🎉 All targeted applications already have resumes uploaded.');
      }
      return;
    }

    // Display applications that match criteria
    console.log('\n📋 Applications matching removal criteria:');
    console.log('==========================================');
    
    targetApplications.forEach((app, index) => {
      const user = app.applicantId;
      const hasResume = !!(user?.attachments?.resume_url && user.attachments.resume_url.trim() !== '');
      
      console.log(`${index + 1}. ${user?.fullName || 'Unknown'} (${user?.email || 'Unknown'})`);
      console.log(`   📅 Applied: ${app.appliedAt.toLocaleDateString()}`);
      console.log(`   📝 Application Status: ${app.status}`);
      console.log(`   👤 User Status: ${user?.annotatorStatus || 'Unknown'}`);
      console.log(`   📄 Has Resume: ${hasResume ? '✅ Yes' : '❌ No'}`);
      if (user?.attachments?.resume_url) {
        console.log(`   🔗 Resume URL: ${user.attachments.resume_url.substring(0, 50)}...`);
      }
      if (app.coverLetter) {
        console.log(`   💬 Cover Letter: "${app.coverLetter.substring(0, 80)}..."`);
      }
      console.log('');
    });

    if (dryRun) {
      console.log('🧪 DRY RUN MODE - No changes will be made');
      console.log(`📊 Would remove: ${targetApplications.length} applications`);
      console.log(`📧 Would send: ${sendEmails ? targetApplications.length : 0} notification emails`);
      console.log('\n💡 To execute the removal:');
      console.log('1. Set dryRun: false in the script options');
      console.log('2. Run the script again');
      return;
    }

    // Perform actual removal and notifications
    console.log('\n🗑️ Performing removal and sending notifications...');
    
    let removedCount = 0;
    let emailsSent = 0;
    const errors = [];

    for (const application of targetApplications) {
      const user = application.applicantId;
      
      try {
        // Remove the application
        await ProjectApplication.findByIdAndDelete(application._id);
        removedCount++;
        console.log(`✅ Removed application for ${user.fullName}`);

        // Send notification email if enabled
        if (sendEmails) {
          try {
            await sendResumeRequiredEmail(user.email, user.fullName, project, application.status);
            emailsSent++;
            console.log(`📧 Email sent to ${user.fullName}`);
          } catch (emailError) {
            console.log(`⚠️ Failed to send email to ${user.fullName}: ${emailError.message}`);
            errors.push(`Email failed for ${user.fullName}: ${emailError.message}`);
          }
        }
        
      } catch (removeError) {
        console.log(`❌ Failed to remove application for ${user.fullName}: ${removeError.message}`);
        errors.push(`Removal failed for ${user.fullName}: ${removeError.message}`);
      }
    }

    // Update project statistics
    const remainingApplications = await ProjectApplication.countDocuments({ projectId: PROJECT_ID });
    await AnnotationProject.findByIdAndUpdate(PROJECT_ID, {
      totalApplications: remainingApplications
    });

    // Summary
    console.log('\n🎉 REMOVAL COMPLETED');
    console.log('===================');
    console.log(`📋 Project: ${project.projectName}`);
    console.log(`🗑️ Applications removed: ${removedCount}`);
    console.log(`📧 Emails sent: ${emailsSent}`);
    console.log(`📊 Remaining applications: ${remainingApplications}`);
    
    if (errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

async function sendResumeRequiredEmail(userEmail, userName, project, originalStatus) {
  const subject = `Resume Required - Reapply to ${project.projectName}`;
  
  const statusMessage = originalStatus === 'approved' 
    ? 'We had to temporarily remove your approved application' 
    : 'We had to remove your pending application';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Resume Required - MyDeeptech</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">📄 Resume Required</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Application Update Required</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <p style="font-size: 18px; margin-bottom: 20px;">Hi <strong>${userName}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
                We hope this email finds you well. We're writing regarding your application to <strong>${project.projectName}</strong>.
            </p>

            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #856404;">📋 Important Update</h3>
                <p style="margin-bottom: 0; color: #856404;">
                    ${statusMessage} because we now require all applicants to have their resume uploaded in their profile. 
                    This helps us provide better and faster review of applications.
                </p>
            </div>
            
            <div style="background: #ffffff; border: 2px solid #007bff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #007bff;">📝 Quick Steps to Reapply</h3>
                <ol style="color: #333; margin-bottom: 0;">
                    <li style="margin-bottom: 10px;"><strong>Upload Resume:</strong> Go to your profile and upload your CV (PDF, DOC, or DOCX)</li>
                    <li style="margin-bottom: 10px;"><strong>Reapply:</strong> Submit your application again with resume attached</li>
                    <li style="margin-bottom: 0;"><strong>Faster Review:</strong> Your application will be processed much faster!</li>
                </ol>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="https://mydeeptech.ng/profile" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-right: 10px;">
                    📄 Upload Resume
                </a>
                <a href="https://mydeeptech.ng/projects" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    🎯 Apply to Projects
                </a>
            </div>

            <div style="background: #e8f4fd; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #0056b3;">🎯 Project Still Available</h4>
                <p style="margin-bottom: 0; color: #333;">
                    <strong>Project:</strong> ${project.projectName}<br>
                    <strong>Category:</strong> ${project.projectCategory}<br>
                    <strong>Pay Rate:</strong> $${project.payRate} ${project.payRateCurrency || 'USD'}<br>
                    <strong>Status:</strong> ✅ Still accepting applications
                </p>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
                Thank you for your understanding. This change helps us serve you better!
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            
            <p style="font-size: 14px; color: #666; text-align: center; margin: 0;">
                Best regards,<br>
                <strong>MyDeeptech Team</strong><br>
                <a href="https://mydeeptech.ng" style="color: #007bff;">mydeeptech.ng</a>
            </p>
        </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: userEmail,
    subject: subject,
    html: htmlContent
  });
}

// Predefined scenarios
async function removePendingWithoutResume() {
  await flexibleApplicationRemoval({
    statuses: ['pending'],
    requireResume: true,
    sendEmails: true,
    dryRun: false
  });
}

async function removeAllWithoutResume() {
  await flexibleApplicationRemoval({
    statuses: ['pending', 'approved'],
    requireResume: true,
    sendEmails: true,
    dryRun: false
  });
}

async function previewRemoval() {
  await flexibleApplicationRemoval({
    statuses: ['pending'],
    requireResume: true,
    sendEmails: true,
    dryRun: true
  });
}

// Command line interface
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case '--preview':
    console.log('🔍 Preview mode - showing what would be removed...\n');
    previewRemoval();
    break;
  case '--pending-only':
    console.log('🎯 Removing pending applications without resumes...\n');
    removePendingWithoutResume();
    break;
  case '--all-statuses':
    console.log('🎯 Removing ALL applications without resumes...\n');
    removeAllWithoutResume();
    break;
  default:
    console.log('🎯 FLEXIBLE APPLICATION REMOVAL TOOL');
    console.log('====================================');
    console.log('Available commands:');
    console.log('  --preview        Show what would be removed (dry run)');
    console.log('  --pending-only   Remove only pending applications without resumes');
    console.log('  --all-statuses   Remove ALL applications without resumes (pending + approved)');
    console.log('');
    console.log('Example: node remove-pending-without-resume.js --preview');
    break;
}

module.exports = { 
  flexibleApplicationRemoval, 
  removePendingWithoutResume, 
  removeAllWithoutResume, 
  previewRemoval 
};