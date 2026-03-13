const HVNCDevice = require('../models/hvnc-device.model');
const HVNCUser = require('../models/hvnc-user.model');
const HVNCSession = require('../models/hvnc-session.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');

/**
 * GET /api/hvnc/admin/stats
 * Fetch dashboard statistics
 */
const getStats = async (req, res) => {
  try {
    // Get total devices
    const totalDevices = await HVNCDevice.countDocuments();

    // Get online devices (last seen within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineDevices = await HVNCDevice.countDocuments({ 
      last_seen: { $gt: fiveMinutesAgo },
      status: 'online'
    });

    // Get active sessions
    const activeSessions = await HVNCSession.countDocuments({
      status: { $in: ['active', 'idle'] },
      ended_at: null
    });

    // Get active timers (sessions with running Hubstaff)
    const activeTimers = await HVNCSession.countDocuments({
      status: { $in: ['active', 'idle'] },
      ended_at: null,
      'hubstaff_data.is_running': true
    });

    res.json({
      totalDevices,
      onlineDevices,
      activeSessions,
      activeTimers
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    });
  }
};

/**
 * GET /api/hvnc/admin/devices/live
 * Fetch live devices for dashboard grid
 */
const getLiveDevices = async (req, res) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const devices = await HVNCDevice.find({})
      .select('device_id pc_name status last_seen')
      .lean();

    // Transform devices for frontend
    const deviceData = await Promise.all(devices.map(async (device) => {
      const isOnline = device.last_seen > fiveMinutesAgo && device.status === 'online';
      
      // Get assigned user
      let assignedUser = null;
      const shift = await require('../models/hvnc-shift.model').findOne({
        device_id: device.device_id,
        status: 'active',
        $or: [
          { end_date: null },
          { end_date: { $gte: new Date() } }
        ]
      });

      if (shift) {
        const user = await HVNCUser.findOne({ email: shift.user_email }).select('full_name');
        assignedUser = user ? user.full_name : null;
      }

      // Calculate uptime for online devices
      let uptime = null;
      if (isOnline) {
        const uptimeMs = Date.now() - device.last_seen.getTime();
        const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
        const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);
        uptime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }

      // Last seen for offline devices
      let lastSeen = null;
      if (!isOnline) {
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

      return {
        id: device.device_id,
        name: device.pc_name,
        status: isOnline ? 'online' : 'offline',
        uptime,
        user: assignedUser,
        lastSeen
      };
    }));

    res.json({
      devices: deviceData
    });

  } catch (error) {
    console.error('Get live devices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live devices'
    });
  }
};

/**
 * GET /api/hvnc/admin/activity
 * Fetch recent activity feed
 */
const getActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const activities = await HVNCActivityLog.find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    // Transform activities for frontend
    const activityItems = activities.map((activity) => {
      // Map activity types to frontend types  
      let type = 'session';
      let icon = 'SyncOutlined';
      
      if (activity.event_type === 'user_login' || activity.event_type === 'authentication_successful') {
        type = 'login';
      } else if (activity.event_type === 'user_logout' || activity.event_type === 'session_ended') {
        type = 'logout';
      } else if (activity.event_type === 'session_completed') {
        type = 'completed';
      } else if (activity.severity === 'high' || activity.severity === 'medium') {
        type = 'warning';
      }

      // Format time
      const timeAgo = formatTimeAgo(activity.timestamp);
      
      // Create subject and message
      let subject = activity.user_id || activity.device_id || 'System';
      let message = activity.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      if (activity.context && activity.context.device_name) {
        message += ` on ${activity.context.device_name}`;
      }

      return {
        id: activity._id.toString(),
        type,
        subject,
        message,
        time: timeAgo
      };
    });

    res.json({
      items: activityItems
    });

  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity'
    });
  }
};

/**
 * Helper function to format time ago
 */
function formatTimeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return past.toLocaleDateString();
}

module.exports = {
  getStats,
  getLiveDevices,
  getActivity
};