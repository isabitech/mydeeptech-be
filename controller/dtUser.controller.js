const DTUser = require("../models/dtUser.model");
const transporter = require("../utils/mailer");

//   User Creation and Verification Mail
const createDTUser = async (req, res) => {
  try {
    const { fullName, phone, email, domains, socialsFollowed, consent } = req.body;

    const existing = await DTUser.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    const newUser = new DTUser({
      fullName,
      phone,
      email,
      domains,
      socialsFollowed,
      consent,
    });

    await newUser.save();

// send verification email
const verifyLink = `https://my-deep-tech.onrender.com/api/auth/dt-users/verify-email/${newUser._id}`;

await transporter.sendMail({
  from: process.env.MAIL_USER,
  to: newUser.email,
  subject: "Welcome to Mydeeptech – Get Started as an Annotator 🚀",
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h3>Hello ${newUser.fullName},</h3>
      
      <p>Welcome to <strong>Mydeeptech</strong>! 🎉 We’re excited to have you join our annotator community. To get started, please follow these steps:</p>
      
      <h4>Step 1 – Verify Your Email</h4>
      <p>
        Click the link below to confirm your email address:<br/>
        <a href="${verifyLink}" style="color: #1a73e8;">Verify Email</a>
      </p>

      <h4>Step 2 – Take Your First Assessment</h4>
      <p>Once you’re on the platform, complete the initial assessment to evaluate your readiness.</p>

      <h4>Step 3 – Earn Your Certifications</h4>
      <ul>
        <li>Complete the <strong>Micro1 Certification</strong>.</li>
        <li>Take the <strong>e2f English Test</strong> to demonstrate language proficiency.</li>
      </ul>

      <h4>Step 4 – Submit Your Results</h4>
      <p>After completing the above, upload and submit your assessment results through the platform.</p>

      <p>That’s it! ✅ Once reviewed, you’ll be on your way to exciting opportunities as a qualified annotator.</p>
      
      <p>If you run into any issues, our support team is here to help. Just reply to this email.</p>
      
      <p>Welcome aboard,<br/><strong>The Mydeeptech Team</strong></p>
    </div>
  `,
});


    res.status(201).json({
      responseCode: "90",
      responseMessage: "User created successfully. Please check your email to verify.",
      data: newUser,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Verify Email
const verifyEmail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send("User not found");

    user.isVerified = true;
    await user.save();

    return res.send("Email verified successfully!");
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
};

// User Submits Result Link
const submitResult = async (req, res) => {
  try {
    const { resultLink } = req.body;
    const user = await DTUser.findById(req.params.id);

    if (!user) return res.status(404).send("User not found");
    if (!user.isEmailVerified) return res.status(403).send("Verify email before submitting result");

    user.resultLink = resultLink;
    user.annotatorStatus = "submitted"; // mark status
    await user.save();

    res.status(200).json({
      responseCode: "90",
      responseMessage: "Result submitted successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin Get All Users
const getAllDTUsers = async (req, res) => {
  try {
    const users = await DTUser.find({}, "fullName email resultLink annotatorStatus microTaskerStatus");
    res.status(200).json({
      responseCode: "90",
      responseMessage: "Users fetched successfully",
      data: users,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin Update User Status
const updateUserStatus = async (req, res) => {
  try {
    const { annotatorStatus, microTaskerStatus } = req.body;
    const user = await DTUser.findById(req.params.id);

    if (!user) return res.status(404).send("User not found");

    if (annotatorStatus) user.annotatorStatus = annotatorStatus;
    if (microTaskerStatus) user.microTaskerStatus = microTaskerStatus;

    await user.save();

    res.status(200).json({
      responseCode: "90",
      responseMessage: "User status updated successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

 // Get Single User by ID
const getDTUser = async (req, res) => {
  try {
    const user = await DTUser.findById(
      req.params.id,
      "fullName phone email domains socialsFollowed consent resultLink annotatorStatus microTaskerStatus isEmailVerified"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      responseCode: "90",
      responseMessage: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


module.exports = { createDTUser, verifyEmail, submitResult, getAllDTUsers, getDTUser, updateUserStatus,};
