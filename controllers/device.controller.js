const mongoose = require('mongoose');
const DeviceService = require('../services/device.service');

/**
 * Get all devices
 */
const getAllDevices = async (req, res) => {
    try {
        const queryParams = {
            ...req.query,
            userId: req.user?.id,
            ipAddress: req.ip
        };
        
        const result = await DeviceService.getAllDevices(queryParams);
        
        res.status(200).json({
            success: true,
            message: 'Devices retrieved successfully',
            error: null,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve devices',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get device by ID
 */
const getDeviceById = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid device ID',
                error: 'CastError',
                data: null
            });
        }

        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        };

        const device = await DeviceService.getDeviceById(req.params.id, requestContext);
        
        res.status(200).json({
            success: true,
            message: 'Device retrieved successfully',
            error: null,
            data: device
        });
    } catch (error) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to retrieve device',
            error: error.message,
            data: null
        });
    }
};

/**
 * Create new device
 */
const createDevice = async (req, res) => {
    try {
        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        };

        const device = await DeviceService.createDevice(req.body, requestContext);
        
        res.status(201).json({
            success: true,
            message: 'Device created successfully',
            error: null,
            data: device
        });
    } catch (error) {
        const statusCode = error.message.includes('required') || error.message.includes('validation') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to create device',
            error: error.message,
            data: null
        });
    }
};

/**
 * Update device
 */
const updateDevice = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid device ID',
                error: 'CastError',
                data: null
            });
        }

        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        };

        const device = await DeviceService.updateDevice(req.params.id, req.body, requestContext);
        
        res.status(200).json({
            success: true,
            message: 'Device updated successfully',
            error: null,
            data: device
        });
    } catch (error) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to update device',
            error: error.message,
            data: null
        });
    }
};

/**
 * Delete device
 */
const deleteDevice = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid device ID',
                error: 'CastError',
                data: null
            });
        }

        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        };

        const result = await DeviceService.deleteDevice(req.params.id, requestContext);
        
        res.status(200).json({
            success: true,
            message: result.message,
            error: null,
            data: result.device
        });
    } catch (error) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to delete device',
            error: error.message,
            data: null
        });
    }
};

/**
 * Send command to device
 */
const sendDeviceCommand = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid device ID',
                error: 'CastError',
                data: null
            });
        }

        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        };

        const result = await DeviceService.sendDeviceCommand(req.params.id, req.body, requestContext);
        
        res.status(200).json({
            success: true,
            message: 'Command sent successfully',
            error: null,
            data: result
        });
    } catch (error) {
        const statusCode = error.message.includes('not found') || error.message.includes('not available') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to send command',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get device Hubstaff status
 */
const getDeviceHubstaffStatus = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid device ID',
                error: 'CastError',
                data: null
            });
        }

        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip
            }
        };

        const status = await DeviceService.getDeviceHubstaffStatus(req.params.id, requestContext);
        
        res.status(200).json({
            success: true,
            message: 'Hubstaff status retrieved successfully',
            error: null,
            data: status
        });
    } catch (error) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to retrieve Hubstaff status',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get device logs
 */
const getDeviceLogs = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid device ID',
                error: 'CastError',
                data: null
            });
        }

        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip
            }
        };

        const logs = await DeviceService.getDeviceLogs(req.params.id, req.query, requestContext);
        
        res.status(200).json({
            success: true,
            message: 'Device logs retrieved successfully',
            error: null,
            data: logs
        });
    } catch (error) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to retrieve device logs',
            error: error.message,
            data: null
        });
    }
};

module.exports = {
    getAllDevices,
    getDeviceById,
    createDevice,
    updateDevice,
    deleteDevice,
    sendDeviceCommand,
    getDeviceHubstaffStatus,
    getDeviceLogs
};