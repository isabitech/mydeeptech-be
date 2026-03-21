const PermissionService = require("../services/permission.service");
const ResponseClass = require("../utils/response-handler");

class PermissionController {
  async createPermission(req, res, next) {
    try {
      const { name, description, resource, action } = req.body;
      const data = {
        ...(name && { name }),
        ...(description && { description }),
        ...(resource && { resource }),
        ...(action && { action }),
      };
      const permission = await PermissionService.createPermission(data);
      return ResponseClass.Success(res, {
        message: "Permission created successfully",
        data: permission,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPermissionOptions(req, res, next) {
    try {
      const options = await PermissionService.getPermissionOptions();

      return ResponseClass.Success(res, {
        message: "Permission options fetched successfully",
        data: options,
      });
    } catch (error) {
      next(error);
    }
  }

  async createManyPermissions(req, res, next) {
    try {
      const { permissions } = req.body;
      const createdPermissions =
        await PermissionService.createManyPermissions(permissions);
      return ResponseClass.Success(res, {
        message: "Permissions created successfully",
        data: createdPermissions,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllPermissions(req, res, next) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(
        Math.max(parseInt(req.query.limit, 10) || 10, 1),
        100,
      );

      const result = await PermissionService.getAllPermissions({ page, limit });
      return ResponseClass.Success(res, {
        message: "Permissions fetched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPermissionById(req, res, next) {
    try {
      const { id } = req.params;
      const permission = await PermissionService.getPermissionById(id);
      return ResponseClass.Success(res, {
        message: "Permission fetched successfully",
        data: permission,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPermissionByName(req, res, next) {
    try {
      const name = req.params.name || req.query.name;
      if (!name) {
        return ResponseClass.BadRequest(res, {
          message: "Permission name is required",
        });
      }
      const permission = await PermissionService.getPermissionByName(name);
      return ResponseClass.Success(res, {
        message: "Permission fetched successfully",
        data: permission,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllPermissionsByName(req, res, next) {
    try {
      const name = req.params.name || req.query.name || "";
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(
        Math.max(parseInt(req.query.limit, 10) || 10, 1),
        100,
      );

      const result = await PermissionService.getAllPermissionsByName({
        name,
        page,
        limit,
      });
      return ResponseClass.Success(res, {
        message: "Permissions fetched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePermission(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, resource, action } = req.body;
      const data = {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(resource !== undefined && { resource }),
        ...(action !== undefined && { action }),
      };
      const updatedPermission = await PermissionService.updatePermission(
        id,
        data,
      );
      return ResponseClass.Success(res, {
        message: "Permission updated successfully",
        data: updatedPermission,
      });
    } catch (error) {
      next(error);
    }
  }

  async deletePermission(req, res, next) {
    try {
      const { id } = req.params;
      const deletedPermission = await PermissionService.deletePermission(id);
      return ResponseClass.Success(res, {
        message: "Permission deleted and removed from all roles",
        data: deletedPermission,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PermissionController();
