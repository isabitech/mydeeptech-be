// Layer: Controller
const sessionService = require("../services/sessionManagement.service");
const sessionRepository = require("../repositories/sessionManagement.repository");
const WebSocket = require("ws");

/**
 * Session Management with WebSocket Support
 * Handles real-time session monitoring and control
 */

class SessionManager {
  /**
   * Initialize WebSocket server
   */
  initWebSocketServer(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Cleanup inactive connections every 30 seconds
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 30000);

    console.log("WebSocket server initialized for HVNC session management");
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const type = url.searchParams.get("type"); // 'device' or 'user'
    const token = url.searchParams.get("token");

    ws.type = type;
    ws.isAlive = true;
    ws.lastPing = Date.now();

    // Handle authentication
    if (type === "device") {
      this.handleDeviceConnection(ws, token);
    } else if (type === "user") {
      this.handleUserConnection(ws, token);
    } else {
      ws.close(1008, "Invalid connection type");
      return;
    }

    // Set up message handlers
    ws.on("message", (data) => {
      this.handleMessage(ws, data);
    });

    ws.on("pong", () => {
      ws.isAlive = true;
      ws.lastPing = Date.now();
    });

    ws.on("close", () => {
      this.handleDisconnection(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      this.handleDisconnection(ws);
    });
  }

  /**
   * Handle device connection
   */
  async handleDeviceConnection(ws, deviceToken) {
    try {
      const device = await sessionRepository.findDeviceByToken(deviceToken);
      if (!device) {
        ws.close(1008, "Invalid device authentication");
        return;
      }

      ws.deviceId = device.device_id;
      ws.deviceName = device.pc_name;

      await sessionService.handleDeviceConnection(device.device_id, ws, device);

      // Notify connected users about device coming online
      await this.broadcastDeviceStatusUpdate(device.device_id, "online");

      console.log(`Device connected: ${device.pc_name} (${device.device_id})`);

      ws.send(
        JSON.stringify({
          type: "connection_established",
          data: {
            deviceId: device.device_id,
            deviceName: device.pc_name,
            status: "connected",
          },
        }),
      );
    } catch (error) {
      console.error("Device connection error:", error);
      ws.close(1011, "Server error");
    }
  }

  /**
   * Handle user connection
   */
  async handleUserConnection(ws, userToken) {
    try {
      const userEmail = userToken; // In real implementation, decode JWT
      const user = await sessionRepository.findUserByEmail(userEmail);
      if (!user) {
        ws.close(1008, "Invalid user authentication");
        return;
      }

      ws.userEmail = user.email;
      ws.userName = user.full_name;

      await sessionService.handleUserConnection(user.email, ws);

      console.log(`User connected: ${user.full_name} (${user.email})`);
      await this.sendUserDeviceStatus(user.email, ws);
    } catch (error) {
      console.error("User connection error:", error);
      ws.close(1011, "Server error");
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      switch (message.type) {
        case "ping":
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          break;
        case "device_heartbeat":
          await this.handleDeviceHeartbeat(ws, message.data);
          break;
        case "session_update":
          await this.handleSessionUpdate(ws, message.data);
          break;
        case "start_session":
          await this.handleStartSession(ws, message.data);
          break;
        case "end_session":
          await this.handleEndSession(ws, message.data);
          break;
        case "get_device_status":
          await this.handleGetDeviceStatus(ws, message.data);
          break;
        default:
          ws.send(
            JSON.stringify({ type: "error", message: "Unknown message type" }),
          );
      }
    } catch (error) {
      console.error("Message handling error:", error);
      ws.send(
        JSON.stringify({ type: "error", message: "Invalid message format" }),
      );
    }
  }

  /**
   * Handle device heartbeat
   */
  async handleDeviceHeartbeat(ws, data) {
    if (ws.type !== "device") return;

    const deviceConnection = sessionService.getDeviceConnection(ws.deviceId);
    if (deviceConnection) {
      deviceConnection.lastPing = Date.now();
      await sessionRepository.updateDeviceStatus(
        ws.deviceId,
        "online",
        data?.systemInfo || {},
      );
    }
  }

  /**
   * Handle session status updates
   */
  async handleSessionUpdate(ws, data) {
    const { sessionId, status, metadata } = data;
    try {
      const session = await sessionRepository.findSessionById(sessionId);
      if (!session) return;

      const updateData = { status };
      if (metadata) {
        updateData.metadata = { ...session.metadata, ...metadata };
      }
      if (status === "ended" || status === "terminated") {
        updateData.ended_at = new Date();
        sessionService.activeSessions.delete(sessionId);
      }
      await sessionRepository.updateSession(sessionId, updateData);

      const userConnections = sessionService.getAllUserConnections(
        session.user_email,
      );
      if (userConnections) {
        const updateMessage = {
          type: "session_update",
          data: {
            sessionId,
            deviceId: session.device_id,
            status,
            timestamp: new Date(),
          },
        };
        userConnections.forEach((userWs) => {
          if (userWs.readyState === WebSocket.OPEN)
            userWs.send(JSON.stringify(updateMessage));
        });
      }
      console.log(`Session ${sessionId} updated to status: ${status}`);
    } catch (error) {
      console.error("Session update error:", error);
    }
  }

  /**
   * Start a new session via WebSocket
   */
  async handleStartSession(ws, data) {
    if (ws.type !== "user") return;

    try {
      const { deviceId } = data;
      const session = await sessionService.startSession(
        ws.userEmail,
        deviceId,
        ws,
      );
      const deviceConnection = sessionService.getDeviceConnection(deviceId);
      if (
        deviceConnection &&
        deviceConnection.ws &&
        deviceConnection.ws.readyState === WebSocket.OPEN
      ) {
        deviceConnection.ws.send(
          JSON.stringify({
            type: "session_started",
            data: {
              sessionId: session._id,
              userEmail: session.user_email,
              userName: ws.userName,
            },
          }),
        );
      }

      ws.send(
        JSON.stringify({
          type: "session_started",
          data: {
            sessionId: session._id,
            deviceId: deviceId,
            startTime: session.started_at,
          },
        }),
      );
      console.log(
        `Session started: ${session._id} (${ws.userEmail} -> ${deviceId})`,
      );
    } catch (error) {
      console.error("Start session error:", error);
      ws.send(
        JSON.stringify({ type: "session_start_failed", error: error.message }),
      );
    }
  }

  /**
   * End a session via WebSocket
   */
  async handleEndSession(ws, data) {
    try {
      const { sessionId } = data;
      const { session, duration, deviceWs } =
        await sessionService.endSession(sessionId);
      if (deviceWs && deviceWs.readyState === WebSocket.OPEN) {
        deviceWs.send(
          JSON.stringify({
            type: "session_ended",
            data: { sessionId, duration },
          }),
        );
      }
      ws.send(
        JSON.stringify({
          type: "session_ended",
          data: {
            sessionId,
            endTime: session.ended_at,
            duration,
          },
        }),
      );
      console.log(`Session ended: ${sessionId}`);
    } catch (error) {
      console.error("End session error:", error);
      ws.send(
        JSON.stringify({ type: "session_end_failed", error: error.message }),
      );
    }
  }

  async handleGetDeviceStatus(ws) {
    if (ws.type !== "user" || !ws.userEmail) return;
    await this.sendUserDeviceStatus(ws.userEmail, ws);
  }

  /**
   * Handle disconnection
   */
  async handleDisconnection(ws) {
    if (ws.type === "device" && ws.deviceId) {
      const terminated = await sessionService.handleDeviceDisconnection(
        ws.deviceId,
      );
      for (const sessionData of terminated) {
        if (
          sessionData.userWs &&
          sessionData.userWs.readyState === WebSocket.OPEN
        ) {
          sessionData.userWs.send(
            JSON.stringify({
              type: "session_terminated",
              data: {
                sessionId: sessionData.sessionId,
                reason: "Device disconnected",
              },
            }),
          );
        }
      }
      await this.broadcastDeviceStatusUpdate(ws.deviceId, "offline");
      console.log(`Device disconnected: ${ws.deviceId}`);
    } else if (ws.type === "user" && ws.userEmail) {
      sessionService.handleUserDisconnection(ws.userEmail, ws);
      console.log(`User disconnected: ${ws.userEmail}`);
    }
  }

  async broadcastDeviceStatusUpdate(deviceId, status) {
    await sessionService.broadcastDeviceStatusUpdate(deviceId, status);
  }

  async sendUserDeviceStatus(userEmail, ws) {
    await sessionService.sendUserDeviceStatus(userEmail, ws);
  }

  async cleanupInactiveConnections() {
    await sessionService.cleanupInactiveConnections();
  }

  async getSessionStats() {
    return sessionService.getSessionStats();
  }
}

const sessionManager = new SessionManager();

const getSessionStats = async (req, res) => {
  try {
    const stats = await sessionService.getSessionStats();
    res.json(stats);
  } catch (error) {
    console.error("Get session stats error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch session statistics" });
  }
};

const forceEndSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason = "force_ended_by_admin" } = req.body;

    const { sessionData } = await sessionService.forceEndSession(
      sessionId,
      reason,
      req.admin?.email,
    );

    if (sessionData) {
      const terminationMessage = {
        type: "session_terminated",
        data: {
          sessionId,
          reason,
          terminatedBy: req.admin?.email || "admin",
        },
      };

      if (
        sessionData.userWs &&
        sessionData.userWs.readyState === WebSocket.OPEN
      ) {
        sessionData.userWs.send(JSON.stringify(terminationMessage));
      }
      if (
        sessionData.deviceWs &&
        sessionData.deviceWs.readyState === WebSocket.OPEN
      ) {
        sessionData.deviceWs.send(JSON.stringify(terminationMessage));
      }
    }

    res.json({ success: true, message: "Session terminated successfully" });
  } catch (error) {
    console.error("Force end session error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  SessionManager,
  sessionManager,
  getSessionStats,
  forceEndSession,
};
