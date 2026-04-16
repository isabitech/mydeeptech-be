const HVNCSession = require('../models/hvnc-session.model');
const HVNCDevice = require('../models/hvnc-device.model');
const HVNCUser = require('../models/hvnc-user.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');
const WebSocket = require('ws');

/**
 * Session Management with WebSocket Support
 * Handles real-time session monitoring and control
 */

class SessionManager {
  constructor() {
    this.activeSessions = new Map(); // sessionId -> { ws, session, heartbeat }
    this.deviceConnections = new Map(); // deviceId -> { ws, lastPing }
    this.userConnections = new Map(); // userEmail -> Set of WebSocket connections
  }

  /**
   * Initialize WebSocket server
   */
  initWebSocketServer(server) {
    this.wss = new WebSocket.Server({ server });
    
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Cleanup inactive connections every 30 seconds
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 30000);

    console.log('WebSocket server initialized for HVNC session management');
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const type = url.searchParams.get('type'); // 'device' or 'user'
    const token = url.searchParams.get('token');

    ws.type = type;
    ws.isAlive = true;
    ws.lastPing = Date.now();

    // Handle authentication
    if (type === 'device') {
      this.handleDeviceConnection(ws, token);
    } else if (type === 'user') {
      this.handleUserConnection(ws, token);
    } else {
      ws.close(1008, 'Invalid connection type');
      return;
    }

    // Set up message handlers
    ws.on('message', (data) => {
      this.handleMessage(ws, data);
    });

    ws.on('pong', () => {
      ws.isAlive = true;
      ws.lastPing = Date.now();
    });

    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnection(ws);
    });
  }

  /**
   * Handle device connection
   */
  async handleDeviceConnection(ws, deviceToken) {
    try {
      // Validate device token/authentication
      const device = await HVNCDevice.findOne({ 
        $or: [
          { device_id: deviceToken },
          { initial_access_code: deviceToken }
        ]
      });

      if (!device) {
        ws.close(1008, 'Invalid device authentication');
        return;
      }

      ws.deviceId = device.device_id;
      ws.deviceName = device.pc_name;

      // Update device status
      device.status = 'online';
      device.last_seen = new Date();
      await device.save();

      // Store device connection
      this.deviceConnections.set(device.device_id, {
        ws: ws,
        lastPing: Date.now(),
        device: device
      });

      // Notify connected users about device coming online
      await this.broadcastDeviceStatusUpdate(device.device_id, 'online');

      console.log(`Device connected: ${device.pc_name} (${device.device_id})`);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connection_established',
        data: {
          deviceId: device.device_id,
          deviceName: device.pc_name,
          status: 'connected'
        }
      }));

    } catch (error) {
      console.error('Device connection error:', error);
      ws.close(1011, 'Server error');
    }
  }

  /**
   * Handle user connection
   */
  async handleUserConnection(ws, userToken) {
    try {
      // Validate user token (implement JWT verification here)
      // For now, assuming token contains user email
      const userEmail = userToken; // In real implementation, decode JWT

      const user = await HVNCUser.findOne({ email: userEmail });
      if (!user) {
        ws.close(1008, 'Invalid user authentication');
        return;
      }

      ws.userEmail = user.email;
      ws.userName = user.full_name;

      // Store user connection
      if (!this.userConnections.has(user.email)) {
        this.userConnections.set(user.email, new Set());
      }
      this.userConnections.get(user.email).add(ws);

      // Send current status of assigned devices
      await this.sendUserDeviceStatus(user.email, ws);

    } catch (error) {
      console.error('User connection error:', error);
      ws.close(1011, 'Server error');
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        case 'device_heartbeat':
          await this.handleDeviceHeartbeat(ws, message.data);
          break;

        case 'session_update':
          await this.handleSessionUpdate(ws, message.data);
          break;

        case 'start_session':
          await this.handleStartSession(ws, message.data);
          break;

        case 'end_session':
          await this.handleEndSession(ws, message.data);
          break;

        case 'get_device_status':
          await this.handleGetDeviceStatus(ws, message.data);
          break;

        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Unknown message type'
          }));
      }
    } catch (error) {
      console.error('Message handling error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  }

  /**
   * Handle device heartbeat
   */
  async handleDeviceHeartbeat(ws, data) {
    if (ws.type !== 'device') return;

    const deviceId = ws.deviceId;
    const deviceConnection = this.deviceConnections.get(deviceId);
    
    if (deviceConnection) {
      deviceConnection.lastPing = Date.now();
      
      // Update device in database
      await HVNCDevice.updateOne(
        { device_id: deviceId },
        { 
          last_seen: new Date(),
          system_info: data.systemInfo || {}
        }
      );
    }
  }

  /**
   * Handle session status updates
   */
  async handleSessionUpdate(ws, data) {
    const { sessionId, status, metadata } = data;
    
    try {
      const session = await HVNCSession.findById(sessionId);
      if (!session) return;

      // Update session status
      session.status = status;
      if (metadata) {
        session.metadata = { ...session.metadata, ...metadata };
      }

      if (status === 'ended' || status === 'terminated') {
        session.ended_at = new Date();
        this.activeSessions.delete(sessionId);
      }

      await session.save();

      // Notify user about session update
      const userConnections = this.userConnections.get(session.user_email);
      if (userConnections) {
        const updateMessage = {
          type: 'session_update',
          data: {
            sessionId: session._id,
            deviceId: session.device_id,
            status: status,
            timestamp: new Date()
          }
        };

        userConnections.forEach(userWs => {
          if (userWs.readyState === WebSocket.OPEN) {
            userWs.send(JSON.stringify(updateMessage));
          }
        });
      }

      console.log(`Session ${sessionId} updated to status: ${status}`);

    } catch (error) {
      console.error('Session update error:', error);
    }
  }

  /**
   * Start a new session via WebSocket
   */
  async handleStartSession(ws, data) {
    if (ws.type !== 'user') return;

    try {
      const { deviceId } = data;
      const userEmail = ws.userEmail;

      // Verify device is online
      const deviceConnection = this.deviceConnections.get(deviceId);
      if (!deviceConnection) {
        ws.send(JSON.stringify({
          type: 'session_start_failed',
          error: 'Device is not online'
        }));
        return;
      }

      // Create session
      const session = await HVNCSession.create({
        user_email: userEmail,
        device_id: deviceId,
        started_at: new Date(),
        status: 'active',
        client_info: {
          connection_type: 'websocket'
        }
      });

      // Store in active sessions
      this.activeSessions.set(session._id.toString(), {
        session: session,
        userWs: ws,
        deviceWs: deviceConnection.ws,
        heartbeatInterval: null
      });

      // Notify device about new session
      deviceConnection.ws.send(JSON.stringify({
        type: 'session_started',
        data: {
          sessionId: session._id,
          userEmail: session.user_email,
          userName: ws.userName
        }
      }));

      // Notify user about successful start
      ws.send(JSON.stringify({
        type: 'session_started',
        data: {
          sessionId: session._id,
          deviceId: deviceId,
          startTime: session.started_at
        }
      }));

      // Log session start
      await HVNCActivityLog.logUserEvent(userEmail, 'session_started', {
        session_id: session._id,
        device_id: deviceId,
        connection_type: 'websocket'
      });

      console.log(`Session started: ${session._id} (${userEmail} -> ${deviceId})`);

    } catch (error) {
      console.error('Start session error:', error);
      ws.send(JSON.stringify({
        type: 'session_start_failed',
        error: 'Failed to start session'
      }));
    }
  }

  /**
   * End a session via WebSocket
   */
  async handleEndSession(ws, data) {
    try {
      const { sessionId } = data;
      const sessionData = this.activeSessions.get(sessionId);
      
      if (!sessionData) {
        ws.send(JSON.stringify({
          type: 'session_end_failed',
          error: 'Session not found'
        }));
        return;
      }

      const session = sessionData.session;
      
      // Update session
      session.status = 'ended';
      session.ended_at = new Date();
      await session.save();

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      // Calculate duration
      const duration = session.ended_at - session.started_at;

      // Notify device
      if (sessionData.deviceWs && sessionData.deviceWs.readyState === WebSocket.OPEN) {
        sessionData.deviceWs.send(JSON.stringify({
          type: 'session_ended',
          data: {
            sessionId: sessionId,
            duration: duration
          }
        }));
      }

      // Notify user
      ws.send(JSON.stringify({
        type: 'session_ended',
        data: {
          sessionId: sessionId,
          endTime: session.ended_at,
          duration: duration
        }
      }));

      console.log(`Session ended: ${sessionId}`);

    } catch (error) {
      console.error('End session error:', error);
    }
  }

  /**
   * Handle disconnection
   */
  async handleDisconnection(ws) {
    if (ws.type === 'device' && ws.deviceId) {
      // Device disconnected
      await this.handleDeviceDisconnection(ws);
    } else if (ws.type === 'user' && ws.userEmail) {
      // User disconnected
      this.handleUserDisconnection(ws);
    }
  }

  /**
   * Handle device disconnection
   */
  async handleDeviceDisconnection(ws) {
    const deviceId = ws.deviceId;
    
    try {
      // Update device status
      await HVNCDevice.updateOne(
        { device_id: deviceId },
        { 
          status: 'offline',
          last_seen: new Date()
        }
      );

      // Remove from connections
      this.deviceConnections.delete(deviceId);

      // End any active sessions for this device
      const activeSessions = Array.from(this.activeSessions.entries());
      for (const [sessionId, sessionData] of activeSessions) {
        if (sessionData.session.device_id === deviceId) {
          sessionData.session.status = 'terminated';
          sessionData.session.ended_at = new Date();
          sessionData.session.termination_reason = 'device_disconnected';
          await sessionData.session.save();

          this.activeSessions.delete(sessionId);

          // Notify user
          if (sessionData.userWs && sessionData.userWs.readyState === WebSocket.OPEN) {
            sessionData.userWs.send(JSON.stringify({
              type: 'session_terminated',
              data: {
                sessionId: sessionId,
                reason: 'Device disconnected'
              }
            }));
          }
        }
      }

      // Notify users about device going offline
      await this.broadcastDeviceStatusUpdate(deviceId, 'offline');

      console.log(`Device disconnected: ${deviceId}`);

    } catch (error) {
      console.error('Device disconnection error:', error);
    }
  }

  /**
   * Handle user disconnection
   */
  handleUserDisconnection(ws) {
    const userEmail = ws.userEmail;
    
    if (this.userConnections.has(userEmail)) {
      this.userConnections.get(userEmail).delete(ws);
      
      if (this.userConnections.get(userEmail).size === 0) {
        this.userConnections.delete(userEmail);
      }
    }

    console.log(`User disconnected: ${userEmail}`);
  }

  /**
   * Broadcast device status update to relevant users
   */
  async broadcastDeviceStatusUpdate(deviceId, status) {
    try {
      // Find users who have access to this device
      const shifts = await HVNCShift.find({
        device_id: deviceId,
        status: 'active'
      }).select('user_email');

      const updateMessage = {
        type: 'device_status_update',
        data: {
          deviceId: deviceId,
          status: status,
          timestamp: new Date()
        }
      };

      for (const shift of shifts) {
        const userConnections = this.userConnections.get(shift.user_email);
        if (userConnections) {
          userConnections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(updateMessage));
            }
          });
        }
      }
    } catch (error) {
      console.error('Broadcast device status error:', error);
    }
  }

  /**
   * Send device status to newly connected user
   */
  async sendUserDeviceStatus(userEmail, ws) {
    try {
      const shifts = await HVNCShift.find({
        user_email: userEmail,
        status: 'active'
      });

      for (const shift of shifts) {
        const deviceConnection = this.deviceConnections.get(shift.device_id);
        const isOnline = !!deviceConnection;

        ws.send(JSON.stringify({
          type: 'device_status',
          data: {
            deviceId: shift.device_id,
            status: isOnline ? 'online' : 'offline',
            lastSeen: deviceConnection?.lastPing || null
          }
        }));
      }
    } catch (error) {
      console.error('Send device status error:', error);
    }
  }

  /**
   * Cleanup inactive connections
   */
  cleanupInactiveConnections() {
    const now = Date.now();
    const TIMEOUT = 5 * 60 * 1000; // 5 minutes

    // Cleanup device connections
    for (const [deviceId, connection] of this.deviceConnections) {
      if (now - connection.lastPing > TIMEOUT) {
        console.log(`Cleaning up inactive device connection: ${deviceId}`);
        connection.ws.close();
        this.deviceConnections.delete(deviceId);
      }
    }

    // Cleanup user connections
    for (const [userEmail, connections] of this.userConnections) {
      const activeConnections = new Set();
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN && now - ws.lastPing < TIMEOUT) {
          activeConnections.add(ws);
        } else {
          ws.close();
        }
      });
      
      if (activeConnections.size === 0) {
        this.userConnections.delete(userEmail);
      } else {
        this.userConnections.set(userEmail, activeConnections);
      }
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    return {
      activeSessions: this.activeSessions.size,
      connectedDevices: this.deviceConnections.size,
      connectedUsers: this.userConnections.size,
      totalConnections: this.deviceConnections.size + Array.from(this.userConnections.values()).reduce((total, connections) => total + connections.size, 0)
    };
  }
}

// Create singleton instance
const sessionManager = new SessionManager();

// HTTP endpoints for session management
const getSessionStats = async (req, res) => {
  try {
    const stats = sessionManager.getSessionStats();
    
    // Get database statistics
    const totalSessions = await HVNCSession.countDocuments();
    const activeSessions = await HVNCSession.countDocuments({
      status: { $in: ['active', 'idle'] }
    });
    
    res.json({
      realtime: stats,
      database: {
        totalSessions,
        activeSessions,
        completedSessions: totalSessions - activeSessions
      }
    });
  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session statistics'
    });
  }
};

const forceEndSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason = 'force_ended_by_admin' } = req.body;
    
    // End session in database
    const session = await HVNCSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    session.status = 'terminated';
    session.ended_at = new Date();
    session.termination_reason = reason;
    await session.save();
    
    // Remove from active sessions and notify via WebSocket
    const sessionData = sessionManager.activeSessions.get(sessionId);
    if (sessionData) {
      sessionManager.activeSessions.delete(sessionId);
      
      // Notify user and device
      const terminationMessage = {
        type: 'session_terminated',
        data: {
          sessionId: sessionId,
          reason: reason,
          terminatedBy: req.admin?.email || 'admin'
        }
      };
      
      if (sessionData.userWs && sessionData.userWs.readyState === WebSocket.OPEN) {
        sessionData.userWs.send(JSON.stringify(terminationMessage));
      }
      
      if (sessionData.deviceWs && sessionData.deviceWs.readyState === WebSocket.OPEN) {
        sessionData.deviceWs.send(JSON.stringify(terminationMessage));
      }
    }
    
    res.json({
      success: true,
      message: 'Session terminated successfully'
    });
    
  } catch (error) {
    console.error('Force end session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to terminate session'
    });
  }
};

module.exports = {
  SessionManager,
  sessionManager,
  getSessionStats,
  forceEndSession
};