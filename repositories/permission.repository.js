const Permission = require("../models/permissions.model");

class PermissionRepository {
  // CREATE 
  async create(data) {
    const permission = new Permission(data);
    return await permission.save();
  }

  async createMany(permissionsArray = []) {
    // insertMany is faster for bulk seeding
    return await Permission.insertMany(permissionsArray, { ordered: false });
  }

  //  READ 
  async findAll() {
    return await Permission.find();
  }

  async findById(id) {
    return await Permission.findById(id);
  }

  async findByName(name) {
    return await Permission.findOne({ name: name.toLowerCase().trim() });
  }

  async findByResource(resource) {
    // Get all permissions tied to a resource e.g. 'project', 'user'
    return await Permission.find({ resource });
  }

  async findByAction(action) {
    // Get all permissions with a specific action e.g. 'delete'
    return await Permission.find({ action });
  }

  async findManyByIds(ids = []) {
    return await Permission.find({ _id: { $in: ids } });
  }

  //  UPDATE 
  async update(id, data) {
    return await Permission.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    );
  }

  //  DELETE 
  async delete(id) {
    return await Permission.findByIdAndDelete(id);
  }

  //  HELPERS  
  async exists(name) {
    const permission = await Permission.findOne({ name: name.toLowerCase().trim() });
    return !!permission;
  }
}

module.exports = new PermissionRepository();
