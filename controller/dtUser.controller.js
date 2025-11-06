const DTUser = require("../models/dtUser.model");
const { sendVerificationEmail } = require("../utils/mailer");
const { emailQueue } = require("../utils/emailQueue");

// Option 1: Send email with timeout (current implementation)
const createDTUser = async (req, res) => {
  try {
    const { fullName, phone, email, domains, socialsFollowed, consent } = req.body;

    // 1️⃣ Check if user already exists
    const existing = await DTUser.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    // 2️⃣ Create new user
    const newUser = new DTUser({
      fullName,
      phone,
      email,
      domains,
      socialsFollowed,
      consent,
    });

    // 3️⃣ Save user to database
    const savedUser = await newUser.save();

    // 4️⃣ Send verification email asynchronously with timeout
    const emailPromise = Promise.race([
      sendVerificationEmail(savedUser.email, savedUser.fullName),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Email sending timeout')), 15000)
      )
    ]);

    try {
      await emailPromise;
      console.log(`✅ Verification email sent successfully to ${savedUser.email}`);
      
      res.status(201).json({
        message: "User created successfully. Verification email sent.",
        user: savedUser,
      });
    } catch (emailError) {
      console.error("❌ Email sending failed:", emailError.message);
      
      // Still respond with success since user was created
      res.status(201).json({
        message: "User created successfully. However, there was an issue sending the verification email. Please contact support.",
        user: savedUser,
        emailSent: false,
        emailError: emailError.message
      });
    }

  } catch (error) {
    console.error("❌ Error creating user:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Option 2: Background email sending (recommended for production)
const createDTUserWithBackgroundEmail = async (req, res) => {
  try {
    const { fullName, phone, email, domains, socialsFollowed, consent } = req.body;

    // 1️⃣ Check if user already exists
    const existing = await DTUser.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    // 2️⃣ Create new user
    const newUser = new DTUser({
      fullName,
      phone,
      email,
      domains,
      socialsFollowed,
      consent,
    });

    // 3️⃣ Save user to database
    const savedUser = await newUser.save();

    // 4️⃣ Queue verification email for background processing
    emailQueue.addEmail(savedUser.email, savedUser.fullName);

    // 5️⃣ Respond immediately without waiting for email
    res.status(201).json({
      message: "User created successfully. Verification email will be sent shortly.",
      user: savedUser,
    });

  } catch (error) {
    console.error("❌ Error creating user:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = { createDTUser, createDTUserWithBackgroundEmail };
