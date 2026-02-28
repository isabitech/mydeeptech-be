const nodemailer = require("nodemailer");
const { sendVerificationEmailBrevo } = require('./brevoMailer');
const { sendVerificationEmailBrevoSMTP } = require('./brevoSMTP');
const envConfig = require("../config/envConfig");


// Validate email configuration
if (!envConfig.email.legacy.EMAIL_USER || !envConfig.email.legacy.EMAIL_PASS) {
  console.warn("⚠️ Gmail SMTP configuration missing. Brevo will be used as primary email service.");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: envConfig.email.legacy.EMAIL_USER,
    pass: envConfig.email.legacy.EMAIL_PASS,
  },
  // Add timeout and connection settings
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 5000,    // 5 seconds
  socketTimeout: 15000,     // 15 seconds
});

// Gmail SMTP fallback function
const sendVerificationEmailGmail = async (email, name, userId) => {

  // href="https://mydeeptech.ng/api/auth/verifyDTusermail/${userId}?email=${encodeURIComponent(email)}";

  const BACKEND_URL = envConfig.NODE_ENV === 'production' ? 'https://mydeeptech.ng' : 'http://localhost:4000';
  const href = `${BACKEND_URL}/api/auth/verifyDTusermail/${userId}?email=${encodeURIComponent(email)}`;

  const mailOptions = {
    from: `"MyDeepTech Team" <${envConfig.email.legacy.EMAIL_USER}>`,
    to: email,
    subject: "Verify Your Email Address",
    html: `
      <h2>Hello ${name},</h2>
      <p>Thank you for signing up. Please click the link below to verify your email:</p>
      <a href="${href}">Verify Email</a>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Gmail verification email sent to ${email}`, info.messageId);
    return { success: true, messageId: info.messageId, provider: 'gmail' };
  } catch (error) {
    console.error("❌ Error sending Gmail email:", error);
    throw new Error(`Failed to send verification email via Gmail: ${error.message}`);
  }
};

// Main email function with priorities: Brevo SMTP > Brevo API > Gmail
const sendVerificationEmail = async (email, name, userId) => {
  console.log(`📧 Sending verification email to ${email}...`);

  // 1st Priority: Try Brevo SMTP (fastest ands most reliable)
  if (envConfig.email.brevo.SMTP_LOGIN && envConfig.email.brevo.SMTP_KEY) {
    try {
      console.log("� Attempting to send email via Brevo SMTP...");
      const result = await sendVerificationEmailBrevoSMTP(email, name, userId);
      console.log(`✅ Email sent successfully via ${result.provider}`);
      return result;
    } catch (brevoSMTPError) {
      console.warn("⚠️ Brevo SMTP failed, trying other methods...", brevoSMTPError.message);
    }
  }

  // 2nd Priority: Try Brevo API
  if (envConfig.email.brevo.BREVO_API_KEY && envConfig.email.brevo.BREVO_API_KEY !== 'your-brevo-api-key-here') {
    try {
      console.log("📨 Attempting to send email via Brevo API...");
      const result = await sendVerificationEmailBrevo(email, name, userId);
      console.log(`✅ Email sent successfully via ${result.provider}`);
      return result;
    } catch (brevoAPIError) {
      console.warn("⚠️ Brevo API failed, trying Gmail fallback...", brevoAPIError.message);
    }
  }
  
  // 3rd Priority: Gmail fallback
  if (envConfig.email.legacy.EMAIL_USER && envConfig.email.legacy.EMAIL_PASS) {
    try {
      console.log("� Attempting to send email via Gmail...");
      const result = await sendVerificationEmailGmail(email, name, userId);
      console.log(`✅ Email sent successfully via ${result.provider}`);
      return result;
    } catch (gmailError) {
      console.error("❌ Gmail also failed");
      throw new Error(`All email providers failed. Gmail: ${gmailError.message}`);
    }
  }
  
  // No email provider configured
  throw new Error("No email provider configured. Please set up Brevo SMTP, Brevo API, or Gmail SMTP credentials.");
};

module.exports = { sendVerificationEmail };
