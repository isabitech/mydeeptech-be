const AssessmentService = require('../services/assessment.service');

const handleError = (res, error, defaultMessage = "Failed operation") => {
  res.status(error.status || 500).json({
    success: false,
    message: error.status && error.status < 500 ? error.message : defaultMessage,
    error: error.errors || error.message
  });
};

const getAssessmentQuestions = async (req, res) => {
  try {
    const result = await AssessmentService.getAssessmentQuestions({
      userId: req.user?.userId || req.userId,
      questionsPerSection: req.query.questionsPerSection,
      language: req.query.language
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) { handleError(res, error, "Failed to fetch assessment questions"); }
};

const submitAssessment = async (req, res) => {
  try {
    const result = await AssessmentService.submitAssessment({
      userId: req.user?.userId || req?.userId,
      body: req.body,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) { handleError(res, error, "Failed to submit assessment"); }
};

const getUserAssessmentHistory = async (req, res) => {
  try {
    const result = await AssessmentService.getUserAssessmentHistory({
      userId: req.user?.userId || req.userId,
      query: req.query
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) { handleError(res, error, "Failed to fetch assessment history"); }
};

const checkRetakeEligibility = async (req, res) => {
  try {
    const result = await AssessmentService.checkRetakeEligibility({
      userId: req.user?.userId || req.userId,
      assessmentType: req.query.assessmentType
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) { handleError(res, error, "Failed to check retake eligibility"); }
};

const getAdminAssessments = async (req, res) => {
  try {
    const result = await AssessmentService.getAdminAssessments({
      query: req.query,
      isAdmin: !!req.admin
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) { handleError(res, error, "Failed to fetch assessments"); }
};

const getSectionStatistics = async (req, res) => {
  try {
    const result = await AssessmentService.getSectionStatistics({
      isAdmin: !!req.admin,
      requireAdminCheck: req.query.isAdmin === 'true' || req.query.isAdmin === true
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) { handleError(res, error, "Failed to fetch section statistics"); }
};

const getAllAssessments = async (req, res) => {
  try {
    const result = await AssessmentService.getAllAssessments({
      userId: req.user?.userId || req.userId
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) { handleError(res, error, "Failed to fetch available assessments"); }
};

const startAssessmentById = async (req, res) => {
  try {
    const result = await AssessmentService.startAssessmentById({
      userId: req.user?.userId || req.userId,
      assessmentId: req.params.assessmentId,
      query: req.query
    });
    
    if (result.delegate === "multimedia") {
      const { startAssessmentSession } = require('./multimediaAssessmentSession.controller');
      req.body = { assessmentId: req.params.assessmentId };
      return startAssessmentSession(req, res);
    }
    
    res.status(result.statusCode).json(result.body);
  } catch (error) { handleError(res, error, "Failed to start assessment"); }
};

const getAssessmentSubmissions = async (req, res) => {
  try {
    const result = await AssessmentService.getAssessmentSubmissions({
      assessmentId: req.params.assessmentId,
      query: req.query,
      requestingUserId: req.user?.userId || req.userId,
      isAdmin: !!req.admin
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) { handleError(res, error, "Failed to fetch assessment submissions"); }
};

const getAdminAssessmentsOverview = async (req, res) => {
  try {
    const result = await AssessmentService.getAdminAssessmentsOverview({
      isAdmin: !!req.admin
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) { handleError(res, error, "Failed to fetch admin assessments overview"); }
};

const getUserAssessmentsOverview = async (req, res) => {
  try {
    const result = await AssessmentService.getUserAssessmentsOverview({
      userId: req.user?.userId || req.userId
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) { handleError(res, error, "Failed to fetch user assessments overview"); }
};

module.exports = {
  getAssessmentQuestions,
  submitAssessment,
  getUserAssessmentHistory,
  checkRetakeEligibility,
  getAdminAssessments,
  getSectionStatistics,
  getAllAssessments,
  startAssessmentById,
  getAssessmentSubmissions,
  getAdminAssessmentsOverview,
  getUserAssessmentsOverview
};