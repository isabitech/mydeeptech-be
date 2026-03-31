/**
 * Single Source of Truth for Resources, Roles, and Permissions
 *
 * To add a new resource to the system:
 * 1. Add it to the RESOURCE_DEFINITIONS array below.
 * 2. Specify the actions it supports.
 * 3. Assign it to specific roles in /scripts/rbacSeeder.js (ROLE_PERMISSIONS) if needed.
 *    Note: The 'super_admin' role will automatically receive ALL permissions defined here.
 */

const ACTIONS = {
  VIEW: "view",
  VIEW_OWN: "view_own",
  CREATE: "create",
  EDIT: "edit",
  DELETE: "delete",
  APPROVE: "approve",
  MANAGE: "manage",
};

const ALL_ACTIONS = Object.values(ACTIONS);

const RESOURCE_DEFINITIONS = [
  {
    key: "overview",
    label: "Overview",
    icon: "HomeOutlined",
    resource: "overview",
    path: "/overview",
    actions: ALL_ACTIONS,
  },
  {
    key: "annotators",
    label: "Annotators",
    icon: "UserOutlined",
    resource: "annotators",
    path: "/annotators",
    actions: ALL_ACTIONS,
  },
  {
    key: "assessments",
    label: "Assessments",
    icon: "BookOutlined",
    resource: "assessments",
    path: "/assessments",
    actions: ALL_ACTIONS,
  },
  {
    key: "projects",
    label: "Projects",
    icon: "CodeSandboxOutlined",
    resource: "projects",
    path: "/projects",
    actions: ALL_ACTIONS,
  },
  {
    key: "applications",
    label: "Applications",
    icon: "InboxOutlined",
    resource: "applications",
    path: "/applications",
    actions: ALL_ACTIONS,
  },
  {
    key: "payment",
    label: "Payment",
    icon: "WalletOutlined",
    resource: "payment",
    path: "/payments",
    actions: ALL_ACTIONS,
  },
  {
    key: "invoice",
    label: "Invoice",
    icon: "WalletOutlined",
    resource: "invoice",
    path: "/invoices",
    actions: ALL_ACTIONS,
  },
  {
    key: "partner-invoice",
    label: "Partners Invoice",
    icon: "FileTextOutlined",
    resource: "invoice", // Maps to the same core 'invoice' permissions
    path: "/partner-invoices",
    actions: ALL_ACTIONS,
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: "BellOutlined",
    resource: "notifications",
    path: "/notifications",
    actions: ALL_ACTIONS,
  },
  {
    key: "chat",
    label: "Support Chat",
    icon: "MessageOutlined",
    resource: "support_chat",
    path: "/chat",
    actions: ALL_ACTIONS,
  },
  {
    key: "users",
    label: "User Roles",
    icon: "UserOutlined",
    resource: "user_roles",
    path: "/users",
    actions: ALL_ACTIONS,
  },
  {
    key: "employees",
    label: "Employees Mgt",
    icon: "UserOutlined",
    resource: "employees",
    path: "/employees",
    actions: ALL_ACTIONS,
  },
  {
    key: "rbac",
    label: "Roles & Permissions",
    icon: "SafetyOutlined",
    resource: "roles", // Uses "roles" as the core resource enum
    path: "/rbac",
    actions: ALL_ACTIONS,
  },
  {
    key: "settings",
    label: "Settings",
    icon: "SettingOutlined",
    resource: "settings",
    path: "/settings",
    actions: ALL_ACTIONS,
  },
];

// Extract unique resource identifiers for the Mongoose permission enum.
// We also add 'permissions' to cover any existing references not present in the frontend menu explicitly.
const RESOURCE_NAMES = [
  ...new Set(
    RESOURCE_DEFINITIONS.map((r) => r.resource).concat(["permissions"]),
  ),
];

// Generate an array of objects mapping every supported action to its resource
// Used mainly by the rbacSeeder
const SYSTEM_PERMISSIONS = [];
const permissionNames = new Set();
RESOURCE_DEFINITIONS.forEach((def) => {
  if (def.actions && def.actions.length > 0) {
    def.actions.forEach((action) => {
      const name = `${def.resource}:${action}`;
      if (!permissionNames.has(name)) {
        permissionNames.add(name);
        SYSTEM_PERMISSIONS.push({
          name,
          resource: def.resource,
          action: action,
        });
      }
    });
  }
});

module.exports = {
  ACTIONS,
  RESOURCE_DEFINITIONS,
  RESOURCE_NAMES,
  SYSTEM_PERMISSIONS,
};
