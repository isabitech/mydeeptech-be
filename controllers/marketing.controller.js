const { validationResult } = require("express-validator");
const marketingService = require("../services/marketing.service");

class MarketingController {
  getErrorStatusCode(error) {
    const errorMessage = String(error?.message || "").toLowerCase();

    if (
      errorMessage.includes("not found")
    ) {
      return 404;
    }

    if (
      errorMessage.includes("no recipients") ||
      errorMessage.includes("unsupported audience")
    ) {
      return 400;
    }

    return 500;
  }

  async previewAudience(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const preview = await marketingService.previewAudience(req.body.audience);

      return res.status(200).json({
        success: true,
        message: "Marketing audience preview generated successfully",
        data: preview,
      });
    } catch (error) {
      console.error("Error generating marketing audience preview:", error);
      return res.status(this.getErrorStatusCode(error)).json({
        success: false,
        message: error.message || "Failed to preview marketing audience",
      });
    }
  }

  async getAudienceCountryOptions(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const countryOptions = await marketingService.getAudienceCountryOptions(
        req.query,
      );

      return res.status(200).json({
        success: true,
        message: "Marketing country options retrieved successfully",
        data: countryOptions,
      });
    } catch (error) {
      console.error("Error fetching marketing country options:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch marketing country options",
      });
    }
  }

  async sendCampaign(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const campaign = await marketingService.createAndQueueCampaign(
        req.body,
        req.admin,
      );

      return res.status(202).json({
        success: true,
        message: "Marketing campaign created and queued for delivery",
        data: campaign,
      });
    } catch (error) {
      console.error("Error creating marketing campaign:", error);
      return res.status(this.getErrorStatusCode(error)).json({
        success: false,
        message: error.message || "Failed to create marketing campaign",
      });
    }
  }

  async getCampaigns(req, res) {
    try {
      const campaigns = await marketingService.getCampaigns(req.query);

      return res.status(200).json({
        success: true,
        message: "Marketing campaigns retrieved successfully",
        data: campaigns,
      });
    } catch (error) {
      console.error("Error fetching marketing campaigns:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch marketing campaigns",
      });
    }
  }

  async getCampaignById(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const campaign = await marketingService.getCampaignById(req.params.campaignId);

      return res.status(200).json({
        success: true,
        message: "Marketing campaign retrieved successfully",
        data: campaign,
      });
    } catch (error) {
      console.error("Error fetching marketing campaign:", error);
      return res.status(this.getErrorStatusCode(error)).json({
        success: false,
        message: error.message || "Failed to fetch marketing campaign",
      });
    }
  }
}

module.exports = new MarketingController();
