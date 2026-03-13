const HVNCDevice = require('../models/hvnc-device.model');
const DTUser = require('../models/dtUser.model');
const HVNCShift = require('../models/hvnc-shift.model');
const HVNCSession = require('../models/hvnc-session.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');
const crypto = require('crypto');

/**
 * GET /api/hvnc/admin/devices
 * Fetch all devices for device management
 */
const getAllDevices = async (req, res) => {
  try {
    const { status } = req.query;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    // Build query filter
    let query = {};
    if (status === 'Active') {
      query = { 
        last_seen: { $gt: fiveMinutesAgo },
        status: 'online'
      };
    } else if (status === 'Offline') {
      query = {
        $or: [
          { last_seen: { $lte: fiveMinutesAgo } },
          { status: { $ne: 'online' } }
        ]
      };
    }

    const devices = await HVNCDevice.find(query).lean();
    
    // Transform devices for frontend
    const deviceData = await Promise.all(devices.map(async (device) => {
      const isOnline = device.last_seen > fiveMinutesAgo && device.status === 'online';
      
      // Get assigned user
      let assignedUser = 'Unassigned';
      let assignedUserId = null;
      const shift = await HVNCShift.findOne({
        device_id: device.device_id,
        status: 'active',
        $or: [
          { end_date: null },
          { end_date: { $gte: new Date() } }
        ]
      });

      if (shift) {
        const user = await DTUser.findOne({ email: shift.user_email }).select('fullName email');
        if (user) {
          assignedUser = user.fullName;
          assignedUserId = user._id.toString();
        }
      }

      // Calculate Hubstaff time (placeholder - integrate with actual Hubstaff API)
      const hubstaffSeconds = device.system_info?.hubstaff_seconds || 0;
      const hubstaffHours = Math.floor(hubstaffSeconds / 3600);
      const hubstaffMinutes = Math.floor((hubstaffSeconds % 3600) / 60);
      const hubstaffSecondsRem = hubstaffSeconds % 60;
      const hubstaffDisplay = `${hubstaffHours.toString().padStart(2, '0')}:${hubstaffMinutes.toString().padStart(2, '0')}:${hubstaffSecondsRem.toString().padStart(2, '0')}`;
      
      // Calculate Hubstaff percentage (8 hours = 100%)
      const hubstaffPercent = Math.min(100, Math.floor((hubstaffSeconds / (8 * 3600)) * 100));

      return {
        id: device._id,
        pcName: device.pc_name,
        status: isOnline ? 'Active' : 'Offline',
        assigned: assignedUser,
        assignedUserId: assignedUserId,
        hubstaff: hubstaffDisplay,
        hubstaffSeconds: hubstaffSeconds,
        hubstaffPercent: hubstaffPercent
      };
    }));

    // Count totals
    const total = await HVNCDevice.countDocuments();
    const activeCount = await HVNCDevice.countDocuments({ 
      last_seen: { $gt: fiveMinutesAgo },
      status: 'online'
    });
    const inactiveCount = total - activeCount;

    res.json({
      total,
      activeCount,
      inactiveCount,
      devices: deviceData
    });

  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch devices'
    });
  }
};

/**
 * GET /api/hvnc/admin/devices/:deviceId
 * Get detailed device information
 */
const getDeviceDetail = async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const device = await HVNCDevice.findById(deviceId).lean();
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isOnline = device.last_seen > fiveMinutesAgo && device.status === 'online';

    // Get assigned user
    let assignedUser = 'Unassigned';
    let assignedUserId = null;
    const shift = await HVNCShift.findOne({
      device_id: device.device_id,
      status: 'active',
      $or: [
        { end_date: null },
        { end_date: { $gte: new Date() } }
      ]
    });

    if (shift) {
      const user = await DTUser.findOne({ email: shift.user_email }).select('fullName email');
      if (user) {
        assignedUser = user.fullName;
        assignedUserId = user._id.toString();
      }
    }

    // Calculate Hubstaff data
    const hubstaffSeconds = device.system_info?.hubstaff_seconds || 0;
    const hubstaffHours = Math.floor(hubstaffSeconds / 3600);
    const hubstaffMinutes = Math.floor((hubstaffSeconds % 3600) / 60);
    const hubstaffSecondsRem = hubstaffSeconds % 60;
    const hubstaffDisplay = `${hubstaffHours.toString().padStart(2, '0')}:${hubstaffMinutes.toString().padStart(2, '0')}:${hubstaffSecondsRem.toString().padStart(2, '0')}`;
    const hubstaffPercent = Math.min(100, Math.floor((hubstaffSeconds / (8 * 3600)) * 100));

    // Get current access code (or generate if none exists)
    let accessCode = device.initial_access_code;
    if (!accessCode) {
      accessCode = generateAccessCode();
      // Update device with new access code
      await HVNCDevice.findByIdAndUpdate(deviceId, { 
        initial_access_code: accessCode 
      });
    }

    // Format last seen
    let lastSeen = 'Never';
    if (device.last_seen) {
      const lastSeenMs = Date.now() - device.last_seen.getTime();
      if (lastSeenMs < 60000) {
        lastSeen = 'Just now';
      } else if (lastSeenMs < 3600000) {
        const mins = Math.floor(lastSeenMs / 60000);
        lastSeen = `${mins} min${mins > 1 ? 's' : ''} ago`;
      } else if (lastSeenMs < 86400000) {
        const hours = Math.floor(lastSeenMs / 3600000);
        lastSeen = `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        const days = Math.floor(lastSeenMs / 86400000);
        lastSeen = `${days} day${days > 1 ? 's' : ''} ago`;
      }
    }

    // Get recent activity for this device
    const activities = await HVNCActivityLog.find({
      device_id: device.device_id
    })
    .sort({ timestamp: -1 })
    .limit(10)
    .lean();

    const activityData = activities.map((activity, index) => {
      const isActive = index === 0; // Latest activity is active
      return {
        id: activity._id.toString(),
        time: formatTime(activity.timestamp),
        event: activity.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        active: isActive
      };
    });

    res.json({
      id: device._id,
      pcName: device.pc_name,
      status: isOnline ? 'Active' : 'Offline',
      assigned: assignedUser,
      assignedUserId: assignedUserId,
      hubstaff: hubstaffDisplay,
      hubstaffSeconds: hubstaffSeconds,
      hubstaffPercent: hubstaffPercent,
      lastSeen: lastSeen,
      accessCode: accessCode,
      activity: activityData
    });

  } catch (error) {
    console.error('Get device detail error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch device details'
    });
  }
};

/**
 * POST /api/hvnc/admin/devices
 * Register a new device
 */
const registerDevice = async (req, res) => {
  try {
    const { pcName, assignedUserId } = req.body;

    if (!pcName) {
      return res.status(400).json({
        success: false,
        error: 'PC name is required'
      });
    }

    // Generate unique device ID
    const deviceId = `HVNC_${Date.now()}`;
    const accessCode = generateAccessCode();

    // Get assigned user info
    let assignedUser = 'Unassigned';
    if (assignedUserId) {
      const user = await DTUser.findById(assignedUserId).select('fullName email');
      if (user) {
        assignedUser = user.fullName;
        
        // Create a shift for this user/device assignment
        await HVNCShift.create({
          user_email: user.email,
          device_id: deviceId,
          start_date: new Date(),
          end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          start_time: '00:00',
          end_time: '23:59',
          timezone: 'UTC',
          is_recurring: true,
          days_of_week: [0, 1, 2, 3, 4, 5, 6],
          status: 'active'
        });
      }
    }

    // Create device
    const device = await HVNCDevice.create({
      device_id: deviceId,
      pc_name: pcName,
      hostname: pcName,
      status: 'offline',
      initial_access_code: accessCode,
      installed_at: new Date(),
      last_seen: new Date()
    });

    // Log device registration
    await HVNCActivityLog.logDeviceEvent(deviceId, 'device_registered', {
      pc_name: pcName,
      assigned_user: assignedUser,
      access_code: accessCode
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({
      id: device._id,
      pcName: device.pc_name,
      status: 'Offline',
      assigned: assignedUser,
      assignedUserId: assignedUserId,
      hubstaff: '00:00:00',
      hubstaffSeconds: 0,
      hubstaffPercent: 0,
      lastSeen: 'Never',
      accessCode: accessCode
    });

  } catch (error) {
    console.error('Register device error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register device'
    });
  }
};

/**
 * PUT /api/hvnc/admin/devices/:deviceId
 * Update device assignment
 */
const updateDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { assignedUserId, pcName } = req.body;

    const device = await HVNCDevice.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    // Update device name if provided
    if (pcName) {
      device.pc_name = pcName;
      device.hostname = pcName;
    }

    // Handle user assignment
    if (assignedUserId) {
      // Use only DTUser model
      const user = await DTUser.findById(assignedUserId).select('fullName email');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found in DT users'
        });
      }

      // Remove existing shifts for this device
      await HVNCShift.deleteMany({ device_id: device.device_id });

      // Create new shift for assigned user
      await HVNCShift.create({
        user_email: user.email,
        device_id: device.device_id,
        start_date: new Date(),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        start_time: '00:00',
        end_time: '23:59',
        timezone: 'UTC',
        is_recurring: true,
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        status: 'active'
      });
    }

    await device.save();

    // Return updated device detail
    const deviceDetail = await getDeviceDetailById(deviceId);
    res.json(deviceDetail);

  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update device'
    });
  }
};

/**
 * DELETE /api/hvnc/admin/devices/:deviceId
 * Remove a device
 */
const deleteDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await HVNCDevice.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    // End any active sessions
    await HVNCSession.updateMany(
      { device_id: device.device_id, status: { $in: ['active', 'idle'] } },
      { 
        status: 'terminated',
        ended_at: new Date(),
        termination_reason: 'device_removed'
      }
    );

    // Remove shifts
    await HVNCShift.deleteMany({ device_id: device.device_id });

    // Log device removal
    await HVNCActivityLog.logDeviceEvent(device.device_id, 'device_removed', {
      pc_name: device.pc_name
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    // Remove device
    await HVNCDevice.findByIdAndDelete(deviceId);

    res.json({
      success: true,
      message: 'Device removed successfully.'
    });

  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove device'
    });
  }
};

/**
 * POST /api/hvnc/admin/devices/:deviceId/access-code/generate
 * Generate new access code for device
 */
const generateNewAccessCode = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await HVNCDevice.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    const newAccessCode = generateAccessCode();
    const generatedAt = new Date();

    // Update device access code
    device.initial_access_code = newAccessCode;
    await device.save();

    // Invalidate any Redis-stored codes for this device
    const hvncVerificationStore = require('../utils/hvncVerificationStore');
    await hvncVerificationStore.removeAllCodesForDevice(device.device_id);

    // Log access code generation
    await HVNCActivityLog.logDeviceEvent(device.device_id, 'access_code_generated', {
      new_code: newAccessCode,
      generated_by: req.admin?.email || 'admin'
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({
      accessCode: newAccessCode,
      generatedAt: generatedAt.toISOString()
    });

  } catch (error) {
    console.error('Generate access code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate new access code'
    });
  }
};

/**
 * POST /api/hvnc/admin/devices/:deviceId/hubstaff/start
 * Start Hubstaff timer
 */
const startHubstaffTimer = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await HVNCDevice.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    const startedAt = new Date();

    // Update device Hubstaff status
    if (!device.system_info) {
      device.system_info = {};
    }
    device.system_info.hubstaff_running = true;
    device.system_info.hubstaff_started_at = startedAt;
    await device.save();

    // Log Hubstaff start
    await HVNCActivityLog.logDeviceEvent(device.device_id, 'hubstaff_timer_started', {
      started_by: req.admin?.email || 'admin'
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({
      deviceId: device._id,
      hubstaffRunning: true,
      startedAt: startedAt.toISOString()
    });

  } catch (error) {
    console.error('Start Hubstaff timer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start Hubstaff timer'
    });
  }
};

/**
 * POST /api/hvnc/admin/devices/:deviceId/hubstaff/pause
 * Pause Hubstaff timer
 */
const pauseHubstaffTimer = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await HVNCDevice.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    const pausedAt = new Date();
    let elapsed = '00:00:00';

    // Calculate elapsed time if timer was running
    if (device.system_info?.hubstaff_running && device.system_info?.hubstaff_started_at) {
      const elapsedMs = pausedAt - new Date(device.system_info.hubstaff_started_at);
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      const hours = Math.floor(elapsedSeconds / 3600);
      const minutes = Math.floor((elapsedSeconds % 3600) / 60);
      const seconds = elapsedSeconds % 60;
      elapsed = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // Update total seconds
      const currentTotal = device.system_info.hubstaff_seconds || 0;
      device.system_info.hubstaff_seconds = currentTotal + elapsedSeconds;
    }

    // Update device Hubstaff status
    device.system_info = device.system_info || {};
    device.system_info.hubstaff_running = false;
    device.system_info.hubstaff_paused_at = pausedAt;
    delete device.system_info.hubstaff_started_at;
    await device.save();

    // Log Hubstaff pause
    await HVNCActivityLog.logDeviceEvent(device.device_id, 'hubstaff_timer_paused', {
      paused_by: req.admin?.email || 'admin',
      elapsed_time: elapsed
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({
      deviceId: device._id,
      hubstaffRunning: false,
      pausedAt: pausedAt.toISOString(),
      elapsed: elapsed
    });

  } catch (error) {
    console.error('Pause Hubstaff timer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause Hubstaff timer'
    });
  }
};

/**
 * Helper functions
 */
function generateAccessCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function getDeviceDetailById(deviceId) {
  const device = await HVNCDevice.findById(deviceId).lean();
  if (!device) return null;
  
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const isOnline = device.last_seen > fiveMinutesAgo && device.status === 'online';

  // Get assigned user
  let assignedUser = 'Unassigned';
  let assignedUserId = null;
  const shift = await HVNCShift.findOne({
    device_id: device.device_id,
    status: 'active',
    $or: [
      { end_date: null },
      { end_date: { $gte: new Date() } }
    ]
  });

  if (shift) {
    const user = await DTUser.findOne({ email: shift.user_email }).select('fullName email');
    if (user) {
      assignedUser = user.fullName;
      assignedUserId = user._id.toString();
    }
  }

  // Calculate Hubstaff data
  const hubstaffSeconds = device.system_info?.hubstaff_seconds || 0;
  const hubstaffHours = Math.floor(hubstaffSeconds / 3600);
  const hubstaffMinutes = Math.floor((hubstaffSeconds % 3600) / 60);
  const hubstaffSecondsRem = hubstaffSeconds % 60;
  const hubstaffDisplay = `${hubstaffHours.toString().padStart(2, '0')}:${hubstaffMinutes.toString().padStart(2, '0')}:${hubstaffSecondsRem.toString().padStart(2, '0')}`;
  const hubstaffPercent = Math.min(100, Math.floor((hubstaffSeconds / (8 * 3600)) * 100));

  return {
    id: device._id,
    pcName: device.pc_name,
    status: isOnline ? 'Active' : 'Offline',
    assigned: assignedUser,
    assignedUserId: assignedUserId,
    hubstaff: hubstaffDisplay,
    hubstaffSeconds: hubstaffSeconds,
    hubstaffPercent: hubstaffPercent
  };
}

module.exports = {
  getAllDevices,
  getDeviceDetail,
  registerDevice,
  updateDevice,
  deleteDevice,
  generateNewAccessCode,
  startHubstaffTimer,
  pauseHubstaffTimer
};