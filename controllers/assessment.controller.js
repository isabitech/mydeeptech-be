const AssessmentService = require("../services/assessment.service");

class AssessmentController {
  constructor() {
    const methods = Object.getOwnPropertyNames(
      AssessmentController.prototype,
    ).filter((m) => m !== "constructor");
    methods.forEach((m) => {
      this[m] = this[m].bind(this);
    });
  }

  _handleError(res, error, defaultMessage = "Failed operation") {
    res.status(error.status || 500).json({
      success: false,
      message:
        error.status && error.status < 500 ? error.message : defaultMessage,
      error: error.errors || error.message,
    });
  }

  _getUserId(req) {
    return req.user?.userId || req.userId;
  }

  async getAssessmentQuestions(req, res) {
    try {
      const result = await AssessmentService.getAssessmentQuestions({
        userId: this._getUserId(req),
        questionsPerSection: req.query.questionsPerSection,
        language: req.query.language,
      });
      res.status(result.statusCode).json(result.body);
    } catch (error) {
      this._handleError(res, error, "Failed to fetch assessment questions");
    }
  }

  async submitAssessment(req, res) {
    try {
      const result = await AssessmentService.submitAssessment({
        userId: this._getUserId(req),
        body: req.body,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get("User-Agent"),
      });
      res.status(result.statusCode).json(result.body);
    } catch (error) {
      this._handleError(res, error, "Failed to submit assessment");
    }
  }

  async getUserAssessmentHistory(req, res) {
    try {
      const result = await AssessmentService.getUserAssessmentHistory({
        userId: this._getUserId(req),
        query: req.query,
      });
      res.status(result.statusCode).json(result.body);
    } catch (error) {
      this._handleError(res, error, "Failed to fetch assessment history");
    }
  }

  async checkRetakeEligibility(req, res) {
    try {
      const result = await AssessmentService.checkRetakeEligibility({
        userId: this._getUserId(req),
        assessmentType: req.query.assessmentType,
      });
      res.status(result.statusCode).json(result.body);
    } catch (error) {
      this._handleError(res, error, "Failed to check retake eligibility");
    }
  }

  async getAdminAssessments(req, res) {
    try {
      const result = await AssessmentService.getAdminAssessments({
        query: req.query,
        isAdmin: !!req.admin,
      });
      res.status(result.statusCode).json(result.body);
    } catch (error) {
      this._handleError(res, error, "Failed to fetch assessments");
    }
  }

  async getSectionStatistics(req, res) {
    try {
      const result = await AssessmentService.getSectionStatistics({
        isAdmin: !!req.admin,
        requireAdminCheck:
          req.query.isAdmin === "true" || req.query.isAdmin === true,
      });
      res.status(result.statusCode).json(result.body);
    } catch (error) {
      this._handleError(res, error, "Failed to fetch section statistics");
    }
  }

  async getAllAssessments(req, res) {
    try {
      const result = await AssessmentService.getAllAssessments({
        userId: this._getUserId(req),
      });
      res.status(result.statusCode).json(result.body);
    } catch (error) {
      this._handleError(res, error, "Failed to fetch available assessments");
    }
  }

  async startAssessmentById(req, res) {
    try {
      const result = await AssessmentService.startAssessmentById({
        userId: this._getUserId(req),
        assessmentId: req.params.assessmentId,
        query: req.query,
      });

      if (result.delegate === "multimedia") {
        const {
          startAssessmentSession,
        } = require("./multimediaAssessmentSession.controller");
        req.body = { assessmentId: req.params.assessmentId };
        return startAssessmentSession(req, res);
      }

      res.status(result.statusCode).json(result.body);
    } catch (error) {
      this._handleError(res, error, "Failed to start assessment");
    }
  }

  async getAssessmentSubmissions(req, res) {
    try {
      const result = await AssessmentService.getAssessmentSubmissions({
        assessmentId: req.params.assessmentId,
        query: req.query,
        requestingUserId: this._getUserId(req),
        isAdmin: !!req.admin,
      });
      res.status(result.statusCode).json(result.body);
    } catch (error) {
      this._handleError(res, error, "Failed to fetch assessment submissions");
    }
  }

  async getAdminAssessmentsOverview(req, res) {
    try {
      const result = await AssessmentService.getAdminAssessmentsOverview({
        isAdmin: !!req.admin,
      });
      res.status(result.statusCode).json(result.body);
    } catch (error) {
      this._handleError(
        res,
        error,
        "Failed to fetch admin assessments overview",
      );
    }
  }

  async getUserAssessmentsOverview(req, res) {
    try {
      const result = await AssessmentService.getUserAssessmentsOverview({
        userId: this._getUserId(req),
      });
      res.status(result.statusCode).json(result.body);
    } catch (error) {
      this._handleError(
        res,
        error,
        "Failed to fetch user assessments overview",
      );
    }
  }
}

module.exports = new AssessmentController();
