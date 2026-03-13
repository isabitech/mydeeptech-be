const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const envConfig = require('./envConfig');

let io;

/**
 * Initialize Socket.IO server
 */
const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Authentication middleware for socket connections
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
            
            if (!token) {
                return next(new Error('Authentication token required'));
            }

            const decoded = jwt.verify(token, envConfig.JWT_SECRET || 'fallback-secret');
            socket.user = decoded;
            next();
        } catch (error) {
            next(new Error('Invalid authentication token'));
        }
    });

    // Connection handler
    io.on('connection', (socket) => {
        console.log(`User ${socket.user.email || socket.user.id} connected to real-time logs`);

        // Join user to personal room for targeted log streaming
        socket.join(`user:${socket.user.id}`);
        socket.join(`user:${socket.user.email}`);
        
        // Join admin users to admin room for system-wide logs
        if (socket.user.role === 'admin' || socket.user.role === 'moderator') {
            socket.join('admin');
        }

        // Handle real-time log subscription
        socket.on('subscribe:logs', (filters = {}) => {
            socket.logFilters = filters;
            socket.emit('subscription:confirmed', {
                message: 'Real-time log subscription active',
                filters: filters
            });
        });

        // Handle user log subscription
        socket.on('subscribe:user-logs', (userEmail) => {
            if (socket.user.role === 'admin' || socket.user.email === userEmail) {
                socket.join(`logs:${userEmail}`);
                socket.emit('subscription:confirmed', {
                    message: `Subscribed to logs for user: ${userEmail}`,
                    type: 'user-logs',
                    target: userEmail
                });
            } else {
                socket.emit('subscription:error', {
                    message: 'Unauthorized to subscribe to user logs'
                });
            }
        });

        // Handle device log subscription
        socket.on('subscribe:device-logs', (deviceId) => {
            socket.join(`device:${deviceId}`);
            socket.emit('subscription:confirmed', {
                message: `Subscribed to logs for device: ${deviceId}`,
                type: 'device-logs',
                target: deviceId
            });
        });

        // Handle error log subscription
        socket.on('subscribe:error-logs', () => {
            socket.join('error-logs');
            socket.emit('subscription:confirmed', {
                message: 'Subscribed to error logs',
                type: 'error-logs'
            });
        });

        // Handle security log subscription (admin only)
        socket.on('subscribe:security-logs', () => {
            if (socket.user.role === 'admin') {
                socket.join('security-logs');
                socket.emit('subscription:confirmed', {
                    message: 'Subscribed to security logs',
                    type: 'security-logs'
                });
            } else {
                socket.emit('subscription:error', {
                    message: 'Admin access required for security logs'
                });
            }
        });

        // Handle log filter updates
        socket.on('update:log-filters', (filters) => {
            socket.logFilters = filters;
            socket.emit('filters:updated', {
                message: 'Log filters updated successfully',
                filters: filters
            });
        });

        // Handle disconnection
        socket.on('disconnect', (reason) => {
            console.log(`User ${socket.user.email || socket.user.id} disconnected: ${reason}`);
        });

        // Handle ping for connection health
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });
    });

    return io;
};

/**
 * Get the socket.io instance
 */
const getSocketInstance = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initializeSocket first.');
    }
    return io;
};

/**
 * Broadcast log to real-time subscribers
 */
const broadcastLog = (logData) => {
    if (!io) return;

    try {
        // Broadcast to all connected admin users
        if (logData.level === 'error' || logData.level === 'fatal' || logData.category === 'security') {
            io.to('admin').emit('log:alert', {
                type: 'alert',
                log: logData,
                timestamp: Date.now()
            });
        }

        // Broadcast to error log subscribers
        if (['error', 'fatal'].includes(logData.level)) {
            io.to('error-logs').emit('log:error', {
                type: 'error',
                log: logData,
                timestamp: Date.now()
            });
        }

        // Broadcast to security log subscribers
        if (logData.category === 'security') {
            io.to('security-logs').emit('log:security', {
                type: 'security',
                log: logData,
                timestamp: Date.now()
            });
        }

        // Broadcast to specific user log subscribers
        if (logData.user?.email) {
            io.to(`logs:${logData.user.email}`).emit('log:user', {
                type: 'user-log',
                log: logData,
                timestamp: Date.now()
            });
        }

        // Broadcast to specific device log subscribers
        if (logData.device?.id) {
            io.to(`device:${logData.device.id}`).emit('log:device', {
                type: 'device-log',
                log: logData,
                timestamp: Date.now()
            });
        }

        // Broadcast to general log subscribers with filters
        io.sockets.sockets.forEach((socket) => {
            if (socket.logFilters && shouldIncludeLog(logData, socket.logFilters)) {
                socket.emit('log:general', {
                    type: 'general',
                    log: logData,
                    timestamp: Date.now()
                });
            }
        });

    } catch (error) {
        console.error('Error broadcasting log:', error);
    }
};

/**
 * Check if log matches socket filters
 */
const shouldIncludeLog = (logData, filters) => {
    if (!filters) return true;

    // Level filter
    if (filters.level && !filters.level.includes(logData.level)) {
        return false;
    }

    // Category filter
    if (filters.category && !filters.category.includes(logData.category)) {
        return false;
    }

    // Source filter
    if (filters.source && filters.source !== logData.source) {
        return false;
    }

    // User filter
    if (filters.userId && logData.user?.id !== filters.userId) {
        return false;
    }

    // Device filter
    if (filters.deviceId && logData.device?.id !== filters.deviceId) {
        return false;
    }

    // Severity filter
    if (filters.severity && logData.error?.severity !== filters.severity) {
        return false;
    }

    return true;
};

/**
 * Broadcast system status update
 */
const broadcastSystemStatus = (status) => {
    if (!io) return;

    io.to('admin').emit('system:status', {
        type: 'system-status',
        status,
        timestamp: Date.now()
    });
};

/**
 * Broadcast real-time metrics
 */
const broadcastMetrics = (metrics) => {
    if (!io) return;

    io.to('admin').emit('metrics:update', {
        type: 'metrics',
        metrics,
        timestamp: Date.now()
    });
};

/**
 * Send notification to specific user
 */
const sendUserNotification = (userId, userEmail, notification) => {
    if (!io) return;

    io.to(`user:${userId}`).to(`user:${userEmail}`).emit('notification', {
        type: 'notification',
        notification,
        timestamp: Date.now()
    });
};

/**
 * Get connected users count
 */
const getConnectedUsersCount = () => {
    return io ? io.sockets.sockets.size : 0;
};

/**
 * Get room members count
 */
const getRoomMembersCount = (roomName) => {
    if (!io) return 0;
    return io.sockets.adapter.rooms.get(roomName)?.size || 0;
};

module.exports = {
    initializeSocket,
    getSocketInstance,
    broadcastLog,
    broadcastSystemStatus,
    broadcastMetrics,
    sendUserNotification,
    getConnectedUsersCount,
    getRoomMembersCount
};