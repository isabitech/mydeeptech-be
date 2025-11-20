// Remove Specific Users' Applications and Send Resume Requirement Emails
// This script removes applications for specific user IDs and notifies them about the resume requirement

const mongoose = require('mongoose');
require('dotenv').config();

const DTUser = require('./models/dtUser.model');
const ProjectApplication = require('./models/projectApplication.model');
const AnnotationProject = require('./models/annotationProject.model');
const nodemailer = require('nodemailer');

// Target user IDs to remove
const TARGET_USER_IDS = [
  '691486674b9960cf4217665c',
  '69148bed4b9960cf421766b7', 
  '6916df4e8d8e029c01a1c441',
  '69149269ada25252bd8e8957'
];

async function removeSpecificUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    console.log(`🎯 Target Users: ${TARGET_USER_IDS.length} users`);
    console.log('📋 User IDs:', TARGET_USER_IDS);

    // Find all applications for these users
    const applications = await ProjectApplication.find({
      applicantId: { $in: TARGET_USER_IDS }
    }).populate('applicantId', 'fullName email phoneNumber')
      .populate('projectId', 'projectName projectCategory payRate payRateCurrency');

    if (applications.length === 0) {
      console.log('❌ No applications found for the specified user IDs');
      return;
    }

    console.log(`\n📊 Found ${applications.length} applications to remove:`);

    // Group applications by project for better tracking
    const projectGroups = {};
    const userDetails = {};

    for (const app of applications) {
      const projectId = app.projectId._id.toString();
      const userId = app.applicantId._id.toString();
      
      if (!projectGroups[projectId]) {
        projectGroups[projectId] = {
          project: app.projectId,
          applications: []
        };
      }
      
      projectGroups[projectId].applications.push(app);
      userDetails[userId] = app.applicantId;

      console.log(`   👤 ${app.applicantId.fullName} (${app.applicantId.email})`);
      console.log(`      📋 Project: ${app.projectId.projectName}`);
      console.log(`      📊 Status: ${app.status}`);
      console.log(`      📅 Applied: ${app.appliedAt.toDateString()}`);
      console.log(`      📄 Resume: ${app.resumeUrl ? '✅ Has Resume' : '❌ No Resume'}`);
      console.log('');
    }

    // Confirm removal
    console.log(`\n⚠️  About to remove ${applications.length} applications`);
    console.log('📧 Will send resume requirement emails to all users');
    
    // Remove applications
    const removeResult = await ProjectApplication.deleteMany({
      applicantId: { $in: TARGET_USER_IDS }
    });

    console.log(`\n✅ Successfully removed ${removeResult.deletedCount} applications`);

    // Update project statistics for each affected project
    for (const [projectId, group] of Object.entries(projectGroups)) {
      const project = group.project;
      const removedCount = group.applications.length;
      
      // Recalculate project stats
      const remainingApps = await ProjectApplication.countDocuments({ projectId });
      
      console.log(`📊 Project "${project.projectName}": Removed ${removedCount} applications, ${remainingApps} remaining`);
    }

    // Setup email transporter
    let transporter;
    try {
      transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER || process.env.BREVO_EMAIL,
          pass: process.env.EMAIL_PASS || process.env.BREVO_API_KEY
        }
      });
    } catch (emailSetupError) {
      console.log('❌ Email setup failed, will save email content to files');
    }

    // Send emails to each removed user
    console.log('\n📧 Sending resume requirement emails...');
    
    for (const userId of TARGET_USER_IDS) {
      const user = userDetails[userId];
      if (!user) {
        console.log(`⚠️  User ${userId} not found, skipping email`);
        continue;
      }

      // Find which projects they were removed from
      const userApps = applications.filter(app => app.applicantId._id.toString() === userId);
      const projects = userApps.map(app => app.projectId);
      
      const subject = `Resume Required - Reapply to Your Selected Projects`;
      
      const projectList = projects.map(p => 
        `• ${p.projectName} (${p.projectCategory}) - $${p.payRate} ${p.payRateCurrency || 'USD'}`
      ).join('\n');

      const emailContent = {
        to: user.email,
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
              <meta charset="UTF-8">
              <title>Resume Required - MyDeeptech</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="margin: 0; font-size: 28px;">📄 Resume Required</h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Application Update Required</p>
              </div>
              
              <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                  <p style="font-size: 18px; margin-bottom: 20px;">Hi <strong>${user.fullName}</strong>,</p>
                  
                  <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
                      <h3 style="margin-top: 0; color: #856404;">📋 Important Update</h3>
                      <p style="margin-bottom: 0; color: #856404;">
                          We had to temporarily remove your application(s) because we now require all applicants to have their resume uploaded in their profile. 
                          This helps us provide better and faster review of applications.
                      </p>
                  </div>
                  
                  <div style="background: #e8f4fd; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
                      <h4 style="margin-top: 0; color: #0056b3;">📋 Projects You Were Applied To:</h4>
                      <div style="background: white; padding: 15px; border-radius: 5px; margin-top: 10px;">
                          ${projects.map(p => `
                              <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
                                  <strong>${p.projectName}</strong><br>
                                  <span style="color: #666;">Category: ${p.projectCategory}</span><br>
                                  <span style="color: #28a745; font-weight: bold;">Pay: $${p.payRate} ${p.payRateCurrency || 'USD'}</span>
                              </div>
                          `).join('')}
                      </div>
                  </div>
                  
                  <div style="background: #ffffff; border: 2px solid #007bff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                      <h3 style="margin-top: 0; color: #007bff;">📝 Quick Steps to Reapply</h3>
                      <ol style="color: #333; margin-bottom: 0;">
                          <li style="margin-bottom: 10px;"><strong>Upload Resume:</strong> Go to your profile and upload your CV (PDF, DOC, or DOCX)</li>
                          <li style="margin-bottom: 10px;"><strong>Reapply:</strong> Submit your applications again with resume attached</li>
                          <li style="margin-bottom: 0;"><strong>Fast Review:</strong> We'll prioritize your applications since you were previously interested!</li>
                      </ol>
                  </div>

                  <div style="text-align: center; margin: 30px 0;">
                      <a href="https://mydeeptech.ng/profile" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-right: 10px;">
                          📄 Upload Resume
                      </a>
                      <a href="https://mydeeptech.ng/projects" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                          🎯 Browse Projects
                      </a>
                  </div>

                  <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                      <h4 style="margin-top: 0; color: #155724;">🌟 Why This Benefits You</h4>
                      <ul style="margin-bottom: 0; color: #155724;">
                          <li>Faster application review process</li>
                          <li>Better matching with project requirements</li>
                          <li>Improved communication during selection</li>
                          <li>Higher success rates for qualified applicants</li>
                      </ul>
                  </div>
                  
                  <p style="font-size: 14px; color: #666; margin-top: 30px;">
                      Thank you for your understanding. We're excited to see your applications with your resume attached!
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
        `,
        text: `
Hi ${user.fullName},

IMPORTANT UPDATE: Resume Required

We had to temporarily remove your application(s) because we now require all applicants to have their resume uploaded in their profile.

PROJECTS YOU WERE APPLIED TO:
${projectList}

QUICK STEPS TO REAPPLY:
1. Upload Resume: Go to your profile and upload your CV (PDF, DOC, or DOCX)
2. Reapply: Submit your applications again with resume attached  
3. Fast Review: We'll prioritize your applications since you were previously interested!

WHY THIS BENEFITS YOU:
- Faster application review process
- Better matching with project requirements
- Improved communication during selection
- Higher success rates for qualified applicants

Upload resume: https://mydeeptech.ng/profile
Browse projects: https://mydeeptech.ng/projects

Thank you for your understanding. We're excited to see your applications with your resume!

Best regards,
MyDeeptech Team
https://mydeeptech.ng
        `
      };

      // Try to send email
      try {
        if (transporter) {
          const info = await transporter.sendMail(emailContent);
          console.log(`✅ Email sent to ${user.fullName} (${user.email})`);
        } else {
          throw new Error('No email transporter available');
        }
      } catch (emailError) {
        console.log(`❌ Email failed for ${user.fullName}: ${emailError.message}`);
        
        // Save email content to file as backup
        const fs = require('fs');
        const filename = `resume-notification-${userId}.html`;
        fs.writeFileSync(filename, emailContent.html);
        console.log(`   📝 Email content saved to: ${filename}`);
      }
    }

    console.log('\n🎯 Removal Summary:');
    console.log(`👥 Users processed: ${TARGET_USER_IDS.length}`);
    console.log(`📝 Applications removed: ${removeResult.deletedCount}`);
    console.log(`📋 Projects affected: ${Object.keys(projectGroups).length}`);
    console.log(`📧 Email notifications: Attempted for all users`);
    console.log('\n📄 Next Steps for Users:');
    console.log('   1. Upload resume to profile');
    console.log('   2. Reapply to desired projects');
    console.log('   3. Applications will be fast-tracked');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  removeSpecificUsers();
}

module.exports = removeSpecificUsers;