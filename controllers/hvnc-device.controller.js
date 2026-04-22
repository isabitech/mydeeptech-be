const HVNCDeviceService = require('../services/hvnc-device.service');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');

/**
 * Register a new HVNC device
 * POST /api/hvnc/devices/register
 */
const registerDevice = async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.body.device_id || !req.body.pc_name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'device_id and pc_name are required',
          required_fields: ['device_id', 'pc_name']
        }
      });
    }

    const result = await HVNCDeviceService.registerDevice(req.body, {
      originalIp: req.body.public_ip || req.body.ip_address || req.ip,
      userAgent: req.headers['user-agent'],
      host: req.get('host')
    });

    if (result.is_existing) {
        // Log handled in service
        await HVNCActivityLog.logDeviceEvent(req.body.device_id, 'device_registration', {
            result: 'success',
            pc_name: req.body.pc_name,
            hostname: req.body.hostname,
            os_version: req.body.os_version,
            hubstaff_installed: req.body.hubstaff_installed,
            registration_ip: req.ip
        }, {
            status: 'success',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            duration_ms: Date.now() - startTime
        });

        // Delete the internal flag
        delete result.is_existing;
        return res.status(200).json(result);
    }
    
    // Log successful registration for completely new devices
    await HVNCActivityLog.logDeviceEvent(req.body.device_id, 'device_registration', {
        result: 'success',
        pc_name: req.body.pc_name,
        hostname: req.body.hostname,
        os_version: req.body.os_version,
        hubstaff_installed: req.body.hubstaff_installed,
        registration_ip: req.ip
    }, {
        status: 'success',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        duration_ms: Date.now() - startTime
    });

    delete result.is_existing;
    res.status(200).json({
        success: true,
        ...result
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
    const data = { ...req.body, check_config: req.query.check_config };
    const result = await HVNCDeviceService.heartbeat(req.device, data, {
      originalIp: req.ip
    });

    res.status(200).json(result);

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
    const result = await HVNCDeviceService.getCommands(req.device, req.query, {
      originalIp: req.ip
    });

    res.status(200).json(result);

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
    const { command_id } = req.params;

    const result = await HVNCDeviceService.acknowledgeCommand(req.device, command_id, req.body, {
      start_time: startTime,
      originalIp: req.ip
    });

    res.status(200).json(result);

  } catch (error) {
    console.error('Command acknowledgment error:', error);
    if (error.status && error.code) {
      return res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

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
    const result = await HVNCDeviceService.getDeviceStatus(req.device);
    res.status(200).json(result);

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
    const result = await HVNCDeviceService.updateConfig(req.device, req.body, {
      originalIp: req.ip
    });

    res.status(200).json(result);

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
    const result = await HVNCDeviceService.disconnect(req.device, req.body, {
      originalIp: req.ip
    });

    res.status(200).json(result);

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