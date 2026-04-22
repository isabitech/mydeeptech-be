const Joi = require("joi");
const AssessmentAnalyticsService = require("../services/assessmentAnalytics.service");

const analyticsQuerySchema = Joi.object({
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  assessmentId: Joi.string().optional(),
  projectId: Joi.string().optional(),
  period: Joi.string()
    .valid("day", "week", "month", "quarter", "year")
    .default("month"),
  granularity: Joi.string()
    .valid("daily", "weekly", "monthly")
    .default("daily"),
});

class AssessmentAnalyticsController {
  constructor() {
    const methods = Object.getOwnPropertyNames(
      AssessmentAnalyticsController.prototype,
    ).filter((m) => m !== "constructor");
    methods.forEach((m) => {
      this[m] = this[m].bind(this);
    });
  }

  _validateQuery(query) {
    return analyticsQuerySchema.validate(query);
  }

  _handleError(res, error, defaultMessage) {
    console.error(`${defaultMessage}:`, error);
    res
      .status(500)
      .json({ success: false, message: defaultMessage, error: error.message });
  }

  _validationError(res, error) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Validation error",
        details: error.details,
      });
  }

  async getAssessmentDashboard(req, res) {
    try {
      const { error, value } = this._validateQuery(req.query);
      if (error) return this._validationError(res, error);
      const data =
        await AssessmentAnalyticsService.getAssessmentDashboard(value);
      res.json({ success: true, data });
    } catch (error) {
      this._handleError(res, error, "Failed to fetch assessment analytics");
    }
  }

  async getReelAnalytics(req, res) {
    try {
      const { error, value } = this._validateQuery(req.query);
      if (error) return this._validationError(res, error);
      const data = await AssessmentAnalyticsService.getReelAnalytics(value);
      res.json({ success: true, data });
    } catch (error) {
      this._handleError(res, error, "Failed to fetch reel analytics");
    }
  }

  async getUserPerformanceAnalytics(req, res) {
    try {
      const { error, value } = this._validateQuery(req.query);
      if (error) return this._validationError(res, error);
      const data =
        await AssessmentAnalyticsService.getUserPerformanceAnalytics(value);
      res.json({ success: true, data });
    } catch (error) {
      this._handleError(
        res,
        error,
        "Failed to fetch user performance analytics",
      );
    }
  }

  async getQAAnalytics(req, res) {
    try {
      const { error, value } = this._validateQuery(req.query);
      if (error) return this._validationError(res, error);
      const data = await AssessmentAnalyticsService.getQAAnalytics(value);
      res.json({ success: true, data });
    } catch (error) {
      this._handleError(res, error, "Failed to fetch QA analytics");
    }
  }

  async exportAnalyticsCSV(req, res) {
    try {
      const { type, ...queryParams } = req.query;
      if (!type || !["submissions", "reels", "users", "qa"].includes(type)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid export type. Must be one of: submissions, reels, users, qa",
        });
      }
      const { csvData, filename } =
        await AssessmentAnalyticsService.exportAnalyticsCSV(type, queryParams);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.send(csvData.join("\n"));
    } catch (error) {
      this._handleError(res, error, "Failed to export analytics data");
    }
  }
}

module.exports = new AssessmentAnalyticsController();
