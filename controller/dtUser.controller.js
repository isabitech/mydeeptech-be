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
    const verifyLink = `http://localhost:5000/api/dt-users/verify-email/${newUser._id}`;
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: newUser.email,
      subject: "Verify Your Email",
      html: `<h3>Hello ${newUser.fullName}</h3>
             <p>Please verify your email by clicking below:</p>
             <a href="${verifyLink}">Verify Email</a>`,
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
    const user = await DTUser.findById(req.params.id);
    if (!user) return res.status(404).send("User not found");

    user.isEmailVerified = true;
    await user.save();

    res.status(200).json({
      responseCode: "90",
      responseMessage: "Email verified successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
