const permissionRepository = require("../repositories/permission.repository");

class PermissionService {
  //  CREATE 
  async createPermission(data) {
    const { name, description, resource, action } = data;

    const alreadyExists = await permissionRepository.exists(name);
    if (alreadyExists) {
      throw new Error(`Permission "${name}" already exists`);
    }

    return await permissionRepository.create({ name, description, resource, action });
  }

  async createManyPermissions(permissionsArray = []) {
    // Useful for seeding all permissions at once
    // Filter out any that already exist to avoid duplicate key errors
    const results = [];

    for (const item of permissionsArray) {
      const exists = await permissionRepository.exists(item.name);
      if (!exists) results.push(item);
    }

    if (results.length === 0) {
      throw new Error("All provided permissions already exist");
    }

    return await permissionRepository.createMany(results);
  }

  //  READ 
  async getAllPermissions() {
    return await permissionRepository.findAll();
  }

  async getPermissionById(id) {
    const permission = await permissionRepository.findById(id);
    if (!permission) throw new Error("Permission not found");
    return permission;
  }

  async getPermissionByName(name) {
    const permission = await permissionRepository.findByName(name);
    if (!permission) throw new Error(`Permission "${name}" not found`);
    return permission;
  }

  async getPermissionsByResource(resource) {
    return await permissionRepository.findByResource(resource);
  }

  async getPermissionsByAction(action) {
    return await permissionRepository.findByAction(action);
  }

  //  UPDATE 
  async updatePermission(id, data) {
    const permission = await permissionRepository.findById(id);
    if (!permission) throw new Error("Permission not found");

    // Prevent name collision with another permission
    if (data.name) {
      const existing = await permissionRepository.findByName(data.name);
      if (existing && existing._id.toString() !== id) {
        throw new Error(`Permission name "${data.name}" is already taken`);
      }
    }

    return await permissionRepository.update(id, data);
  }

  //  DELETE 
  async deletePermission(id) {
    const permission = await permissionRepository.findById(id);
    if (!permission) throw new Error("Permission not found");

    return await permissionRepository.delete(id);
  }
}

module.exports = new PermissionService();
