const rolesService = require("../services/role.service");
const ResponseClass = require("../utils/response-handler");

class RoleController {
  async createRole(req, res, next) {
    try {
      const { name, permissions, description, isActive } = req.body;
      const data = {
        ...(name && { name }),
        ...(permissions && { permissions }),
        ...(description && { description }),
        ...(isActive !== undefined && { isActive }),
      };
      const role = await rolesService.createRole(data);
      return ResponseClass.Success(res, {
        message: "Role created successfully",
        data: role,
      });
    } catch (error) {
      next(error);
    }
  }

  async createManyRoles(req, res, next) {
    try {
      const { roles } = req.body;
      const createdRoles = await rolesService.createManyRoles(roles);
      return ResponseClass.Success(res, {
        message: "Roles created successfully",
        data: createdRoles,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllRoles(req, res, next) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(
        Math.max(parseInt(req.query.limit, 10) || 10, 1),
        100,
      );

      const result = await rolesService.getAllRoles({ page, limit });
      return ResponseClass.Success(res, {
        message: "Roles fetched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRoleById(req, res, next) {
    try {
      const { id } = req.params;
      const role = await rolesService.getRoleById(id);
      return ResponseClass.Success(res, {
        message: "Role fetched successfully",
        data: role,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRoleByName(req, res, next) {
    try {
      const { name } = req.params;
      const role = await rolesService.getRoleByName(name);
      return ResponseClass.Success(res, {
        message: "Role fetched successfully",
        data: role,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, permissions, isActive } = req.body;
      const data = {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(permissions !== undefined && { permissions }),
        ...(isActive !== undefined && { isActive }),
      };

      const updatedRole = await rolesService.updateRole(id, data);
      return ResponseClass.Success(res, {
        message: "Role updated successfully",
        data: updatedRole,
      });
    } catch (error) {
      next(error);
    }
  }

  async removePermissionsFromRole(req, res, next) {
    try {
      const { id } = req.params;
      const { permissions } = req.body;
      const idsToRemove = Array.from(new Set(permissions));

      const updatedRole = await rolesService.removePermissionsFromRole(
        id,
        idsToRemove,
      );
      return ResponseClass.Success(res, {
        message: "Permissions removed from role successfully",
        data: updatedRole,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteRole(req, res, next) {
    try {
      const { id } = req.params;
      const deletedRole = await rolesService.deleteRole(id);
      return ResponseClass.Success(res, {
        message: "Role deleted successfully",
        data: deletedRole,
      });
    } catch (error) {
      next(error);
    }
  }
  async assignRoleToUser(req, res, next) {
    console.log("Assigning role to user with params:", req.params);
    try {
      const { id: roleId, userId } = req.params;

      console.log(`Assigning role ${roleId} to user ${userId}`);

      const updatedUser = await rolesService.assignRoleToUser(roleId, userId);
      return ResponseClass.Success(res, {
        message: "Role assigned to user successfully",
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RoleController();
