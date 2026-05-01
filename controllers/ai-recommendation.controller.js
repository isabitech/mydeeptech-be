const aiRecommendationService = require("../services/ai-recommendation.service");
const { validationResult } = require("express-validator");

/**
 * Get AI-powered annotator recommendations for a project
 * @route GET /api/ai-recommendations/projects/:projectId/annotators
 */
const getAnnotatorRecommendations = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array()
      });
    }

    const { projectId } = req.params;
    const { maxRecommendations = 10 } = req.query;

    const recommendations = await aiRecommendationService.getAnnotatorRecommendations(
      projectId, 
      parseInt(maxRecommendations)
    );

    return res.status(200).json({
      success: true,
      message: "Annotator recommendations generated successfully",
      data: recommendations
    });

  } catch (error) {
    console.error("Error getting annotator recommendations:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate recommendations",
      error: error.message
    });
  }
};

/**
 * Send bulk invitation emails to recommended annotators
 * @route POST /api/ai-recommendations/projects/:projectId/send-invitations
 */
const sendBulkInvitations = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array()
      });
    }

    const { projectId } = req.params;
    const { annotatorIds, customMessage } = req.body;

    if (!Array.isArray(annotatorIds) || annotatorIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
        error: "annotatorIds must be a non-empty array"
      });
    }

    const results = await aiRecommendationService.sendBulkInvitations(
      projectId,
      annotatorIds,
      customMessage
    );

    return res.status(200).json({
      success: true,
      message: "Bulk invitations sent",
      data: {
        summary: `Successfully sent ${results.successful} out of ${results.total} invitations`,
        details: results
      }
    });

  } catch (error) {
    console.error("Error sending bulk invitations:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send invitations",
      error: error.message
    });
  }
};

/**
 * Get AI recommendation service status and configuration
 * @route GET /api/ai-recommendations/status
 */
const getRecommendationStatus = async (req, res) => {
  try {
    const status = {
      aiConfigured: aiRecommendationService.llmProvider.isConfigured(),
      promptVersion: aiRecommendationService.llmProvider.getPromptVersion(),
      service: "AI Recommendation Service",
      version: "1.0.0",
      capabilities: [
        "Annotator skill matching",
        "Domain expertise analysis", 
        "Language compatibility scoring",
        "Experience level assessment",
        "Bulk email invitations"
      ]
    };

    return res.status(200).json({
      success: true,
      message: "AI recommendation service status",
      data: status
    });

  } catch (error) {
    console.error("Error getting recommendation status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get service status",
      error: error.message
    });
  }
};

module.exports = {
  getAnnotatorRecommendations,
  sendBulkInvitations,
  getRecommendationStatus
};