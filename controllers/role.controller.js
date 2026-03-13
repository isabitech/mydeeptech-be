const rolesService = require("../services/role.service");
const ResponseClass = require('../utils/response-handler');

class RoleController {
    async createRole(req, res) {
        try {
            const { name, permissions } = req.body;
            const role = await rolesService.createRole({ name, permissions });
            return ResponseClass.Success(res, { message: 'Role created successfully', data: role });
        } catch (error) {
            next(error);
        }
    }

    async createManyRoles(req, res) {
        try {
            const { roles } = req.body;
            const createdRoles = await rolesService.createManyRoles(roles);
            return ResponseClass.Success(res, { message: 'Roles created successfully', data: createdRoles });
        } catch (error) {
            next(error);
        }
    }

    async getAllRoles(req, res) {
        try {
            const roles = await rolesService.getAllRoles();
            return ResponseClass.Success(res, { message: 'Roles fetched successfully', data: roles });
        } catch (error) {
            next(error);
        }
    }

    async getRoleById(req, res) {
        try {
            const { id } = req.params;
            const role = await rolesService.getRoleById(id);
            return ResponseClass.Success(res, { message: 'Role fetched successfully', data: role });
        } catch (error) {
            next(error);
        }
    }

    async getRoleByName(req, res) {
        try {
            const { name } = req.params;
            const role = await rolesService.getRoleByName(name);
            return ResponseClass.Success(res, { message: 'Role fetched successfully', data: role });
        } catch (error) {
            next(error);
        }
    }

    async updateRole(req, res) {
        try {
            const { id } = req.params;
            const { name, permissions } = req.body;
            const updatedRole = await rolesService.updateRole(id, { name, permissions });
            return ResponseClass.Success(res, { message: 'Role updated successfully', data: updatedRole });
        } catch (error) {
            next(error);
        }
    }

    async deleteRole(req, res) {
        try {
            const { id } = req.params;
            const deletedRole = await rolesService.deleteRole(id);
            return ResponseClass.Success(res, { message: 'Role deleted successfully', data: deletedRole });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new RoleController();
