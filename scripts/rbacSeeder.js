require('dotenv').config();
const mongoose = require("mongoose");
const Permission = require("../models/permissions.model");
const Role = require("../models/roles.model");
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

// ─── 1. DEFINE ALL PERMISSIONS ────────────────────────────────────────────────
// Format: resource:action
const PERMISSIONS = [
  // Overview
  { name: "overview:view", resource: "overview", action: "view" },

  // Annotators
  { name: "annotators:view", resource: "annotators", action: "view" },
  { name: "annotators:create", resource: "annotators", action: "create" },
  { name: "annotators:edit", resource: "annotators", action: "edit" },
  { name: "annotators:delete", resource: "annotators", action: "delete" },
  { name: "annotators:manage", resource: "annotators", action: "manage" },

  // Assessments
  { name: "assessments:view", resource: "assessments", action: "view" },
  { name: "assessments:create", resource: "assessments", action: "create" },
  { name: "assessments:edit", resource: "assessments", action: "edit" },
  { name: "assessments:delete", resource: "assessments", action: "delete" },
  { name: "assessments:manage", resource: "assessments", action: "manage" },

  // Projects
  { name: "projects:view", resource: "projects", action: "view" },
  { name: "projects:create", resource: "projects", action: "create" },
  { name: "projects:edit", resource: "projects", action: "edit" },
  { name: "projects:delete", resource: "projects", action: "delete" },
  { name: "projects:manage", resource: "projects", action: "manage" },

  // Applications
  { name: "applications:view", resource: "applications", action: "view" },
  { name: "applications:create", resource: "applications", action: "create" },
  { name: "applications:edit", resource: "applications", action: "edit" },
  { name: "applications:delete", resource: "applications", action: "delete" },
  { name: "applications:approve", resource: "applications", action: "approve" },
  { name: "applications:manage", resource: "applications", action: "manage" },

  // Payment
  { name: "payment:view", resource: "payment", action: "view" },
  { name: "payment:create", resource: "payment", action: "create" },
  { name: "payment:edit", resource: "payment", action: "edit" },
  { name: "payment:delete", resource: "payment", action: "delete" },
  { name: "payment:approve", resource: "payment", action: "approve" },
  { name: "payment:manage", resource: "payment", action: "manage" },

  // Invoice
  { name: "invoice:view", resource: "invoice", action: "view" },
  { name: "invoice:view_own", resource: "invoice", action: "view_own" }, // individual partners
  { name: "invoice:create", resource: "invoice", action: "create" },
  { name: "invoice:edit", resource: "invoice", action: "edit" },
  { name: "invoice:delete", resource: "invoice", action: "delete" },
  { name: "invoice:manage", resource: "invoice", action: "manage" },

  // Notifications
  { name: "notifications:view", resource: "notifications", action: "view" },
  { name: "notifications:manage", resource: "notifications", action: "manage" },

  // Support Chat
  { name: "support_chat:view", resource: "support_chat", action: "view" },
  { name: "support_chat:manage", resource: "support_chat", action: "manage" },

  // User Roles
  { name: "user_roles:view", resource: "user_roles", action: "view" },
  { name: "user_roles:manage", resource: "user_roles", action: "manage" },

  // Employees Management
  { name: "employees:view", resource: "employees", action: "view" },
  { name: "employees:create", resource: "employees", action: "create" },
  { name: "employees:edit", resource: "employees", action: "edit" },
  { name: "employees:delete", resource: "employees", action: "delete" },
  { name: "employees:manage", resource: "employees", action: "manage" },

  // Settings
  { name: "settings:view", resource: "settings", action: "view" },
  { name: "settings:manage", resource: "settings", action: "manage" },
];

// ─── 2. DEFINE ROLES WITH THEIR PERMISSION SETS ───────────────────────────────
const ROLE_PERMISSIONS = {
  super_admin: [
    // Gets everything
    "overview:view",
    "annotators:view", "annotators:create", "annotators:edit", "annotators:delete", "annotators:manage",
    "assessments:view", "assessments:create", "assessments:edit", "assessments:delete", "assessments:manage",
    "projects:view", "projects:create", "projects:edit", "projects:delete", "projects:manage",
    "applications:view", "applications:create", "applications:edit", "applications:delete", "applications:approve", "applications:manage",
    "payment:view", "payment:create", "payment:edit", "payment:delete", "payment:approve", "payment:manage",
    "invoice:view", "invoice:view_own", "invoice:create", "invoice:edit", "invoice:delete", "invoice:manage",
    "notifications:view", "notifications:manage",
    "support_chat:view", "support_chat:manage",
    "user_roles:view", "user_roles:manage",
    "employees:view", "employees:create", "employees:edit", "employees:delete", "employees:manage",
    "settings:view", "settings:manage",
  ],

  executives: [
    "overview:view",
    "projects:view",
    "payment:view",
    "invoice:view",
    "notifications:view",
  ],

  human_resources: [
    "overview:view",
    "applications:view", "applications:approve", "applications:edit",
    "annotators:view", "annotators:edit",
    "assessments:view", "assessments:edit",
    "employees:manage",
    "notifications:view",
  ],

  operations: [
    "overview:view",
    "projects:view", "projects:create", "projects:edit",
    "annotators:view", "annotators:edit",
    "assessments:view", "assessments:edit",
    "support_chat:view", "support_chat:manage",
    "notifications:view",
  ],

  product_dev: [
    "overview:view",
    "projects:view", "projects:edit",
    "assessments:view", "assessments:create", "assessments:edit",
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

  media: [
    "overview:view",
    "notifications:view",
    "support_chat:view",
  ],
};

// ─── 3. SEED FUNCTION ─────────────────────────────────────────────────────────
const seedRBAC = async () => {
  try {
    console.log("🌱 Starting RBAC seed...\n");

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
    const roleDocs = Object.entries(ROLE_PERMISSIONS).map(([roleName, permNames]) => {
      const resolvedIds = permNames
        .map((name) => {
          if (!permissionMap[name]) {
            console.warn(`⚠️  Permission "${name}" not found for role "${roleName}"`);
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
    });

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
    corporate_partnerships: "Client relationship management for corporate partners.",
    individual_partnerships: "Independent contractor and client coordination.",
    legal: "Contracts, compliance, and legal review.",
    media: "Communications, branding, and support.",
  };
  return descriptions[roleName] || "";
}

// ─── 5. RUN ───────────────────────────────────────────────────────────────────
// Run directly: node seeders/rbacSeeder.js
if (require.main === module) {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/your_db";

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
