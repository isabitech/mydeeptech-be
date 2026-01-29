const brevo = require('@getbrevo/brevo');
const envConfig = require('../config/envConfig');

// Initialize Brevo API client (using modern API configuration like paymentMailer.js)
const apiInstance = new brevo.TransactionalEmailsApi();

apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, envConfig.email.brevo.BREVO_API_KEY);

// Validate Brevo configuration
if (!envConfig.email.brevo.BREVO_API_KEY) {
  console.error("❌ Brevo API key missing. Please set BREVO_API_KEY in your .env file");
}

if (!envConfig.email.brevo.BREVO_SENDER_EMAIL) {
  console.error("❌ Brevo sender email missing. Please set BREVO_SENDER_EMAIL in your .env file");
}

const sendVerificationEmailBrevo = async (email, name, userId) => {
  try {
    // Use modern SendSmtpEmail initialization (consistent with paymentMailer.js)
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    
    // Configure email content
    sendSmtpEmail.subject = "Verify Your Email Address - MyDeepTech";
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to MyDeepTech!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Thank you for signing up with MyDeepTech! We're excited to have you on board.</p>
            <p>To complete your registration and verify your email address, please click the button below:</p>
            <a href="https://mydeeptech.ng/verify-email/${userId}?email=${encodeURIComponent(email)}" class="button">Verify Email Address</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="https://mydeeptech.ng/verify-email/${userId}?email=${encodeURIComponent(email)}">https://mydeeptech.ng/verify-email/${userId}?email=${encodeURIComponent(email)}</a></p>
            <p>If you didn't create an account with us, please ignore this email.</p>
            <p>Best regards,<br>The MyDeepTech Team</p>
          </div>
          <div class="footer">
            <p>© 2025 MyDeepTech. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Add plain text version for better compatibility (like paymentMailer.js)
    sendSmtpEmail.textContent = `
      Welcome to MyDeepTech!
      
      Hello ${name},
      
      Thank you for signing up with MyDeepTech!
      
      To verify your email address, please visit:
      https://mydeeptech.ng/verify-email/${userId}?email=${encodeURIComponent(email)}
      
      If you didn't create an account with us, please ignore this email.
      
      Best regards,
      The MyDeepTech Team
      
      © 2025 MyDeepTech. All rights reserved.
    `;
    
    // Configure sender (consistent with other mailers)
    sendSmtpEmail.sender = {
      name: envConfig.email.brevo.BREVO_SENDER_NAME || "MyDeepTech Team",
      email: envConfig.email.brevo.BREVO_SENDER_EMAIL
    };
    
    sendSmtpEmail.to = [{
      email: email,
      name: name
    }];
    
    // Add tags for tracking
    sendSmtpEmail.tags = ["email-verification", "user-signup"];
    
    // Send email using the properly configured API instance
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    console.log(`✅ Brevo verification email sent to ${email}`, result.messageId);
    
    return { 
      success: true, 
      messageId: result.messageId,
      provider: 'brevo-api'
    };
    
  } catch (error) {
    console.error("❌ Error sending Brevo email:", error);
    
    // Enhanced error handling for better debugging
    if (error.response && error.response.body) {
      const errorBody = error.response.body;
      console.error("Brevo API Error Details:", errorBody);
      throw new Error(`Brevo API Error: ${errorBody.message || errorBody.code || 'Unknown error'}`);
    }
    
    throw new Error(`Failed to send verification email via Brevo API: ${error.message}`);
  }
};

// Test Brevo API connection using modern configuration
const testBrevoConnection = async () => {
  try {
    // Use AccountApi to test connection (same approach as paymentMailer.js pattern)
    const accountApi = new brevo.AccountApi();
    accountApi.setApiKey(brevo.AccountApiApiKeys.apiKey, envConfig.email.brevo.BREVO_API_KEY);
    
    const account = await accountApi.getAccount();
    console.log("✅ Brevo API connection successful!", {
      email: account.email,
      plan: account.plan?.type,
      creditsRemaining: account.plan?.creditsRemaining
    });
    return true;
  } catch (error) {
    console.error("❌ Brevo API connection failed:", error.message);
    if (error.response && error.response.body) {
      console.error("Brevo API Error Details:", error.response.body);
    }
    return false;
  }
};

module.exports = { 
  sendVerificationEmailBrevo, 
  testBrevoConnection 
};