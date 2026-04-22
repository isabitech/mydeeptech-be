const HVNCShift = require('../models/hvnc-shift.model');

class HVNCShiftRepository {
    static async findById(id) {
        return await HVNCShift.findById(id);
    }

    static async findActiveByUserEmail(user_email) {
        const now = new Date();
        return await HVNCShift.findOne({
            user_email,
            status: 'active',
            start_date: { $lte: now },
            $or: [{ end_date: null }, { end_date: { $gte: now } }]
        });
    }

    static async findAllActiveForUser(user_email) {
        const now = new Date();
        return await HVNCShift.find({
            user_email,
            status: 'active',
            $or: [{ end_date: null }, { end_date: { $gte: now } }]
        });
    }

    static async findOne(query) {
        return await HVNCShift.findOne(query);
    }

    static async findAll(filter = {}) {
        return await HVNCShift.find(filter);
    }

    static async create(shiftData) {
        const shift = new HVNCShift(shiftData);
        return await shift.save();
    }

    static async findActiveByDeviceId(device_id) {
        const now = new Date();
        return await HVNCShift.find({
            device_id,
            status: 'active',
            $or: [{ end_date: null }, { end_date: { $gte: now } }]
        });
    }

    static async update(id, updateData) {
        return await HVNCShift.findByIdAndUpdate(id, updateData, { new: true });
    }
}

module.exports = HVNCShiftRepository;
