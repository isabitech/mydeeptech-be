const PermissionRepository = require("../repositories/permission.repository");

class PermissionService {
  //  CREATE 
  async createPermission(data) {
    const { name, description, resource, action } = data;

    const alreadyExists = await PermissionRepository.exists(name);
    if (alreadyExists) {
      throw new Error(`Permission "${name}" already exists`);
    }

    return await PermissionRepository.create({ name, description, resource, action });
  }

  async createManyPermissions(permissionsArray = []) {
    // Useful for seeding all permissions at once
    // Filter out any that already exist to avoid duplicate key errors
    const results = [];

    for (const item of permissionsArray) {
      const exists = await PermissionRepository.exists(item.name);
      if (!exists) results.push(item);
    }

    if (results.length === 0) {
      throw new Error("All provided permissions already exist");
    }

    return await PermissionRepository.createMany(results);
  }

  //  READ 
  async getAllPermissions() {
    return await PermissionRepository.findAll();
  }

  async getPermissionById(id) {
    const permission = await PermissionRepository.findById(id);
    if (!permission) throw new Error("Permission not found");
    return permission;
  }

  async getPermissionByName(name) {
    const permission = await PermissionRepository.findByName(name);
    if (!permission) throw new Error(`Permission "${name}" not found`);
    return permission;
  }

  async getPermissionsByResource(resource) {
    return await PermissionRepository.findByResource(resource);
  }

  async getPermissionsByAction(action) {
    return await PermissionRepository.findByAction(action);
  }

  //  UPDATE 
  async updatePermission(id, data) {
    const permission = await PermissionRepository.findById(id);
    if (!permission) throw new Error("Permission not found");

    // Prevent name collision with another permission
    if (data.name) {
      const existing = await PermissionRepository.findByName(data.name);
      if (existing && existing._id.toString() !== id) {
        throw new Error(`Permission name "${data.name}" is already taken`);
      }
    }

    return await PermissionRepository.update(id, data);
  }

  //  DELETE 
  async deletePermission(id) {
    const deleted = await PermissionRepository.delete(id);
    if (!deleted) throw new Error("Permission not found");

    return deleted;
  }
}

module.exports = new PermissionService();
