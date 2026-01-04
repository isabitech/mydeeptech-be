import assessmentAnalyticsService from '../services/assessmentAnalytics.service.js';
import { ResponseHandler } from '../utils/responseHandler.js';
import Joi from 'joi';

class AssessmentAnalyticsController {
    static analyticsQuerySchema = Joi.object({
        startDate: Joi.date().optional(),
        endDate: Joi.date().optional(),
        assessmentId: Joi.string().optional(),
        projectId: Joi.string().optional(),
        period: Joi.string().valid('day', 'week', 'month', 'quarter', 'year').default('month'),
        granularity: Joi.string().valid('daily', 'weekly', 'monthly').default('daily')
    });

    async getAssessmentDashboard(req, res) {
        try {
            const { error, value } = AssessmentAnalyticsController.analyticsQuerySchema.validate(req.query);
            if (error) return ResponseHandler.error(res, { statusCode: 400, message: 'Validation error', details: error.details.map(d => d.message) });

            const data = await assessmentAnalyticsService.getDashboard(value);
            return ResponseHandler.success(res, data, 'Assessment dashboard analytics retrieved successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async getReelAnalytics(req, res) {
        try {
            const data = await assessmentAnalyticsService.getReelAnalytics();
            return ResponseHandler.success(res, data, 'Video reel analytics retrieved successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async getUserPerformanceAnalytics(req, res) {
        try {
            const { error, value } = AssessmentAnalyticsController.analyticsQuerySchema.validate(req.query);
            if (error) return ResponseHandler.error(res, { statusCode: 400, message: 'Validation error', details: error.details.map(d => d.message) });

            const data = await assessmentAnalyticsService.getUserPerformance(value);
            return ResponseHandler.success(res, data, 'User performance analytics retrieved successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async getQAAnalytics(req, res) {
        try {
            const { error, value } = AssessmentAnalyticsController.analyticsQuerySchema.validate(req.query);
            if (error) return ResponseHandler.error(res, { statusCode: 400, message: 'Validation error', details: error.details.map(d => d.message) });

            const data = await assessmentAnalyticsService.getQAAnalytics(value);
            return ResponseHandler.success(res, data, 'QA analytics retrieved successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }
}

export default new AssessmentAnalyticsController();