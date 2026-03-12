const permissionsService = require("../services/permission.service");

class PermissionController {
    async createPermission(req, res) {
        try {
            const { name, description } = req.body;
            const permission = await permissionsService.createPermission({ name, description });
            res.status(201).json(permission);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async createManyPermissions(req, res) {
        try {
            const { permissions } = req.body;
            const createdPermissions = await permissionsService.createManyPermissions(permissions);
            res.status(201).json(createdPermissions);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getAllPermissions(req, res) {
        try {
            const permissions = await permissionsService.getAllPermissions();
            res.status(200).json(permissions);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getPermissionById(req, res) {
        try {
            const { id } = req.params;
            const permission = await permissionsService.getPermissionById(id);
            res.status(200).json(permission);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getPermissionByName(req, res) {
        try {
            const { name } = req.params;
            const permission = await permissionsService.getPermissionByName(name);
            res.status(200).json(permission);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async updatePermission(req, res) {
        try {
            const { id } = req.params;
            const { name, description } = req.body;
            const updatedPermission = await permissionsService.updatePermission(id, { name, description });
            res.status(200).json(updatedPermission);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async deletePermission(req, res) {
        try {
            const { id } = req.params;
            const deletedPermission = await permissionsService.deletePermission(id);
            res.status(200).json(deletedPermission);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = new PermissionController();