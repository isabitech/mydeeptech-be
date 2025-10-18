const DTUser = require("../models/dtUser.model");
const { sendVerificationEmail } = require("../utils/mailer");

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

    // 4️⃣ Send verification email
    await sendVerificationEmail(savedUser.email, savedUser.fullName);

    res.status(201).json({
      message: "User created successfully. Verification email sent.",
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

module.exports = { createDTUser };
