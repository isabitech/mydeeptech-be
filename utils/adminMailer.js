const { sendEmail } = require('./brevoSMTP');

const sendAdminVerificationEmail = async (email, verificationCode, adminName) => {
    try {
        console.log(`📧 Sending admin verification email to: ${email}`);

        const emailData = {
            to: email,
            subject: "🔐 Admin Account Verification - MyDeepTech",
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Admin Account Verification</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd; }
                        .verification-code { background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
                        .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: monospace; }
                        .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0; }
                        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                        .security-notice { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 15px 0; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>👑 Admin Account Verification</h1>
                        <p>MyDeepTech Administration Panel</p>
                    </div>
                    <div class="content">
                        <h2>Hello ${adminName || 'Admin'},</h2>
                        <p>A new admin account creation request has been initiated for this email address.</p>
                        
                        <div class="verification-code">
                            <h3>Your Verification Code:</h3>
                            <div class="code">${verificationCode}</div>
                            <p><small>This code expires in 15 minutes</small></p>
                        </div>

                        <div class="security-notice">
                            <h4>🔒 Security Information:</h4>
                            <ul>
                                <li>This verification code is required to complete admin account creation</li>
                                <li>Code is valid for 15 minutes only</li>
                                <li>Maximum 3 verification attempts allowed</li>
                                <li>If you didn't request this, please ignore this email</li>
                            </ul>
                        </div>

                        <div class="warning">
                            <h4>⚠️ Important Security Notice</h4>
                            <p>Admin accounts have elevated privileges in the MyDeepTech system. If you did not request admin account creation, please contact the system administrator immediately.</p>
                        </div>

                        <p><strong>Next Steps:</strong></p>
                        <ol>
                            <li>Use the verification code above in your admin creation request</li>
                            <li>Complete the admin account setup process</li>
                            <li>Secure your admin account with a strong password</li>
                        </ol>

                        <p>If you have any questions or didn't request this admin account, please contact support.</p>
                    </div>
                    <div class="footer">
                        <p>© 2025 MyDeepTech. All rights reserved.</p>
                        <p>This is an automated security email. Please do not reply.</p>
                    </div>
                </body>
                </html>
            `,
            text: `
Admin Account Verification - MyDeepTech

Hello ${adminName || 'Admin'},

A new admin account creation request has been initiated for this email address.

Your Verification Code: ${verificationCode}

This code expires in 15 minutes.

Security Information:
- This verification code is required to complete admin account creation
- Code is valid for 15 minutes only
- Maximum 3 verification attempts allowed
- If you didn't request this, please ignore this email

IMPORTANT SECURITY NOTICE:
Admin accounts have elevated privileges in the MyDeepTech system. If you did not request admin account creation, please contact the system administrator immediately.

Next Steps:
1. Use the verification code above in your admin creation request
2. Complete the admin account setup process
3. Secure your admin account with a strong password

If you have any questions or didn't request this admin account, please contact support.

© 2025 MyDeepTech. All rights reserved.
This is an automated security email. Please do not reply.
            `
        };

        const result = await sendEmail(emailData);
        console.log(`✅ Admin verification email sent successfully to: ${email}`);
        return result;

    } catch (error) {
        console.error(`❌ Failed to send admin verification email to ${email}:`, error);
        throw error;
    }
};

module.exports = {
    sendAdminVerificationEmail
};