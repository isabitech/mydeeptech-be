const HVNCDeviceRepository = require('../repositories/hvnc-device.repository');
const HVNCSessionRepository = require('../repositories/hvnc-session.repository');
const HVNCUserRepository = require('../repositories/hvnc-user.repository');
const HVNCShiftRepository = require('../repositories/hvnc-shift.repository');
const HVNCActivityLogRepository = require('../repositories/hvnc-activity-log.repository');
const { isDeviceConnected } = require('./hvnc-websocket.service');

class HVNCUserPortalService {
    async getDashboard(user) {
        const userEmail = user.email;
        const activeShifts = await HVNCShiftRepository.findAllActiveForUser(userEmail);

        const assignedDevices = [];
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        for (const shift of activeShifts) {
            const device = await HVNCDeviceRepository.findByDeviceId(shift.device_id);
            if (device) {
                const isConnectedViaWebSocket = isDeviceConnected(device.device_id);
                const isOnlineInDB = device.last_seen > fiveMinutesAgo && device.status === "online";
                const isOnline = isConnectedViaWebSocket || isOnlineInDB;

                assignedDevices.push({
                    id: device._id,
                    name: device.pc_name,
                    deviceId: device.device_id,
                    status: isOnline ? "Online" : "Offline",
                    lastSeen: device.last_seen,
                    shiftTime: `${shift.start_time} - ${shift.end_time}`,
                    shiftId: shift._id,
                });
            }
        }

        const activeSessionsCount = await HVNCSessionRepository.countActiveForUser(userEmail);
        const recentSessions = await HVNCSessionRepository.findRecentForUser(userEmail, 10);

        const sessionHistory = await Promise.all(
            recentSessions.map(async (session) => {
                const device = await HVNCDeviceRepository.findByDeviceId(session.device_id);
                const duration = session.ended_at
                    ? this.calculateSessionDuration(session.started_at, session.ended_at)
                    : "In Progress";

                return {
                    id: session._id,
                    deviceName: device?.pc_name || "Unknown Device",
                    startTime: session.started_at,
                    endTime: session.ended_at,
                    duration: duration,
                    status: session.status,
                };
            })
        );

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todaySessions = await HVNCSessionRepository.find({
            user_email: userEmail,
            started_at: { $gte: todayStart },
        });

        let totalTimeToday = 0;
        for (const session of todaySessions) {
            if (session.ended_at) {
                totalTimeToday += new Date(session.ended_at) - new Date(session.started_at);
            } else if (session.status === "active") {
                totalTimeToday += Date.now() - new Date(session.started_at);
            }
        }

        const todayHours = Math.floor(totalTimeToday / 3600000);
        const todayMinutes = Math.floor((totalTimeToday % 3600000) / 60000);

        return {
            user: {
                name: user.full_name || user.fullName,
                email: user.email,
            },
            stats: {
                assignedDevices: assignedDevices.length,
                activeSessions: activeSessionsCount,
                todayTime: `${todayHours}h ${todayMinutes}m`,
                totalDevices: assignedDevices.length,
            },
            assignedDevices: assignedDevices,
            sessionHistory: sessionHistory,
        };
    }

    async getDevices(userEmail) {
        const activeShifts = await HVNCShiftRepository.findAllActiveForUser(userEmail);
        const devices = [];
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        for (const shift of activeShifts) {
            const device = await HVNCDeviceRepository.findByDeviceId(shift.device_id);
            if (device) {
                const isConnectedViaWebSocket = isDeviceConnected(device.device_id);
                const isOnlineInDB = device.last_seen > fiveMinutesAgo && device.status === "online";
                const isOnline = isConnectedViaWebSocket || isOnlineInDB;

                const activeSession = await HVNCSessionRepository.findOne({
                    user_email: userEmail,
                    device_id: device.device_id,
                    status: { $in: ["active", "idle"] },
                });

                let lastSeenStr = "Never";
                if (isConnectedViaWebSocket) {
                    lastSeenStr = "Just now";
                } else if (device.last_seen) {
                    const lastSeenMs = Date.now() - device.last_seen.getTime();
                    if (lastSeenMs < 60000) lastSeenStr = "Just now";
                    else if (lastSeenMs < 3600000) {
                        const mins = Math.floor(lastSeenMs / 60000);
                        lastSeenStr = `${mins} min${mins > 1 ? "s" : ""} ago`;
                    } else if (lastSeenMs < 86400000) {
                        const hours = Math.floor(lastSeenMs / 3600000);
                        lastSeenStr = `${hours} hour${hours > 1 ? "s" : ""} ago`;
                    } else {
                        const days = Math.floor(lastSeenMs / 86400000);
                        lastSeenStr = `${days} day${days > 1 ? "s" : ""} ago`;
                    }
                }

                devices.push({
                    id: device._id,
                    name: device.pc_name,
                    deviceId: device.device_id,
                    status: isOnline ? "Online" : "Offline",
                    lastSeen: lastSeenStr,
                    hasActiveSession: !!activeSession,
                    sessionId: activeSession?._id,
                    shiftTime: `${shift.start_time} - ${shift.end_time}`,
                    shiftDays: shift.days_of_week,
                    isRecurring: shift.is_recurring,
                });
            }
        }
        return { devices };
    }

    async getSessions(userEmail, filters) {
        const { status, device_id, limit = 50 } = filters;
        let query = { user_email: userEmail };
        if (status) query.status = status;
        if (device_id) query.device_id = device_id;

        const sessions = await HVNCSessionRepository.find(query);
        // Sort and limit in memory if repository doesn't handle it yet, 
        // but let's assume we can add these to the repository or handle here.
        const sortedSessions = sessions.sort((a, b) => b.started_at - a.started_at).slice(0, parseInt(limit));

        const sessionData = await Promise.all(
            sortedSessions.map(async (session) => {
                const device = await HVNCDeviceRepository.findByDeviceId(session.device_id);
                const duration = session.ended_at
                    ? this.calculateSessionDuration(session.started_at, session.ended_at)
                    : this.calculateSessionDuration(session.started_at, new Date());

                let sessionStatus = session.status;
                if (session.status === "active" || session.status === "idle") sessionStatus = "Active";
                else if (session.status === "ended") sessionStatus = "Completed";
                else if (session.status === "terminated") sessionStatus = "Terminated";

                return {
                    id: session._id,
                    deviceName: device?.pc_name || "Unknown Device",
                    deviceId: session.device_id,
                    startTime: session.started_at,
                    endTime: session.ended_at,
                    duration: duration,
                    status: sessionStatus,
                    terminationReason: session.termination_reason,
                };
            })
        );

        return { sessions: sessionData, total: sessionData.length };
    }

    async startSession(userEmail, deviceId, clientInfo) {
        const device = await HVNCDeviceRepository.findById(deviceId);
        if (!device) throw new Error("Device not found");

        const hasShift = await HVNCShiftRepository.findOne({
            user_email: userEmail,
            device_id: device.device_id,
            status: "active",
            $or: [{ end_date: null }, { end_date: { $gte: new Date() } }],
        });

        if (!hasShift) throw new Error("You do not have access to this device");

        const existingSession = await HVNCSessionRepository.findOne({
            user_email: userEmail,
            device_id: device.device_id,
            status: { $in: ["active", "idle"] },
        });

        if (existingSession) throw new Error("You already have an active session on this device");

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const isOnline = device.last_seen > fiveMinutesAgo && device.status === "online";
        if (!isOnline) throw new Error("Device is currently offline");

        const session = await HVNCSessionRepository.create({
            user_email: userEmail,
            device_id: device.device_id,
            started_at: new Date(),
            status: "active",
            client_info: clientInfo
        });

        if (HVNCActivityLogRepository.logUserEvent) {
            await HVNCActivityLogRepository.logUserEvent(
                userEmail,
                "session_started",
                {
                    session_id: session._id,
                    device_id: device.device_id,
                    device_name: device.pc_name,
                },
                clientInfo
            );
        }

        return {
            sessionId: session._id,
            deviceName: device.pc_name,
            deviceId: device.device_id,
            startTime: session.started_at,
            status: "active"
        };
    }

    async endSession(userEmail, sessionId, clientInfo) {
        const session = await HVNCSessionRepository.findOne({
            _id: sessionId,
            user_email: userEmail,
        });

        if (!session) throw new Error("Session not found or access denied");
        if (session.status === "ended" || session.status === "terminated") throw new Error("Session is already ended");

        const endTime = new Date();
        session.status = "ended";
        session.ended_at = endTime;
        await session.save();

        const duration = this.calculateSessionDuration(session.started_at, endTime);

        if (HVNCActivityLogRepository.logUserEvent) {
            await HVNCActivityLogRepository.logUserEvent(
                userEmail,
                "session_ended",
                {
                    session_id: session._id,
                    device_id: session.device_id,
                    duration: duration,
                },
                clientInfo
            );
        }

        return {
            sessionId: session._id,
            endTime: endTime,
            duration: duration,
            status: "ended"
        };
    }

    async getUserProfile(user) {
        const totalSessions = await HVNCSessionRepository.countByUserEmail(user.email);
        const activeSessions = await HVNCSessionRepository.countActiveForUser(user.email);
        const assignedDevicesCount = await HVNCShiftRepository.findAllActiveForUser(user.email);

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentSessions = await HVNCSessionRepository.find({
            user_email: user.email,
            started_at: { $gte: thirtyDaysAgo },
            ended_at: { $exists: true },
        });

        let totalTime = 0;
        for (const session of recentSessions) {
            totalTime += new Date(session.ended_at) - new Date(session.started_at);
        }

        const totalHours = Math.floor(totalTime / 3600000);
        const totalMinutes = Math.floor((totalTime % 3600000) / 60000);

        return {
            id: user._id,
            fullName: user.full_name,
            email: user.email,
            phoneNumber: user.phone_number,
            role: user.role,
            profile: {
                timezone: user.profile?.timezone || "UTC",
                country: user.profile?.country,
                joinedDate: user.created_at,
                lastLogin: user.last_login,
            },
            statistics: {
                totalSessions: totalSessions,
                activeSessions: activeSessions,
                assignedDevices: assignedDevicesCount.length,
                totalTimeThisMonth: `${totalHours}h ${totalMinutes}m`,
            },
        };
    }

    calculateSessionDuration(start, end) {
        const durationMs = new Date(end) - new Date(start);
        const hours = Math.floor(durationMs / 3600000);
        const minutes = Math.floor((durationMs % 3600000) / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);

        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${seconds}s`;
        return `${seconds}s`;
    }
}

module.exports = new HVNCUserPortalService();
