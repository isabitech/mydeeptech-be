#!/usr/bin/env node
const path = require("path");
const mongoose = require("mongoose");
const dns = require("node:dns");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Improves SRV DNS resolution reliability on some Windows/network setups.
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const Resource = require("../models/resource.model");

const FRONTEND_MENU = [
  {
    key: "overview",
    label: "Overview",
    icon: "HomeOutlined",
    resource: "overview",
    path: "/overview",
  },
  {
    key: "annotators",
    label: "Annotators",
    icon: "UserOutlined",
    resource: "annotators",
    path: "/annotators",
  },
  {
    key: "assessments",
    label: "Assessments",
    icon: "BookOutlined",
    resource: "assessments",
    path: "/assessments",
  },
  {
    key: "projects",
    label: "Projects",
    icon: "CodeSandboxOutlined",
    resource: "projects",
    path: "/projects",
  },
  {
    key: "applications",
    label: "Applications",
    icon: "InboxOutlined",
    resource: "applications",
    path: "/applications",
  },
  {
    key: "payment",
    label: "Payment",
    icon: "WalletOutlined",
    resource: "payment",
    path: "/payments",
  },
  {
    key: "invoice",
    label: "Invoice",
    icon: "WalletOutlined",
    resource: "invoice",
    path: "/invoices",
  },
  {
    key: "partner-invoice",
    label: "Partners Invoice",
    icon: "FileTextOutlined",
    resource: "invoice",
    path: "/partner-invoices",
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: "BellOutlined",
    resource: "notifications",
    path: "/notifications",
  },
  {
    key: "chat",
    label: "Support Chat",
    icon: "MessageOutlined",
    resource: "support_chat",
    path: "/chat",
  },
  {
    key: "users",
    label: "User Roles",
    icon: "UserOutlined",
    resource: "user_roles",
    path: "/users",
  },
  {
    key: "employees",
    label: "Employees Mgt",
    icon: "UserOutlined",
    resource: "employees",
    path: "/employees",
  },
  {
    key: "rbac",
    label: "Roles & Permissions",
    icon: "SafetyOutlined",
    resource: "roles",
    path: "/rbac",
  },
  {
    key: "settings",
    label: "Settings",
    icon: "SettingOutlined",
    resource: "settings",
    path: "/settings",
  },
];

function normalizeResource(value) {
  return value.trim().toLowerCase().replace(/-/g, "_");
}

function normalizeKey(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
}

async function upsertResource(menuItem, resourceKey, sortOrder) {
  const payload = {
    title: menuItem.label,
    link: menuItem.path,
    description: `${menuItem.label} sidebar resource`,
    icon: menuItem.icon,
    resourceKey,
    parent: null,
    sortOrder,
    isPublished: true,
  };

  const existing = await Resource.findOne({ link: payload.link });

  if (existing) {
    await Resource.updateOne({ _id: existing._id }, { $set: payload });
    return {
      status: "updated",
      id: existing._id.toString(),
      objectId: existing._id,
      key: menuItem.key,
    };
  }

  const created = await Resource.create(payload);
  return {
    status: "created",
    id: created._id.toString(),
    objectId: created._id,
    key: menuItem.key,
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
    const resourceKeyUsage = new Map();

    for (const [index, item] of FRONTEND_MENU.entries()) {
      const normalizedResource = normalizeResource(item.resource);
      let finalResourceKey = normalizedResource;

      if (resourceKeyUsage.has(normalizedResource)) {
        // Prevent resourceKey collisions when menu shares the same resource (e.g., invoice variants).
        finalResourceKey = `${normalizedResource}__${normalizeKey(item.key)}`;
      }

      resourceKeyUsage.set(
        normalizedResource,
        (resourceKeyUsage.get(normalizedResource) || 0) + 1,
      );

      const result = await upsertResource(item, finalResourceKey, index + 1);
      if (result.status === "created") createdCount += 1;
      if (result.status === "updated") updatedCount += 1;
      console.log(
        `- ${result.status.toUpperCase()}: ${result.key} (${result.id})`,
      );
    }

    console.log("\nResource seeding completed.");
    console.log(`Created: ${createdCount}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Total processed: ${FRONTEND_MENU.length}`);
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
