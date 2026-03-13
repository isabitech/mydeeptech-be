const HVNCDevice = require('../models/hvnc-device.model');
const HVNCUser = require('../models/hvnc-user.model');
const HVNCCommand = require('../models/hvnc-command.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');
const envConfig = require('../config/envConfig');

/**
 * Register a new HVNC device
 * POST /api/hvnc/devices/register
 */
const registerDevice = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const {
      device_id,
      pc_name,
      hostname,
      operating_system,
      os_version,
      browser_version,
      public_ip,
      ip_address,
      mac_address,
      system_info,
      hubstaff_installed,
      hubstaff_version,
      initial_access_code,
      installed_at
    } = req.body;

    // Validate required fields (flexible field names)
    if (!device_id || !pc_name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'device_id and pc_name are required',
          required_fields: ['device_id', 'pc_name']
        }
      });
    }

    // Check if device already exists
    const existingDevice = await HVNCDevice.findByDeviceId(device_id);
    if (existingDevice) {
      // Update last seen and return existing device info
      existingDevice.last_seen = new Date();
      existingDevice.status = 'online';
      await existingDevice.save();

      await HVNCActivityLog.logDeviceEvent(device_id, 'device_reconnected', {
        result: 'existing_device',
        pc_name,
        system_info,
        public_ip: public_ip || ip_address || req.ip
      }, {
        status: 'info',
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      // Generate new token for existing device
      const token = existingDevice.generateAuthToken();
      
      return res.status(200).json({
        success: true,
        device: {
          device_id: existingDevice.device_id,
          pc_name: existingDevice.pc_name,
          status: existingDevice.status,
          registered_at: existingDevice.createdAt
        },
        auth_token: token,
        message: 'Device reconnected successfully'
      });
    }

    // Create new device with flexible field mapping
    const deviceData = {
      device_id,
      pc_name,
      hostname: hostname || pc_name,
      operating_system: operating_system || os_version || 'Unknown',
      browser_version: browser_version || 'Unknown',
      location: {
        ip: public_ip || ip_address || req.ip,
        country: 'Unknown',
        city: 'Unknown'
      },
      system_info: system_info || {},
      mac_address,
      hubstaff_info: {
        is_hubstaff_installed: hubstaff_installed || false,
        hubstaff_version
      },
      initial_access_code,
      installed_at: installed_at ? new Date(installed_at) : new Date(),
      status: 'online',
      last_seen: new Date()
    };

    const device = new HVNCDevice(deviceData);
    await device.save();

    // Generate authentication token
    const token = device.generateAuthToken();

    // Store token hash
    const bcrypt = require('bcrypt');
    device.auth_token_hash = await bcrypt.hash(token, 10);
    
    // Set device configuration
    device.config = {
      server_url: `wss://${req.get('host')}/device`,
      heartbeat_interval: 60,
      encryption_key: Buffer.from(require('crypto').randomBytes(32)).toString('base64')
    };

    await device.save();

    // Log successful registration
    await HVNCActivityLog.logDeviceEvent(device_id, 'device_registration', {
      result: 'success',
      pc_name,
      hostname,
      os_version,
      hubstaff_installed,
      registration_ip: req.ip
    }, {
      status: 'success',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      duration_ms: Date.now() - startTime
    });

    res.status(200).json({
      success: true,
      device: {
        id: device._id,
        device_id: device.device_id,
        status: device.status
      },
      auth: {
        token,
        expires_in: 30 * 24 * 60 * 60 // 30 days in seconds
      },
      config: device.config
    });

  } catch (error) {
    console.error('Device registration error:', error);
    
    await HVNCActivityLog.logDeviceEvent(req.body.device_id, 'device_registration', {
      result: 'error',
      error: error.message
    }, {
      status: 'failure',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      duration_ms: Date.now() - startTime,
      error_message: error.message
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_ERROR',
        message: 'Device registration failed'
      }
    });
  }
};

/**
 * Device heartbeat with status updates
 * POST /api/devices/heartbeat
 */
const heartbeat = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const device = req.device; // From auth middleware
    const {
      status,
      uptime,
      chrome_status,
      hubstaff_status,
      desktop_status,
      system_info
    } = req.body;

    // Update device heartbeat and status
    await device.updateHeartbeat({
      status: status || 'online',
      system_info,
      chrome_status,
      desktop_status
    });

    // Update Hubstaff status if provided
    if (hubstaff_status) {
      const hubstaffData = {
        timer_running: hubstaff_status.timer_running,
        project_id: hubstaff_status.project_id,
        project_name: hubstaff_status.project_name,
        elapsed_minutes: hubstaff_status.elapsed_minutes,
        last_activity: hubstaff_status.last_activity ? new Date(hubstaff_status.last_activity) : new Date()
      };

      // Log Hubstaff status change if timer state changed
      const previousStatus = device.hubstaff_session?.is_timer_running;
      if (previousStatus !== hubstaff_status.timer_running) {
        await HVNCActivityLog.logDeviceEvent(device.device_id, 'hubstaff_status_update', {
          timer_running: hubstaff_status.timer_running,
          project_id: hubstaff_status.project_id,
          project_name: hubstaff_status.project_name,
          previous_state: previousStatus
        }, {
          status: 'info',
          ip_address: req.ip
        });
      }
    }

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      next_heartbeat: device.config?.heartbeat_interval || 60
    };

    // Check for any configuration updates
    if (req.query.check_config) {
      response.config_update = {
        heartbeat_interval: device.config?.heartbeat_interval || 60,
        server_url: device.config?.server_url
      };
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Heartbeat error:', error);
    
    await HVNCActivityLog.logDeviceEvent(req.device?.device_id, 'device_heartbeat', {
      result: 'error',
      error: error.message
    }, {
      status: 'failure',
      ip_address: req.ip,
      duration_ms: Date.now() - startTime,
      error_message: error.message
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'HEARTBEAT_ERROR',
        message: 'Heartbeat update failed'
      }
    });
  }
};

/**
 * Poll for pending commands
 * GET /api/devices/commands
 */
const getCommands = async (req, res) => {
  try {
    const device = req.device;
    const limit = parseInt(req.query.limit) || 10;

    // Get pending commands for this device
    const commands = await HVNCCommand.getPendingCommands(device.device_id, limit);

    // Mark commands as sent
    for (const command of commands) {
      await command.markSent();
    }

    // Format commands for response
    const formattedCommands = commands.map(cmd => ({
      id: cmd.command_id,
      type: cmd.type,
      action: cmd.action,
      parameters: cmd.parameters,
      session_id: cmd.session_id,
      user_email: cmd.user_email,
      timestamp: cmd.createdAt.toISOString(),
      expires_at: cmd.expires_at.toISOString(),
      priority: cmd.priority,
      timeout_seconds: cmd.timeout_seconds
    }));

    // Log command polling
    if (commands.length > 0) {
      await HVNCActivityLog.logDeviceEvent(device.device_id, 'command_received', {
        command_count: commands.length,
        command_types: commands.map(cmd => `${cmd.type}:${cmd.action}`)
      }, {
        status: 'info',
        ip_address: req.ip
      });
    }

    res.status(200).json({
      commands: formattedCommands
    });

  } catch (error) {
    console.error('Get commands error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'COMMANDS_ERROR',
        message: 'Failed to retrieve commands'
      }
    });
  }
};

/**
 * Acknowledge command execution
 * POST /api/devices/commands/{command_id}/ack
 */
const acknowledgeCommand = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const device = req.device;
    const { command_id } = req.params;
    const { status, result, error } = req.body;

    // Find the command
    const command = await HVNCCommand.findOne({
      command_id,
      device_id: device.device_id,
      status: { $in: ['sent', 'acknowledged', 'executing'] }
    });

    if (!command) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COMMAND_NOT_FOUND',
          message: 'Command not found or already processed'
        }
      });
    }

    const executionTime = Date.now() - startTime;

    // Update command status based on result
    switch (status) {
      case 'success':
        await command.complete(result, executionTime);
        break;
      case 'error':
        await command.fail(error?.message || 'Command execution failed', error?.code);
        break;
      case 'timeout':
        await command.timeout();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Status must be success, error, or timeout'
          }
        });
    }

    // Log command execution
    await HVNCActivityLog.logCommandEvent(command_id, 'command_executed', {
      status,
      result: status === 'success' ? result : null,
      error: status === 'error' ? error : null,
      execution_time_ms: executionTime,
      command_type: command.type,
      command_action: command.action
    }, {
      status: status === 'success' ? 'success' : 'failure',
      device_id: device.device_id,
      session_id: command.session_id,
      user_email: command.user_email,
      ip_address: req.ip,
      duration_ms: executionTime
    });

    res.status(200).json({
      success: true,
      command_id,
      acknowledged_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Command acknowledgment error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ACK_ERROR',
        message: 'Command acknowledgment failed'
      }
    });
  }
};

/**
 * Get device status and information
 * GET /api/devices/status
 */
const getDeviceStatus = async (req, res) => {
  try {
    const device = req.device;

    // Get active sessions for this device
    const { default: HVNCSession } = await import('../models/hvnc-session.model.js');
    const activeSessions = await HVNCSession.findActiveSessionsForDevice(device.device_id);

    // Get pending commands count
    const pendingCommands = await HVNCCommand.countDocuments({
      device_id: device.device_id,
      status: { $in: ['pending', 'sent'] },
      expires_at: { $gt: new Date() }
    });

    const response = {
      success: true,
      device: {
        id: device._id,
        device_id: device.device_id,
        pc_name: device.pc_name,
        hostname: device.hostname,
        status: device.status,
        is_online: device.is_online,
        last_seen: device.last_seen,
        uptime: device.system_info?.uptime,
        chrome_status: device.chrome_status,
        hubstaff_status: device.hubstaff_status,
        desktop_status: device.desktop_status,
        system_info: device.system_info
      },
      sessions: {
        active_count: activeSessions.length,
        active_sessions: activeSessions.map(session => ({
          session_id: session.session_id,
          user_email: session.user_email,
          started_at: session.started_at,
          last_activity: session.last_activity,
          status: session.status
        }))
      },
      commands: {
        pending_count: pendingCommands
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Get device status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_ERROR',
        message: 'Failed to retrieve device status'
      }
    });
  }
};

/**
 * Update device configuration
 * POST /api/devices/config
 */
const updateConfig = async (req, res) => {
  try {
    const device = req.device;
    const { heartbeat_interval, encryption_key, auto_screenshot } = req.body;

    // Update device configuration
    const config = device.config || {};
    
    if (heartbeat_interval !== undefined) {
      config.heartbeat_interval = Math.max(30, Math.min(300, heartbeat_interval)); // 30s to 5min
    }
    
    if (encryption_key) {
      config.encryption_key = encryption_key;
    }
    
    if (auto_screenshot !== undefined) {
      config.auto_screenshot = auto_screenshot;
    }

    device.config = config;
    await device.save();

    // Log configuration update
    await HVNCActivityLog.logDeviceEvent(device.device_id, 'configuration_change', {
      changes: req.body,
      updated_by: 'device_self'
    }, {
      status: 'info',
      ip_address: req.ip
    });

    res.status(200).json({
      success: true,
      config: device.config
    });

  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIG_ERROR',
        message: 'Configuration update failed'
      }
    });
  }
};

/**
 * Device disconnect/cleanup
 * POST /api/devices/disconnect
 */
const disconnect = async (req, res) => {
  try {
    const device = req.device;
    const { reason = 'manual_disconnect' } = req.body;

    // Update device status
    device.status = 'offline';
    device.last_seen = new Date();
    await device.save();

    // End all active sessions for this device
    const { default: HVNCSession } = await import('../models/hvnc-session.model.js');
    const activeSessions = await HVNCSession.findActiveSessionsForDevice(device.device_id);
    
    for (const session of activeSessions) {
      await session.endSession('device_offline');
    }

    // Cancel pending commands
    await HVNCCommand.cancelDeviceCommands(device.device_id, `Device disconnected: ${reason}`);

    // Log disconnect
    await HVNCActivityLog.logDeviceEvent(device.device_id, 'device_offline', {
      reason,
      active_sessions_ended: activeSessions.length,
      disconnect_type: 'graceful'
    }, {
      status: 'info',
      ip_address: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Device disconnected successfully',
      affected_sessions: activeSessions.length
    });

  } catch (error) {
    console.error('Device disconnect error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DISCONNECT_ERROR',
        message: 'Device disconnect failed'
      }
    });
  }
};

module.exports = {
  registerDevice,
  heartbeat,
  getCommands,
  acknowledgeCommand,
  getDeviceStatus,
  updateConfig,
  disconnect
};