// Layer: Service
const sessionRepository = require("../repositories/sessionManagement.repository");
const hvncShiftRepository = require("../repositories/hvnc-shift.repository");
const WebSocket = require("ws");

class SessionManagementService {
  constructor() {
    this.activeSessions = new Map(); // sessionId -> { userWs, deviceWs, session }
    this.deviceConnections = new Map(); // deviceId -> { ws, lastPing, device }
    this.userConnections = new Map(); // userEmail -> Set of WebSocket connections
  }

  async handleDeviceConnection(deviceId, ws, device) {
    await sessionRepository.updateDeviceStatus(deviceId, "online");
    this.deviceConnections.set(deviceId, {
      ws,
      lastPing: Date.now(),
      device,
    });
  }

  async handleDeviceDisconnection(deviceId) {
    await sessionRepository.updateDeviceStatus(deviceId, "offline");
    this.deviceConnections.delete(deviceId);

    // Terminate active sessions for this device
    const terminatedSessions = [];
    for (const [sessionId, sessionData] of this.activeSessions.entries()) {
      if (sessionData.session.device_id === deviceId) {
        const endedAt = new Date();
        await sessionRepository.updateSession(sessionId, {
          status: "terminated",
          ended_at: endedAt,
          termination_reason: "device_disconnected",
        });
        terminatedSessions.push({ sessionId, userWs: sessionData.userWs });
        this.activeSessions.delete(sessionId);
      }
    }
    return terminatedSessions;
  }

  async handleUserConnection(userEmail, ws) {
    if (!this.userConnections.has(userEmail)) {
      this.userConnections.set(userEmail, new Set());
    }
    this.userConnections.get(userEmail).add(ws);
  }

  handleUserDisconnection(userEmail, ws) {
    if (this.userConnections.has(userEmail)) {
      this.userConnections.get(userEmail).delete(ws);
      if (this.userConnections.get(userEmail).size === 0) {
        this.userConnections.delete(userEmail);
      }
    }
  }

  async startSession(userEmail, deviceId, userWs) {
    const deviceConnection = this.deviceConnections.get(deviceId);
    if (!deviceConnection) {
      throw new Error("Device is not online");
    }

    const session = await sessionRepository.createSession({
      user_email: userEmail,
      device_id: deviceId,
      started_at: new Date(),
      status: "active",
      client_info: { connection_type: "websocket" },
    });

    this.activeSessions.set(session._id.toString(), {
      session,
      userWs,
      deviceWs: deviceConnection.ws,
    });

    await sessionRepository.logEvent(userEmail, "session_started", {
      session_id: session._id,
      device_id: deviceId,
      connection_type: "websocket",
    });

    return session;
  }

  async endSession(sessionId) {
    const sessionData = this.activeSessions.get(sessionId);
    if (!sessionData) throw new Error("Session not found");

    const endedAt = new Date();
    const updatedSession = await sessionRepository.updateSession(sessionId, {
      status: "ended",
      ended_at: endedAt,
    });

    this.activeSessions.delete(sessionId);
    const duration = endedAt - updatedSession.started_at;

    return {
      session: updatedSession,
      duration,
      deviceWs: sessionData.deviceWs,
    };
  }

  async forceEndSession(sessionId, reason, adminEmail) {
    const session = await sessionRepository.findSessionById(sessionId);
    if (!session) throw new Error("Session not found");

    await sessionRepository.updateSession(sessionId, {
      status: "terminated",
      ended_at: new Date(),
      termination_reason: reason,
    });

    const sessionData = this.activeSessions.get(sessionId);
    if (sessionData) {
      this.activeSessions.delete(sessionId);
    }

    return { session, sessionData };
  }

  async getSessionStats() {
    const realtime = {
      activeSessions: this.activeSessions.size,
      connectedDevices: this.deviceConnections.size,
      connectedUsers: this.userConnections.size,
      totalConnections:
        this.deviceConnections.size +
        Array.from(this.userConnections.values()).reduce(
          (t, c) => t + c.size,
          0,
        ),
    };

    const totalSessions = await sessionRepository.countSessions();
    const activeDbSessions = await sessionRepository.countSessions({
      status: { $in: ["active", "idle"] },
    });

    return {
      realtime,
      database: {
        totalSessions,
        activeSessions: activeDbSessions,
        completedSessions: totalSessions - activeDbSessions,
      },
    };
  }

  getDeviceConnection(deviceId) {
    return this.deviceConnections.get(deviceId);
  }

  getAllUserConnections(userEmail) {
    return this.userConnections.get(userEmail);
  }

  async broadcastDeviceStatusUpdate(deviceId, status) {
    try {
      const shifts = await hvncShiftRepository.findActiveByDeviceId(deviceId);
      const updateMessage = {
        type: "device_status_update",
        data: { deviceId, status, timestamp: new Date() },
      };

      for (const shift of shifts) {
        const userConnections = this.userConnections.get(shift.user_email);
        if (userConnections) {
          userConnections.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN)
              ws.send(JSON.stringify(updateMessage));
          });
        }
      }
    } catch (error) {
      console.error("Broadcast device status error:", error);
    }
  }

  async sendUserDeviceStatus(userEmail, ws) {
    try {
      const shifts = await hvncShiftRepository.findAllActiveForUser(userEmail);

      for (const shift of shifts) {
        const deviceConnection = this.deviceConnections.get(shift.device_id);
        const isOnline = !!deviceConnection;

        ws.send(
          JSON.stringify({
            type: "device_status",
            data: {
              deviceId: shift.device_id,
              status: isOnline ? "online" : "offline",
              lastSeen: deviceConnection?.lastPing || null,
            },
          }),
        );
      }
    } catch (error) {
      console.error("Send device status error:", error);
    }
  }

  async cleanupInactiveConnections(timeoutMs = 5 * 60 * 1000) {
    const now = Date.now();

    for (const [deviceId, connection] of this.deviceConnections.entries()) {
      if (now - connection.lastPing <= timeoutMs) continue;

      try {
        if (
          connection.ws &&
          (connection.ws.readyState === WebSocket.OPEN ||
            connection.ws.readyState === WebSocket.CONNECTING)
        ) {
          connection.ws.close();
        }

        const terminatedSessions =
          await this.handleDeviceDisconnection(deviceId);
        for (const terminated of terminatedSessions) {
          if (
            terminated.userWs &&
            terminated.userWs.readyState === WebSocket.OPEN
          ) {
            terminated.userWs.send(
              JSON.stringify({
                type: "session_terminated",
                data: {
                  sessionId: terminated.sessionId,
                  reason: "Device disconnected",
                },
              }),
            );
          }
        }

        await this.broadcastDeviceStatusUpdate(deviceId, "offline");
      } catch (error) {
        console.error(`Inactive device cleanup failed for ${deviceId}:`, error);
      }
    }

    for (const [userEmail, connections] of this.userConnections.entries()) {
      const activeConnections = new Set();

      for (const ws of connections) {
        if (
          ws.readyState === WebSocket.OPEN &&
          now - (ws.lastPing || 0) <= timeoutMs
        ) {
          activeConnections.add(ws);
          continue;
        }

        try {
          if (
            ws.readyState === WebSocket.OPEN ||
            ws.readyState === WebSocket.CONNECTING
          ) {
            ws.close();
          }
        } catch (error) {
          console.error(
            `Failed closing inactive user socket for ${userEmail}:`,
            error,
          );
        }
      }

      if (activeConnections.size === 0) {
        this.userConnections.delete(userEmail);
      } else {
        this.userConnections.set(userEmail, activeConnections);
      }
    }
  }
}

module.exports = new SessionManagementService();
