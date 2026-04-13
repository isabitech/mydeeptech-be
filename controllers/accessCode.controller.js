const mongoose = require('mongoose');
const AccessCodeService = require('../services/accessCode.service');

/**
 * Get all access codes
 */
const getAllAccessCodes = async (req, res) => {
    try {
        const queryParams = {
            ...req.query,
            userId: req.user?.id,
            ipAddress: req.ip
        };
        
        const result = await AccessCodeService.getAllAccessCodes(queryParams);
        
        res.status(200).json({
            success: true,
            message: 'Access codes retrieved successfully',
            error: null,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve access codes',
            error: error.message,
            data: null
        });
    }
};

/**
 * Generate new access code
 */
const generateAccessCode = async (req, res) => {
    try {
        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        };

        // Set the generator
        const codeData = {
            ...req.body,
            generatedBy: req.user?.id
        };

        const accessCode = await AccessCodeService.generateAccessCode(codeData, requestContext);
        
        res.status(201).json({
            success: true,
            message: 'Access code generated successfully',
            error: null,
            data: accessCode
        });
    } catch (error) {
        const statusCode = error.message.includes('required') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to generate access code',
            error: error.message,
            data: null
        });
    }
};

/**
 * Validate access code
 */
const validateAccessCode = async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Access code is required',
                error: 'ValidationError',
                data: null
            });
        }

        const validationContext = {
            userId: req.user?.id,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            deviceInfo: req.get('User-Agent') // Could be enhanced with more device info
        };

        const result = await AccessCodeService.validateAccessCode(code, validationContext);
        
        const statusCode = result.valid ? 200 : (result.code || 403);
        
        res.status(statusCode).json({
            success: result.valid,
            message: result.valid ? 'Access code is valid' : result.reason,
            error: result.valid ? null : result.reason,
            data: result.valid ? result.accessCode : null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to validate access code',
            error: error.message,
            data: null
        });
    }
};

/**
 * Revoke access code
 */
const revokeAccessCode = async (req, res) => {
    try {
        const { code } = req.params;
        const { reason, isEmergency = false } = req.body;
        
        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip
            }
        };

        const result = await AccessCodeService.revokeAccessCode(
            code,
            req.user?.id,
            reason,
            isEmergency,
            requestContext
        );
        
        res.status(200).json({
            success: true,
            message: 'Access code revoked successfully',
            error: null,
            data: result
        });
    } catch (error) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to revoke access code',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get usage history for access code
 */
const getUsageHistory = async (req, res) => {
    try {
        const { code } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        
        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip
            }
        };

        const history = await AccessCodeService.getUsageHistory(code, limit, requestContext);
        
        res.status(200).json({
            success: true,
            message: 'Usage history retrieved successfully',
            error: null,
            data: {
                code,
                usage: history,
                total: history.length
            }
        });
    } catch (error) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to retrieve usage history',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get access code statistics
 */
const getAccessCodeStats = async (req, res) => {
    try {
        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip
            }
        };

        const stats = await AccessCodeService.getAccessCodeStatistics(requestContext);
        
        res.status(200).json({
            success: true,
            message: 'Access code statistics retrieved successfully',
            error: null,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve access code statistics',
            error: error.message,
            data: null
        });
    }
};

/**
 * Get expiring codes
 */
const getExpiringCodes = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        
        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip
            }
        };

        const codes = await AccessCodeService.getExpiringCodes(days, requestContext);
        
        res.status(200).json({
            success: true,
            message: 'Expiring codes retrieved successfully',
            error: null,
            data: {
                expiringIn: days,
                codes,
                total: codes.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve expiring codes',
            error: error.message,
            data: null
        });
    }
};

/**
 * Bulk revoke access codes
 */
const bulkRevokeAccessCodes = async (req, res) => {
    try {
        const { codeIds, reason } = req.body;
        
        if (!Array.isArray(codeIds) || codeIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Code IDs array is required',
                error: 'ValidationError',
                data: null
            });
        }

        const requestContext = {
            user: {
                id: req.user?.id,
                ipAddress: req.ip
            }
        };

        const result = await AccessCodeService.bulkRevokeAccessCodes(
            codeIds,
            req.user?.id,
            reason,
            requestContext
        );
        
        res.status(200).json({
            success: true,
            message: `Successfully revoked ${result.modifiedCount} access codes`,
            error: null,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to bulk revoke access codes',
            error: error.message,
            data: null
        });
    }
};

module.exports = {
    getAllAccessCodes,
    generateAccessCode,
    validateAccessCode,
    revokeAccessCode,
    getUsageHistory,
    getAccessCodeStats,
    getExpiringCodes,
    bulkRevokeAccessCodes
};