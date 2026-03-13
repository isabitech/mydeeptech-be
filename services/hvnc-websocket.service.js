const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const HVNCDevice = require('../models/hvnc-device.model');
const HVNCUser = require('../models/hvnc-user.model');
const HVNCSession = require('../models/hvnc-session.model');
const HVNCCommand = require('../models/hvnc-command.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');
const envConfig = require('../config/envConfig');

let io;
const connectedDevices = new Map(); // Track online devices: { device_id: { socket, device_info } }
const connectedAdmins = new Map(); // Track admin connections: { admin_id: socketId }
const activeCommands = new Map(); // Track pending commands: { command_id: timeout }

/**
 * Initialize HVNC WebSocket server
 * @param {Object} server - HTTP server instance
 */
const initializeHVNCSocket = (server) => {
  io = new Server(server, {
    path: '/hvnc/socket.io',
    cors: {
      origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://hvnc.mydeeptech.ng',
        'https://admin.mydeeptech.ng',
        envConfig.FRONTEND_URL,
        envConfig.BACKEND_URL
      ].filter(Boolean),
      credentials: true,
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });

  // Device namespace for client connections
  const deviceNamespace = io.of('/device');
  
  // Admin namespace for admin dashboard
  const adminNamespace = io.of('/admin');

  // Device authentication middleware
  deviceNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) {
        return next(new Error('Device authentication token required'));
      }

      const decoded = jwt.verify(token, envConfig.jwt.JWT_SECRET);
      
      if (decoded.type !== 'device') {
        return next(new Error('Invalid token type for device connection'));
      }

      // Fetch device from database
      const device = await HVNCDevice.findById(decoded.id);
      if (!device || device.device_id !== decoded.device_id) {
        return next(new Error('Device not found or invalid'));
      }

      if (device.status === 'disabled') {
        return next(new Error('Device is disabled'));
      }

      socket.deviceId = device.device_id;
      socket.device = device;
      
      next();
    } catch (error) {
      console.error('Device WebSocket auth error:', error);
      next(new Error('Device authentication failed'));
    }
  });

  // Admin authentication middleware
  adminNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Admin authentication token required'));
      }

      const decoded = jwt.verify(token, envConfig.jwt.JWT_SECRET);
      
      // Fetch admin user
      const adminUser = await HVNCUser.findOne({ 
        email: decoded.email,
        role: { $in: ['admin', 'supervisor'] },
        status: 'active'
      });
      
      if (!adminUser) {
        return next(new Error('Admin access denied'));
      }

      socket.adminId = adminUser._id;
      socket.admin = adminUser;
      
      next();
    } catch (error) {
      console.error('Admin WebSocket auth error:', error);
      next(new Error('Admin authentication failed'));
    }
  });

  // Device connection handling
  deviceNamespace.on('connection', (socket) => {
    const device = socket.device;
    console.log(`🖥️ Device connected: ${device.pc_name} (${device.device_id})`);
    
    // Store device connection
    connectedDevices.set(device.device_id, {
      socket: socket,
      device: device,
      connectedAt: new Date(),
      lastHeartbeat: new Date()
    });

    // Update device status
    device.status = 'online';
    device.last_seen = new Date();
    device.save();

    // Join device to its room for targeted messaging
    socket.join(`device_${device.device_id}`);

    // Log device connection
    HVNCActivityLog.logDeviceEvent(device.device_id, 'device_connected', {
      socket_id: socket.id,
      connection_type: 'websocket',
      pc_name: device.pc_name
    }, {
      status: 'success',
      ip_address: socket.handshake.address
    });

    // Notify admins of device connection
    adminNamespace.emit('device_online', {
      device_id: device.device_id,
      pc_name: device.pc_name,
      hostname: device.hostname,
      connected_at: new Date(),
      ip_address: socket.handshake.address
    });

    // Handle device status updates
    socket.on('device_status', async (data) => {
      try {
        const connectionInfo = connectedDevices.get(device.device_id);
        if (connectionInfo) {
          connectionInfo.lastHeartbeat = new Date();
        }

        // Update device status in database
        await device.updateHeartbeat(data);

        // Broadcast status to admins
        adminNamespace.emit('device_status_update', {
          device_id: device.device_id,
          status: data,
          timestamp: new Date()
        });

        socket.emit('status_ack', { 
          success: true, 
          timestamp: new Date() 
        });

      } catch (error) {
        console.error('Device status update error:', error);
        socket.emit('status_ack', { 
          success: false, 
          error: error.message 
        });
      }
    });

    // Handle Hubstaff timer updates
    socket.on('hubstaff_update', async (data) => {
      try {
        await HVNCActivityLog.logDeviceEvent(device.device_id, 'hubstaff_status_update', {
          timer_running: data.timer_running,
          project_id: data.project_id,
          project_name: data.project_name,
          elapsed_minutes: data.elapsed_minutes
        });

        // Notify admins of Hubstaff changes
        adminNamespace.emit('hubstaff_update', {
          device_id: device.device_id,
          ...data,
          timestamp: new Date()
        });

        // Update any active sessions with Hubstaff data
        const activeSessions = await HVNCSession.findActiveSessionsForDevice(device.device_id);
        for (const session of activeSessions) {
          await session.updateHubstaffStatus(data);
        }

        socket.emit('hubstaff_ack', { success: true });

      } catch (error) {
        console.error('Hubstaff update error:', error);
        socket.emit('hubstaff_ack', { 
          success: false, 
          error: error.message 
        });
      }
    });

    // Handle session events
    socket.on('session_event', async (data) => {
      try {
        const { session_id, event, user_email } = data;

        await HVNCActivityLog.logSessionEvent(session_id, 'session_event', {
          event,
          user_email,
          device_id: device.device_id,
          event_data: data
        }, {
          device_id: device.device_id,
          session_id,
          user_email
        });

        // Notify admins of session events
        adminNamespace.emit('session_event', {
          device_id: device.device_id,
          session_id,
          event,
          user_email,
          timestamp: new Date(),
          data
        });

        socket.emit('session_event_ack', { success: true });

      } catch (error) {
        console.error('Session event error:', error);
        socket.emit('session_event_ack', { 
          success: false, 
          error: error.message 
        });
      }
    });

    // Handle command execution results
    socket.on('command_result', async (data) => {
      try {
        const { command_id, status, result, error, execution_time } = data;

        // Find and update the command
        const command = await HVNCCommand.findOne({ command_id });
        if (!command) {
          socket.emit('command_error', {
            command_id,
            error: 'Command not found'
          });
          return;
        }

        // Update command based on result
        switch (status) {
          case 'success':
            await command.complete(result, execution_time);
            break;
          case 'error':
            await command.fail(error?.message, error?.code);
            break;
          case 'timeout':
            await command.timeout();
            break;
        }

        // Clear command timeout if it exists
        if (activeCommands.has(command_id)) {
          clearTimeout(activeCommands.get(command_id));
          activeCommands.delete(command_id);
        }

        // Log command execution
        await HVNCActivityLog.logCommandEvent(command_id, 'command_executed', {
          status,
          result: status === 'success' ? result : null,
          error: status === 'error' ? error : null,
          execution_time
        }, {
          device_id: device.device_id,
          session_id: command.session_id,
          user_email: command.user_email,
          status: status === 'success' ? 'success' : 'failure'
        });

        // Notify admins of command completion
        adminNamespace.emit('command_completed', {
          command_id,
          device_id: device.device_id,
          status,
          result: status === 'success' ? result : null,
          error: status === 'error' ? error : null,
          execution_time,
          timestamp: new Date()
        });

        socket.emit('command_ack', { 
          command_id, 
          success: true 
        });

      } catch (error) {
        console.error('Command result error:', error);
        socket.emit('command_ack', { 
          command_id: data.command_id, 
          success: false, 
          error: error.message 
        });
      }
    });

    // Handle screen sharing events
    socket.on('screen_data', (data) => {
      // Forward screen data to admins monitoring this device
      adminNamespace.emit('screen_update', {
        device_id: device.device_id,
        screen_data: data,
        timestamp: new Date()
      });
    });

    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      console.log(`🖥️ Device disconnected: ${device.pc_name} (${reason})`);
      
      // Remove from connected devices
      connectedDevices.delete(device.device_id);

      // Update device status
      device.status = 'offline';
      device.last_seen = new Date();
      await device.save();

      // End any active sessions for this device
      const activeSessions = await HVNCSession.findActiveSessionsForDevice(device.device_id);
      for (const session of activeSessions) {
        await session.endSession('device_offline');
      }

      // Cancel pending commands
      await HVNCCommand.cancelDeviceCommands(device.device_id, 'Device disconnected');

      // Clear any active command timeouts
      for (const [commandId, timeout] of activeCommands.entries()) {
        const command = await HVNCCommand.findOne({ 
          command_id: commandId, 
          device_id: device.device_id 
        });
        if (command) {
          clearTimeout(timeout);
          activeCommands.delete(commandId);
        }
      }

      // Log disconnection
      await HVNCActivityLog.logDeviceEvent(device.device_id, 'device_disconnected', {
        reason,
        session_duration: Date.now() - new Date(connectedDevices.get(device.device_id)?.connectedAt || 0)
      }, {
        status: 'info'
      });

      // Notify admins
      adminNamespace.emit('device_offline', {
        device_id: device.device_id,
        pc_name: device.pc_name,
        reason,
        disconnected_at: new Date()
      });
    });
  });

  // Admin connection handling
  adminNamespace.on('connection', (socket) => {
    const admin = socket.admin;
    console.log(`👨‍💼 Admin connected: ${admin.full_name} (${admin.email})`);
    
    // Track admin connection
    connectedAdmins.set(admin._id.toString(), socket.id);

    // Join admin rooms
    socket.join('admins');
    socket.join(`admin_${admin._id}`);

    // Send current device states
    socket.emit('device_states', Array.from(connectedDevices.entries()).map(([deviceId, conn]) => ({
      device_id: deviceId,
      pc_name: conn.device.pc_name,
      hostname: conn.device.hostname,
      status: conn.device.status,
      connected_at: conn.connectedAt,
      last_heartbeat: conn.lastHeartbeat,
      system_info: conn.device.system_info,
      chrome_status: conn.device.chrome_status,
      hubstaff_status: conn.device.hubstaff_status
    })));

    // Handle admin commands to devices
    socket.on('send_command', async (commandData) => {
      try {
        const { device_id, type, action, parameters, session_id, priority = 'normal' } = commandData;

        // Validate device connection
        const deviceConnection = connectedDevices.get(device_id);
        if (!deviceConnection) {
          socket.emit('command_error', {
            error: 'Device not connected',
            device_id
          });
          return;
        }

        // Create command in database
        const command = await HVNCCommand.createCommand({
          device_id,
          session_id: session_id || `admin_${admin._id}`,
          user_email: admin.email,
          type,
          action,
          parameters,
          priority,
          metadata: {
            source: 'admin_dashboard',
            admin_user: admin.email
          }
        });

        // Send command to device
        deviceConnection.socket.emit('command', {
          id: command.command_id,
          type,
          action,
          parameters,
          priority,
          timeout_seconds: command.timeout_seconds,
          session_id
        });

        // Set command timeout
        const timeoutMs = (command.timeout_seconds + 10) * 1000; // Add 10s buffer
        const commandTimeout = setTimeout(async () => {
          await command.timeout();
          activeCommands.delete(command.command_id);
          
          socket.emit('command_timeout', {
            command_id: command.command_id,
            device_id
          });
        }, timeoutMs);

        activeCommands.set(command.command_id, commandTimeout);

        // Mark command as sent
        await command.markSent();

        socket.emit('command_sent', {
          command_id: command.command_id,
          device_id,
          sent_at: new Date()
        });

        // Log admin command
        await HVNCActivityLog.logUserEvent(admin.email, 'admin_action', {
          action: 'send_command',
          command_id: command.command_id,
          device_id,
          command_type: type,
          command_action: action
        });

      } catch (error) {
        console.error('Send command error:', error);
        socket.emit('command_error', {
          error: error.message,
          command_data: commandData
        });
      }
    });

    // Handle device control requests
    socket.on('device_control', async (data) => {
      const { device_id, action, parameters } = data;
      
      const deviceConnection = connectedDevices.get(device_id);
      if (!deviceConnection) {
        socket.emit('control_error', {
          error: 'Device not connected',
          device_id
        });
        return;
      }

      // Send control command to device
      deviceConnection.socket.emit('control', {
        action,
        parameters,
        admin: admin.email,
        timestamp: new Date()
      });

      // Log admin control action
      await HVNCActivityLog.logUserEvent(admin.email, 'admin_action', {
        action: 'device_control',
        device_id,
        control_action: action,
        parameters
      });
    });

    // Handle session management
    socket.on('manage_session', async (data) => {
      const { session_id, action, reason } = data;
      
      try {
        const session = await HVNCSession.findOne({ session_id });
        if (!session) {
          socket.emit('session_error', {
            error: 'Session not found',
            session_id
          });
          return;
        }

        switch (action) {
          case 'end':
            await session.endSession(reason || 'admin_disconnect');
            socket.emit('session_ended', { session_id });
            break;
          case 'extend':
            // Extend session timeout
            session.settings.max_duration_hours += 1;
            await session.save();
            socket.emit('session_extended', { session_id });
            break;
        }

        // Log admin session management
        await HVNCActivityLog.logUserEvent(admin.email, 'admin_action', {
          action: 'manage_session',
          session_id,
          session_action: action,
          reason
        });

      } catch (error) {
        console.error('Manage session error:', error);
        socket.emit('session_error', {
          error: error.message,
          session_id
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`👨‍💼 Admin disconnected: ${admin.full_name} (${reason})`);
      connectedAdmins.delete(admin._id.toString());
    });
  });

  console.log('🔌 HVNC WebSocket server initialized');
  return io;
};

/**
 * Send command to device
 */
async function sendCommandToDevice(deviceId, command) {
  const deviceConnection = connectedDevices.get(deviceId);
  if (!deviceConnection) {
    throw new Error('Device not connected');
  }

  deviceConnection.socket.emit('command', {
    id: command.command_id,
    type: command.type,
    action: command.action,
    parameters: command.parameters,
    priority: command.priority,
    timeout_seconds: command.timeout_seconds,
    session_id: command.session_id
  });

  // Set timeout for command
  const timeoutMs = (command.timeout_seconds + 10) * 1000;
  const commandTimeout = setTimeout(async () => {
    await command.timeout();
    activeCommands.delete(command.command_id);
  }, timeoutMs);

  activeCommands.set(command.command_id, commandTimeout);

  return true;
}

/**
 * Broadcast to all admins
 */
function broadcastToAdmins(event, data) {
  if (io) {
    io.of('/admin').emit(event, data);
  }
}

/**
 * Send notification to specific admin
 */
function notifyAdmin(adminId, event, data) {
  if (io) {
    io.of('/admin').to(`admin_${adminId}`).emit(event, data);
  }
}

/**
 * Get connected devices
 */
function getConnectedDevices() {
  return Array.from(connectedDevices.entries()).map(([deviceId, conn]) => ({
    device_id: deviceId,
    pc_name: conn.device.pc_name,
    connected_at: conn.connectedAt,
    last_heartbeat: conn.lastHeartbeat
  }));
}

/**
 * Get connected admins
 */
function getConnectedAdmins() {
  return Array.from(connectedAdmins.keys());
}

/**
 * Check if device is connected
 */
function isDeviceConnected(deviceId) {
  return connectedDevices.has(deviceId);
}

/**
 * Send configuration update to device
 */
async function sendConfigUpdate(deviceId, config) {
  const deviceConnection = connectedDevices.get(deviceId);
  if (!deviceConnection) {
    return false;
  }

  deviceConnection.socket.emit('config_update', config);
  return true;
}

/**
 * Cleanup expired commands and timeouts
 */
async function cleanupExpiredCommands() {
  try {
    // Expire old commands in database
    await HVNCCommand.expireCommands();

    // Clear expired timeouts
    for (const [commandId, timeout] of activeCommands.entries()) {
      const command = await HVNCCommand.findOne({ command_id: commandId });
      if (!command || command.status !== 'executing') {
        clearTimeout(timeout);
        activeCommands.delete(commandId);
      }
    }
  } catch (error) {
    console.error('Command cleanup error:', error);
  }
}

// Periodic cleanup
setInterval(cleanupExpiredCommands, 60000); // Every minute

module.exports = {
  initializeHVNCSocket,
  sendCommandToDevice,
  broadcastToAdmins,
  notifyAdmin,
  getConnectedDevices,
  getConnectedAdmins,
  isDeviceConnected,
  sendConfigUpdate,
  cleanupExpiredCommands
};