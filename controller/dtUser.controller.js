const DTUser = require("../models/dtUser.model");
const { sendVerificationEmail } = require("../utils/mailer");
const { emailQueue } = require("../utils/emailQueue");
const { dtUserPasswordSchema, dtUserLoginSchema } = require("../utils/authValidator");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const jwt = require('jsonwebtoken');

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
      sendVerificationEmail(savedUser.email, savedUser.fullName, savedUser._id),
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

// Email verification function
const verifyEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;

    console.log(`🔍 Attempting to verify email for user ID: ${id}, email: ${email}`);

    // Find user by ID and email for extra security
    const user = await DTUser.findById(id);
    
    if (!user) {
      console.log(`❌ User not found with ID: ${id}`);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Verify email matches
    if (user.email !== email) {
      console.log(`❌ Email mismatch for user ${id}. Expected: ${user.email}, Got: ${email}`);
      return res.status(400).json({ 
        success: false,
        message: "Invalid verification link" 
      });
    }

    // Check if already verified
    if (user.isEmailVerified) {
      console.log(`✅ Email already verified for user: ${email}`);
      return res.status(200).json({ 
        success: true,
        message: "Email is already verified",
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          isEmailVerified: user.isEmailVerified
        }
      });
    }

    // Update user verification status
    user.isEmailVerified = true;
    await user.save();

    console.log(`✅ Email successfully verified for user: ${email}`);

    res.status(200).json({
      success: true,
      message: "Email verified successfully!",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        isEmailVerified: user.isEmailVerified
      }
    });

  } catch (error) {
    console.error("❌ Error verifying email:", error);
    res.status(500).json({
      success: false,
      message: "Server error during email verification",
      error: error.message,
    });
  }
};

// Password setup function (after email verification)
const setupPassword = async (req, res) => {
  try {
    // Validate input
    const { error } = dtUserPasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { userId, email, password } = req.body;

    console.log(`🔐 Setting up password for user ID: ${userId}, email: ${email}`);

    // Find user by ID and email for extra security
    const user = await DTUser.findById(userId);
    
    if (!user) {
      console.log(`❌ User not found with ID: ${userId}`);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Verify email matches
    if (user.email !== email) {
      console.log(`❌ Email mismatch for user ${userId}. Expected: ${user.email}, Got: ${email}`);
      return res.status(400).json({ 
        success: false,
        message: "Invalid request" 
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      console.log(`❌ Email not verified for user: ${email}`);
      return res.status(400).json({ 
        success: false,
        message: "Email must be verified before setting up password" 
      });
    }

    // Check if password already set
    if (user.hasSetPassword) {
      console.log(`⚠️ Password already set for user: ${email}`);
      return res.status(400).json({ 
        success: false,
        message: "Password has already been set. Use login instead." 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user with password
    user.password = hashedPassword;
    user.hasSetPassword = true;
    await user.save();

    console.log(`✅ Password successfully set for user: ${email}`);

    res.status(200).json({
      success: true,
      message: "Password set successfully! You can now login.",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        domains: user.domains,
        socialsFollowed: user.socialsFollowed,
        isEmailVerified: user.isEmailVerified,
        hasSetPassword: user.hasSetPassword,
        annotatorStatus: user.annotatorStatus,
        microTaskerStatus: user.microTaskerStatus,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error("❌ Error setting up password:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password setup",
      error: error.message,
    });
  }
};

// DTUser login function
const dtUserLogin = async (req, res) => {
  try {
    // Validate input
    const { error } = dtUserLoginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { email, password } = req.body;

    console.log(`🔐 Login attempt for email: ${email}`);

    // Find user by email
    const user = await DTUser.findOne({ email });
    
    if (!user) {
      console.log(`❌ User not found with email: ${email}`);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      console.log(`❌ Email not verified for user: ${email}`);
      return res.status(400).json({ 
        success: false,
        message: "Please verify your email first" 
      });
    }

    // Check if password is set
    if (!user.hasSetPassword || !user.password) {
      console.log(`❌ Password not set for user: ${email}`);
      return res.status(400).json({ 
        success: false,
        message: "Please set up your password first",
        requiresPasswordSetup: true,
        userId: user._id
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log(`❌ Invalid password for user: ${email}`);
      return res.status(400).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    console.log(`✅ Successful login for user: ${email}`);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        fullName: user.fullName
      },
      process.env.JWT_SECRET || 'your-secret-key', // Use environment variable for production
      { expiresIn: '7d' } // Token expires in 7 days
    );

    console.log(`🎟️ JWT token generated for user: ${email}`);

    // Return user data with JWT token
    res.status(200).json({
      success: true,
      message: "Login successful",
      token: token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        domains: user.domains,
        socialsFollowed: user.socialsFollowed,
        consent: user.consent,
        isEmailVerified: user.isEmailVerified,
        hasSetPassword: user.hasSetPassword,
        annotatorStatus: user.annotatorStatus,
        microTaskerStatus: user.microTaskerStatus,
        resultLink: user.resultLink,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error("❌ Error during DTUser login:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message,
    });
  }
};

module.exports = { createDTUser, createDTUserWithBackgroundEmail, verifyEmail, setupPassword, dtUserLogin };
