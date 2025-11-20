const { sendVerificationEmailBrevoSMTP } = require('./brevoSMTP');
const brevoTransporter = require('./brevoSMTP');

/**
 * Send password reset email using Brevo SMTP
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {string} resetToken - Password reset token
 * @param {string} userType - 'user' or 'dtuser'
 */
const sendPasswordResetEmail = async (email, name, resetToken, userType = 'user') => {
  try {
    const resetUrl = userType === 'dtuser' 
      ? `${process.env.FRONTEND_URL || 'https://mydeeptech.ng'}/reset-password?token=${resetToken}&type=dtuser`
      : `${process.env.FRONTEND_URL || 'https://mydeeptech.ng'}/reset-password?token=${resetToken}&type=user`;

    const emailContent = {
      to: [{ email, name }],
      subject: '🔒 Reset Your MyDeepTech Password',
      htmlContent: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    margin: 0; 
                    padding: 0; 
                    background-color: #f5f7fa; 
                    color: #333;
                }
                .container { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background: white; 
                    border-radius: 10px; 
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1); 
                    overflow: hidden;
                    margin-top: 20px;
                    margin-bottom: 20px;
                }
                .header { 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; 
                    padding: 40px 30px; 
                    text-align: center; 
                }
                .header h1 { 
                    margin: 0; 
                    font-size: 28px; 
                    font-weight: 300; 
                }
                .content { 
                    padding: 40px 30px; 
                }
                .greeting { 
                    font-size: 18px; 
                    color: #2d3748; 
                    margin-bottom: 20px; 
                }
                .message { 
                    font-size: 16px; 
                    line-height: 1.6; 
                    color: #4a5568; 
                    margin-bottom: 30px; 
                }
                .reset-button { 
                    display: inline-block; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; 
                    text-decoration: none; 
                    padding: 15px 30px; 
                    border-radius: 25px; 
                    font-weight: bold; 
                    font-size: 16px;
                    margin: 20px 0;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                    transition: transform 0.2s ease;
                }
                .reset-button:hover { 
                    transform: translateY(-2px); 
                }
                .security-note { 
                    background: #fef5e7; 
                    border-left: 4px solid #ed8936; 
                    padding: 20px; 
                    margin: 30px 0; 
                    border-radius: 0 5px 5px 0; 
                }
                .security-note h3 { 
                    color: #c05621; 
                    margin-top: 0; 
                }
                .alternative-method { 
                    background: #edf2f7; 
                    padding: 20px; 
                    border-radius: 5px; 
                    margin: 20px 0; 
                }
                .footer { 
                    background: #2d3748; 
                    color: #a0aec0; 
                    padding: 30px; 
                    text-align: center; 
                    font-size: 14px; 
                }
                .footer a { 
                    color: #667eea; 
                    text-decoration: none; 
                }
                .expiry-info { 
                    color: #e53e3e; 
                    font-weight: bold; 
                    font-size: 14px; 
                    margin-top: 15px; 
                }
                .token-display {
                    background: #f7fafc;
                    border: 1px solid #e2e8f0;
                    padding: 15px;
                    border-radius: 5px;
                    font-family: 'Courier New', monospace;
                    font-size: 14px;
                    word-break: break-all;
                    margin: 15px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔒 Password Reset Request</h1>
                </div>
                
                <div class="content">
                    <div class="greeting">Hello ${name},</div>
                    
                    <div class="message">
                        We received a request to reset the password for your MyDeepTech account. 
                        If you made this request, click the button below to set a new password.
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" class="reset-button">
                            🔑 Reset My Password
                        </a>
                    </div>
                    
                    <div class="security-note">
                        <h3>🛡️ Security Information</h3>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li>This link will expire in <strong>1 hour</strong> for security reasons</li>
                            <li>If you didn't request this, you can safely ignore this email</li>
                            <li>Your current password remains unchanged until you complete the reset</li>
                            <li>Only use this link once - it cannot be reused</li>
                        </ul>
                    </div>
                    
                    <div class="alternative-method">
                        <h4>🔧 Alternative Method</h4>
                        <p>If the button doesn't work, copy and paste this link into your browser:</p>
                        <div class="token-display">${resetUrl}</div>
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 14px;">
                        <p><strong>🔍 Didn't request this?</strong></p>
                        <p>If you didn't request a password reset, someone else might have entered your email address by mistake. 
                        You can safely ignore this email and your account remains secure.</p>
                    </div>
                </div>
                
                <div class="footer">
                    <p><strong>MyDeepTech Security Team</strong></p>
                    <p>This is an automated security email from our password reset system.</p>
                    <p>
                        Need help? Contact us: 
                        <a href="mailto:support@mydeeptech.ng">support@mydeeptech.ng</a>
                    </p>
                    <p style="margin-top: 20px; font-size: 12px; color: #68737d;">
                        MyDeepTech Limited | Lagos, Nigeria<br>
                        <a href="https://mydeeptech.ng">mydeeptech.ng</a> | 
                        <a href="https://mydeeptech.ng/privacy">Privacy Policy</a>
                    </p>
                </div>
            </div>
        </body>
        </html>
      `,
      textContent: `
Password Reset Request - MyDeepTech

Hello ${name},

We received a request to reset the password for your MyDeepTech account.

Reset your password by visiting this link:
${resetUrl}

IMPORTANT SECURITY INFORMATION:
- This link expires in 1 hour
- If you didn't request this, you can safely ignore this email
- Your current password remains unchanged until you complete the reset
- Use this link only once - it cannot be reused

If the link doesn't work, copy and paste it into your browser address bar.

Didn't request this? Someone else might have entered your email address by mistake. 
Your account remains secure.

Need help? Contact: support@mydeeptech.ng

MyDeepTech Security Team
https://mydeeptech.ng
      `
    };

    // Send email using Brevo SMTP
    const response = await brevoTransporter.sendMail(emailContent);
    
    console.log(`✅ Password reset email sent to ${email} via Brevo SMTP`);
    return { 
      success: true, 
      messageId: response.messageId,
      provider: 'brevo-smtp',
      resetUrl 
    };

  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
};

/**
 * Send password reset confirmation email
 * @param {string} email - User's email address  
 * @param {string} name - User's name
 * @param {string} userType - 'user' or 'dtuser'
 */
const sendPasswordResetConfirmationEmail = async (email, name, userType = 'user') => {
  try {
    const loginUrl = userType === 'dtuser' 
      ? `${process.env.FRONTEND_URL || 'https://mydeeptech.ng'}/dtuser/login`
      : `${process.env.FRONTEND_URL || 'https://mydeeptech.ng'}/login`;

    const emailContent = {
      to: [{ email, name }],
      subject: '✅ MyDeepTech Password Successfully Changed',
      htmlContent: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Changed Successfully</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f7fa; }
                .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); overflow: hidden; }
                .header { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 40px 30px; text-align: center; }
                .content { padding: 40px 30px; }
                .success-icon { font-size: 48px; margin-bottom: 20px; }
                .login-button { display: inline-block; background: #48bb78; color: white; text-decoration: none; padding: 15px 30px; border-radius: 25px; font-weight: bold; margin: 20px 0; }
                .footer { background: #2d3748; color: #a0aec0; padding: 20px; text-align: center; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="success-icon">✅</div>
                    <h1>Password Changed Successfully!</h1>
                </div>
                
                <div class="content">
                    <p>Hello ${name},</p>
                    
                    <p>Your MyDeepTech account password has been successfully changed. You can now log in with your new password.</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${loginUrl}" class="login-button">
                            🚀 Login Now
                        </a>
                    </div>
                    
                    <div style="background: #fed7d7; border: 1px solid #fc8181; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0; color: #c53030;"><strong>⚠️ Security Alert</strong></p>
                        <p style="margin: 10px 0 0 0; color: #c53030;">
                            If you didn't change your password, please contact our support team immediately at 
                            <a href="mailto:support@mydeeptech.ng" style="color: #c53030;">support@mydeeptech.ng</a>
                        </p>
                    </div>
                    
                    <p style="color: #718096; font-size: 14px; margin-top: 30px;">
                        This confirmation was sent from ${new Date().toLocaleString()} as a security measure.
                    </p>
                </div>
                
                <div class="footer">
                    <p><strong>MyDeepTech Security Team</strong></p>
                    <p>Contact: <a href="mailto:support@mydeeptech.ng" style="color: #48bb78;">support@mydeeptech.ng</a></p>
                </div>
            </div>
        </body>
        </html>
      `,
      textContent: `
Password Changed Successfully - MyDeepTech

Hello ${name},

Your MyDeepTech account password has been successfully changed. 
You can now log in with your new password.

Login here: ${loginUrl}

SECURITY ALERT: If you didn't change your password, please contact 
our support team immediately at support@mydeeptech.ng

This confirmation was sent on ${new Date().toLocaleString()} as a security measure.

MyDeepTech Security Team
support@mydeeptech.ng
      `
    };

    const response = await brevoTransporter.sendMail(emailContent);
    
    console.log(`✅ Password reset confirmation email sent to ${email}`);
    return { success: true, messageId: response.messageId };

  } catch (error) {
    console.error('❌ Error sending confirmation email:', error);
    throw new Error(`Failed to send confirmation email: ${error.message}`);
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendPasswordResetConfirmationEmail
};