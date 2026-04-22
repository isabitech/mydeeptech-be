const HVNCSession = require('../models/hvnc-session.model');

class HVNCSessionRepository {
    static async findById(id) {
        return await HVNCSession.findById(id);
    }

    static async findActiveByUserEmail(user_email) {
        return await HVNCSession.findOne({ user_email, status: 'active' });
    }

    static async findActiveByDeviceId(device_id) {
        return await HVNCSession.findOne({ device_id, status: 'active' });
    }

    static async findByUserEmail(user_email, limit = 10, skip = 0) {
        return await HVNCSession.find({ user_email })
            .sort({ started_at: -1 })
            .limit(limit)
            .skip(skip);
    }

    static async countByUserEmail(user_email) {
        return await HVNCSession.countDocuments({ user_email });
    }

    static async countActiveForUser(user_email) {
        return await HVNCSession.countDocuments({
            user_email,
            status: { $in: ['active', 'idle'] }
        });
    }

    static async findRecentForUser(user_email, limit = 10) {
        return await HVNCSession.find({ user_email })
            .sort({ started_at: -1 })
            .limit(limit);
    }

    static async countDocuments(query = {}) {
        return await HVNCSession.countDocuments(query);
    }

    static async find(query = {}) {
        return await HVNCSession.find(query);
    }

    static async findOne(query = {}) {
        return await HVNCSession.findOne(query);
    }

    static async findActive() {
        return await HVNCSession.find({ status: 'active' });
    }

    static async create(sessionData) {
        const session = new HVNCSession(sessionData);
        return await session.save();
    }

    static async update(id, updateData) {
        return await HVNCSession.findByIdAndUpdate(id, updateData, { new: true });
    }

    static async findRecent(limit = 5) {
        return await HVNCSession.find()
            .sort({ started_at: -1 })
            .limit(limit);
    }
}

module.exports = HVNCSessionRepository;
