const rolesService = require("../services/role.service");

class RoleController {
    async createRole(req, res) {
        try {
            const { name, permissions } = req.body;
            const role = await rolesService.createRole({ name, permissions });
            res.status(201).json(role);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async createManyRoles(req, res) {
        try {
            const { roles } = req.body;
            const createdRoles = await rolesService.createManyRoles(roles);
            res.status(201).json(createdRoles);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getAllRoles(req, res) {
        try {
            const roles = await rolesService.getAllRoles();
            res.status(200).json(roles);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getRoleById(req, res) {
        try {
            const { id } = req.params;
            const role = await rolesService.getRoleById(id);
            res.status(200).json(role);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getRoleByName(req, res) {
        try {
            const { name } = req.params;
            const role = await rolesService.getRoleByName(name);
            res.status(200).json(role);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async updateRole(req, res) {
        try {
            const { id } = req.params;
            const { name, permissions } = req.body;
            const updatedRole = await rolesService.updateRole(id, { name, permissions });
            res.status(200).json(updatedRole);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async deleteRole(req, res) {
        try {
            const { id } = req.params;
            const deletedRole = await rolesService.deleteRole(id);
            res.status(200).json(deletedRole);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}