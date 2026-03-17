const express = require("express");
const router = express.Router();
const PermissionController = require("../controllers/permission.controller");
const RoleController = require("../controllers/role.controller");

const { authenticateToken } = require("../middleware/auth");
const { authenticateAdmin } = require("../middleware/adminAuth");

const {
  validateCreatePermission,
  validateUpdatePermission,
  validatePermissionId,
  validateCreateRole,
  validateUpdateRole,
  validateRoleId,
  validateRemovePermissionsFromRole,
  validateAssignRoleToUserParams,
} = require("../validations/rbac.validation");

// Permission routes
router.post(
  "/permission/create",
  authenticateToken,
  authenticateAdmin,
  validateCreatePermission,
  PermissionController.createPermission,
);
router.get(
  "/permission/all",
  authenticateToken,
  authenticateAdmin,
  PermissionController.getAllPermissions,
);
router.get(
  "/permission/all/name",
  authenticateToken,
  authenticateAdmin,
  PermissionController.getAllPermissionsByName,
);
router.get(
  "/permission/all/name/:name",
  authenticateToken,
  authenticateAdmin,
  PermissionController.getAllPermissionsByName,
);
router.get(
  "/permission/:id",
  authenticateToken,
  authenticateAdmin,
  validatePermissionId,
  PermissionController.getPermissionById,
);
router.put(
  "/permission/update/:id",
  authenticateToken,
  authenticateAdmin,
  validatePermissionId,
  validateUpdatePermission,
  PermissionController.updatePermission,
);
router.delete(
  "/permission/delete/:id",
  authenticateToken,
  authenticateAdmin,
  validatePermissionId,
  PermissionController.deletePermission,
);

// Role routes
router.post(
  "/role/create",
  authenticateToken,
  authenticateAdmin,
  validateCreateRole,
  RoleController.createRole,
);
router.get(
  "/role/all",
  authenticateToken,
  authenticateAdmin,
  RoleController.getAllRoles,
);
router.get(
  "/role/:id",
  authenticateToken,
  authenticateAdmin,
  validateRoleId,
  RoleController.getRoleById,
);
router.put(
  "/role/:id",
  authenticateToken,
  authenticateAdmin,
  validateRoleId,
  validateUpdateRole,
  RoleController.updateRole,
);
router.patch(
  "/role/:id/permissions/remove",
  authenticateToken,
  authenticateAdmin,
  validateRoleId,
  validateRemovePermissionsFromRole,
  RoleController.removePermissionsFromRole,
);
router.delete(
  "/role/:id",
  authenticateToken,
  authenticateAdmin,
  validateRoleId,
  RoleController.deleteRole,
);

router.post(
  "/role/:id/assign-user/:userId",
  authenticateToken,
  authenticateAdmin,
  validateAssignRoleToUserParams,
  RoleController.assignRoleToUser,
);

module.exports = router;
