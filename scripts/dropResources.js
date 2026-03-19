#!/usr/bin/env node
const path = require("path");
const mongoose = require("mongoose");
const dns = require("node:dns");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function connectDatabase() {
  const mongoUri = process.env.MONGO_URI;
  const directMongoUri =
    process.env.MONGO_URI_DIRECT || process.env.MONGODB_URI;

  if (!mongoUri && !directMongoUri) {
    throw new Error("MONGO_URI is missing in environment variables");
  }

  try {
    await mongoose.connect(mongoUri || directMongoUri, {
      serverSelectionTimeoutMS: 30000,
    });
  } catch (error) {
    const isSrvDnsFailure =
      String(error?.message || "").includes("querySrv") ||
      String(error?.message || "").includes("ECONNREFUSED");

    if (isSrvDnsFailure && directMongoUri) {
      console.warn(
        "SRV lookup failed for MONGO_URI. Retrying with MONGO_URI_DIRECT/MONGODB_URI...",
      );
      await mongoose.connect(directMongoUri, {
        serverSelectionTimeoutMS: 30000,
      });
    } else {
      throw error;
    }
  }
}

async function dropResourcesCollection() {
  await connectDatabase();

  try {
    const collectionName = "resources";
    const db = mongoose.connection.db;

    const existing = await db
      .listCollections({ name: collectionName })
      .toArray();

    if (existing.length === 0) {
      console.log('Collection "resources" does not exist. Nothing to drop.');
      return;
    }

    await db.dropCollection(collectionName);
    console.log('Collection "resources" dropped successfully.');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  dropResourcesCollection()
    .then(() => process.exit(0))
    .catch((error) => {
      const message = String(error?.message || error);
      if (message.includes("querySrv") || message.includes("ECONNREFUSED")) {
        console.error(
          "Drop failed: SRV DNS lookup failed. Check network/DNS, or set MONGO_URI_DIRECT with a non-SRV Mongo URI.",
        );
      } else {
        console.error("Drop failed:", message);
      }
      process.exit(1);
    });
}

module.exports = { dropResourcesCollection };
