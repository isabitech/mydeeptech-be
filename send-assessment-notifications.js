// Send English Assessment Notification to Pending Annotators
// This script sends emails to all users with annotatorStatus "pending" about the new on-platform assessment

const mongoose = require('mongoose');
require('dotenv').config();

const DTUser = require('./models/dtUser.model');
const { sendProjectEmail } = require('./utils/brevoSMTP');

async function sendAssessmentNotifications() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all users with pending annotatorStatus
    const pendingAnnotators = await DTUser.find({
      annotatorStatus: 'pending'
    }).select('_id fullName email annotatorStatus createdAt');

    console.log(`📊 Found ${pendingAnnotators.length} pending annotators`);

    if (pendingAnnotators.length === 0) {
      console.log('❌ No pending annotators found');
      return;
    }

    console.log('\n📋 Pending annotators to notify:');
    pendingAnnotators.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.fullName} (${user.email}) - Registered: ${user.createdAt.toDateString()}`);
    });

    console.log('\n📧 Starting email campaign...');

    let successCount = 0;
    let failedCount = 0;

    for (const user of pendingAnnotators) {
      console.log(`\n📧 Sending to ${user.fullName} (${user.email})`);

      const subject = 'Complete Your English Assessment - Access Unlimited Opportunities! 🚀';
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>English Assessment - MyDeeptech</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">🎯 Assessment Ready!</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Complete Your English Assessment Now</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                <p style="font-size: 18px; margin-bottom: 20px;">Hi <strong>${user.fullName}</strong>,</p>
                
                <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #155724;">🎉 Great News!</h3>
                    <p style="margin-bottom: 0; color: #155724;">
                        <strong>No more external platforms!</strong> Your English assessment is now available directly on our website. 
                        Complete it in just <strong>15 minutes</strong> and unlock unlimited opportunities with MyDeeptech!
                    </p>
                </div>
                
                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #856404;">⏱️ Quick & Easy Process</h4>
                    <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        <div style="display: flex; align-items: center; margin: 10px 0;">
                            <span style="background: #28a745; color: white; width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold;">1</span>
                            <div>
                                <strong>Log into MyDeeptech</strong><br>
                                <span style="color: #666;">Use your existing account credentials</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; margin: 10px 0;">
                            <span style="background: #007bff; color: white; width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold;">2</span>
                            <div>
                                <strong>Take Assessment</strong><br>
                                <span style="color: #666;">Quick 15-minute English proficiency test</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; margin: 10px 0;">
                            <span style="background: #6f42c1; color: white; width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold;">3</span>
                            <div>
                                <strong>Get Approved</strong><br>
                                <span style="color: #666;">Access unlimited project opportunities</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://mydeeptech.ng/login" style="background: #28a745; color: white; padding: 18px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);">
                        🚀 Start Assessment Now
                    </a>
                </div>

                <div style="background: #e8f4fd; border-left: 4px solid #007bff; padding: 20px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #0056b3;">💰 What You'll Access</h4>
                    <div style="background: white; padding: 15px; border-radius: 5px;">
                        <ul style="margin: 0; color: #333; padding-left: 20px;">
                            <li style="margin: 8px 0;"><strong>High-Paying Projects:</strong> $15-50+ per hour</li>
                            <li style="margin: 8px 0;"><strong>Flexible Work:</strong> Choose your own schedule</li>
                            <li style="margin: 8px 0;"><strong>Diverse Opportunities:</strong> Text annotation, image labeling, data analysis</li>
                            <li style="margin: 8px 0;"><strong>Remote Work:</strong> Work from anywhere in the world</li>
                            <li style="margin: 8px 0;"><strong>Weekly Payments:</strong> Fast and reliable payment system</li>
                        </ul>
                    </div>
                </div>

                <div style="background: #fff; border: 2px solid #007bff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #007bff; text-align: center;">🌟 Why Complete This Now?</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                        <div style="text-align: center; padding: 10px;">
                            <div style="font-size: 24px; margin-bottom: 5px;">⚡</div>
                            <strong style="color: #007bff;">Fast Process</strong><br>
                            <span style="color: #666; font-size: 14px;">Just 15 minutes</span>
                        </div>
                        <div style="text-align: center; padding: 10px;">
                            <div style="font-size: 24px; margin-bottom: 5px;">🏠</div>
                            <strong style="color: #007bff;">On Our Platform</strong><br>
                            <span style="color: #666; font-size: 14px;">No external sites</span>
                        </div>
                        <div style="text-align: center; padding: 10px;">
                            <div style="font-size: 24px; margin-bottom: 5px;">🎯</div>
                            <strong style="color: #007bff;">Instant Access</strong><br>
                            <span style="color: #666; font-size: 14px;">Immediate opportunities</span>
                        </div>
                        <div style="text-align: center; padding: 10px;">
                            <div style="font-size: 24px; margin-bottom: 5px;">💰</div>
                            <strong style="color: #007bff;">High Earning</strong><br>
                            <span style="color: #666; font-size: 14px;">Premium projects</span>
                        </div>
                    </div>
                </div>

                <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #721c24;">⏰ Don't Wait!</h4>
                    <p style="margin-bottom: 0; color: #721c24;">
                        <strong>Limited project slots available.</strong> Complete your assessment today to secure your place 
                        in our next batch of approved annotators. Projects are assigned on a first-come, first-served basis!
                    </p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #dee2e6;">
                        <h4 style="margin-top: 0; color: #495057;">📱 Need Help?</h4>
                        <p style="color: #6c757d; margin: 10px 0;">Our support team is here to assist you!</p>
                        <div style="margin: 15px 0;">
                            <a href="mailto:support@mydeeptech.ng" style="color: #007bff; text-decoration: none; margin: 0 10px;">📧 support@mydeeptech.ng</a><br>
                            <a href="https://mydeeptech.ng/help" style="color: #007bff; text-decoration: none; margin: 0 10px;">📖 Help Center</a>
                        </div>
                    </div>
                </div>
                
                <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">
                    We're excited to have you as part of the MyDeeptech community!
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

GREAT NEWS! English Assessment Now Available on Our Platform

No more external platforms! Your English assessment is now available directly on our website. 
Complete it in just 15 minutes and unlock unlimited opportunities with MyDeeptech!

QUICK 3-STEP PROCESS:
1. Log into MyDeeptech - Use your existing account credentials
2. Take Assessment - Quick 15-minute English proficiency test  
3. Get Approved - Access unlimited project opportunities

WHAT YOU'LL ACCESS:
- High-Paying Projects: $15-50+ per hour
- Flexible Work: Choose your own schedule
- Diverse Opportunities: Text annotation, image labeling, data analysis
- Remote Work: Work from anywhere in the world
- Weekly Payments: Fast and reliable payment system

WHY COMPLETE THIS NOW?
⚡ Fast Process - Just 15 minutes
🏠 On Our Platform - No external sites  
🎯 Instant Access - Immediate opportunities
💰 High Earning - Premium projects

DON'T WAIT! Limited project slots available. Complete your assessment today to secure your place 
in our next batch of approved annotators. Projects are assigned on a first-come, first-served basis!

Start Assessment: https://mydeeptech.ng/login

Need help? Contact us at support@mydeeptech.ng

We're excited to have you as part of the MyDeeptech community!

Best regards,
The MyDeeptech Team
https://mydeeptech.ng
      `;

      try {
        const result = await sendProjectEmail({
          to: user.email,
          subject: subject,
          html: htmlContent,
          text: textContent
        });

        console.log(`✅ Email sent successfully to ${user.fullName}`);
        console.log(`   📧 Message ID: ${result.messageId}`);
        console.log(`   📨 Provider: ${result.provider}`);
        console.log(`   📤 Sender: ${result.sender}`);
        
        successCount++;
        
        // Small delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500));
        
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${user.fullName}:`, emailError.message);
        failedCount++;
      }
    }

    console.log('\n🎯 Assessment Notification Campaign Summary:');
    console.log(`📊 Total pending annotators: ${pendingAnnotators.length}`);
    console.log(`✅ Emails sent successfully: ${successCount}`);
    console.log(`❌ Emails failed: ${failedCount}`);
    console.log(`📧 Sender email: ${process.env.BREVO_PROJECT_SENDER_EMAIL || 'projects@mydeeptech.ng'}`);
    console.log(`👤 Sender name: ${process.env.BREVO_PROJECT_SENDER_NAME || 'MyDeepTech Projects'}`);
    
    console.log('\n📄 Next Steps for Users:');
    console.log('   1. Log into MyDeeptech platform');
    console.log('   2. Complete 15-minute English assessment');
    console.log('   3. Get approved for unlimited opportunities');
    console.log('   4. Start earning with high-paying projects');

    console.log('\n🚀 Expected Impact:');
    console.log('   - Faster onboarding process');
    console.log('   - Better user experience (no external platforms)');
    console.log('   - Higher completion rates');
    console.log('   - More approved annotators');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  sendAssessmentNotifications();
}

module.exports = sendAssessmentNotifications;