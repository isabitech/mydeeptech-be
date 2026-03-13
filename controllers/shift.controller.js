const mongoose = require('mongoose');
const ShiftService = require('../services/shift.service');

/**
 * Get all shifts
 */
const getAllShifts = async (req, res) => {
    try {
        const queryParams = {
            ...req.query,
            userId: req.user?.id,
            ipAddress: req.ip
        };
        
        const result = await ShiftService.getAllShifts(queryParams);
        
        res.status(200).json({
            success: true,
            message: 'Shifts retrieved successfully',
            error: null,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve shifts',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get active shifts
 */
const getActiveShifts = async (req, res) => {
    try {
        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip
            }
        };

        const shifts = await ShiftService.getActiveShifts(requestContext);
        
        res.status(200).json({
            success: true,
            message: 'Active shifts retrieved successfully',
            error: null,
            data: shifts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve active shifts',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get calendar view of shifts
 */
const getCalendarShifts = async (req, res) => {
    try {
        const { month } = req.params;
        const year = new Date().getFullYear(); // or from query params
        
        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip
            }
        };

        const result = await ShiftService.getCalendarShifts(year, parseInt(month), requestContext);
        
        res.status(200).json({
            success: true,
            message: 'Calendar shifts retrieved successfully',
            error: null,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve calendar shifts',
            error: error.message,
            data: null
        });
    }
};

/**
 * Create new shift
 */
const createShift = async (req, res) => {
    try {
        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        };

        const shift = await ShiftService.createShift(req.body, requestContext);
        
        res.status(201).json({
            success: true,
            message: 'Shift created successfully',
            error: null,
            data: shift
        });
    } catch (error) {
        const statusCode = error.message.includes('required') || error.message.includes('conflicts') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to create shift',
            error: error.message,
            data: null
        });
    }
};

/**
 * Update shift
 */
const updateShift = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid shift ID',
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

        const shift = await ShiftService.updateShift(req.params.id, req.body, requestContext);
        
        res.status(200).json({
            success: true,
            message: 'Shift updated successfully',
            error: null,
            data: shift
        });
    } catch (error) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to update shift',
            error: error.message,
            data: null
        });
    }
};

/**
 * Delete shift
 */
const deleteShift = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid shift ID',
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

        const result = await ShiftService.deleteShift(req.params.id, requestContext);
        
        res.status(200).json({
            success: true,
            message: result.message,
            error: null,
            data: result.shift
        });
    } catch (error) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to delete shift',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get shifts by device
 */
const getShiftsByDevice = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.device_id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid device ID',
                error: 'CastError',
                data: null
            });
        }

        const { startDate, endDate } = req.query;
        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip
            }
        };

        const shifts = await ShiftService.getShiftsByDevice(
            req.params.device_id,
            startDate,
            endDate,
            requestContext
        );
        
        res.status(200).json({
            success: true,
            message: 'Device shifts retrieved successfully',
            error: null,
            data: shifts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve device shifts',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get shifts by user
 */
const getShiftsByUser = async (req, res) => {
    try {
        const { email } = req.params;
        const { startDate, endDate } = req.query;
        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip
            }
        };

        const shifts = await ShiftService.getShiftsByUser(
            email,
            startDate,
            endDate,
            requestContext
        );
        
        res.status(200).json({
            success: true,
            message: 'User shifts retrieved successfully',
            error: null,
            data: shifts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user shifts',
            error: error.message,
            data: null
        });
    }
};

module.exports = {
    getAllShifts,
    getActiveShifts,
    getCalendarShifts,
    createShift,
    updateShift,
    deleteShift,
    getShiftsByDevice,
    getShiftsByUser
};