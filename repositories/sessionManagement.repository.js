// Layer: Repository
const HVNCSession = require('../models/hvnc-session.model');
const HVNCDevice = require('../models/hvnc-device.model');
const HVNCUser = require('../models/hvnc-user.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');

class SessionManagementRepository {
  async findDeviceByToken(token) {
    return await HVNCDevice.findOne({ 
      $or: [
        { device_id: token },
        { initial_access_code: token }
      ]
    });
  }

  async updateDeviceStatus(deviceId, status, systemInfo = {}) {
    const updateData = { 
      status, 
      last_seen: new Date() 
    };
    if (Object.keys(systemInfo).length > 0) {
      updateData.system_info = systemInfo;
    }
    return await HVNCDevice.updateOne({ device_id: deviceId }, updateData);
  }

  async findUserByEmail(email) {
    return await HVNCUser.findOne({ email });
  }

  async createSession(data) {
    return await HVNCSession.create(data);
  }

  async findSessionById(id) {
    return await HVNCSession.findById(id);
  }

  async updateSession(id, updateData) {
    return await HVNCSession.findByIdAndUpdate(id, updateData, { new: true });
  }

  async countSessions(query = {}) {
    return await HVNCSession.countDocuments(query);
  }

  async logEvent(userEmail, event, metadata) {
    if (HVNCActivityLog.logUserEvent) {
      return await HVNCActivityLog.logUserEvent(userEmail, event, metadata);
    }
  }
}

module.exports = new SessionManagementRepository();
