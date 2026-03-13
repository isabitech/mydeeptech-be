const Log = require('../models/log.model');
const mongoose = require('mongoose');

class LogRepository {
    constructor() {}

    /**
     * Get logs with advanced filtering, sorting, and pagination
     */
    static async getLogs(payloads) {
        const { 
            limit = 50, 
            skip = 0, 
            search, 
            level, 
            category,
            source,
            userId,
            deviceId,
            resourceType,
            startDate,
            endDate,
            severity,
            threatLevel,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = payloads;

        // Build filter query
        const filterQuery = {};
        
        if (search) {
            filterQuery.$text = { $search: search };
        }
        
        if (level) {
            if (Array.isArray(level)) {
                filterQuery.level = { $in: level };
            } else {
                filterQuery.level = level;
            }
        }
        
        if (category) {
            if (Array.isArray(category)) {
                filterQuery.category = { $in: category };
            } else {
                filterQuery.category = category;
            }
        }
        
        if (source) {
            filterQuery.source = source;
        }
        
        if (userId) {
            filterQuery['user.id'] = userId;
        }
        
        if (deviceId) {
            filterQuery['device.id'] = deviceId;
        }
        
        if (resourceType) {
            filterQuery['resource.type'] = resourceType;
        }
        
        if (severity) {
            filterQuery['error.severity'] = severity;
        }
        
        if (threatLevel) {
            filterQuery['security.threat'] = threatLevel;
        }
        
        // Date range filter
        if (startDate || endDate) {
            filterQuery.createdAt = {};
            if (startDate) {
                filterQuery.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                filterQuery.createdAt.$lte = new Date(endDate);
            }
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const [totalLogs, logs] = await Promise.all([
            Log.countDocuments(filterQuery),
            Log.find(filterQuery)
                .populate('user.id', 'firstname lastname email')
                .populate('device.id', 'name deviceId type')
                .populate('resource.id')
                .populate('metadata.parentLogId')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        return {
            logs,
            pagination: {
                total: totalLogs,
                page: Math.floor(skip / limit) + 1,
                pages: Math.ceil(totalLogs / limit),
                limit,
                hasNext: (skip + limit) < totalLogs,
                hasPrev: skip > 0
            }
        };
    }

    /**
     * Get log by ID
     */
    static async getLogById(logId) {
        if (!mongoose.isValidObjectId(logId)) {
            throw new Error('Invalid log ID format');
        }

        const log = await Log.findById(logId)
            .populate('user.id', 'firstname lastname email role')
            .populate('device.id', 'name deviceId type status')
            .populate('resource.id')
            .populate('metadata.parentLogId')
            .lean();

        if (!log) {
            throw new Error('Log not found');
        }

        return log;
    }

    /**
     * Create new log entry
     */
    static async createLog(logData) {
        return await Log.createEntry(logData);
    }

    /**
     * Get logs by correlation ID
     */
    static async getLogsByCorrelationId(correlationId) {
        return await Log.find({ 'metadata.correlationId': correlationId })
            .populate('user.id', 'firstname lastname email')
            .populate('device.id', 'name deviceId type')
            .sort({ createdAt: 1 })
            .lean();
    }

    /**
     * Get device-specific logs
     */
    static async getDeviceLogs(deviceId, startDate = null, endDate = null, limit = 100) {
        if (!mongoose.isValidObjectId(deviceId)) {
            throw new Error('Invalid device ID format');
        }

        const filterQuery = { 'device.id': deviceId };

        if (startDate && endDate) {
            filterQuery.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        return await Log.find(filterQuery)
            .populate('user.id', 'firstname lastname email')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Get user-specific logs
     */
    static async getUserLogs(userEmail, startDate = null, endDate = null, limit = 100) {
        const filterQuery = { 'user.email': userEmail };

        if (startDate && endDate) {
            filterQuery.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        return await Log.find(filterQuery)
            .populate('device.id', 'name deviceId type')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Get error logs with high priority
     */
    static async getErrorLogs(severity = null, limit = 50) {
        const filterQuery = { 
            level: { $in: ['error', 'fatal'] }
        };

        if (severity) {
            filterQuery['error.severity'] = severity;
        }

        return await Log.find(filterQuery)
            .populate('user.id', 'firstname lastname email')
            .populate('device.id', 'name deviceId type')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Get security-related logs
     */
    static async getSecurityLogs(threatLevel = null, limit = 50) {
        const filterQuery = { category: 'security' };

        if (threatLevel) {
            filterQuery['security.threat'] = threatLevel;
        }

        return await Log.find(filterQuery)
            .populate('user.id', 'firstname lastname email')
            .populate('device.id', 'name deviceId type')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Get log statistics
     */
    static async getLogStats(startDate = null, endDate = null) {
        let matchStage = {};
        
        if (startDate && endDate) {
            matchStage.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const [overview, byLevel, byCategory, bySource, errorAnalysis, performanceAnalysis] = await Promise.all([
            // Overall statistics
            Log.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        errors: { 
                            $sum: {
                                $cond: [
                                    { $in: ['$level', ['error', 'fatal']] },
                                    1,
                                    0
                                ]
                            }
                        },
                        securityThreats: {
                            $sum: {
                                $cond: [
                                    { $in: ['$security.threat', ['high', 'critical']] },
                                    1,
                                    0
                                ]
                            }
                        },
                        avgResponseTime: { $avg: '$response.duration' },
                        uniqueUsers: { $addToSet: '$user.id' },
                        uniqueDevices: { $addToSet: '$device.id' }
                    }
                },
                {
                    $addFields: {
                        uniqueUsersCount: { $size: '$uniqueUsers' },
                        uniqueDevicesCount: { $size: '$uniqueDevices' }
                    }
                }
            ]),

            // By log level
            Log.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: '$level',
                        count: { $sum: 1 },
                        percentage: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ]),

            // By category
            Log.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        errors: {
                            $sum: {
                                $cond: [
                                    { $in: ['$level', ['error', 'fatal']] },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                },
                { $sort: { count: -1 } }
            ]),

            // By source
            Log.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: '$source',
                        count: { $sum: 1 },
                        avgResponseTime: { $avg: '$response.duration' }
                    }
                },
                { $sort: { count: -1 } }
            ]),

            // Error analysis
            Log.aggregate([
                { 
                    $match: { 
                        ...matchStage,
                        level: { $in: ['error', 'fatal'] }
                    }
                },
                {
                    $group: {
                        _id: '$error.type',
                        count: { $sum: 1 },
                        severity: { $push: '$error.severity' }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),

            // Performance analysis
            Log.aggregate([
                { 
                    $match: { 
                        ...matchStage,
                        'response.duration': { $exists: true }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d-%H',
                                date: '$createdAt'
                            }
                        },
                        avgResponseTime: { $avg: '$response.duration' },
                        maxResponseTime: { $max: '$response.duration' },
                        requestCount: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ])
        ]);

        return {
            overview: overview[0] || {
                total: 0,
                errors: 0,
                securityThreats: 0,
                avgResponseTime: 0,
                uniqueUsersCount: 0,
                uniqueDevicesCount: 0
            },
            byLevel,
            byCategory,
            bySource,
            errorAnalysis,
            performanceAnalysis
        };
    }

    /**
     * Export logs to CSV format
     */
    static async exportLogs(filters = {}, format = 'csv') {
        const { 
            startDate, 
            endDate, 
            level, 
            category, 
            maxRecords = 10000 
        } = filters;

        const filterQuery = {};
        
        if (startDate && endDate) {
            filterQuery.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        if (level) {
            filterQuery.level = Array.isArray(level) ? { $in: level } : level;
        }
        
        if (category) {
            filterQuery.category = Array.isArray(category) ? { $in: category } : category;
        }

        const logs = await Log.find(filterQuery)
            .populate('user.id', 'firstname lastname email')
            .populate('device.id', 'name deviceId')
            .sort({ createdAt: -1 })
            .limit(maxRecords)
            .lean();

        // Anonymize sensitive data for export
        const anonymizedLogs = logs.map(log => {
            const anonymized = new Log(log).anonymize();
            return {
                timestamp: anonymized.createdAt,
                level: anonymized.level,
                category: anonymized.category,
                message: anonymized.message,
                action: anonymized.action,
                user: anonymized.user?.email || 'N/A',
                device: anonymized.device?.name || 'N/A',
                source: anonymized.source,
                status: anonymized.response?.statusCode || 'N/A',
                duration: anonymized.response?.duration || 'N/A'
            };
        });

        return {
            data: anonymizedLogs,
            total: logs.length,
            format,
            exportedAt: new Date()
        };
    }

    /**
     * Search logs with full-text search
     */
    static async searchLogs(searchTerm, filters = {}, limit = 100) {
        const filterQuery = {
            $text: { $search: searchTerm },
            ...filters
        };

        return await Log.find(filterQuery, { score: { $meta: 'textScore' } })
            .populate('user.id', 'firstname lastname email')
            .populate('device.id', 'name deviceId type')
            .sort({ score: { $meta: 'textScore' } })
            .limit(limit)
            .lean();
    }

    /**
     * Get logs requiring attention (alerts)
     */
    static async getAlertLogs(limit = 20) {
        return await Log.find({
            $or: [
                { level: { $in: ['error', 'fatal'] } },
                { 'security.threat': { $in: ['high', 'critical'] } },
                { 'security.blocked': true },
                { 'error.severity': { $in: ['high', 'critical'] } }
            ],
            'processed.alerted': { $ne: true }
        })
        .populate('user.id', 'firstname lastname email')
        .populate('device.id', 'name deviceId type')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    }

    /**
     * Mark logs as processed
     */
    static async markAsProcessed(logIds, processType) {
        if (!Array.isArray(logIds) || logIds.length === 0) {
            throw new Error('Invalid log IDs array');
        }

        const validLogIds = logIds.filter(id => mongoose.isValidObjectId(id));
        
        if (validLogIds.length === 0) {
            throw new Error('No valid log IDs provided');
        }

        const updateField = `processed.${processType}`;
        
        const result = await Log.updateMany(
            { _id: { $in: validLogIds } },
            { $set: { [updateField]: true } }
        );

        return {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount
        };
    }

    /**
     * Cleanup old logs
     */
    static async cleanupOldLogs(daysOld = 365, levels = ['debug', 'trace', 'info']) {
        return await Log.cleanup(daysOld);
    }

    /**
     * Get system performance metrics from logs
     */
    static async getPerformanceMetrics(startDate, endDate) {
        const matchStage = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            'performance': { $exists: true }
        };

        return await Log.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d-%H',
                            date: '$createdAt'
                        }
                    },
                    avgCpuUsage: { $avg: '$performance.cpuUsage' },
                    avgMemoryUsage: { $avg: '$performance.memoryUsage' },
                    avgResponseTime: { $avg: '$performance.responseTime' },
                    maxCpuUsage: { $max: '$performance.cpuUsage' },
                    maxMemoryUsage: { $max: '$performance.memoryUsage' },
                    maxResponseTime: { $max: '$performance.responseTime' },
                    requestCount: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
    }

    /**
     * Get audit trail for specific resource
     */
    static async getAuditTrail(resourceType, resourceId, limit = 100) {
        if (!mongoose.isValidObjectId(resourceId)) {
            throw new Error('Invalid resource ID format');
        }

        return await Log.find({
            'resource.type': resourceType,
            'resource.id': resourceId
        })
        .populate('user.id', 'firstname lastname email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    }

    /**
     * Get real-time monitoring data
     */
    static async getRealtimeData() {
        const [currentErrors, recentActivity, systemHealth] = await Promise.all([
            // Current errors (last hour)
            Log.find({
                level: { $in: ['error', 'fatal'] },
                createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
            }).countDocuments(),

            // Recent activity (last 5 minutes)
            Log.find({
                createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
            })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('user.id', 'firstname lastname email')
            .populate('device.id', 'name deviceId')
            .lean(),

            // System health indicators
            Log.aggregate([
                {
                    $match: {
                        createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
                    }
                },
                {
                    $group: {
                        _id: null,
                        errorRate: {
                            $avg: {
                                $cond: [
                                    { $in: ['$level', ['error', 'fatal']] },
                                    1,
                                    0
                                ]
                            }
                        },
                        avgResponseTime: { $avg: '$response.duration' },
                        requestCount: { $sum: 1 }
                    }
                }
            ])
        ]);

        return {
            currentErrors,
            recentActivity,
            systemHealth: systemHealth[0] || {
                errorRate: 0,
                avgResponseTime: 0,
                requestCount: 0
            }
        };
    }
}

module.exports = LogRepository;