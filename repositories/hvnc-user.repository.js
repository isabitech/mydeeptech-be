const HVNCUser = require('../models/hvnc-user.model');

class HVNCUserRepository {
    static async findByEmail(email) {
        return await HVNCUser.findOne({ email });
    }

    static async findById(id) {
        return await HVNCUser.findById(id);
    }

    static async findAll(filter = {}) {
        return await HVNCUser.find(filter);
    }

    static async create(userData) {
        const user = new HVNCUser(userData);
        return await user.save();
    }

    static async update(id, updateData) {
        return await HVNCUser.findByIdAndUpdate(id, updateData, { new: true });
    }

    static async delete(id) {
        return await HVNCUser.findByIdAndDelete(id);
    }
}

module.exports = HVNCUserRepository;
