const mongoose = require('mongoose');
const ShiftService = require('../services/shift.service');
const AccessCodeService = require('../services/accessCode.service');
const LogService = require('../services/log.service');
const DeviceService = require('../services/device.service');

/**
 * Get user sessions
 */
const getUserSessions = async (req, res) => {
    try {
        const { email } = req.params;
        const { startDate, endDate, limit } = req.query;
        
        // This would typically come from a session management service
        // For now, we'll return shift data as sessions
        const sessions = await ShiftService.getShiftsByUser(email, startDate, endDate);
        
        res.status(200).json({
            success: true,
            message: 'User sessions retrieved successfully',
            error: null,
            data: {
                userEmail: email,
                sessions: sessions.map(shift => ({
                    id: shift._id,
                    startTime: shift.actualStartTime || shift.startTime,
                    endTime: shift.actualEndTime || shift.endTime,
                    device: shift.device,
                    status: shift.status,
                    duration: shift.actualDuration || shift.duration
                })),
                total: sessions.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user sessions',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get user statistics
 */
const getUserStats = async (req, res) => {
    try {
        const { email } = req.params;
        const { startDate, endDate } = req.query;
        
        // Get user shifts for statistics
        const shifts = await ShiftService.getShiftsByUser(email, startDate, endDate);
        
        // Get user logs for activity statistics
        const logs = await LogService.getUserLogs(email, startDate, endDate, 1000);
        
        // Calculate statistics
        const stats = {
            shifts: {
                total: shifts.length,
                completed: shifts.filter(s => s.status === 'completed').length,
                active: shifts.filter(s => s.status === 'active').length,
                cancelled: shifts.filter(s => s.status === 'cancelled').length,
                totalHours: shifts.reduce((acc, shift) => {
                    if (shift.actualDuration) {
                        return acc + (shift.actualDuration / 60); // Convert minutes to hours
                    }
                    return acc;
                }, 0)
            },
            activity: {
                totalLogs: logs.length,
                errorLogs: logs.filter(l => ['error', 'fatal'].includes(l.level)).length,
                lastActivity: logs.length > 0 ? logs[0].createdAt : null,
                devicesUsed: [...new Set(logs.filter(l => l.device?.id).map(l => l.device.id))].length
            },
            period: {
                startDate: startDate || null,
                endDate: endDate || null
            }
        };
        
        res.status(200).json({
            success: true,
            message: 'User statistics retrieved successfully',
            error: null,
            data: {
                userEmail: email,
                statistics: stats
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user statistics',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get all users (list)
 */
const getAllUsers = async (req, res) => {
    try {
        // This would typically come from the existing user service
        // For now, return a simplified response
        const users = []; // Would call UserService.getAllUsers(req.query)
        
        res.status(200).json({
            success: true,
            message: 'Users retrieved successfully',
            error: null,
            data: {
                users,
                pagination: {
                    total: users.length,
                    page: 1,
                    pages: 1,
                    limit: 50
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve users',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get user by email
 */
const getUserByEmail = async (req, res) => {
    try {
        const { email } = req.params;
        
        // This would typically come from the existing user service
        // For now, return a simplified response
        const user = null; // Would call UserService.getUserByEmail(email)
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                error: 'NotFound',
                data: null
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'User retrieved successfully',
            error: null,
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user',
            error: error.message,
            data: null
        });
    }
};

/**
 * Create user
 */
const createUser = async (req, res) => {
    try {
        // This would typically call the existing user service
        const userData = req.body;
        
        // Validate required fields
        if (!userData.email || !userData.firstname || !userData.lastname) {
            return res.status(400).json({
                success: false,
                message: 'Email, first name, and last name are required',
                error: 'ValidationError',
                data: null
            });
        }
        
        // const user = await UserService.createUser(userData);
        const user = userData; // Placeholder
        
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            error: null,
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to create user',
            error: error.message,
            data: null
        });
    }
};

/**
 * Update user
 */
const updateUser = async (req, res) => {
    try {
        const { email } = req.params;
        const updateData = req.body;
        
        // This would typically call the existing user service
        // const user = await UserService.updateUser(email, updateData);
        const user = { email, ...updateData }; // Placeholder
        
        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            error: null,
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update user',
            error: error.message,
            data: null
        });
    }
};

/**
 * Deactivate user
 */
const deactivateUser = async (req, res) => {
    try {
        const { email } = req.params;
        
        // This would typically call the existing user service
        // await UserService.deactivateUser(email);
        
        res.status(200).json({
            success: true,
            message: 'User deactivated successfully',
            error: null,
            data: { email, status: 'deactivated' }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to deactivate user',
            error: error.message,
            data: null
        });
    }
};

module.exports = {
    getAllUsers,
    getUserByEmail,
    createUser,
    updateUser,
    deactivateUser,
    getUserSessions,
    getUserStats
};