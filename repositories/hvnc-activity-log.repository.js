const HVNCActivityLog = require('../models/hvnc-activity-log.model');

class HVNCActivityLogRepository {
    static async create(logData) {
        const log = new HVNCActivityLog(logData);
        return await log.save();
    }

    static async findByUserEmail(user_email, limit = 50) {
        return await HVNCActivityLog.find({ user_email })
            .sort({ timestamp: -1 })
            .limit(limit);
    }

    static async findBySessionId(session_id) {
        return await HVNCActivityLog.find({ session_id })
            .sort({ timestamp: 1 });
    }

    static async findAll(filter = {}, limit = 100, skip = 0) {
        return await HVNCActivityLog.find(filter)
            .sort({ timestamp: -1 })
            .limit(limit)
            .skip(skip);
    }

    static async count(filter = {}) {
        return await HVNCActivityLog.countDocuments(filter);
    }

    static async getRecent(limit = 10) {
        return await HVNCActivityLog.find()
            .sort({ timestamp: -1 })
            .limit(limit);
    }

    static async logUserEvent(user_email, event_type, event_data, options = {}) {
        return await HVNCActivityLog.logUserEvent(user_email, event_type, event_data, options);
    }
}

module.exports = HVNCActivityLogRepository;
