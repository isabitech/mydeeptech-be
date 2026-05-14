const normalizeRoles = (roles = []) =>
  roles
    .flat(Infinity)
    .filter(Boolean)
    .map((role) => String(role).trim().toLowerCase());

const getNormalizedUserRoles = (req) => {
  const roles = new Set(
    normalizeRoles([
      req.user?.role,
      req.user?.userDoc?.role,
      req.user?.role_permission?.name,
      req.user?.userDoc?.role_permission?.name,
    ]),
  );

  // Keep super_admin compatible with legacy admin-only checks.
  if (roles.has("super_admin")) {
    roles.add("admin");
  }

  return [...roles];
};

const getNormalizedUserRole = (req) => getNormalizedUserRoles(req)[0] || "";

const isAdminLikeRole = (role) => ["admin", "super_admin"].includes(role);

const hasAllowedRole = (req, allowedRoles = []) => {
  const normalizedAllowedRoles = normalizeRoles(allowedRoles);
  const userRoles = getNormalizedUserRoles(req);

  return userRoles.some((role) => normalizedAllowedRoles.includes(role));
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated." });
    }

    const normalizedAllowedRoles = normalizeRoles(allowedRoles);

    if (!hasAllowedRole(req, normalizedAllowedRoles)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${normalizedAllowedRoles.join(" or ")}.`,
      });
    }

    next();
  };
};

const requireApprovedQAOrAdmin = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated." });
    }

    const qaStatus = req.user.qaStatus || req.user.userDoc?.qaStatus;

    if (
      getNormalizedUserRoles(req).some((role) => isAdminLikeRole(role))
    ) {
      return next();
    }

    if (qaStatus === "approved") {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "Access denied. An approved QA status is required.",
    });
  };
};

/**
 * ─────────────────────────────────────────────
 *  3. PERMISSION MIDDLEWARE — checks specific permission
 *  Usage: requirePermission("projects", "view")
 *         requirePermission("payment", "approve")
 * ─────────────────────────────────────────────
 */
const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated." });
    }

    const rolePermission =
      req.user.role_permission || req.user.userDoc?.role_permission || null;

    // No role assigned
    if (!rolePermission) {
      return res.status(403).json({
        success: false,
        message: "Access denied. No role assigned to your account.",
      });
    }

    // Role is inactive
    if (rolePermission.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Your role has been deactivated.",
      });
    }

    const permissions = rolePermission.permissions || [];

    // super_admin bypass — has access to everything
    if (rolePermission.name === "super_admin") {
      return next();
    }

    // Check for exact match or "manage" which supersedes all actions
    const hasPermission = permissions.some(
      (p) =>
        p.resource === resource &&
        (p.action === action || p.action === "manage"),
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Missing permission: ${resource}:${action}.`,
      });
    }

    next();
  };
};

/**
 * ─────────────────────────────────────────────
 *  4. COMBINED — role OR permission check
 *  Usage: requireRoleOrPermission({ role: "admin" })
 *         requireRoleOrPermission({ permission: ["payment", "approve"] })
 *         requireRoleOrPermission({ role: "admin", permission: ["payment", "approve"] })
 * ─────────────────────────────────────────────
 */
const requireRoleOrPermission = ({ role, permission } = {}) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated." });
    }

    // Check role
    if (role) {
      if (hasAllowedRole(req, [role])) {
        return next();
      }
    }

    // Check permission
    if (permission) {
      const [resource, action] = permission;
      const rolePermission =
        req.user.role_permission || req.user.userDoc?.role_permission;

      if (rolePermission?.name === "super_admin") return next();

      const permissions = rolePermission?.permissions || [];
      const hasPermission = permissions.some(
        (p) =>
          p.resource === resource &&
          (p.action === action || p.action === "manage"),
      );

      if (hasPermission) return next();
    }

    return res.status(403).json({
      success: false,
      message: "Access denied. Insufficient role or permissions.",
    });
  };
};

module.exports = {
  requireRole,
  requireApprovedQAOrAdmin,
  requirePermission,
  requireRoleOrPermission,
};
