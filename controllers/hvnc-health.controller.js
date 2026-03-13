/**
 * HVNC Health Check Controller
 * Provides comprehensive health monitoring for the HVNC system
 */

const mongoose = require('mongoose');
const { redisHealthCheck } = require('../config/redis');
const { getConnectedDevices, getConnectedAdmins } = require('../services/hvnc-websocket.service');

/**
 * Basic HVNC System Health Check
 */
const hvncHealthCheck = async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Check database connectivity
    const HVNCDevice = require('../models/hvnc-device.model');
    const HVNCSession = require('../models/hvnc-session.model');
    const HVNCUser = require('../models/hvnc-user.model');
    
    const [
      deviceCount,
      activeSessionCount,
      totalUsers,
      onlineDevices
    ] = await Promise.all([
      HVNCDevice.countDocuments(),
      HVNCSession.countDocuments({
        status: { $in: ['active', 'idle'] },
        ended_at: { $exists: false }
      }),
      HVNCUser.countDocuments({ status: 'active' }),
      HVNCDevice.countDocuments({ 
        status: 'online',
        last_seen: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
      })
    ]);

    // Check Redis connectivity
    const redisStatus = await redisHealthCheck();
    
    // Check WebSocket connections
    const connectedDevices = getConnectedDevices();
    const connectedAdmins = getConnectedAdmins();
    
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Determine overall health
    const isHealthy = 
      mongoose.connection.readyState === 1 && // MongoDB connected
      redisStatus.status === 'connected' && // Redis connected (if enabled)
      responseTime < 2000; // Response under 2 seconds
    
    const healthStatus = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      response_time_ms: responseTime,
      
      database: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        ready_state: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name
      },
      
      redis: redisStatus,
      
      statistics: {
        total_devices: deviceCount,
        online_devices: onlineDevices,
        total_users: totalUsers,
        active_sessions: activeSessionCount
      },
      
      websocket: {
        connected_devices: connectedDevices.length,
        connected_admins: connectedAdmins.length,
        device_connections: connectedDevices.map(device => ({
          device_id: device.device_id,
          connected_at: device.connected_at,
          last_activity: device.last_activity
        })),
        admin_connections: connectedAdmins.map(admin => ({
          admin_id: admin.admin_id,
          email: admin.email,
          connected_at: admin.connected_at
        }))
      },
      
      system: {
        node_version: process.version,
        platform: process.platform,
        architecture: process.arch,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        }
      }
    };

    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(healthStatus);

  } catch (error) {
    console.error('HVNC Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      database: 'unknown',
      redis: 'unknown',
      websocket: 'unknown'
    });
  }
};

/**
 * Detailed System Statistics (Admin only)
 */
const getSystemStatistics = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    const HVNCSession = require('../models/hvnc-session.model');
    const HVNCCommand = require('../models/hvnc-command.model');
    const HVNCDevice = require('../models/hvnc-device.model');
    const HVNCUser = require('../models/hvnc-user.model');
    const HVNCActivityLog = require('../models/hvnc-activity-log.model');

    const [
      sessionStats,
      commandStats,
      deviceStats,
      userStats,
      activityCounts,
      topDevices,
      recentActivity
    ] = await Promise.all([
      // Session statistics
      HVNCSession.getSessionStats(startDate, endDate),
      
      // Command statistics  
      HVNCCommand.getCommandStats(startDate, endDate),
      
      // Device statistics
      HVNCDevice.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // User statistics
      HVNCUser.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Activity log counts by type
      HVNCActivityLog.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$event_type',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),
      
      // Most active devices
      HVNCSession.aggregate([
        {
          $match: {
            started_at: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$device_id',
            session_count: { $sum: 1 },
            total_duration: { $sum: '$duration_seconds' }
          }
        },
        { $sort: { session_count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'hvnc_devices',
            localField: '_id',
            foreignField: 'device_id',
            as: 'device'
          }
        }
      ]),
      
      // Recent high-priority activity
      HVNCActivityLog.find({
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        severity: { $in: ['warning', 'error'] }
      })
      .sort({ timestamp: -1 })
      .limit(10)
      .select('timestamp event_type user_email device_id severity status event_data')
    ]);

    res.json({
      success: true,
      generated_at: new Date(),
      period: {
        start: startDate,
        end: endDate,
        days: parseInt(days)
      },
      overview: {
        uptime_seconds: Math.floor(process.uptime()),
        total_devices: deviceStats.reduce((sum, stat) => sum + stat.count, 0),
        total_users: userStats.reduce((sum, stat) => sum + stat.count, 0),
        connected_devices: getConnectedDevices().length,
        connected_admins: getConnectedAdmins().length
      },
      sessions: sessionStats[0] || {
        total_sessions: 0,
        avg_duration_minutes: 0,
        total_commands: 0,
        unique_user_count: 0,
        unique_device_count: 0
      },
      commands: commandStats,
      devices: {
        by_status: deviceStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        most_active: topDevices.map(device => ({
          device_id: device._id,
          hostname: device.device[0]?.hostname || 'Unknown',
          session_count: device.session_count,
          total_duration_minutes: Math.round(device.total_duration / 60)
        }))
      },
      users: {
        by_status: userStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      },
      activity: {
        by_type: activityCounts.reduce((acc, activity) => {
          acc[activity._id] = activity.count;
          return acc;
        }, {}),
        recent_alerts: recentActivity.map(log => ({
          timestamp: log.timestamp,
          event_type: log.event_type,
          user_email: log.user_email,
          device_id: log.device_id,
          severity: log.severity,
          status: log.status,
          summary: log.event_data?.summary || 'No details'
        }))
      }
    });

  } catch (error) {
    console.error('System statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate system statistics',
      details: error.message
    });
  }
};

/**
 * Activity Logs with Advanced Filtering (Admin only)
 */
const getActivityLogs = async (req, res) => {
  try {
    const {
      event_type,
      user_email,
      device_id,
      severity,
      status,
      start_date,
      end_date,
      limit = 100,
      page = 1,
      search
    } = req.query;

    const HVNCActivityLog = require('../models/hvnc-activity-log.model');

    // Build query
    let query = {};
    
    if (event_type) {
      query.event_type = { $in: event_type.split(',') };
    }
    
    if (user_email) {
      query.user_email = user_email.toLowerCase();
    }
    
    if (device_id) {
      query.device_id = device_id;
    }
    
    if (severity) {
      query.severity = { $in: severity.split(',') };
    }
    
    if (status) {
      query.status = { $in: status.split(',') };
    }
    
    // Date range filter
    if (start_date || end_date) {
      query.timestamp = {};
      if (start_date) {
        query.timestamp.$gte = new Date(start_date);
      }
      if (end_date) {
        query.timestamp.$lte = new Date(end_date);
      }
    }
    
    // Text search across event_data
    if (search) {
      query.$text = { $search: search };
    }

    const skip = Math.max(0, (page - 1) * limit);
    const limitNum = Math.min(parseInt(limit), 1000); // Cap at 1000 results
    
    const [logs, total] = await Promise.all([
      HVNCActivityLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-__v'),
      HVNCActivityLog.countDocuments(query)
    ]);

    res.json({
      success: true,
      logs: logs.map(log => ({
        id: log._id,
        timestamp: log.timestamp,
        event_type: log.event_type,
        user_email: log.user_email,
        device_id: log.device_id,
        session_id: log.session_id,
        severity: log.severity,
        status: log.status,
        event_data: log.event_data,
        ip_address: log.ip_address,
        duration_ms: log.duration_ms,
        is_flagged: log.is_flagged
      })),
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      filters: {
        event_type,
        user_email,
        device_id,
        severity,
        status,
        start_date,
        end_date,
        search
      }
    });

  } catch (error) {
    console.error('Activity logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve activity logs',
      details: error.message
    });
  }
};

module.exports = {
  hvncHealthCheck,
  getSystemStatistics,
  getActivityLogs
};