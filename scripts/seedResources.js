#!/usr/bin/env node
const path = require("path");
const mongoose = require("mongoose");
const dns = require("node:dns");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Improves SRV DNS resolution reliability on some Windows/network setups.
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const Resource = require("../models/resource.model");

const RESOURCE_ITEMS = [
  { key: "overview", sortOrder: 1 },
  { key: "annotators", sortOrder: 2 },
  { key: "assessments", sortOrder: 3 },
  { key: "projects", sortOrder: 4 },
  { key: "applications", sortOrder: 5 },
  { key: "payment", sortOrder: 6 },
  { key: "invoice", sortOrder: 7 },
  { key: "notifications", sortOrder: 8 },
  { key: "support_chat", sortOrder: 9 },
  { key: "user_roles", sortOrder: 10 },
  { key: "employees", sortOrder: 11 },
  { key: "settings", sortOrder: 12 },
  { key: "roles", sortOrder: 1, parentKey: "user_roles" },
  { key: "permissions", sortOrder: 2, parentKey: "user_roles" },
];

function toTitle(value) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toRoute(value) {
  return `/admin/${value.replace(/_/g, "-")}`;
}

function toIcon(value) {
  return value.replace(/_/g, "-");
}

function toResourceKey(value) {
  return value.trim().toLowerCase().replace(/-/g, "_");
}

async function upsertResource(item, parentId = null) {
  const title = toTitle(item.key);
  const link = toRoute(item.key);
  const icon = toIcon(item.key);
  const resourceKey = toResourceKey(item.key);

  const payload = {
    title,
    link,
    description: `${title} sidebar resource`,
    icon,
    resourceKey,
    parent: parentId,
    sortOrder: Number(item.sortOrder) || 0,
    isPublished: true,
  };

  const existing = await Resource.findOne({ link });

  if (existing) {
    await Resource.updateOne({ _id: existing._id }, { $set: payload });
    return {
      status: "updated",
      id: existing._id.toString(),
      objectId: existing._id,
      key: item.key,
    };
  }

  const created = await Resource.create(payload);
  return {
    status: "created",
    id: created._id.toString(),
    objectId: created._id,
    key: item.key,
  };
}

async function seedResources() {
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

  try {
    let createdCount = 0;
    let updatedCount = 0;
    const seededByKey = new Map();

    for (const item of RESOURCE_ITEMS) {
      let parentId = null;

      if (item.parentKey) {
        const seededParent = seededByKey.get(item.parentKey);
        if (seededParent) {
          parentId = seededParent;
        } else {
          const parent = await Resource.findOne({
            link: toRoute(item.parentKey),
          }).select("_id");
          parentId = parent?._id || null;
        }
      }

      const result = await upsertResource(item, parentId);
      if (result.status === "created") createdCount += 1;
      if (result.status === "updated") updatedCount += 1;
      seededByKey.set(result.key, result.objectId);
      console.log(
        `- ${result.status.toUpperCase()}: ${result.key} (${result.id})`,
      );
    }

    console.log("\nResource seeding completed.");
    console.log(`Created: ${createdCount}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Total processed: ${RESOURCE_ITEMS.length}`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  seedResources()
    .then(() => process.exit(0))
    .catch((error) => {
      const message = String(error?.message || error);
      if (message.includes("querySrv") || message.includes("ECONNREFUSED")) {
        console.error(
          "Resource seed failed: SRV DNS lookup failed. Check network/DNS, or set MONGO_URI_DIRECT with a non-SRV Mongo URI.",
        );
      } else {
        console.error("Resource seed failed:", message);
      }
      process.exit(1);
    });
}

module.exports = { seedResources };
