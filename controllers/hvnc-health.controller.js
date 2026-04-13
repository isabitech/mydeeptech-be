/**
 * HVNC Health Check Controller
 * Provides comprehensive health monitoring for the HVNC system
 */

const HVNCHealthService = require('../services/hvnc-health.service');

/**
 * Basic HVNC System Health Check
 */
const hvncHealthCheck = async (req, res) => {
  try {
    const result = await HVNCHealthService.getBasicHealth();
    res.status(result.statusCode).json(result.data);

  } catch (error) {
    console.error('HVNC Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      database: 'unknown',
      redis: 'unknown',
      websocket: 'unknown'
    });
  }
};

/**
 * Detailed System Statistics (Admin only)
 */
const getSystemStatistics = async (req, res) => {
  try {
    const days = req.query.days || 7;
    const result = await HVNCHealthService.getSystemStatistics(days);
    
    res.json(result);

  } catch (error) {
    console.error('System statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate system statistics',
      details: error.message
    });
  }
};

/**
 * Activity Logs with Advanced Filtering (Admin only)
 */
const getActivityLogs = async (req, res) => {
  try {
    const queryOpts = {
      event_type: req.query.event_type,
      user_email: req.query.user_email,
      device_id: req.query.device_id,
      severity: req.query.severity,
      status: req.query.status,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      limit: req.query.limit || 10,
      page: req.query.page || 1,
      search: req.query.search
    };

    const result = await HVNCHealthService.getActivityLogs(queryOpts);
    
    res.json(result);

  } catch (error) {
    console.error('Activity logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve activity logs',
      details: error.message
    });
  }
};

module.exports = {
  hvncHealthCheck,
  getSystemStatistics,
  getActivityLogs
};