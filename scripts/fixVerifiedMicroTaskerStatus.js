#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const dns = require("node:dns");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const repoRoot = path.resolve(__dirname, "..");
const nodeEnv = process.env.NODE_ENV || "development";
const envFileCandidates = [`.env.${nodeEnv}`, ".env"];
const envFile = envFileCandidates.find((file) =>
  fs.existsSync(path.join(repoRoot, file)),
);

if (envFile) {
  dotenv.config({ path: path.join(repoRoot, envFile) });
}

// Improves SRV DNS resolution reliability on some Windows/network setups.
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const DTUser = require("../models/dtUser.model");

const ISSUE_FILTER = {
  isEmailVerified: true,
  microTaskerStatus: { $ne: "approved" },
};

async function connectDatabase() {
  const mongoUri = process.env.MONGO_URI;
  const directMongoUri =
    process.env.MONGO_URI_DIRECT || process.env.MONGODB_URI;

  if (!mongoUri && !directMongoUri) {
    throw new Error("MONGO_URI is missing in environment variables.");
  }

  try {
    await mongoose.connect(mongoUri || directMongoUri, {
      serverSelectionTimeoutMS: 30000,
    });
  } catch (error) {
    const message = String(error?.message || error);
    const isSrvDnsFailure =
      message.includes("querySrv") ||
      message.includes("ENOTFOUND") ||
      message.includes("ECONNREFUSED");

    if (isSrvDnsFailure && directMongoUri) {
      console.warn(
        "SRV lookup failed for MONGO_URI. Retrying with MONGO_URI_DIRECT/MONGODB_URI...",
      );
      await mongoose.connect(directMongoUri, {
        serverSelectionTimeoutMS: 30000,
      });
      return;
    }

    throw error;
  }
}

async function getIssueSummary() {
  const affectedCount = await DTUser.countDocuments(ISSUE_FILTER);
  const totalVerifiedUsers = await DTUser.countDocuments({ isEmailVerified: true });

  const breakdown = await DTUser.aggregate([
    { $match: ISSUE_FILTER },
    {
      $group: {
        _id: { $ifNull: ["$microTaskerStatus", "null/undefined"] },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1, _id: 1 } },
  ]);

  const sampleUsers = await DTUser.find(ISSUE_FILTER)
    .select("fullName email microTaskerStatus isEmailVerified")
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(10)
    .lean();

  return {
    affectedCount,
    totalVerifiedUsers,
    breakdown,
    sampleUsers,
  };
}

function printSummary(summary) {
  console.log(`Verified users: ${summary.totalVerifiedUsers}`);
  console.log(
    `Verified users needing microTaskerStatus fix: ${summary.affectedCount}`,
  );

  if (summary.breakdown.length === 0) {
    console.log("No status mismatches found.");
  } else {
    console.log("\nBreakdown by current microTaskerStatus:");
    summary.breakdown.forEach((item) => {
      console.log(`- ${item._id}: ${item.count}`);
    });
  }

  if (summary.sampleUsers.length > 0) {
    console.log("\nSample affected users:");
    summary.sampleUsers.forEach((user) => {
      console.log(
        `- ${user.fullName || "(no name)"} | ${user.email || "(no email)"} | ${user.microTaskerStatus || "null/undefined"}`,
      );
    });
  }
}

async function checkVerifiedMicroTaskerStatus() {
  await connectDatabase();

  try {
    console.log("Checking for verified users with non-approved microTaskerStatus...");
    console.log(`Environment file: ${envFile || "none found"}`);

    const summary = await getIssueSummary();
    printSummary(summary);
  } finally {
    await mongoose.disconnect();
  }
}

async function fixVerifiedMicroTaskerStatus() {
  await connectDatabase();

  try {
    console.log("Backfilling microTaskerStatus for verified users...");
    console.log(`Environment file: ${envFile || "none found"}`);

    const before = await getIssueSummary();
    printSummary(before);

    if (before.affectedCount === 0) {
      console.log("\nNothing to update.");
      return;
    }

    const result = await DTUser.updateMany(ISSUE_FILTER, {
      $set: { microTaskerStatus: "approved" },
    });

    console.log(
      `\nUpdated ${result.modifiedCount} user(s) to microTaskerStatus=\"approved\".`,
    );

    const after = await getIssueSummary();
    console.log("\nPost-fix summary:");
    printSummary(after);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  const command = process.argv[2];

  const run =
    command === "check"
      ? checkVerifiedMicroTaskerStatus
      : command === "fix"
        ? fixVerifiedMicroTaskerStatus
        : null;

  if (!run) {
    console.log("Usage:");
    console.log(
      "  node scripts/fixVerifiedMicroTaskerStatus.js check  - Show verified users with mismatched microTaskerStatus",
    );
    console.log(
      "  node scripts/fixVerifiedMicroTaskerStatus.js fix    - Update mismatched verified users to microTaskerStatus=\"approved\"",
    );
    process.exit(1);
  }

  run()
    .then(() => process.exit(0))
    .catch((error) => {
      const message = String(error?.message || error);

      if (
        message.includes("querySrv") ||
        message.includes("ENOTFOUND") ||
        message.includes("ECONNREFUSED")
      ) {
        console.error(
          "Script failed: MongoDB DNS lookup/connection failed. Check network access, or set MONGO_URI_DIRECT/MONGODB_URI with a non-SRV Mongo URI.",
        );
      } else {
        console.error("Script failed:", message);
      }

      process.exit(1);
    });
}

module.exports = {
  checkVerifiedMicroTaskerStatus,
  fixVerifiedMicroTaskerStatus,
};
