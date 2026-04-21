const HVNCCommand = require('../models/hvnc-command.model');

class HVNCCommandRepository {
    static async create(commandData) {
        const command = new HVNCCommand(commandData);
        return await command.save();
    }

    static async findById(id) {
        return await HVNCCommand.findById(id);
    }

    static async findPendingByDeviceId(deviceId) {
        return await HVNCCommand.find({ 
            device_id: deviceId, 
            status: 'pending' 
        }).sort({ createdAt: 1 });
    }

    static async findActiveBySessionId(sessionId) {
        return await HVNCCommand.getActiveCommands(sessionId);
    }

    static async updateStatus(id, status, result = null) {
        const update = { status };
        if (result) update.result = result;
        if (status === 'completed' || status === 'failed') update.completedAt = new Date();
        
        return await HVNCCommand.findByIdAndUpdate(id, update, { new: true });
    }

    static async cancelPending(deviceId) {
        return await HVNCCommand.cancelDeviceCommands(deviceId, 'Device cancelled');
    }

    static async cancelPendingBySession(sessionId, reason = 'Session ended') {
        return await HVNCCommand.cancelSessionCommands(sessionId, reason);
    }
}

module.exports = HVNCCommandRepository;
