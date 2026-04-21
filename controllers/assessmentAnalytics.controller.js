const Joi = require('joi');
const AssessmentAnalyticsService = require('../services/assessmentAnalytics.service');

// Validation schemas
const analyticsQuerySchema = Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    assessmentId: Joi.string().optional(),
    projectId: Joi.string().optional(),
    period: Joi.string().valid('day', 'week', 'month', 'quarter', 'year').default('month'),
    granularity: Joi.string().valid('daily', 'weekly', 'monthly').default('daily')
});

/**
 * Get comprehensive assessment analytics dashboard
 */
const getAssessmentDashboard = async (req, res) => {
    try {
        const { error, value } = analyticsQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                details: error.details
            });
        }
        const data = await AssessmentAnalyticsService.getAssessmentDashboard(value);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching assessment dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch assessment analytics',
            error: error.message
        });
    }
};

/**
 * Get detailed video reel usage analytics
 */
const getReelAnalytics = async (req, res) => {
    try {
        const { error, value } = analyticsQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                details: error.details
            });
        }
        const data = await AssessmentAnalyticsService.getReelAnalytics(value);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching reel analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reel analytics',
            error: error.message
        });
    }
};

/**
 * Get user performance analytics
 */
const getUserPerformanceAnalytics = async (req, res) => {
    try {
        const { error, value } = analyticsQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                details: error.details
            });
        }
        const data = await AssessmentAnalyticsService.getUserPerformanceAnalytics(value);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching user performance analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user performance analytics',
            error: error.message
        });
    }
};

/**
 * Get QA review performance analytics
 */
const getQAAnalytics = async (req, res) => {
    try {
        const { error, value } = analyticsQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                details: error.details
            });
        }
        const data = await AssessmentAnalyticsService.getQAAnalytics(value);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching QA analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch QA analytics',
            error: error.message
        });
    }
};

/**
 * Export analytics data to CSV
 */
const exportAnalyticsCSV = async (req, res) => {
    try {
        const { type, ...queryParams } = req.query;
        
        if (!type || !['submissions', 'reels', 'users', 'qa'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid export type. Must be one of: submissions, reels, users, qa'
            });
        }

        const { csvData, filename } = await AssessmentAnalyticsService.exportAnalyticsCSV(type, queryParams);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvData.join('\n'));

    } catch (error) {
        console.error('Error exporting analytics CSV:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export analytics data',
            error: error.message
        });
    }
};

module.exports = {
    getAssessmentDashboard,
    getReelAnalytics,
    getUserPerformanceAnalytics,
    getQAAnalytics,
    exportAnalyticsCSV
};