const Role = require("../models/roles.model");

class RoleRepository {
    //  CREATE 
    async create(data) {
        const role = new Role(data);
        return await role.save();
    }

    //  READ 
    async findAll(page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [roles, totalRoles] = await Promise.all([
            Role.find({ isActive: true })
                .populate({ path: 'permissions', select: 'name resource action -_id' })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Role.countDocuments({ isActive: true }),
        ]);

        const totalPages = Math.ceil(totalRoles / limit);

        return {
            roles,
            pagination: {
                currentPage: page,
                totalPages,
                totalRoles,
                rolesPerPage: limit,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        };
    }

    async findById(id) {
        return await Role.findById(id).populate({
            path: 'permissions',
            select: 'name resource action -_id',
        });
    }

    async findByName(name) {
        return await Role.findOne({ name: name.toLowerCase().trim() }).populate({
            path: 'permissions',
            select: 'name resource action -_id',
        });
    }

    async findByIdRaw(id) {
        // No populate — useful for internal checks
        return await Role.findById(id);
    }

    //  UPDATE 
    async update(id, data) {
        const { permissions, ...otherData } = data;
        const updateQuery = {};
        
        if (Object.keys(otherData).length > 0) {
            updateQuery.$set = otherData;
        }
        
        if (permissions && permissions.length > 0) {
            updateQuery.$addToSet = { permissions: { $each: permissions } };
        }

        return await Role.findByIdAndUpdate(id, updateQuery, { new: true }).populate({
            path: 'permissions',
            select: 'name resource action -_id',
        });
    }

    async addPermission(roleId, permissionId) {
        return await Role.findByIdAndUpdate(
            roleId,
            { $addToSet: { permissions: permissionId } }, // addToSet prevents duplicates
            { new: true }
        ).populate({
            path: 'permissions',
            select: 'name resource action -_id',
        });
    }

    async removePermission(roleId, permissionId) {
        return await Role.findByIdAndUpdate(
            roleId,
            { $pull: { permissions: permissionId } },
            { new: true }
        ).populate({
            path: 'permissions',
            select: 'name resource action -_id',
        });
    }

    async addManyPermissions(roleId, permissionIds = []) {
        return await Role.findByIdAndUpdate(
            roleId,
            { $addToSet: { permissions: { $each: permissionIds } } },
            { new: true }
        ).populate({
            path: 'permissions',
            select: 'name resource action -_id',
        });
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