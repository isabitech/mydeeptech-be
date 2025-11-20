// Remove Pending Applications Without Resume and Send Notifications
// This script removes only pending applications where users don't have resumes uploaded

const mongoose = require('mongoose');
require('dotenv').config();

const ProjectApplication = require('./models/projectApplication.model');
const AnnotationProject = require('./models/annotationProject.model');
const DTUser = require('./models/dtUser.model');
const { sendEmail } = require('./utils/mailer');

async function removePendingApplicationsWithoutResume() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    const PROJECT_ID = '6915dbacf42225fa10bd6fae';
    
    console.log('🎯 REMOVING PENDING APPLICATIONS WITHOUT RESUMES');
    console.log('================================================');
    console.log(`📋 Project ID: ${PROJECT_ID}\n`);

    // Step 1: Get project details
    const project = await AnnotationProject.findById(PROJECT_ID);
    if (!project) {
      console.log('❌ Project not found!');
      return;
    }

    console.log(`✅ Project: "${project.projectName}"`);
    console.log(`📂 Category: ${project.projectCategory}`);
    console.log(`💰 Pay Rate: $${project.payRate} ${project.payRateCurrency || 'USD'}\n`);

    // Step 2: Find pending applications without resumes
    const pendingApplications = await ProjectApplication.find({ 
      projectId: PROJECT_ID,
      status: 'pending' // Only pending applications
    }).populate('applicantId', 'fullName email attachments.resume_url annotatorStatus');

    console.log(`📊 Found ${pendingApplications.length} pending applications`);

    // Filter applications where users don't have resumes
    const applicationsWithoutResume = pendingApplications.filter(app => {
      const user = app.applicantId;
      const hasResume = !!(user?.attachments?.resume_url && user.attachments.resume_url.trim() !== '');
      return !hasResume;
    });

    console.log(`🎯 Applications without resumes: ${applicationsWithoutResume.length}`);

    if (applicationsWithoutResume.length === 0) {
      console.log('✅ All pending applications already have resumes uploaded!');
      return;
    }

    // Step 3: Display applications that will be removed
    console.log('\n📋 Applications to be removed:');
    console.log('===============================');
    
    applicationsWithoutResume.forEach((app, index) => {
      const user = app.applicantId;
      console.log(`${index + 1}. ${user?.fullName || 'Unknown'} (${user?.email || 'Unknown'})`);
      console.log(`   📅 Applied: ${app.appliedAt.toLocaleDateString()}`);
      console.log(`   📝 Status: ${app.status}`);
      console.log(`   👤 Annotator Status: ${user?.annotatorStatus || 'Unknown'}`);
      if (app.coverLetter) {
        console.log(`   💬 Cover Letter: "${app.coverLetter.substring(0, 80)}..."`);
      }
      console.log('');
    });

    // Confirmation flag for safety
    const CONFIRM_REMOVAL = false; // Change to true to proceed
    
    if (!CONFIRM_REMOVAL) {
      console.log('🛑 REMOVAL STOPPED - Safety confirmation required');
      console.log('📝 To proceed:');
      console.log('   1. Review the applications listed above');
      console.log('   2. Change CONFIRM_REMOVAL to true in this script');
      console.log('   3. Run the script again');
      console.log(`\n💡 This will remove ${applicationsWithoutResume.length} applications and send notification emails.`);
      return;
    }

    // Step 4: Remove applications and send emails
    console.log('\n🗑️ Removing applications and sending notifications...');
    
    let removedCount = 0;
    let emailsSent = 0;
    const errors = [];

    for (const application of applicationsWithoutResume) {
      const user = application.applicantId;
      
      try {
        // Remove the application
        await ProjectApplication.findByIdAndDelete(application._id);
        removedCount++;
        console.log(`✅ Removed application for ${user.fullName}`);

        // Send notification email
        try {
          await sendResumeRequiredEmail(user.email, user.fullName, project);
          emailsSent++;
          console.log(`📧 Email sent to ${user.fullName}`);
        } catch (emailError) {
          console.log(`⚠️ Failed to send email to ${user.fullName}: ${emailError.message}`);
          errors.push(`Email failed for ${user.fullName}: ${emailError.message}`);
        }
        
      } catch (removeError) {
        console.log(`❌ Failed to remove application for ${user.fullName}: ${removeError.message}`);
        errors.push(`Removal failed for ${user.fullName}: ${removeError.message}`);
      }
    }

    // Step 5: Update project statistics
    const remainingApplications = await ProjectApplication.countDocuments({ projectId: PROJECT_ID });
    await AnnotationProject.findByIdAndUpdate(PROJECT_ID, {
      totalApplications: remainingApplications
    });

    // Step 6: Summary
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

    console.log('\n📝 Users have been notified to:');
    console.log('1. Upload their resume in profile section');
    console.log('2. Reapply to the project with resume attached');
    console.log('3. Benefit from the improved application process');

  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Email template for resume requirement notification
async function sendResumeRequiredEmail(userEmail, userName, project) {
  const subject = `Resume Required - Reapply to ${project.projectName}`;
  
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
                We hope this email finds you well. We're writing regarding your application to the project <strong>${project.projectName}</strong>.
            </p>

            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #856404;">📋 Application Update Required</h3>
                <p style="margin-bottom: 0; color: #856404;">
                    We have updated our application process to ensure better quality and faster review times. 
                    <strong>All applicants are now required to upload their resume</strong> before applying to projects.
                </p>
            </div>
            
            <div style="background: #ffffff; border: 2px solid #007bff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #007bff;">📝 What You Need to Do</h3>
                <ol style="color: #333; margin-bottom: 0;">
                    <li style="margin-bottom: 10px;"><strong>Upload Your Resume:</strong> Go to your profile section and upload your CV/resume (PDF, DOC, or DOCX format)</li>
                    <li style="margin-bottom: 10px;"><strong>Reapply to Project:</strong> Once your resume is uploaded, you can reapply to "${project.projectName}"</li>
                    <li style="margin-bottom: 0;"><strong>Faster Review:</strong> Your application will be reviewed faster with your resume attached</li>
                </ol>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="https://mydeeptech.ng/profile" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-right: 10px;">
                    Upload Resume
                </a>
                <a href="https://mydeeptech.ng/projects" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    View Projects
                </a>
            </div>

            <div style="background: #e8f4fd; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #0056b3;">💡 Why This Change?</h4>
                <ul style="margin-bottom: 0; color: #333;">
                    <li>Faster application review process for admins</li>
                    <li>Better matching of skills to project requirements</li>
                    <li>Improved communication during the selection process</li>
                    <li>Higher success rates for approved applicants</li>
                </ul>
            </div>

            <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #155724;">🎯 Project Details</h4>
                <p style="margin-bottom: 0; color: #155724;">
                    <strong>Project:</strong> ${project.projectName}<br>
                    <strong>Category:</strong> ${project.projectCategory}<br>
                    <strong>Pay Rate:</strong> $${project.payRate} ${project.payRateCurrency || 'USD'}<br>
                    <strong>Status:</strong> Still accepting applications
                </p>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
                If you have any questions about this process, please don't hesitate to reach out to our support team.
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

  const textContent = `
Hi ${userName},

We're writing regarding your application to the project "${project.projectName}".

APPLICATION UPDATE REQUIRED:
We have updated our application process to ensure better quality and faster review times. All applicants are now required to upload their resume before applying to projects.

WHAT YOU NEED TO DO:
1. Upload Your Resume: Go to your profile section and upload your CV/resume (PDF, DOC, or DOCX format)
2. Reapply to Project: Once your resume is uploaded, you can reapply to "${project.projectName}"
3. Faster Review: Your application will be reviewed faster with your resume attached

PROJECT DETAILS:
- Project: ${project.projectName}
- Category: ${project.projectCategory}
- Pay Rate: $${project.payRate} ${project.payRateCurrency || 'USD'}
- Status: Still accepting applications

WHY THIS CHANGE?
- Faster application review process for admins
- Better matching of skills to project requirements
- Improved communication during the selection process
- Higher success rates for approved applicants

To upload your resume: https://mydeeptech.ng/profile
To view projects: https://mydeeptech.ng/projects

If you have any questions about this process, please reach out to our support team.

Best regards,
MyDeeptech Team
https://mydeeptech.ng
  `;

  try {
    await sendEmail({
      to: userEmail,
      subject: subject,
      html: htmlContent,
      text: textContent
    });
  } catch (error) {
    throw new Error(`Failed to send email to ${userEmail}: ${error.message}`);
  }
}

// Helper function to just list pending applications without resumes
async function listPendingWithoutResume() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const PROJECT_ID = '6915dbacf42225fa10bd6fae';
    
    const project = await AnnotationProject.findById(PROJECT_ID);
    const pendingApplications = await ProjectApplication.find({ 
      projectId: PROJECT_ID,
      status: 'pending'
    }).populate('applicantId', 'fullName email attachments.resume_url');

    const withoutResume = pendingApplications.filter(app => {
      const user = app.applicantId;
      return !(user?.attachments?.resume_url && user.attachments.resume_url.trim() !== '');
    });

    console.log('🎯 PENDING APPLICATIONS WITHOUT RESUMES');
    console.log('=======================================');
    console.log(`📋 Project: ${project?.projectName}`);
    console.log(`📊 Pending applications without resumes: ${withoutResume.length}\n`);

    withoutResume.forEach((app, index) => {
      const user = app.applicantId;
      console.log(`${index + 1}. ${user?.fullName} (${user?.email})`);
      console.log(`   Applied: ${app.appliedAt.toLocaleDateString()}`);
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
  console.log('📋 Listing pending applications without resumes...\n');
  listPendingWithoutResume();
} else {
  console.log('🎯 Running targeted removal script...\n');
  removePendingApplicationsWithoutResume();
}

module.exports = { removePendingApplicationsWithoutResume, listPendingWithoutResume };