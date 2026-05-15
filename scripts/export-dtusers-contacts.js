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

function escapeCsv(value) {
  const safeValue = String(value ?? "")
    .trim()
    .replace(/\r?\n/g, " ")
    .replace(/"/g, '""');

  return `"${safeValue}"`;
}

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

async function exportDtUsersContacts() {
  await connectDatabase();

  try {
    const users = await DTUser.find(
      {},
      {
        fullName: 1,
        email: 1,
        phone: 1,
      },
    )
      .sort({ fullName: 1, email: 1 })
      .lean();

    const exportDir = path.join(repoRoot, "exports");
    fs.mkdirSync(exportDir, { recursive: true });

    const timestamp = new Date().toISOString().slice(0, 10);
    const filePath = path.join(exportDir, `dtusers_contacts_${timestamp}.csv`);

    const rows = [
      ["Name", "Email", "Phone Number"],
      ...users.map((user) => [user.fullName, user.email, user.phone]),
    ];

    const csvContent =
      "\uFEFF" + rows.map((row) => row.map(escapeCsv).join(",")).join("\n") + "\n";

    fs.writeFileSync(filePath, csvContent, "utf8");

    console.log(`Exported ${users.length} DTUsers to ${filePath}`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  exportDtUsersContacts()
    .then(() => process.exit(0))
    .catch((error) => {
      const message = String(error?.message || error);

      if (
        message.includes("querySrv") ||
        message.includes("ENOTFOUND") ||
        message.includes("ECONNREFUSED")
      ) {
        console.error(
          "Export failed: MongoDB DNS lookup/connection failed. Check network access, or set MONGO_URI_DIRECT/MONGODB_URI with a non-SRV Mongo URI.",
        );
      } else {
        console.error("Export failed:", message);
      }

      process.exit(1);
    });
}

module.exports = { exportDtUsersContacts };
