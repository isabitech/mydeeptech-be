require("dotenv").config();
const mongoose = require("mongoose");
const DTUser = require("../models/dtUser.model");
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const KEEP_ID = process.env.KEEP_ID;
const REMOVE_ID = process.env.REMOVE_ID;
const TARGET_EMAIL = process.env.TARGET_EMAIL;

const run = async () => {
  const MONGO_URI = process.env.MONGO_URI;

  const missingVars = [];
  if (!MONGO_URI) missingVars.push("MONGO_URI");
  if (!KEEP_ID) missingVars.push("KEEP_ID");
  if (!REMOVE_ID) missingVars.push("REMOVE_ID");
  if (!TARGET_EMAIL) missingVars.push("TARGET_EMAIL");
  if (missingVars.length > 0) {
    console.error(
      `❌ Missing required environment variable(s): ${missingVars.join(", ")}.`,
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log("📦 Connected to MongoDB\n");

    // 1. Show both documents before doing anything
    const allDocs = await DTUser.find(
      { email: TARGET_EMAIL },
      { _id: 1, email: 1, role: 1, role_permission: 1, createdAt: 1 },
    );

    console.log(`🔍 Found ${allDocs.length} document(s) with this email:`);
    allDocs.forEach((doc, i) => {
      console.log(`\n  [${i + 1}]`, JSON.stringify(doc, null, 4));
    });

    // 2. Confirm the one we're keeping exists
    const keepDoc = await DTUser.findById(KEEP_ID);
    if (!keepDoc) {
      console.error(`\n❌ Cannot find KEEP_ID: ${KEEP_ID}. Aborting.`);
      process.exit(1);
    }
    console.log(
      `\n✅ Confirmed KEEP document exists: ${keepDoc._id} (${keepDoc.email})`,
    );

    // 3. Delete the old one
    const result = await DTUser.deleteOne({ _id: REMOVE_ID });

    if (result.deletedCount === 1) {
      console.log(`\n🗑️  Successfully removed duplicate: ${REMOVE_ID}`);
    } else {
      console.log(
        `\n⚠️  Document ${REMOVE_ID} was not found — may already be deleted.`,
      );
    }

    // 4. Verify only one document remains
    const remaining = await DTUser.find(
      { email: TARGET_EMAIL },
      { _id: 1, email: 1, role: 1, role_permission: 1 },
    );
    console.log(`\n📋 Remaining documents for this email: ${remaining.length}`);
    remaining.forEach((doc) => console.log(" -", JSON.stringify(doc)));

    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
};

run();
