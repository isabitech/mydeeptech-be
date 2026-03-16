const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated." });
    }

    const userRole = req.user.role || req.user.userDoc?.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(" or ")}.`,
      });
    }

    next();
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
    if (role && req.user.role === role) return next();

    // Check permission
    if (permission) {
      const [resource, action] = permission;
      const rolePermission = req.user.role_permission;

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
  requirePermission,
  requireRoleOrPermission,
};
