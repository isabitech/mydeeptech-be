require("dotenv").config();
const mongoose = require("mongoose");
const readline = require("node:readline");

const DTUser = require("../models/dtUser.model");
const Role = require("../models/roles.model");
const dns = require("dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const askForConfirmation = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
};

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  const email = (process.argv[2] || "").trim().toLowerCase();

  if (!mongoUri) {
    console.error("Error: MONGO_URI is missing.");
    process.exit(1);
  }

  if (!email) {
    console.error("Usage: node scripts/promoteUserToAdmin.js <email>");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);

    const user = await DTUser.findOne({ email });
    if (!user) {
      console.error(`User not found for email: ${email}`);
      return;
    }

    const shouldContinue = await askForConfirmation(
      "Promote this user to admin? (y/N): ",
    );

    if (!shouldContinue) {
      console.log("Cancelled. No changes were made.");
      return;
    }

    user.role = "admin";

    const adminRole = await Role.findOne({ name: "admin" });
    if (adminRole) {
      user.role_permission = adminRole._id;
    }
    await user.save();

    if (adminRole) {
      console.log(`Role permission: ${adminRole._id}`);
    }
  } catch (error) {
    console.error("Failed to promote user:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
};

run();
