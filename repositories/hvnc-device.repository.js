const HVNCDevice = require('../models/hvnc-device.model');

class HVNCDeviceRepository {
    static async findByDeviceId(deviceId) {
        return await HVNCDevice.findOne({ device_id: deviceId });
    }

    static async findById(id) {
        return await HVNCDevice.findById(id);
    }

    static async findActive() {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return await HVNCDevice.find({ 
            status: 'online',
            last_seen: { $gt: fiveMinutesAgo }
        });
    }

    static async findAll(filter = {}) {
        return await HVNCDevice.find(filter);
    }

    static async count(filter = {}) {
        return await HVNCDevice.countDocuments(filter);
    }

    static async findAllLive() {
        return await HVNCDevice.find({})
            .select('device_id pc_name status last_seen')
            .lean();
    }

    static async create(deviceData) {
        const device = new HVNCDevice(deviceData);
        return await device.save();
    }

    static async update(id, updateData) {
        return await HVNCDevice.findByIdAndUpdate(id, updateData, { new: true });
    }

    static async updateStatus(deviceId, status, last_seen = new Date()) {
        return await HVNCDevice.findOneAndUpdate(
            { device_id: deviceId },
            { status, last_seen },
            { new: true }
        );
    }
}

module.exports = HVNCDeviceRepository;
