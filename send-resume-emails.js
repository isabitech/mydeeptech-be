// Send Resume Requirement Emails Automatically
// This script uses the existing email infrastructure to send notifications

const mongoose = require('mongoose');
require('dotenv').config();

const DTUser = require('./models/dtUser.model');
const ProjectApplication = require('./models/projectApplication.model');
const AnnotationProject = require('./models/annotationProject.model');

// Use the existing email system
const { sendProjectEmail } = require('./utils/brevoSMTP');
const nodemailer = require('nodemailer');

// Target user IDs
const TARGET_USER_IDS = [
  '691486674b9960cf4217665c',
  '69148bed4b9960cf421766b7', 
  '6916df4e8d8e029c01a1c441',
  '69149269ada25252bd8e8957'
];

// Setup email transporter using existing config
function setupEmailTransporter() {
  // Try Brevo SMTP first (most reliable)
  if (process.env.SMTP_LOGIN && process.env.SMTP_KEY) {
    return nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_LOGIN,
        pass: process.env.SMTP_KEY
      }
    });
  }
  
  // Fallback to Gmail
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  
  return null;
}

async function sendResumeNotifications() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    console.log('📧 Using Brevo Project Email API with proper sender credentials');
    console.log(`   📧 Sender: ${process.env.BREVO_PROJECT_SENDER_EMAIL}`);
    console.log(`   👤 Name: ${process.env.BREVO_PROJECT_SENDER_NAME}`);

    // Get user details
    const users = await DTUser.find({
      _id: { $in: TARGET_USER_IDS }
    });

    console.log(`📋 Found ${users.length} users to notify`);

    // For each user, find their removed applications and send personalized email
    for (const user of users) {
      console.log(`\n📧 Processing ${user.fullName} (${user.email})`);

      // Get all projects they might have been interested in
      const allProjects = await AnnotationProject.find({
        isActive: true,
        status: 'active'
      }).select('projectName projectCategory payRate payRateCurrency');

      const subject = 'Resume Required - Reapply to MyDeeptech Projects';
      
      const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
              <meta charset="UTF-8">
              <title>Resume Required - MyDeeptech</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="margin: 0; font-size: 28px;">📄 Resume Required</h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Important Application Update</p>
              </div>
              
              <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                  <p style="font-size: 18px; margin-bottom: 20px;">Hi <strong>${user.fullName}</strong>,</p>
                  
                  <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
                      <h3 style="margin-top: 0; color: #856404;">📋 Important Policy Update</h3>
                      <p style="margin-bottom: 0; color: #856404;">
                          We had to remove your previous application(s) because <strong>we now require all applicants to have their resume uploaded</strong> 
                          in their MyDeeptech profile. This new policy helps us:
                      </p>
                      <ul style="color: #856404; margin: 10px 0;">
                          <li>Review applications faster</li>
                          <li>Better match candidates with projects</li>
                          <li>Provide more personalized opportunities</li>
                      </ul>
                  </div>
                  
                  <div style="background: #ffffff; border: 2px solid #28a745; border-radius: 8px; padding: 20px; margin: 20px 0;">
                      <h3 style="margin-top: 0; color: #28a745;">📝 Quick 3-Step Process</h3>
                      <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
                          <strong style="color: #28a745;">STEP 1:</strong> Upload Your Resume<br>
                          <span style="color: #666;">Go to your profile → Upload CV (PDF, DOC, DOCX)</span>
                      </div>
                      <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
                          <strong style="color: #007bff;">STEP 2:</strong> Browse Available Projects<br>
                          <span style="color: #666;">Check out current opportunities that match your skills</span>
                      </div>
                      <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
                          <strong style="color: #6f42c1;">STEP 3:</strong> Reapply with Confidence<br>
                          <span style="color: #666;">Submit applications with your resume for faster review</span>
                      </div>
                  </div>

                  <div style="text-align: center; margin: 30px 0;">
                      <a href="https://mydeeptech.ng/profile" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin: 5px;">
                          📄 Upload Resume Now
                      </a>
                      <br><br>
                      <a href="https://mydeeptech.ng/projects" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin: 5px;">
                          🎯 Browse Projects
                      </a>
                  </div>

                  <div style="background: #e8f4fd; border-left: 4px solid #007bff; padding: 20px; margin: 20px 0;">
                      <h4 style="margin-top: 0; color: #0056b3;">🚀 Current Opportunities</h4>
                      <p style="color: #333; margin-bottom: 10px;">We have exciting projects waiting for talented freelancers like you:</p>
                      <ul style="color: #333;">
                          <li><strong>Fact Checking Projects</strong> - Research and verify information</li>
                          <li><strong>Image Annotation</strong> - Computer vision training data</li>
                          <li><strong>Data Analysis</strong> - Extract insights from datasets</li>
                          <li><strong>Content Moderation</strong> - Review and categorize content</li>
                      </ul>
                      <p style="color: #0056b3; margin: 10px 0 0 0;">
                          <strong>💰 Competitive rates from $15-50+ per hour</strong>
                      </p>
                  </div>

                  <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                      <h4 style="margin-top: 0; color: #155724;">🌟 Your Advantages</h4>
                      <div style="display: flex; flex-wrap: wrap;">
                          <div style="flex: 1; min-width: 200px; margin: 5px;">
                              <strong style="color: #155724;">⚡ Priority Review</strong><br>
                              <span style="color: #155724; font-size: 14px;">Previous applicants get faster processing</span>
                          </div>
                          <div style="flex: 1; min-width: 200px; margin: 5px;">
                              <strong style="color: #155724;">🎯 Better Matching</strong><br>
                              <span style="color: #155724; font-size: 14px;">Resume helps us find perfect projects for you</span>
                          </div>
                          <div style="flex: 1; min-width: 200px; margin: 5px;">
                              <strong style="color: #155724;">📈 Higher Success Rate</strong><br>
                              <span style="color: #155724; font-size: 14px;">Complete profiles get more approvals</span>
                          </div>
                          <div style="flex: 1; min-width: 200px; margin: 5px;">
                              <strong style="color: #155724;">💼 Professional Growth</strong><br>
                              <span style="color: #155724; font-size: 14px;">Showcase your skills and experience</span>
                          </div>
                      </div>
                  </div>
                  
                  <div style="background: #fff; border: 2px dashed #007bff; padding: 20px; text-align: center; margin: 30px 0;">
                      <h3 style="margin-top: 0; color: #007bff;">📞 Need Help?</h3>
                      <p style="margin-bottom: 15px; color: #333;">Our team is here to support you every step of the way!</p>
                      <p style="color: #666; margin: 5px 0;">
                          📧 Email: <a href="mailto:support@mydeeptech.ng" style="color: #007bff;">support@mydeeptech.ng</a><br>
                          🌐 Website: <a href="https://mydeeptech.ng" style="color: #007bff;">mydeeptech.ng</a>
                      </p>
                  </div>
                  
                  <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">
                      We appreciate your understanding and look forward to working with you again!
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                  
                  <p style="font-size: 14px; color: #666; text-align: center; margin: 0;">
                      Best regards,<br>
                      <strong style="color: #007bff;">The MyDeeptech Team</strong><br>
                      <a href="https://mydeeptech.ng" style="color: #007bff; text-decoration: none;">mydeeptech.ng</a>
                  </p>
              </div>
          </body>
          </html>
        `;

      const textContent = `
Hi ${user.fullName},

IMPORTANT APPLICATION UPDATE

We had to remove your previous application(s) because we now require all applicants to have their resume uploaded in their MyDeeptech profile.

WHY THIS CHANGE?
- Faster application review process
- Better matching between candidates and projects  
- More personalized opportunity recommendations
- Higher success rates for qualified applicants

QUICK 3-STEP PROCESS:
1. Upload Resume: Go to your profile and upload your CV (PDF, DOC, DOCX)
2. Browse Projects: Check current opportunities that match your skills
3. Reapply: Submit applications with resume for priority review

CURRENT OPPORTUNITIES:
- Fact Checking Projects - Research and verify information
- Image Annotation - Computer vision training data
- Data Analysis - Extract insights from datasets
- Content Moderation - Review and categorize content
💰 Competitive rates: $15-50+ per hour

YOUR ADVANTAGES:
⚡ Priority Review - Previous applicants get faster processing
🎯 Better Matching - Resume helps us find perfect projects
📈 Higher Success - Complete profiles get more approvals
💼 Professional Growth - Showcase your skills and experience

TAKE ACTION:
Upload resume: https://mydeeptech.ng/profile
Browse projects: https://mydeeptech.ng/projects

Need help? Contact us at support@mydeeptech.ng

We appreciate your understanding and look forward to working with you again!

Best regards,
The MyDeeptech Team
https://mydeeptech.ng
        `;

      try {
        const info = await sendProjectEmail({
          to: user.email,
          subject: subject,
          html: htmlContent,
          text: textContent
        });
        console.log(`✅ Email sent successfully to ${user.fullName}`);
        console.log(`   📧 Message ID: ${info.messageId}`);
        console.log(`   📨 To: ${user.email}`);
        console.log(`   👤 From: ${info.sender}`);
        
        // Small delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${user.fullName}:`, emailError.message);
      }
    }

    console.log('\n🎯 Email Campaign Summary:');
    console.log(`📧 Target users: ${users.length}`);
    console.log(`📋 Emails attempted: ${users.length}`);
    console.log('\n📄 Next Steps for Users:');
    console.log('   1. Upload resume to profile');
    console.log('   2. Browse available projects');
    console.log('   3. Reapply with resume attached');
    console.log('   4. Enjoy priority review process');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
sendResumeNotifications();

module.exports = sendResumeNotifications;