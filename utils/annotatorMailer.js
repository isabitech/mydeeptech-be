import { sendProjectEmail } from './brevoSMTP.js';

/**
 * Send approval notification email to annotator
 * @param {string} email - Annotator's email address
 * @param {string} fullName - Annotator's full name
 */
const sendAnnotatorApprovalEmail = async (email, fullName) => {
  const subject = 'Congratulations! You are now an approved annotator';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Annotator Approval - MyDeeptech</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">You are now an approved annotator</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <p style="font-size: 18px; margin-bottom: 20px;">Hi <strong>${fullName}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
                Congratulations! You are now an approved annotator on <strong>MyDeeptech</strong>. 
                Login to your dashboard and complete your profile and you can start applying to projects 
                and surveys on our platform.
            </p>
            
            <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1976d2;">What's Next?</h3>
                <ul style="margin-bottom: 0; padding-left: 20px;">
                    <li>Login to your MyDeeptech dashboard</li>
                    <li>Complete your annotator profile</li>
                    <li>Browse and apply to available projects</li>
                    <li>Start earning with quality annotation work</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://mydeeptech.ng/login" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    Access Your Dashboard
                </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
                If you have any questions, please don't hesitate to contact our support team.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            
            <p style="font-size: 14px; color: #666; text-align: center; margin: 0;">
                Best regards,<br>
                <strong>MyDeeptech Team</strong><br>
                <a href="https://mydeeptech.ng" style="color: #667eea;">mydeeptech.ng</a>
            </p>
        </div>
    </body>
    </html>
  `;

  const textContent = `
Hi ${fullName},

Congratulations! You are now an approved annotator on MyDeeptech. Login to your dashboard and complete your profile and you can start applying to projects and surveys on our platform.

What's Next?
- Login to your MyDeeptech dashboard
- Complete your annotator profile  
- Browse and apply to available projects
- Start earning with quality annotation work

Access your dashboard: https://mydeeptech.ng/login

If you have any questions, please don't hesitate to contact our support team.

Best regards,
MyDeeptech Team
https://mydeeptech.ng
  `;

  try {
    await sendProjectEmail({
      to: email,
      subject: subject,
      html: htmlContent,
      text: textContent
    });

    console.log(`✅ Annotator approval email sent to: ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send annotator approval email to ${email}:`, error);
    throw error;
  }
};

/**
 * Send rejection notification email (micro tasker approval)
 * @param {string} email - User's email address  
 * @param {string} fullName - User's full name
 */
const sendAnnotatorRejectionEmail = async (email, fullName) => {
  const subject = 'Micro Tasker Approval - MyDeeptech';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Micro Tasker Approval - MyDeeptech</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ff9a56 0%, #ffad56 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">🌟 Congratulations!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">You are now an approved Micro Tasker</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <p style="font-size: 18px; margin-bottom: 20px;">Hi <strong>${fullName}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
                You did not meet up to our annotator score however, you are now an approved 
                <strong>Micro Tasker</strong> on MyDeeptech. Login to your dashboard and complete 
                your profile and you can start applying to international surveys on our platform.
            </p>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #856404;">Micro Tasker Opportunities</h3>
                <ul style="margin-bottom: 0; padding-left: 20px;">
                    <li>Access to international survey opportunities</li>
                    <li>Flexible micro-task assignments</li>
                    <li>Earn money with short, simple tasks</li>
                    <li>Build your profile for future annotation opportunities</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://mydeeptech.ng/login" style="background: #ff9a56; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    Access Your Dashboard
                </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
                Keep improving your skills and you may qualify for annotator roles in the future!
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            
            <p style="font-size: 14px; color: #666; text-align: center; margin: 0;">
                Best regards,<br>
                <strong>MyDeeptech Team</strong><br>
                <a href="https://mydeeptech.ng" style="color: #ff9a56;">mydeeptech.ng</a>
            </p>
        </div>
    </body>
    </html>
  `;

  const textContent = `
Hi ${fullName},

You did not meet up to our annotator score however, you are now an approved Micro Tasker on MyDeeptech. Login to your dashboard and complete your profile and you can start applying to international surveys on our platform.

Micro Tasker Opportunities:
- Access to international survey opportunities
- Flexible micro-task assignments  
- Earn money with short, simple tasks
- Build your profile for future annotation opportunities

Access your dashboard: https://mydeeptech.ng/login

Keep improving your skills and you may qualify for annotator roles in the future!

Best regards,
MyDeeptech Team
https://mydeeptech.ng
  `;

  try {
    await sendProjectEmail({
      to: email,
      subject: subject,
      html: htmlContent,
      text: textContent
    });

    console.log(`✅ Micro tasker approval email sent to: ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send micro tasker approval email to ${email}:`, error);
    throw error;
  }
};

export {
  sendAnnotatorApprovalEmail,
  sendAnnotatorRejectionEmail
};
