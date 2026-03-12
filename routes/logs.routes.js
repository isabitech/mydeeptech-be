const express = require('express');
const {
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
} = require('../controllers/log.controller');

const router = express.Router();

// Log Routes

/**
 * @route GET /api/logs
 * @desc Get logs with filtering
 * @access Private
 */
router.get('/', getAllLogs);

/**
 * @route GET /api/logs/search
 * @desc Search logs
 * @access Private
 */
router.get('/search', searchLogs);

/**
 * @route GET /api/logs/errors
 * @desc Get error logs
 * @access Private
 */
router.get('/errors', getErrorLogs);

/**
 * @route GET /api/logs/security
 * @desc Get security logs
 * @access Private
 */
router.get('/security', getSecurityLogs);

/**
 * @route GET /api/logs/realtime
 * @desc Get real-time monitoring data
 * @access Private
 */
router.get('/realtime', getRealtimeData);

/**
 * @route GET /api/logs/export
 * @desc Export logs as CSV
 * @access Private
 */
router.get('/export', exportLogs);

/**
 * @route GET /api/logs/stats
 * @desc Get log statistics
 * @access Private
 */
router.get('/stats', getLogStats);

/**
 * @route GET /api/logs/performance
 * @desc Get performance metrics
 * @access Private
 */
router.get('/performance', getPerformanceMetrics);

/**
 * @route GET /api/logs/stream/user/:email
 * @desc Stream user logs in real-time
 * @access Private
 */
router.get('/stream/user/:email', streamUserLogs);

/**
 * @route GET /api/logs/stream/device/:device_id
 * @desc Stream device logs in real-time
 * @access Private
 */
router.get('/stream/device/:device_id', streamDeviceLogs);

/**
 * @route GET /api/logs/stream/errors
 * @desc Stream error logs in real-time
 * @access Private
 */
router.get('/stream/errors', streamErrorLogs);

/**
 * @route GET /api/logs/stream/security
 * @desc Stream security logs in real-time
 * @access Private
 */
router.get('/stream/security', streamSecurityLogs);

/**
 * @route GET /api/logs/device/:device_id
 * @desc Get device-specific logs
 * @access Private
 */
router.get('/device/:device_id', getDeviceLogs);

/**
 * @route GET /api/logs/user/:email
 * @desc Get user-specific logs
 * @access Private
 */
router.get('/user/:email', getUserLogs);

module.exports = router;