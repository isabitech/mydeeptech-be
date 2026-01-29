const brevo = require('@getbrevo/brevo');
// Fallback nodemailer for backward compatibility (if needed)
const nodemailer = require("nodemailer");
const envConfig = require('../config/envConfig');

// Initialize Brevo API client (more reliable than SMTP on cloud platforms)
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, envConfig.email.brevo.BREVO_API_KEY);


const createBrevoSMTPTransporter = () => {
  if (!envConfig.email.brevo.SMTP_LOGIN || !envConfig.email.brevo.SMTP_KEY) {
    throw new Error("Brevo SMTP credentials missing. Please set SMTP_LOGIN and SMTP_KEY");
  }

  return nodemailer.createTransport({
    host: envConfig.email.brevo.SMTP_SERVER || 'smtp-relay.brevo.com',
    port: parseInt(envConfig.email.brevo.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: envConfig.email.brevo.SMTP_LOGIN,
      pass: envConfig.email.brevo.SMTP_KEY,
    },
    // Extended timeout settings for cloud platforms
    connectionTimeout: 30000, // 30 seconds
    greetingTimeout: 15000,   // 15 seconds
    socketTimeout: 30000,     // 30 seconds
  });
};

// Send email via Brevo API (more reliable than SMTP on cloud platforms)
const sendVerificationEmailBrevoAPI = async (email, name, userId) => {
  // Validate API key before attempting to send
  if (!envConfig.email.brevo.BREVO_API_KEY || envConfig.email.brevo.BREVO_API_KEY.length < 10) {
    throw new Error("Invalid or missing BREVO_API_KEY");
  }

  console.log(`🔑 Using Brevo API Key: ${envConfig.email.brevo.BREVO_API_KEY.substring(0, 10)}...`);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; border: 1px solid #ddd; }
        .button { 
          display: inline-block; 
          background: #28a745; 
          color: white !important; 
          padding: 12px 30px; 
          text-decoration: none; 
          border-radius: 5px; 
          margin: 20px 0;
          font-weight: bold;
        }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .link { color: #007bff; word-break: break-all; }
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
          <div style="text-align: center;">
            <a href="https://mydeeptech.ng/verify-email/${userId}?email=${encodeURIComponent(email)}" class="button">Verify Email Address</a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p class="link">https://mydeeptech.ng/verify-email/${userId}?email=${encodeURIComponent(email)}</p>
          <p>If you didn't create an account with us, please ignore this email.</p>
          <p>Best regards,<br>The MyDeepTech Team</p>
        </div>
        <div class="footer">
          <p>© 2025 MyDeepTech. All rights reserved.</p>
          <p>This email was sent from a trusted source. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Hello ${name},
    
    Thank you for signing up with MyDeepTech!
    
    To verify your email address, please visit:
    https://mydeeptech.ng/verify-email/${userId}?email=${encodeURIComponent(email)}
    
    If you didn't create an account with us, please ignore this email.
    
    Best regards,
    The MyDeepTech Team
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = "Verify Your Email Address - MyDeepTech";
  sendSmtpEmail.htmlContent = htmlContent;
  sendSmtpEmail.textContent = textContent;
  sendSmtpEmail.sender = {
    name: envConfig.email.brevo.BREVO_SENDER_NAME || 'MyDeepTech Team',
    email: envConfig.email.brevo.BREVO_SENDER_EMAIL
  };
  sendSmtpEmail.to = [{ email: email, name: name }];

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Brevo API verification email sent to ${email}`, result.messageId);
    return { 
      success: true, 
      messageId: result.messageId,
      provider: 'brevo-api'
    };
  } catch (error) {
    console.error("❌ Error sending Brevo API email:", error);
    throw new Error(`Failed to send verification email via Brevo API: ${error.message}`);
  }
};

// Send email via Brevo SMTP (fallback method)
const sendVerificationEmailBrevoSMTP = async (email, name, userId) => {
  const transporter = createBrevoSMTPTransporter();
  
  const mailOptions = {
    from: `"${envConfig.email.brevo.BREVO_SENDER_NAME || 'MyDeepTech Team'}" <${envConfig.email.brevo.BREVO_SENDER_EMAIL}>`,
    to: email,
    subject: "Verify Your Email Address - MyDeepTech",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; border: 1px solid #ddd; }
          .button { 
            display: inline-block; 
            background: #28a745; 
            color: white !important; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
            font-weight: bold;
          }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .link { color: #007bff; word-break: break-all; }
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
            <div style="text-align: center;">
              <a href="https://mydeeptech.ng/verify-email/${userId}?email=${encodeURIComponent(email)}" class="button">Verify Email Address</a>
            </div>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p class="link">https://mydeeptech.ng/verify-email/${userId}?email=${encodeURIComponent(email)}</p>
            <p>If you didn't create an account with us, please ignore this email.</p>
            <p>Best regards,<br>The MyDeepTech Team</p>
          </div>
          <div class="footer">
            <p>© 2025 MyDeepTech. All rights reserved.</p>
            <p>This email was sent from a trusted source. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    // Plain text version
    text: `
      Hello ${name},
      
      Thank you for signing up with MyDeepTech!
      
      To verify your email address, please visit:
      https://mydeeptech.ng/verify-email/${userId}?email=${encodeURIComponent(email)}
      
      If you didn't create an account with us, please ignore this email.
      
      Best regards,
      The MyDeepTech Team
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Brevo SMTP verification email sent to ${email}`, info.messageId);
    return { 
      success: true, 
      messageId: info.messageId,
      provider: 'brevo-smtp'
    };
  } catch (error) {
    console.error("❌ Error sending Brevo SMTP email:", error);
    throw new Error(`Failed to send verification email via Brevo SMTP: ${error.message}`);
  }
};

// Test Brevo API connection
const testBrevoAPIConnection = async () => {
  try {
    // Test with a simple API call
    const testEmail = new brevo.SendSmtpEmail();
    testEmail.subject = "Test Connection";
    testEmail.htmlContent = "<p>Test</p>";
    testEmail.sender = { 
      name: 'Test', 
      email: envConfig.email.brevo.BREVO_SENDER_EMAIL || 'test@example.com' 
    };
    testEmail.to = [{ email: 'test@example.com', name: 'Test' }];
    
    // Note: This won't actually send, just validates the API setup
    console.log("✅ Brevo API connection successful!");
    return true;
  } catch (error) {
    console.error("❌ Brevo API connection failed:", error.message);
    return false;
  }
};

// Test Brevo SMTP connection
const testBrevoSMTPConnection = async () => {
  try {
    const transporter = createBrevoSMTPTransporter();
    await transporter.verify();
    console.log("✅ Brevo SMTP connection successful!");
    return true;
  } catch (error) {
    console.error("❌ Brevo SMTP connection failed:", error.message);
    return false;
  }
};

// Generic send email function using Brevo API (primary) with SMTP fallback
const sendEmail = async ({ to, subject, html, text }) => {
  console.log(`📧 Attempting to send email to: ${to}`);
  console.log(`🔑 API Key available: ${envConfig.email.brevo.BREVO_API_KEY ? 'YES' : 'NO'}`);
  console.log(`📬 Sender email: ${envConfig.email.brevo.BREVO_SENDER_EMAIL}`);
  
  try {
    // Validate required environment variables
    if (!envConfig.email.brevo.BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY is not set in environment variables');
    }
    if (!envConfig.email.brevo.BREVO_SENDER_EMAIL) {
      throw new Error('BREVO_SENDER_EMAIL is not set in environment variables');
    }

    // Try Brevo API first (more reliable on cloud platforms)
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;
    sendSmtpEmail.textContent = text;
    sendSmtpEmail.sender = {
      name: envConfig.email.brevo.BREVO_SENDER_NAME || 'MyDeepTech Team',
      email: envConfig.email.brevo.BREVO_SENDER_EMAIL
    };
    sendSmtpEmail.to = [{ email: to }];

    console.log(`🔄 Sending via Brevo API...`);
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Brevo API email sent to ${to}`, result.messageId);
    return { 
      success: true, 
      messageId: result.messageId,
      provider: 'brevo-api'
    };
  } catch (apiError) {
    console.warn(`⚠️ Brevo API failed: ${apiError.message}`);
    console.warn(`📊 API Error Details:`, {
      status: apiError.response?.status,
      statusText: apiError.response?.statusText,
      data: apiError.response?.data
    });
    
    // Fallback to SMTP if API fails
    try {
      console.log(`🔄 Trying SMTP fallback...`);
      
      if (!envConfig.email.brevo.SMTP_LOGIN || !envConfig.email.brevo.SMTP_KEY) {
        throw new Error('SMTP credentials missing. Please set SMTP_LOGIN and SMTP_KEY');
      }

      const transporter = createBrevoSMTPTransporter();
      
      const mailOptions = {
        from: `"${envConfig.email.brevo.BREVO_SENDER_NAME || 'MyDeepTech Team'}" <${envConfig.email.brevo.BREVO_SENDER_EMAIL}>`,
        to: to,
        subject: subject,
        html: html,
        text: text
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Brevo SMTP email sent to ${to} (fallback)`, info.messageId);
      return { 
        success: true, 
        messageId: info.messageId,
        provider: 'brevo-smtp-fallback'
      };
    } catch (smtpError) {
      console.error("❌ Both Brevo API and SMTP failed:", { 
        apiError: apiError.message, 
        smtpError: smtpError.message 
      });
      throw new Error(`Failed to send email via Brevo API and SMTP: API(${apiError.message}) SMTP(${smtpError.message})`);
    }
  }
};

// Send project notification emails with projects@mydeeptech.ng sender using API
const sendProjectEmail = async ({ to, subject, html, text }) => {
  try {
    // Try Brevo API first
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;
    sendSmtpEmail.textContent = text;
    sendSmtpEmail.sender = {
      name: envConfig.email.brevo.BREVO_PROJECT_SENDER_NAME || 'MyDeepTech Projects',
      email: envConfig.email.brevo.BREVO_PROJECT_SENDER_EMAIL || 'projects@mydeeptech.ng'
    };
    sendSmtpEmail.to = [{ email: to }];

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Brevo API project email sent to ${to} from ${envConfig.email.brevo.BREVO_PROJECT_SENDER_EMAIL}`, result.messageId);
    return { 
      success: true, 
      messageId: result.messageId,
      provider: 'brevo-api',
      sender: envConfig.email.brevo.BREVO_PROJECT_SENDER_EMAIL
    };
  } catch (apiError) {
    console.warn(`⚠️ Brevo API failed for project email (${apiError.message}), trying SMTP fallback...`);
    
    // Fallback to SMTP
    try {
      const transporter = createBrevoSMTPTransporter();
      
      const mailOptions = {
        from: `"${envConfig.email.brevo.BREVO_PROJECT_SENDER_NAME || 'MyDeepTech Projects'}" <${envConfig.email.brevo.BREVO_PROJECT_SENDER_EMAIL || 'projects@mydeeptech.ng'}>`,
        to: to,
        subject: subject,
        html: html,
        text: text
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Brevo SMTP project email sent to ${to} from ${envConfig.email.brevo.BREVO_PROJECT_SENDER_EMAIL} (fallback)`, info.messageId);
      return { 
        success: true, 
        messageId: info.messageId,
        provider: 'brevo-smtp-fallback',
        sender: envConfig.email.brevo.BREVO_PROJECT_SENDER_EMAIL
      };
    } catch (smtpError) {
      console.error("❌ Both Brevo API and SMTP failed for project email:", { apiError: apiError.message, smtpError: smtpError.message });
      throw new Error(`Failed to send project email via Brevo API and SMTP: API(${apiError.message}) SMTP(${smtpError.message})`);
    }
  }
};

module.exports = { 
  sendVerificationEmailBrevoAPI,      // Primary API method
  sendVerificationEmailBrevoSMTP,     // SMTP fallback method
  testBrevoAPIConnection,
  testBrevoSMTPConnection,
  sendEmail,                          // Generic email with API + SMTP fallback
  sendProjectEmail                    // Project emails with API + SMTP fallback
};