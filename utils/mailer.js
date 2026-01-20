const nodemailer = require("nodemailer");
const { sendVerificationEmailBrevo } = require('./brevoMailer');
const { sendVerificationEmailBrevoSMTP } = require('./brevoSMTP');

// Validate email configuration
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn("⚠️ Gmail SMTP configuration missing. Brevo will be used as primary email service.");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Add timeout and connection settings
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 5000,    // 5 seconds
  socketTimeout: 15000,     // 15 seconds
});

// Gmail SMTP fallback function
const sendVerificationEmailGmail = async (email, name, userId) => {
  const mailOptions = {
    from: `"MyDeepTech Team" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify Your Email Address",
    html: `
      <h2>Hello ${name},</h2>
      <p>Thank you for signing up. Please click the link below to verify your email:</p>
      <a href="https://mydeeptech.ng/api/auth/verifyDTusermail/${userId}?email=${encodeURIComponent(email)}">Verify Email</a>
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
  
  // 1st Priority: Try Brevo SMTP (fastest and most reliable)
  if (process.env.SMTP_LOGIN && process.env.SMTP_KEY) {
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
  if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY !== 'your-brevo-api-key-here') {
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
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
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
