const Permission = require("../models/permissions.model");

class PermissionRepository {
  escapeRegex(value = "") {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

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

  async findAllPaginated(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [permissions, totalPermissions] = await Promise.all([
      Permission.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Permission.countDocuments(),
    ]);

    const totalPages = Math.ceil(totalPermissions / limit);

    return {
      permissions,
      pagination: {
        currentPage: page,
        totalPages,
        totalPermissions,
        permissionsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findAllByNamePaginated(name = "", page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const trimmedName = name.trim();
    const filter = trimmedName
      ? { name: { $regex: this.escapeRegex(trimmedName), $options: "i" } }
      : {};

    const [permissions, totalPermissions] = await Promise.all([
      Permission.find(filter).select("_id name").sort({ name: 1, createdAt: -1 }).skip(skip).limit(limit),
      Permission.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalPermissions / limit);

    return {
      permissions,
      pagination: {
        currentPage: page,
        totalPages,
        totalPermissions,
        permissionsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      filters: {
        name: trimmedName,
      },
    };
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
