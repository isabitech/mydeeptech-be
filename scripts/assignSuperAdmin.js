require('dotenv').config();
const mongoose = require("mongoose");
const DTUser = require("../models/dtUser.model");
const Role = require("../models/roles.model");
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const assignSuperAdmin = async (email) => {
  try {
    console.log(`\n🚀 Starting super_admin assignment for: ${email}`);

    // 1. Find the super_admin role
    const superAdminRole = await Role.findOne({ name: "super_admin" });
    if (!superAdminRole) {
      console.error("❌ Error: 'super_admin' role not found in the database.");
      console.log("💡 Tip: Run 'npm run seed-rbac' first to seed roles.");
      return;
    }
    console.log(`✅ Found super_admin role: ${superAdminRole._id}`);

    // 2. Find the user
    const user = await DTUser.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.error(`❌ Error: User with email '${email}' not found.`);
      return;
    }
    console.log(`✅ Found user: ${user.fullName} (${user._id})`);

    // 3. Update the user
    user.role_permission = superAdminRole._id;
    user.role = "admin"; // Maintain legacy compatibility if needed

    await user.save();
    const updated = await DTUser.findOne({ email: email.toLowerCase() }).select('role_permission role');
    console.log("🔍 Verification after save:", updated);
    console.log(`\n🎉 Successfully assigned 'super_admin' role to ${email}!`);
    console.log(`   - Name: ${user.fullName}`);
    console.log(`   - New Role Permission ID: ${user.role_permission}`);
    console.log(`   - Legacy Role: ${user.role}`);

  } catch (error) {
    console.error("❌ Assignment failed:", error.message);
  }
};

const run = async () => {
  const MONGO_URI = process.env.MONGO_URI;
  const targetEmail = "shina_bedev@mydeeptech.ng";

  if (!MONGO_URI) {
    console.error("❌ Error: MONGO_URI not found in environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log("📦 Connected to MongoDB");

    await assignSuperAdmin(targetEmail);

    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

run();
