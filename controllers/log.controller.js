const LogService = require('../services/log.service');

/**
 * Get all logs
 */
const getAllLogs = async (req, res) => {
    try {
        const result = await LogService.getAllLogs(req.query);
        
        res.status(200).json({
            success: true,
            message: 'Logs retrieved successfully',
            error: null,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve logs',
            error: error.message,
            data: null
        });
    }
};

/**
 * Setup real-time user logs stream
 */
const streamUserLogs = async (req, res) => {
    try {
        const { email } = req.params;
        const filters = req.query;
        
        const streamData = await LogService.streamUserLogs(email, filters);
        
        res.status(200).json({
            success: true,
            message: 'User logs stream ready',
            error: null,
            data: {
                ...streamData,
                socketInstructions: {
                    event: 'subscribe:user-logs',
                    data: email,
                    listenFor: 'log:user'
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to setup user logs stream',
            error: error.message,
            data: null
        });
    }
};

/**
 * Setup real-time device logs stream
 */
const streamDeviceLogs = async (req, res) => {
    try {
        const { device_id } = req.params;
        const filters = req.query;
        
        const streamData = await LogService.streamDeviceLogs(device_id, filters);
        
        res.status(200).json({
            success: true,
            message: 'Device logs stream ready',
            error: null,
            data: {
                ...streamData,
                socketInstructions: {
                    event: 'subscribe:device-logs',
                    data: device_id,
                    listenFor: 'log:device'
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to setup device logs stream',
            error: error.message,
            data: null
        });
    }
};

/**
 * Setup real-time error logs stream
 */
const streamErrorLogs = async (req, res) => {
    try {
        const { severity } = req.query;
        
        const streamData = await LogService.streamErrorLogs(severity);
        
        res.status(200).json({
            success: true,
            message: 'Error logs stream ready',
            error: null,
            data: {
                ...streamData,
                socketInstructions: {
                    event: 'subscribe:error-logs',
                    data: null,
                    listenFor: 'log:error'
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to setup error logs stream',
            error: error.message,
            data: null
        });
    }
};

/**
 * Setup real-time security logs stream
 */
const streamSecurityLogs = async (req, res) => {
    try {
        const { threatLevel } = req.query;
        
        const streamData = await LogService.streamSecurityLogs(threatLevel);
        
        res.status(200).json({
            success: true,
            message: 'Security logs stream ready',
            error: null,
            data: {
                ...streamData,
                socketInstructions: {
                    event: 'subscribe:security-logs',
                    data: null,
                    listenFor: 'log:security'
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to setup security logs stream',
            error: error.message,
            data: null
        });
    }
};

/**
 * Export logs
 */
const exportLogs = async (req, res) => {
    try {
        const filters = req.query;
        const format = req.query.format || 'csv';
        
        const result = await LogService.exportLogs(filters, format);
        
        // Set appropriate headers for file download
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename=logs_export_${new Date().toISOString().split('T')[0]}.${format}`);
        
        res.status(200).json({
            success: true,
            message: 'Logs exported successfully',
            error: null,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to export logs',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get log statistics
 */
const getLogStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const stats = await LogService.getLogStatistics(startDate, endDate);
        
        res.status(200).json({
            success: true,
            message: 'Log statistics retrieved successfully',
            error: null,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve log statistics',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get device-specific logs
 */
const getDeviceLogs = async (req, res) => {
    try {
        const { device_id } = req.params;
        const { startDate, endDate, limit } = req.query;
        
        const result = await LogService.getDeviceLogs(device_id, startDate, endDate, parseInt(limit));
        
        res.status(200).json({
            success: true,
            message: 'Device logs retrieved successfully',
            error: null,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve device logs',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get user-specific logs
 */
const getUserLogs = async (req, res) => {
    try {
        const { email } = req.params;
        const { startDate, endDate, limit } = req.query;
        
        const result = await LogService.getUserLogs(email, startDate, endDate, parseInt(limit));
        
        res.status(200).json({
            success: true,
            message: 'User logs retrieved successfully',
            error: null,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user logs',
            error: error.message,
            data: null
        });
    }
};

/**
 * Search logs
 */
const searchLogs = async (req, res) => {
    try {
        const { q: searchTerm, limit } = req.query;
        const filters = { ...req.query };
        delete filters.q;
        delete filters.limit;
        
        const logs = await LogService.searchLogs(searchTerm, filters, parseInt(limit));
        
        res.status(200).json({
            success: true,
            message: 'Log search completed successfully',
            error: null,
            data: {
                searchTerm,
                results: logs,
                total: logs.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to search logs',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get error logs
 */
const getErrorLogs = async (req, res) => {
    try {
        const { severity, limit } = req.query;
        const logs = await LogService.getErrorLogs(severity, parseInt(limit));
        
        res.status(200).json({
            success: true,
            message: 'Error logs retrieved successfully',
            error: null,
            data: {
                severity: severity || 'all',
                logs,
                total: logs.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve error logs',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get security logs
 */
const getSecurityLogs = async (req, res) => {
    try {
        const { threatLevel, limit } = req.query;
        const logs = await LogService.getSecurityLogs(threatLevel, parseInt(limit));
        
        res.status(200).json({
            success: true,
            message: 'Security logs retrieved successfully',
            error: null,
            data: {
                threatLevel: threatLevel || 'all',
                logs,
                total: logs.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve security logs',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get performance metrics
 */
const getPerformanceMetrics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const metrics = await LogService.getPerformanceMetrics(startDate, endDate);
        
        res.status(200).json({
            success: true,
            message: 'Performance metrics retrieved successfully',
            error: null,
            data: metrics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve performance metrics',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get real-time monitoring data
 */
const getRealtimeData = async (req, res) => {
    try {
        const data = await LogService.getRealtimeData();
        
        res.status(200).json({
            success: true,
            message: 'Real-time data retrieved successfully',
            error: null,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve real-time data',
            error: error.message,
            data: null
        });
    }
};

module.exports = {
    getAllLogs,
    streamUserLogs,
    streamDeviceLogs,
    streamErrorLogs,
    streamSecurityLogs,
    exportLogs,
    getLogStats,
    getDeviceLogs,
    getUserLogs,
    searchLogs,
    getErrorLogs,
    getSecurityLogs,
    getPerformanceMetrics,
    getRealtimeData
};