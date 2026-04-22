const LogRepository = require("../repositories/log.repository");
const { broadcastLog, broadcastSystemStatus } = require("../config/socket");

class LogService {
  static async runOperation(operation, errorMessage) {
    try {
      return await operation();
    } catch (error) {
      throw new Error(`${errorMessage}: ${error.message}`);
    }
  }

  static async getStreamPayload(
    type,
    keyName,
    keyValue,
    fetcher,
    filters = {},
  ) {
    const recentLogs = await fetcher.call(
      LogRepository,
      keyValue,
      null,
      null,
      50,
    );
    return {
      type,
      [keyName]: keyValue,
      recentLogs,
      filters,
      timestamp: new Date(),
    };
  }

  /**
   * Get all logs with filtering
   */
  static async getAllLogs(queryParams) {
    return this.runOperation(
      () => LogRepository.getLogs(queryParams),
      "Failed to retrieve logs",
    );
  }

  /**
   * Export logs
   */
  static async exportLogs(filters, format = "csv") {
    try {
      const result = await LogRepository.exportLogs(filters, format);

      // Log the export operation
      await LogRepository.createLog({
        level: "info",
        category: "system",
        action: "export_logs",
        message: `Exported ${result.total} logs in ${format} format`,
        source: "api",
        metadata: {
          filters,
          format,
          recordCount: result.total,
        },
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
    return this.runOperation(
      () => LogRepository.getLogStats(startDate, endDate),
      "Failed to get log statistics",
    );
  }

  /**
   * Get device-specific logs
   */
  static async getDeviceLogs(deviceId, startDate, endDate, limit) {
    const logs = await this.runOperation(
      () => LogRepository.getDeviceLogs(deviceId, startDate, endDate, limit),
      "Failed to get device logs",
    );

    return {
      deviceId,
      logs,
      total: logs.length,
    };
  }

  /**
   * Get user-specific logs
   */
  static async getUserLogs(userEmail, startDate, endDate, limit) {
    const logs = await this.runOperation(
      () => LogRepository.getUserLogs(userEmail, startDate, endDate, limit),
      "Failed to get user logs",
    );

    return {
      userEmail,
      logs,
      total: logs.length,
    };
  }

  /**
   * Search logs
   */
  static async searchLogs(searchTerm, filters, limit) {
    return this.runOperation(
      () => LogRepository.searchLogs(searchTerm, filters, limit),
      "Failed to search logs",
    );
  }

  /**
   * Get error logs
   */
  static async getErrorLogs(severity, limit) {
    return this.runOperation(
      () => LogRepository.getErrorLogs(severity, limit),
      "Failed to get error logs",
    );
  }

  /**
   * Get security logs
   */
  static async getSecurityLogs(threatLevel, limit) {
    return this.runOperation(
      () => LogRepository.getSecurityLogs(threatLevel, limit),
      "Failed to get security logs",
    );
  }

  /**
   * Get performance metrics
   */
  static async getPerformanceMetrics(startDate, endDate) {
    return this.runOperation(
      () => LogRepository.getPerformanceMetrics(startDate, endDate),
      "Failed to get performance metrics",
    );
  }

  /**
   * Get audit trail
   */
  static async getAuditTrail(resourceType, resourceId, limit) {
    return this.runOperation(
      () => LogRepository.getAuditTrail(resourceType, resourceId, limit),
      "Failed to get audit trail",
    );
  }

  /**
   * Get real-time monitoring data
   */
  static async getRealtimeData() {
    return this.runOperation(
      () => LogRepository.getRealtimeData(),
      "Failed to get realtime data",
    );
  }

  /**
   * Cleanup old logs
   */
  static async cleanupOldLogs(daysOld) {
    try {
      const result = await LogRepository.cleanupOldLogs(daysOld);

      // Log the cleanup operation
      await LogRepository.createLog({
        level: "info",
        category: "system",
        action: "cleanup_logs",
        message: `Cleaned up logs older than ${daysOld} days`,
        source: "system",
        metadata: {
          daysOld,
          deletedCount: result.deletedCount,
        },
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
      console.error("Failed to create log:", error.message);
      return null;
    }
  }

  /**
   * Get real-time logs stream for specific user
   */
  static async streamUserLogs(userEmail, filters = {}) {
    return this.runOperation(
      () =>
        this.getStreamPayload(
          "user-logs-stream",
          "userEmail",
          userEmail,
          LogRepository.getUserLogs,
          filters,
        ),
      "Failed to setup user logs stream",
    );
  }

  /**
   * Get real-time logs stream for specific device
   */
  static async streamDeviceLogs(deviceId, filters = {}) {
    return this.runOperation(
      () =>
        this.getStreamPayload(
          "device-logs-stream",
          "deviceId",
          deviceId,
          LogRepository.getDeviceLogs,
          filters,
        ),
      "Failed to setup device logs stream",
    );
  }

  /**
   * Get real-time error logs stream
   */
  static async streamErrorLogs(severity = null) {
    return this.runOperation(
      async () => ({
        type: "error-logs-stream",
        severity,
        recentLogs: await LogRepository.getErrorLogs(severity, 50),
        timestamp: new Date(),
      }),
      "Failed to setup error logs stream",
    );
  }

  /**
   * Get real-time security logs stream
   */
  static async streamSecurityLogs(threatLevel = null) {
    return this.runOperation(
      async () => ({
        type: "security-logs-stream",
        threatLevel,
        recentLogs: await LogRepository.getSecurityLogs(threatLevel, 50),
        timestamp: new Date(),
      }),
      "Failed to setup security logs stream",
    );
  }

  /**
   * Broadcast system status update
   */
  static async broadcastSystemHealth() {
    try {
      const realtimeData = await LogRepository.getRealtimeData();

      broadcastSystemStatus({
        health: "healthy", // This would be calculated based on error rates, etc.
        metrics: realtimeData,
        timestamp: new Date(),
      });

      return realtimeData;
    } catch (error) {
      broadcastSystemStatus({
        health: "unhealthy",
        error: error.message,
        timestamp: new Date(),
      });
      throw error;
    }
  }
}

module.exports = LogService;
