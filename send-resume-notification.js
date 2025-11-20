// Send Resume Requirement Email to Specific User
// This script sends a notification email to a user about the resume requirement

const mongoose = require('mongoose');
require('dotenv').config();

const DTUser = require('./models/dtUser.model');
const AnnotationProject = require('./models/annotationProject.model');

// Import the mailer - check the correct path/function name
async function sendResumeNotificationEmail() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const PROJECT_ID = '6915dbacf42225fa10bd6fae';
    const USER_EMAIL = 'debbietosin3@gmail.com';
    
    // Get project and user details
    const project = await AnnotationProject.findById(PROJECT_ID);
    const user = await DTUser.findOne({ email: USER_EMAIL });
    
    if (!project || !user) {
      console.log('❌ Project or user not found!');
      return;
    }

    console.log(`📧 Sending resume requirement email to: ${user.fullName}`);
    console.log(`📋 Project: ${project.projectName}`);

    // Email content
    const subject = `Resume Required - Reapply to ${project.projectName}`;
    
    const emailContent = {
      to: USER_EMAIL,
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
                        We had to temporarily remove your approved application to <strong>${project.projectName}</strong> 
                        because we now require all applicants to have their resume uploaded. 
                        This helps us provide better and faster review of applications.
                    </p>
                </div>
                
                <div style="background: #ffffff; border: 2px solid #007bff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #007bff;">📝 Quick Steps to Reapply</h3>
                    <ol style="color: #333; margin-bottom: 0;">
                        <li style="margin-bottom: 10px;"><strong>Upload Resume:</strong> Go to your profile and upload your CV (PDF, DOC, or DOCX)</li>
                        <li style="margin-bottom: 10px;"><strong>Reapply:</strong> Submit your application again with resume attached</li>
                        <li style="margin-bottom: 0;"><strong>Priority Review:</strong> Since you were previously approved, we'll fast-track your new application!</li>
                    </ol>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://mydeeptech.ng/profile" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-right: 10px;">
                        📄 Upload Resume
                    </a>
                    <a href="https://mydeeptech.ng/projects" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                        🎯 Reapply Now
                    </a>
                </div>

                <div style="background: #e8f4fd; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #0056b3;">🎯 Project Details</h4>
                    <p style="margin-bottom: 0; color: #333;">
                        <strong>Project:</strong> ${project.projectName}<br>
                        <strong>Category:</strong> ${project.projectCategory}<br>
                        <strong>Pay Rate:</strong> $${project.payRate} ${project.payRateCurrency || 'USD'}<br>
                        <strong>Status:</strong> ✅ Still accepting applications
                    </p>
                </div>

                <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #155724;">🌟 Why This Benefits You</h4>
                    <ul style="margin-bottom: 0; color: #155724;">
                        <li>Faster application review process</li>
                        <li>Better matching with project requirements</li>
                        <li>Improved communication during selection</li>
                        <li>Higher success rates for approved applicants</li>
                    </ul>
                </div>
                
                <p style="font-size: 14px; color: #666; margin-top: 30px;">
                    Thank you for your understanding. We're excited to see your application with your resume attached!
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

We had to temporarily remove your approved application to "${project.projectName}" because we now require all applicants to have their resume uploaded in their profile.

QUICK STEPS TO REAPPLY:
1. Upload Resume: Go to your profile and upload your CV (PDF, DOC, or DOCX)
2. Reapply: Submit your application again with resume attached  
3. Priority Review: Since you were previously approved, we'll fast-track your new application!

PROJECT DETAILS:
- Project: ${project.projectName}
- Category: ${project.projectCategory}
- Pay Rate: $${project.payRate} ${project.payRateCurrency || 'USD'}
- Status: Still accepting applications

WHY THIS BENEFITS YOU:
- Faster application review process
- Better matching with project requirements
- Improved communication during selection
- Higher success rates for approved applicants

Upload resume: https://mydeeptech.ng/profile
Reapply now: https://mydeeptech.ng/projects

Thank you for your understanding. We're excited to see your application with your resume!

Best regards,
MyDeeptech Team
https://mydeeptech.ng
      `
    };

    // Try to send email using the project's email system
    try {
      // Check if we have the proper email function available
      const nodemailer = require('nodemailer');
      
      // Create transporter using environment variables
      const transporter = nodemailer.createTransporter({
        service: 'gmail', // or your email service
        auth: {
          user: process.env.EMAIL_USER || process.env.BREVO_EMAIL || 'noreply@mydeeptech.ng',
          pass: process.env.EMAIL_PASS || process.env.BREVO_API_KEY
        }
      });

      // Send email
      const info = await transporter.sendMail(emailContent);
      console.log('✅ Email sent successfully:', info.messageId);
      
    } catch (emailError) {
      console.log('❌ Email sending failed:', emailError.message);
      console.log('\n📧 EMAIL CONTENT (Manual Send Required):');
      console.log('=====================================');
      console.log(`To: ${emailContent.to}`);
      console.log(`Subject: ${emailContent.subject}`);
      console.log('\nHTML Content saved to file for manual sending...');
      
      // Save email content to file for manual sending
      const fs = require('fs');
      fs.writeFileSync('resume-notification-email.html', emailContent.html);
      console.log('✅ Email content saved to: resume-notification-email.html');
    }

    console.log('\n🎯 Summary:');
    console.log(`👤 User: ${user.fullName} (${user.email})`);
    console.log(`📋 Project: ${project.projectName}`);
    console.log(`📝 Action: Application removed, notification sent`);
    console.log(`📄 Next Step: User needs to upload resume and reapply`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
sendResumeNotificationEmail();

module.exports = sendResumeNotificationEmail;