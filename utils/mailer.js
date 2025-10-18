const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationEmail = async (email, name) => {
  const mailOptions = {
    from: `"Your Team" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify Your Email Address",
    html: `
      <h2>Hello ${name},</h2>
      <p>Thank you for signing up. Please click the link below to verify your email You are very welcome.:</p>
      <a href="https://yourfrontend.com/verify?email=${encodeURIComponent(email)}">Verify Email</a>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${email}`);
  } catch (error) {
    console.error("❌ Error sending email:", error);
  }
};

module.exports = { sendVerificationEmail };
