const express = require('express');
const {
    getAllDevices,
    getDeviceById,
    createDevice,
    updateDevice,
    deleteDevice,
    sendDeviceCommand,
    getDeviceHubstaffStatus,
    getDeviceLogs
} = require('../controllers/device.controller');

const router = express.Router();

// Device Routes

/**
 * @route GET /api/devices
 * @desc List all devices
 * @access Private
 */
router.get('/', getAllDevices);

/**
 * @route GET /api/devices/:id
 * @desc Get device details
 * @access Private
 */
router.get('/:id', getDeviceById);

/**
 * @route POST /api/devices
 * @desc Register new device (manual)
 * @access Private
 */
router.post('/', createDevice);

/**
 * @route PUT /api/devices/:id
 * @desc Update device
 * @access Private
 */
router.put('/:id', updateDevice);

/**
 * @route DELETE /api/devices/:id
 * @desc Remove device
 * @access Private
 */
router.delete('/:id', deleteDevice);

/**
 * @route POST /api/devices/:id/command
 * @desc Send command to device
 * @access Private
 */
router.post('/:id/command', sendDeviceCommand);

/**
 * @route GET /api/devices/:id/hubstaff
 * @desc Get Hubstaff status for device
 * @access Private
 */
router.get('/:id/hubstaff', getDeviceHubstaffStatus);

/**
 * @route GET /api/devices/:id/logs
 * @desc Get device logs
 * @access Private
 */
router.get('/:id/logs', getDeviceLogs);

module.exports = router;