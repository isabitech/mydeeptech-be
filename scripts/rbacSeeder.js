require("dotenv").config();
const mongoose = require("mongoose");
const Permission = require("../models/permissions.model");
const Role = require("../models/roles.model");
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const { SYSTEM_PERMISSIONS } = require("../config/resources");

// ─── 1. DEFINE ALL PERMISSIONS ────────────────────────────────────────────────
// Format: resource:action
const PERMISSIONS = SYSTEM_PERMISSIONS;

// ─── 2. DEFINE ROLES WITH THEIR PERMISSION SETS ───────────────────────────────
const ROLE_PERMISSIONS = {
  super_admin: SYSTEM_PERMISSIONS.map(p => p.name),

  executives: [
    "overview:view",
    "projects:view",
    "payment:view",
    "invoice:view",
    "notifications:view",
  ],

  human_resources: [
    "overview:view",
    "applications:view",
    "applications:approve",
    "applications:edit",
    "annotators:view",
    "annotators:edit",
    "assessments:view",
    "assessments:edit",
    "employees:manage",
    "notifications:view",
  ],

  operations: [
    "overview:view",
    "projects:view",
    "projects:create",
    "projects:edit",
    "annotators:view",
    "annotators:edit",
    "assessments:view",
    "assessments:edit",
    "support_chat:view",
    "support_chat:manage",
    "notifications:view",
  ],

  product_dev: [
    "overview:view",
    "projects:view",
    "projects:edit",
    "assessments:view",
    "assessments:create",
    "assessments:edit",
    "annotators:view",
    "support_chat:view",
    "notifications:view",
  ],

  corporate_partnerships: [
    "overview:view",
    "projects:view",
    "invoice:view",
    "notifications:view",
  ],

  individual_partnerships: [
    "overview:view",
    "projects:view",
    "invoice:view_own",
    "notifications:view",
  ],

  legal: [
    "overview:view",
    "projects:view",
    "invoice:view",
    "applications:view",
    "notifications:view",
  ],

  media: ["overview:view", "notifications:view", "support_chat:view"],
};

// ─── 3. SEED FUNCTION ─────────────────────────────────────────────────────────
const seedRBAC = async () => {
  try {
    console.log("🌱 Starting RBAC seed...\n");

    // Safety guard: prevent accidental wipe in production
    if (
      process.env.NODE_ENV === "production" &&
      process.env.CONFIRM_SEED_RBAC !== "true"
    ) {
      console.error(
        "❌ Refusing to run RBAC seeder in production without explicit confirmation.\n" +
          "   Set CONFIRM_SEED_RBAC=true to proceed.",
      );
      process.exit(1);
    }

    // Step 1: Clear existing data
    await Permission.deleteMany({});
    await Role.deleteMany({});
    console.log("🗑️  Cleared existing permissions and roles\n");

    // Step 2: Insert all permissions
    const insertedPermissions = await Permission.insertMany(PERMISSIONS);
    console.log(`✅ Inserted ${insertedPermissions.length} permissions\n`);

    // Build a lookup map: permission name → ObjectId
    const permissionMap = {};
    insertedPermissions.forEach((p) => {
      permissionMap[p.name] = p._id;
    });

    // Step 3: Insert all roles with their resolved permission IDs
    const roleDocs = Object.entries(ROLE_PERMISSIONS).map(
      ([roleName, permNames]) => {
        const resolvedIds = permNames
          .map((name) => {
            if (!permissionMap[name]) {
              console.warn(
                `⚠️  Permission "${name}" not found for role "${roleName}"`,
              );
              return null;
            }
            return permissionMap[name];
          })
          .filter(Boolean);

        return {
          name: roleName,
          description: getRoleDescription(roleName),
          permissions: resolvedIds,
          isActive: true,
        };
      },
    );

    const insertedRoles = await Role.insertMany(roleDocs);
    console.log(`✅ Inserted ${insertedRoles.length} roles:\n`);
    insertedRoles.forEach((r) => {
      console.log(`   - ${r.name} (${r.permissions.length} permissions)`);
    });

    console.log("\n🎉 RBAC seed completed successfully!");
  } catch (error) {
    console.error("❌ Seed failed:", error.message);
    throw error;
  }
};

// ─── 4. ROLE DESCRIPTIONS ─────────────────────────────────────────────────────
function getRoleDescription(roleName) {
  const descriptions = {
    super_admin: "Full system access. No restrictions.",
    executives: "Leadership and directors. Visibility and financial oversight.",
    human_resources: "People management, hiring, and onboarding.",
    operations: "Workflow execution and delivery management.",
    product_dev: "Product performance, QA, and assessment oversight.",
    corporate_partnerships:
      "Client relationship management for corporate partners.",
    individual_partnerships: "Independent contractor and client coordination.",
    legal: "Contracts, compliance, and legal review.",
    media: "Communications, branding, and support.",
  };
  return descriptions[roleName] || "";
}

// ─── 5. RUN ───────────────────────────────────────────────────────────────────
// Run directly: node seeders/rbacSeeder.js
if (require.main === module) {
  const MONGO_URI =
    process.env.MONGO_URI || "mongodb://localhost:27017/your_db";

  mongoose
    .connect(MONGO_URI)
    .then(async () => {
      console.log("📦 Connected to MongoDB\n");
      await seedRBAC();
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ MongoDB connection failed:", err.message);
      process.exit(1);
    });
}

module.exports = seedRBAC;
