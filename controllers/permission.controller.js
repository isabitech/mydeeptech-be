const PermissionService = require("../services/permission.service");
const ResponseClass = require('../utils/response-handler');

class PermissionController {
    async createPermission(req, res, next) {
        try {
            const { name, description, resource, action } = req.body;
            const permission = await PermissionService.createPermission({ name, description, resource, action });
            return ResponseClass.Success(res, { message: 'Permission created successfully', data: permission });
        } catch (error) {
            next(error);
        }
    }

    async createManyPermissions(req, res, next) {
        try {
            const { permissions } = req.body;
            const createdPermissions = await PermissionService.createManyPermissions(permissions);
            return ResponseClass.Success(res, { message: 'Permissions created successfully', data: createdPermissions });
        } catch (error) {
            next(error);
        }
    }

    async getAllPermissions(req, res, next) {
        try {
            const permissions = await PermissionService.getAllPermissions();
            return ResponseClass.Success(res, { message: 'Permissions fetched successfully', data: permissions });
        } catch (error) {
            next(error);
        }
    }

    async getPermissionById(req, res, next) {
        try {
            const { id } = req.params;
            const permission = await PermissionService.getPermissionById(id);
            return ResponseClass.Success(res, { message: 'Permission fetched successfully', data: permission });
        } catch (error) {
            next(error);
        }
    }

    async getPermissionByName(req, res, next) {
        try {
            const { name } = req.params;
            const permission = await PermissionService.getPermissionByName(name);
            return ResponseClass.Success(res, { message: 'Permission fetched successfully', data: permission });
        } catch (error) {
            next(error);
        }
    }

    async updatePermission(req, res, next) {
        try {
            const { id } = req.params;
            const { name, description } = req.body;
            const updatedPermission = await PermissionService.updatePermission(id, { name, description });
            return ResponseClass.Success(res, { message: 'Permission updated successfully', data: updatedPermission });
        } catch (error) {
            next(error);
        }
    }

    async deletePermission(req, res, next ) {
        try {
            const { id } = req.params;
            const deletedPermission = await PermissionService.deletePermission(id);
            return ResponseClass.Success(res, { message: 'Permission deleted and removed from all roles', data: deletedPermission });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new PermissionController();