const roleRepository = require("../repositories/role.repository");
const permissionRepository = require("../repositories/permission.repository");

class RoleService {
  //  CREATE
  async createRole(data) {
    const { name, description, permissions = [] } = data;

    const alreadyExists = await roleRepository.exists(name);
    if (alreadyExists) {
      throw new Error(`Role "${name}" already exists`);
    }

    // Validate all permission IDs before creating
    if (permissions.length > 0) {
      const found = await permissionRepository.findManyByIds(permissions);
      if (found.length !== permissions.length) {
        throw new Error("One or more permission IDs are invalid");
      }
    }

    return await roleRepository.create({ name, description, permissions });
  }

  async createManyRoles(rolesArray = []) {
    // Useful for seeding all roles at once
    // Filter out any that already exist to avoid duplicate key errors
    const results = [];

    for (const item of rolesArray) {
      const exists = await roleRepository.exists(item.name);
      if (!exists) results.push(item);
    }

    if (results.length === 0) {
      throw new Error("All provided roles already exist");
    }

    return await roleRepository.createMany(results);
  }

  //  READ
  async getAllRoles(options = {}) {
    const { page = 1, limit = 10 } = options;
    return await roleRepository.findAll(page, limit);
  }

  async getRoleById(id) {
    const role = await roleRepository.findById(id);
    if (!role) throw new Error("Role not found");
    return role;
  }

  async getRoleByName(name, session = null) {
    const role = await roleRepository.findByName(name, session);
    if (!role) throw new Error(`Role "${name}" not found`);
    return role;
  }

  //  UPDATE
  async updateRole(id, data) {
    const role = await roleRepository.findByIdRaw(id);
    if (!role) throw new Error("Role not found");

    // Prevent duplicate name collision with another role
    if (data.name) {
      const existing = await roleRepository.findByName(data.name);
      if (existing && existing._id.toString() !== id) {
        throw new Error(`Role name "${data.name}" is already taken`);
      }
    }

    // Validate permission IDs if provided
    if (Array.isArray(data.permissions) && data.permissions.length > 0) {
      const found = await permissionRepository.findManyByIds(data.permissions);
      if (found.length !== data.permissions.length) {
        throw new Error("One or more permission IDs are invalid");
      }
    }

    return await roleRepository.update(id, data);
  }

  //  PERMISSION MANAGEMENT
  async addPermissionToRole(roleId, permissionId) {
    const role = await roleRepository.findByIdRaw(roleId);
    if (!role) throw new Error("Role not found");

    const permission = await permissionRepository.findById(permissionId);
    if (!permission) throw new Error("Permission not found");

    return await roleRepository.addPermission(roleId, permissionId);
  }

  async addManyPermissionsToRole(roleId, permissionIds = []) {
    const role = await roleRepository.findByIdRaw(roleId);
    if (!role) throw new Error("Role not found");

    const found = await permissionRepository.findManyByIds(permissionIds);
    if (found.length !== permissionIds.length) {
      throw new Error("One or more permission IDs are invalid");
    }

    return await roleRepository.addManyPermissions(roleId, permissionIds);
  }

  async removePermissionsFromRole(roleId, permissionIds = []) {
    const role = await roleRepository.findByIdRaw(roleId);
    if (!role) throw new Error("Role not found");

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      throw new Error("At least one permission ID is required");
    }

    return await roleRepository.removeManyPermissions(roleId, permissionIds);
  }

  //  DEACTIVATE / DELETE
  async deactivateRole(id) {
    const role = await roleRepository.findByIdRaw(id);
    if (!role) throw new Error("Role not found");

    return await roleRepository.deactivate(id);
  }

  async deleteRole(id) {
    const role = await roleRepository.findByIdRaw(id);
    if (!role) throw new Error("Role not found");

    return await roleRepository.delete(id);
  }

  // UTILITY
  async roleHasPermission(roleId, permissionName) {
    const role = await roleRepository.findById(roleId); // populated
    if (!role) throw new Error("Role not found");

    return role.permissions.some(
      (p) => p.name === permissionName.toLowerCase(),
    );
  }

  async assignRoleToUser(roleId, userId, session = null) {
    const role = await roleRepository.findById(roleId, session);
    if (!role) throw new Error("Role not found");

    const updatedUser = await roleRepository.assignToUser(
      roleId,
      userId,
      session,
    );
    if (!updatedUser) throw new Error("User not found");

    return updatedUser;
  }
}

module.exports = new RoleService();
