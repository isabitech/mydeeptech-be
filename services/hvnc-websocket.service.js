const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const HVNCDevice = require('../models/hvnc-device.model');
const HVNCUser = require('../models/hvnc-user.model');
const DTUser = require('../models/dtUser.model');
const HVNCSession = require('../models/hvnc-session.model');
const HVNCCommand = require('../models/hvnc-command.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');
const HVNCShift = require('../models/hvnc-shift.model');
const envConfig = require('../config/envConfig');
const { getIO } = require('../utils/chatSocketService');

let io;
const connectedDevices = new Map(); // Track online devices: { device_id: { socket, device_info } }
const connectedAdmins = new Map(); // Track admin connections: { admin_id: socketId }
const connectedUsers = new Map(); // Track user connections: { user_id: socketId }
const activeCommands = new Map(); // Track pending commands: { command_id: timeout }
const activeSessions = new Map(); // Track active user sessions: { session_id: { user, device, socket } }

/**
 * Initialize HVNC WebSocket namespaces on existing Socket.IO instance
 * @param {Object} server - HTTP server instance (for compatibility)
 */
const initializeHVNCSocket = (server) => {
  let deviceNamespace, adminNamespace, userNamespace;
  
  try {
    // Get existing Socket.IO instance from chat service
    io = getIO();
    
    if (!io) {
      console.error('❌ Socket.IO instance not found. Chat service must be initialized first.');
      return;
    }

    console.log('🔌 Adding HVNC namespaces to existing Socket.IO instance...');

    // Create HVNC namespaces on existing Socket.IO instance
    deviceNamespace = io.of('/hvnc-device');
    adminNamespace = io.of('/hvnc-admin');
    userNamespace = io.of('/hvnc-user');
  } catch (error) {
    console.error('❌ Failed to get Socket.IO instance:', error.message);
    console.error('❌ Chat service must be initialized before HVNC service');
    return;
  }

  // Device authentication middleware  
  deviceNamespace.use(async (socket, next) => {
    try {
      // First check handshake for token (standard Socket.IO clients)
      let token = socket.handshake.auth.token || socket.handshake.query.token;
      
      // If no token in handshake, check for C++ client token in connect data
      if (!token && socket.handshake.auth) {
        // Parse token from C++ client format: "40/hvnc-device,{"token":"xyz"}"
        const authData = socket.handshake.auth;
        if (typeof authData === 'string') {
          try {
            const parsed = JSON.parse(authData);
            token = parsed.token;
          } catch (e) {
            // Not JSON, might be in different format
          }
        }
        
        // Also check if token is directly in the auth object
        if (!token && socket.handshake.auth.token) {
          token = socket.handshake.auth.token;
        }
      }
      
      console.log('🔐 Device authentication attempt...');
      console.log('   Token provided:', token ? 'YES' : 'NO');
      console.log('   Handshake auth:', socket.handshake.auth);
      console.log('   Handshake query:', socket.handshake.query);
      console.log('   Raw token:', token ? token.substring(0, 20) + '...' : 'NULL');
      
      if (!token) {
        console.log('❌ No token provided in handshake or auth data');
        return next(new Error('Device authentication token required'));
      }

      const decoded = jwt.verify(token, envConfig.jwt.JWT_SECRET);
      console.log('✅ Token decoded successfully:', { id: decoded.id, device_id: decoded.device_id, type: decoded.type });
      
      if (decoded.type !== 'device') {
        console.log('❌ Invalid token type:', decoded.type);
        return next(new Error('Invalid token type for device connection'));
      }

      // Fetch device from database
      console.log('🔍 Looking up device in database...');
      const device = await HVNCDevice.findById(decoded.id);
      console.log('📊 Database lookup result:', device ? 'FOUND' : 'NOT FOUND');
      
      if (!device || device.device_id !== decoded.device_id) {
        console.log('❌ Device validation failed');
        console.log('   Database device:', device ? device.device_id : 'NULL');
        console.log('   Token device_id:', decoded.device_id);
        return next(new Error('Device not found or invalid'));
      }

      if (device.status === 'disabled') {
        console.log('❌ Device is disabled');
        return next(new Error('Device is disabled'));
      }

      socket.deviceId = device.device_id;
      socket.device = device;
      
      console.log('✅ Device authentication successful!');
      next();
    } catch (error) {
      console.error('❌ Device WebSocket auth error:', error.message);
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

  // User authentication middleware (following chat pattern)
  userNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('User authentication token required'));
      }

      const decoded = jwt.verify(token, envConfig.jwt.JWT_SECRET);
      
      // Fetch user (DTUser for HVNC system)
      const user = await DTUser.findById(decoded.userId);
      
      if (!user) {
        return next(new Error('User not found'));
      }

      if (!user.isEmailVerified) {
        return next(new Error('Email not verified'));
      }

      // Check if user is admin
      const isAdmin = user.email && user.email.includes('@mydeeptech.ng');

      socket.userId = decoded.userId;
      socket.userEmail = user.email;
      socket.userName = user.fullName;
      socket.isAdmin = isAdmin;
      socket.user = user;
      
      next();
    } catch (error) {
      console.error('User WebSocket auth error:', error);
      next(new Error('User authentication failed'));
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

    // ✅ Send authentication success confirmation to PC agent
    socket.emit('authenticated', {
      success: true,
      deviceId: device.device_id,
      pcName: device.pc_name,
      message: 'Device authenticated and connected successfully',
      timestamp: new Date().toISOString(),
      socketId: socket.id
    });

    console.log(`📤 Sent 'authenticated' event to device ${device.device_id}`);

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

  // User connection handling (following chat pattern)
  userNamespace.on('connection', (socket) => {
    const user = socket.user;
    console.log(`👤 User connected to HVNC: ${user.fullName} (${user.email})`);
    
    // Track user connection
    connectedUsers.set(user._id.toString(), socket.id);

    // Join user to their personal room for targeted messages
    socket.join(`user_${user._id}`);
    
    // Send user their assigned devices
    socket.on('get_assigned_devices', async () => {
      try {
        // Find devices assigned to this user through shifts
        const activeShifts = await HVNCShift.find({
          user_email: user.email,
          status: 'active',
          start_date: { $lte: new Date() },
          end_date: { $gte: new Date() }
        });

        const deviceIds = activeShifts.map(shift => shift.device_id);
        const devices = await HVNCDevice.find({
          device_id: { $in: deviceIds }
        });

        const deviceList = devices.map(device => {
          const isOnline = connectedDevices.has(device.device_id);
          return {
            id: device._id,
            device_id: device.device_id,
            pc_name: device.pc_name,
            status: isOnline ? 'online' : 'offline',
            last_seen: device.last_seen,
            system_info: device.system_info
          };
        });

        socket.emit('assigned_devices', { devices: deviceList });
      } catch (error) {
        console.error('Get assigned devices error:', error);
        socket.emit('error', { message: 'Failed to get assigned devices' });
      }
    });

    // Start session with device
    socket.on('start_session', async (data) => {
      try {
        const { device_id } = data;

        // Validate device assignment
        const activeShift = await HVNCShift.findOne({
          user_email: user.email,
          device_id: device_id,
          status: 'active',
          start_date: { $lte: new Date() },
          end_date: { $gte: new Date() }
        });

        if (!activeShift) {
          socket.emit('session_error', {
            error: 'No active shift for this device',
            device_id
          });
          return;
        }

        // Check if device is online
        const deviceConnection = connectedDevices.get(device_id);
        if (!deviceConnection) {
          socket.emit('session_error', {
            error: 'Device is not online',
            device_id
          });
          return;
        }

        // Create session
        const session = await HVNCSession.create({
          user_email: user.email,
          device_id: device_id,
          started_at: new Date(),
          status: 'active',
          client_info: {
            connection_type: 'websocket',
            user_id: user._id
          }
        });

        // Store active session
        activeSessions.set(session._id.toString(), {
          session: session,
          userSocket: socket,
          deviceSocket: deviceConnection.socket,
          user: user,
          device: deviceConnection.device
        });

        // Join session room
        socket.join(`session_${session._id}`);

        // Notify device about new session
        deviceConnection.socket.emit('session_started', {
          session_id: session._id,
          user_email: user.email,
          user_name: user.fullName
        });

        // Notify user about successful session start
        socket.emit('session_started', {
          session_id: session._id,
          device_id: device_id,
          device_name: deviceConnection.device.pc_name,
          start_time: session.started_at,
          status: 'active'
        });

        // Log session start
        await HVNCActivityLog.logUserEvent(user.email, 'session_started', {
          session_id: session._id,
          device_id: device_id,
          device_name: deviceConnection.device.pc_name
        });

        console.log(`🎮 Session started: ${user.fullName} → ${deviceConnection.device.pc_name}`);

      } catch (error) {
        console.error('Start session error:', error);
        socket.emit('session_error', {
          error: 'Failed to start session',
          message: error.message
        });
      }
    });

    // End session
    socket.on('end_session', async (data) => {
      try {
        const { session_id } = data;

        const sessionData = activeSessions.get(session_id);
        if (!sessionData || sessionData.user._id.toString() !== user._id.toString()) {
          socket.emit('session_error', {
            error: 'Session not found or access denied',
            session_id
          });
          return;
        }

        // Update session in database
        const session = await HVNCSession.findById(session_id);
        if (session) {
          session.ended_at = new Date();
          session.status = 'ended';
          session.duration_minutes = Math.round((Date.now() - new Date(session.started_at).getTime()) / (1000 * 60));
          await session.save();
        }

        // Notify device about session end
        if (sessionData.deviceSocket) {
          sessionData.deviceSocket.emit('session_ended', {
            session_id: session_id,
            user_email: user.email
          });
        }

        // Remove from active sessions
        activeSessions.delete(session_id);

        // Leave session room
        socket.leave(`session_${session_id}`);

        // Notify user
        socket.emit('session_ended', {
          session_id: session_id,
          end_time: new Date(),
          duration: session ? session.duration_minutes : 0
        });

        // Log session end
        await HVNCActivityLog.logUserEvent(user.email, 'session_ended', {
          session_id: session_id,
          duration_minutes: session ? session.duration_minutes : 0
        });

        console.log(`🛑 Session ended: ${user.fullName} (${session_id})`);

      } catch (error) {
        console.error('End session error:', error);
        socket.emit('session_error', {
          error: 'Failed to end session',
          message: error.message
        });
      }
    });

    // Send command to device during session
    socket.on('send_command', async (data) => {
      try {
        const { session_id, action, parameters } = data;

        const sessionData = activeSessions.get(session_id);
        if (!sessionData || sessionData.user._id.toString() !== user._id.toString()) {
          socket.emit('command_error', {
            error: 'Session not found or access denied',
            session_id
          });
          return;
        }

        // Create command
        const command = await HVNCCommand.createCommand({
          device_id: sessionData.device.device_id,
          session_id: session_id,
          user_email: user.email,
          type: 'user_control',
          action: action,
          parameters: parameters || {},
          priority: 'normal',
          metadata: {
            source: 'user_session',
            user_id: user._id
          }
        });

        // Send command to device
        sessionData.deviceSocket.emit('command', {
          id: command.command_id,
          type: 'user_control',
          action: action,
          parameters: parameters,
          session_id: session_id,
          user: user.fullName
        });

        socket.emit('command_sent', {
          command_id: command.command_id,
          action: action,
          timestamp: new Date()
        });

        // Log command
        await HVNCActivityLog.logUserEvent(user.email, 'user_command', {
          session_id: session_id,
          device_id: sessionData.device.device_id,
          action: action,
          parameters: parameters
        });

      } catch (error) {
        console.error('Send command error:', error);
        socket.emit('command_error', {
          error: 'Failed to send command',
          message: error.message
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`👤 User disconnected from HVNC: ${user.fullName} (${reason})`);
      connectedUsers.delete(user._id.toString());

      // End any active sessions for this user
      for (const [sessionId, sessionData] of activeSessions.entries()) {
        if (sessionData.user._id.toString() === user._id.toString()) {
          // End session in database
          HVNCSession.findById(sessionId).then(session => {
            if (session) {
              session.ended_at = new Date();
              session.status = 'disconnected';
              session.duration_minutes = Math.round((Date.now() - new Date(session.started_at).getTime()) / (1000 * 60));
              return session.save();
            }
          }).catch(err => console.error('Error ending session on disconnect:', err));

          // Notify device
          if (sessionData.deviceSocket) {
            sessionData.deviceSocket.emit('session_ended', {
              session_id: sessionId,
              reason: 'user_disconnected'
            });
          }

          // Remove from active sessions
          activeSessions.delete(sessionId);
        }
      }
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
    io.of('/hvnc-admin').emit(event, data);
  }
}

/**
 * Send notification to specific admin
 */
function notifyAdmin(adminId, event, data) {
  if (io) {
    io.of('/hvnc-admin').to(`admin_${adminId}`).emit(event, data);
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

/**
 * Get connected users
 */
function getConnectedUsers() {
  return Array.from(connectedUsers.keys());
}

/**
 * Send notification to specific user
 */
function notifyUser(userId, event, data) {
  if (io) {
    io.of('/hvnc-user').to(`user_${userId}`).emit(event, data);
  }
}

/**
 * Get active sessions
 */
function getActiveSessions() {
  return Array.from(activeSessions.entries()).map(([sessionId, data]) => ({
    session_id: sessionId,
    user_email: data.user.email,
    user_name: data.user.fullName,
    device_id: data.device.device_id,
    device_name: data.device.pc_name,
    started_at: data.session.started_at
  }));
}

/**
 * End user session by session ID
 */
async function endUserSession(sessionId, reason = 'admin_action') {
  const sessionData = activeSessions.get(sessionId);
  if (!sessionData) {
    return false;
  }

  try {
    // Update session in database
    const session = await HVNCSession.findById(sessionId);
    if (session) {
      session.ended_at = new Date();
      session.status = 'ended';
      session.end_reason = reason;
      session.duration_minutes = Math.round((Date.now() - new Date(session.started_at).getTime()) / (1000 * 60));
      await session.save();
    }

    // Notify user
    sessionData.userSocket.emit('session_force_ended', {
      session_id: sessionId,
      reason: reason,
      end_time: new Date()
    });

    // Notify device
    sessionData.deviceSocket.emit('session_ended', {
      session_id: sessionId,
      reason: reason
    });

    // Remove from active sessions
    activeSessions.delete(sessionId);

    return true;
  } catch (error) {
    console.error('Error ending user session:', error);
    return false;
  }
}

// Periodic cleanup
setInterval(cleanupExpiredCommands, 60000); // Every minute

module.exports = {
  initializeHVNCSocket,
  sendCommandToDevice,
  broadcastToAdmins,
  notifyAdmin,
  notifyUser,
  getConnectedDevices,
  getConnectedAdmins,
  getConnectedUsers,
  getActiveSessions,
  isDeviceConnected,
  sendConfigUpdate,
  endUserSession,
  cleanupExpiredCommands
};