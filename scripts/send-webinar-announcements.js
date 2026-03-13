const mongoose = require('mongoose');
const brevo = require('@getbrevo/brevo');
const DTUser = require('../models/dtUser.model');
const User = require('../models/user');
require('dotenv').config();

/**
 * Script to send webinar announcement emails to all users
 * Webinar Date: February 26, 2025
 * Registration Link: https://luma.com/v0gdp88t
 */

// Initialize Brevo API client
const apiInstance = new brevo.TransactionalEmailsApi();
if (process.env.BREVO_API_KEY) {
  apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
}

// Email template for webinar announcement
const createWebinarEmailHTML = (userFullName) => {
  const firstName = userFullName ? userFullName.split(' ')[0] : 'Tech Enthusiast';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333333; 
          margin: 0; 
          padding: 0; 
          background-color: #f4f4f4;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: white; 
          border-radius: 10px; 
          overflow: hidden;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }
        .header { 
          background: linear-gradient(135deg, #F6921E 0%, #333333 100%); 
          color: white; 
          padding: 40px 30px; 
          text-align: center; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 28px; 
          font-weight: 700;
        }
        .content { 
          padding: 40px 30px; 
          background: white;
        }
        .webinar-badge {
          background: #F6921E;
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          display: inline-block;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .date-highlight {
          background: #f8f9fa;
          border-left: 4px solid #F6921E;
          padding: 15px 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .cta-button { 
          display: inline-block; 
          background: linear-gradient(135deg, #F6921E 0%, #333333 100%); 
          color: white !important; 
          padding: 15px 40px; 
          text-decoration: none; 
          border-radius: 50px; 
          margin: 25px 0;
          font-weight: bold;
          font-size: 16px;
          text-align: center;
          transition: transform 0.3s ease;
        }
        .cta-button:hover {
          transform: translateY(-2px);
        }
        .footer { 
          text-align: center; 
          padding: 30px; 
          background: #f8f9fa; 
          color: #666; 
          font-size: 14px; 
        }
        .link { 
          color: #F6921E; 
          word-break: break-all; 
          text-decoration: none;
        }
        .highlight {
          background: #fff3cd;
          padding: 15px;
          border-radius: 5px;
          border-left: 4px solid #F6921E;
          margin: 20px 0;
        }
        ul li {
          margin-bottom: 8px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚀 MyDeepTech Platform Walkthrough</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Get All Your Questions Answered!</p>
        </div>
        <div class="content">
          <div class="webinar-badge">🔥 Free Webinar</div>
          
          <h2>Good Day ${firstName}! 👋</h2>
          
          <p>I trust you had a great weekend!</p>
          
          <p>We're excited to invite you to our <strong>first platform familiarization webinar</strong> where we'll walk you through how MyDeepTech operates and answer all your questions about our platform.</p>
          
          <div class="date-highlight">
            <strong>📅 Date: Thursday, February 26, 2026</strong><br>
            <strong>⏰ Time: 1pm</strong><br>
            <strong>💻 Format: Online via Meet</strong>
          </div>
          
          <div class="highlight">
            <h3>🎯 What We'll Cover:</h3>
            <ul>
              <li><strong>Platform Overview:</strong> How MyDeepTech operates and what's expected from you</li>
              <li><strong>Communication:</strong> Preferred communication methods (Email, etc.)</li>
              <li><strong>Payment:</strong> Currency options (Naira vs Dollars) and payment processes</li>
              <li><strong>Work Schedule:</strong> Minimum work hours per week and availability requirements</li>
              <li><strong>Project Guidance:</strong> Training and support for projects on your dashboard</li>
              <li><strong>Q&A Session:</strong> Get answers to all your specific questions</li>
            </ul>
          </div>
          
          <p><strong>⚠️ Important:</strong> This is your chance to get clarity on everything about working with MyDeepTech. Come with your questions!</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #333333;">
            <h4 style="margin-top: 0; color: #333333;">📝 Common Questions We'll Address:</h4>
            <ul style="margin-bottom: 0;">
              <li>"Should I choose Email for preferred communication?"</li>
              <li>"Is Naira or Dollars more appropriate for payment currency?"</li>
              <li>"What is the minimum work hour requirement per week?"</li>
              <li>"Will there be training for the projects on my dashboard?"</li>
              <li>"How do I navigate and maximize the platform features?"</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://luma.com/v0gdp88t" class="cta-button">
              📝 REGISTER FOR THE WEBINAR
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; text-align: center;">
            Can't click the button? Copy and paste this link: 
            <a href="https://luma.com/v0gdp88t" class="link">https://luma.com/v0gdp88t</a>
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p><strong>Why This Webinar Matters:</strong></p>
            <p>Whether you're new to our platform or have been with us for a while, this session will help you understand exactly how to work effectively with MyDeepTech, maximize your earnings, and get the support you need for success.</p>
            <p><strong>Can't attend live?</strong> Don't worry! We'll send you a recording after the session.</p>
          </div>
          
          <p>Looking forward to seeing you there and answering all your questions! 🚀</p>
          <p>Best regards,<br><strong>MyDeepTech Events Team</strong></p>
        </div>
        <div class="footer">
          <p>© 2025 MyDeepTech. All rights reserved.</p>
          <p style="font-size: 12px; color: #999; margin-top: 10px;">
            You received this email because you're a registered member of MyDeepTech.<br>
            If you no longer wish to receive event announcements, please contact us.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send email via Brevo API
const sendWebinarEmail = async (email, fullName) => {
  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY not found in environment variables");
  }

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.sender = { 
    email: "events@mydeeptech.ng", 
    name: "MyDeepTech Events" 
  };
  sendSmtpEmail.to = [{ email, name: fullName || "Tech Enthusiast" }];
  sendSmtpEmail.subject = "� MyDeepTech Platform Q&A Webinar - Feb 26 | All Your Questions Answered";
  sendSmtpEmail.htmlContent = createWebinarEmailHTML(fullName);

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true, messageId: result.messageId, email };
  } catch (error) {
    console.error(`❌ Error sending email to ${email}:`, error.message);
    return { success: false, error: error.message, email };
  }
};

// Main function to send announcements to all users
const sendWebinarAnnouncements = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📦 Connected to MongoDB');

    // Fetch DTUsers
    console.log('🔍 Fetching DTUsers...');
    const dtUsers = await DTUser.find(
      { isEmailVerified: true }, // Only send to verified users
      { 
        fullName: 1, 
        email: 1, 
        isEmailVerified: 1,
        createdAt: 1 
      }
    ).lean();

    // Fetch Admin Users  
    console.log('🔍 Fetching Admin Users...');
    const adminUsers = await User.find(
      {}, // Send to all admin users
      { 
        firstname: 1, 
        lastname: 1, 
        email: 1, 
        role: 1,
        createdAt: 1 
      }
    ).lean();

    // Combine and deduplicate users
    const allUsers = [];
    const emailSet = new Set();

    // Add DTUsers
    dtUsers.forEach(user => {
      if (user.email && !emailSet.has(user.email.toLowerCase())) {
        allUsers.push({
          fullName: user.fullName,
          email: user.email,
          type: 'DTUser',
          verified: user.isEmailVerified
        });
        emailSet.add(user.email.toLowerCase());
      }
    });

    // Add Admin Users
    adminUsers.forEach(user => {
      if (user.email && !emailSet.has(user.email.toLowerCase())) {
        const fullName = `${user.firstname || ''} ${user.lastname || ''}`.trim();
        allUsers.push({
          fullName: fullName || 'Admin User',
          email: user.email,
          type: `Admin (${user.role})`,
          verified: true // Assume admin emails are verified
        });
        emailSet.add(user.email.toLowerCase());
      }
    });

    console.log(`\n📊 Email Summary:`);
    console.log(`├─ DTUsers found: ${dtUsers.length} (verified email only)`);
    console.log(`├─ Admin Users found: ${adminUsers.length}`);
    console.log(`└─ Total unique emails: ${allUsers.length}`);

    if (allUsers.length === 0) {
      console.log('⚠️ No users found. Exiting...');
      return;
    }

    // Confirm before sending
    console.log('\n🚨 CONFIRMATION REQUIRED 🚨');
    console.log(`You are about to send webinar announcements to ${allUsers.length} users.`);
    console.log('Press Ctrl+C to cancel or wait 10 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Send emails with rate limiting
    console.log('📧 Starting email campaign...\n');
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < allUsers.length; i++) {
      const user = allUsers[i];
      
      try {
        // Add delay to respect rate limits (Brevo allows 300 emails/hour)
        if (i > 0 && i % 10 === 0) {
          console.log(`⏳ Rate limiting... Processed ${i} emails, waiting 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`📤 [${i + 1}/${allUsers.length}] Sending to: ${user.email} (${user.type})`);
        
        const result = await sendWebinarEmail(user.email, user.fullName);
        
        if (result.success) {
          results.success++;
          console.log(`   ✅ Sent successfully (ID: ${result.messageId})`);
        } else {
          results.failed++;
          results.errors.push({ email: user.email, error: result.error });
          console.log(`   ❌ Failed: ${result.error}`);
        }
        
      } catch (error) {
        results.failed++;
        results.errors.push({ email: user.email, error: error.message });
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // Summary report
    console.log('\n🎉 EMAIL CAMPAIGN COMPLETED 🎉');
    console.log('═'.repeat(50));
    console.log(`✅ Successfully sent: ${results.success}`);
    console.log(`❌ Failed to send: ${results.failed}`);
    console.log(`📊 Success rate: ${((results.success / allUsers.length) * 100).toFixed(1)}%`);

    if (results.errors.length > 0) {
      console.log('\n❌ Failed emails:');
      results.errors.forEach((err, index) => {
        console.log(`   ${index + 1}. ${err.email} - ${err.error}`);
      });
    }

    console.log('\n📧 All webinar announcements have been processed!');
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('📦 MongoDB connection closed');
    process.exit(0);
  }
};

// Run the script
if (require.main === module) {
  console.log('🚀 MyDeepTech Webinar Announcement Campaign');
  console.log('═'.repeat(50));
  console.log('📅 Webinar Date: February 26, 2025');
  console.log('🔗 Registration: https://luma.com/v0gdp88t');
  console.log('📧 From: events@mydeeptech.ng');
  console.log('═'.repeat(50));
  
  sendWebinarAnnouncements();
}

module.exports = { 
  sendWebinarAnnouncements, 
  sendWebinarEmail, 
  createWebinarEmailHTML 
};