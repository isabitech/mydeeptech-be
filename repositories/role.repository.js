const Role = require("../models/Role");

class RoleRepository {
    //  CREATE 
    async create(data) {
        const role = new Role(data);
        return await role.save();
    }

    //  READ 
    async findAll() {
        return await Role.find({ isActive: true }).populate("permissions");
    }

    async findById(id) {
        return await Role.findById(id).populate("permissions");
    }

    async findByName(name) {
        return await Role.findOne({ name: name.toLowerCase().trim() }).populate(
            "permissions"
        );
    }

    async findByIdRaw(id) {
        // No populate — useful for internal checks
        return await Role.findById(id);
    }

    //  UPDATE 
    async update(id, data) {
        return await Role.findByIdAndUpdate(id, { $set: data }, { new: true }).populate(
            "permissions"
        );
    }

    async addPermission(roleId, permissionId) {
        return await Role.findByIdAndUpdate(
            roleId,
            { $addToSet: { permissions: permissionId } }, // addToSet prevents duplicates
            { new: true }
        ).populate("permissions");
    }

    async removePermission(roleId, permissionId) {
        return await Role.findByIdAndUpdate(
            roleId,
            { $pull: { permissions: permissionId } },
            { new: true }
        ).populate("permissions");
    }

    async addManyPermissions(roleId, permissionIds = []) {
        return await Role.findByIdAndUpdate(
            roleId,
            { $addToSet: { permissions: { $each: permissionIds } } },
            { new: true }
        ).populate("permissions");
    }

    async deactivate(id) {
        return await Role.findByIdAndUpdate(
            id,
            { $set: { isActive: false } },
            { new: true }
        );
    }

    //  DELETE 
    async delete(id) {
        return await Role.findByIdAndDelete(id);
    }

    //  HELPERS 
    async exists(name) {
        const role = await Role.findOne({ name: name.toLowerCase().trim() });
        return !!role;
    }
}

module.exports = new RoleRepository();