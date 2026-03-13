const LogRepository = require('../repositories/log.repository');
const { broadcastLog, broadcastSystemStatus } = require('../config/socket');

class LogService {

    /**
     * Get all logs with filtering
     */
    static async getAllLogs(queryParams) {
        try {
            const result = await LogRepository.getLogs(queryParams);
            return result;
        } catch (error) {
            throw new Error(`Failed to retrieve logs: ${error.message}`);
        }
    }

    /**
     * Export logs
     */
    static async exportLogs(filters, format = 'csv') {
        try {
            const result = await LogRepository.exportLogs(filters, format);
            
            // Log the export operation
            await LogRepository.createLog({
                level: 'info',
                category: 'system',
                action: 'export_logs',
                message: `Exported ${result.total} logs in ${format} format`,
                source: 'api',
                metadata: {
                    filters,
                    format,
                    recordCount: result.total
                }
            });

            return result;
        } catch (error) {
            throw new Error(`Failed to export logs: ${error.message}`);
        }
    }

    /**
     * Get log statistics
     */
    static async getLogStatistics(startDate, endDate) {
        try {
            const stats = await LogRepository.getLogStats(startDate, endDate);
            return stats;
        } catch (error) {
            throw new Error(`Failed to get log statistics: ${error.message}`);
        }
    }

    /**
     * Get device-specific logs
     */
    static async getDeviceLogs(deviceId, startDate, endDate, limit) {
        try {
            const logs = await LogRepository.getDeviceLogs(deviceId, startDate, endDate, limit);
            return {
                deviceId,
                logs,
                total: logs.length
            };
        } catch (error) {
            throw new Error(`Failed to get device logs: ${error.message}`);
        }
    }

    /**
     * Get user-specific logs
     */
    static async getUserLogs(userEmail, startDate, endDate, limit) {
        try {
            const logs = await LogRepository.getUserLogs(userEmail, startDate, endDate, limit);
            return {
                userEmail,
                logs,
                total: logs.length
            };
        } catch (error) {
            throw new Error(`Failed to get user logs: ${error.message}`);
        }
    }

    /**
     * Search logs
     */
    static async searchLogs(searchTerm, filters, limit) {
        try {
            const logs = await LogRepository.searchLogs(searchTerm, filters, limit);
            return logs;
        } catch (error) {
            throw new Error(`Failed to search logs: ${error.message}`);
        }
    }

    /**
     * Get error logs
     */
    static async getErrorLogs(severity, limit) {
        try {
            const logs = await LogRepository.getErrorLogs(severity, limit);
            return logs;
        } catch (error) {
            throw new Error(`Failed to get error logs: ${error.message}`);
        }
    }

    /**
     * Get security logs
     */
    static async getSecurityLogs(threatLevel, limit) {
        try {
            const logs = await LogRepository.getSecurityLogs(threatLevel, limit);
            return logs;
        } catch (error) {
            throw new Error(`Failed to get security logs: ${error.message}`);
        }
    }

    /**
     * Get performance metrics
     */
    static async getPerformanceMetrics(startDate, endDate) {
        try {
            const metrics = await LogRepository.getPerformanceMetrics(startDate, endDate);
            return metrics;
        } catch (error) {
            throw new Error(`Failed to get performance metrics: ${error.message}`);
        }
    }

    /**
     * Get audit trail
     */
    static async getAuditTrail(resourceType, resourceId, limit) {
        try {
            const trail = await LogRepository.getAuditTrail(resourceType, resourceId, limit);
            return trail;
        } catch (error) {
            throw new Error(`Failed to get audit trail: ${error.message}`);
        }
    }

    /**
     * Get real-time monitoring data
     */
    static async getRealtimeData() {
        try {
            const data = await LogRepository.getRealtimeData();
            return data;
        } catch (error) {
            throw new Error(`Failed to get realtime data: ${error.message}`);
        }
    }

    /**
     * Cleanup old logs
     */
    static async cleanupOldLogs(daysOld) {
        try {
            const result = await LogRepository.cleanupOldLogs(daysOld);
            
            // Log the cleanup operation
            await LogRepository.createLog({
                level: 'info',
                category: 'system',
                action: 'cleanup_logs',
                message: `Cleaned up logs older than ${daysOld} days`,
                source: 'system',
                metadata: {
                    daysOld,
                    deletedCount: result.deletedCount
                }
            });

            return result;
        } catch (error) {
            throw new Error(`Failed to cleanup logs: ${error.message}`);
        }
    }

    /**
     * Create log entry
     */
    static async createLog(logData) {
        try {
            const log = await LogRepository.createLog(logData);
            
            // Broadcast log in real-time via socket.io
            if (log) {
                setImmediate(() => {
                    broadcastLog(log);
                });
            }
            
            return log;
        } catch (error) {
            // Handle log creation errors gracefully
            console.error('Failed to create log:', error.message);
            return null;
        }
    }

    /**
     * Get real-time logs stream for specific user
     */
    static async streamUserLogs(userEmail, filters = {}) {
        try {
            // Get recent logs for initial load
            const recentLogs = await LogRepository.getUserLogs(userEmail, null, null, 50);
            
            return {
                type: 'user-logs-stream',
                userEmail,
                recentLogs,
                filters,
                timestamp: new Date()
            };
        } catch (error) {
            throw new Error(`Failed to setup user logs stream: ${error.message}`);
        }
    }

    /**
     * Get real-time logs stream for specific device
     */
    static async streamDeviceLogs(deviceId, filters = {}) {
        try {
            // Get recent logs for initial load
            const recentLogs = await LogRepository.getDeviceLogs(deviceId, null, null, 50);
            
            return {
                type: 'device-logs-stream',
                deviceId,
                recentLogs,
                filters,
                timestamp: new Date()
            };
        } catch (error) {
            throw new Error(`Failed to setup device logs stream: ${error.message}`);
        }
    }

    /**
     * Get real-time error logs stream
     */
    static async streamErrorLogs(severity = null) {
        try {
            // Get recent error logs for initial load
            const recentLogs = await LogRepository.getErrorLogs(severity, 50);
            
            return {
                type: 'error-logs-stream',
                severity,
                recentLogs,
                timestamp: new Date()
            };
        } catch (error) {
            throw new Error(`Failed to setup error logs stream: ${error.message}`);
        }
    }

    /**
     * Get real-time security logs stream
     */
    static async streamSecurityLogs(threatLevel = null) {
        try {
            // Get recent security logs for initial load
            const recentLogs = await LogRepository.getSecurityLogs(threatLevel, 50);
            
            return {
                type: 'security-logs-stream',
                threatLevel,
                recentLogs,
                timestamp: new Date()
            };
        } catch (error) {
            throw new Error(`Failed to setup security logs stream: ${error.message}`);
        }
    }

    /**
     * Broadcast system status update
     */
    static async broadcastSystemHealth() {
        try {
            const realtimeData = await LogRepository.getRealtimeData();
            
            broadcastSystemStatus({
                health: 'healthy', // This would be calculated based on error rates, etc.
                metrics: realtimeData,
                timestamp: new Date()
            });
            
            return realtimeData;
        } catch (error) {
            broadcastSystemStatus({
                health: 'unhealthy',
                error: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }
}

module.exports = LogService;