const express = require("express");
const { body, param, query } = require("express-validator");
const marketingController = require("../controllers/marketing.controller");
const { authenticateAdmin } = require("../middleware/adminAuth");
const { rateLimiters } = require("../middleware/simpleRateLimit");

const router = express.Router();

const marketingStatusValues = [
  "pending",
  "submitted",
  "verified",
  "approved",
  "rejected",
];
const qaStatusValues = ["pending", "approved", "rejected"];
const deliveryProviders = ["mailjet"];
const audienceTypes = ["dtusers", "custom_emails"];

const validateCustomRecipients = (customRecipients) => {
  if (!Array.isArray(customRecipients) || customRecipients.length === 0) {
    throw new Error(
      "audience.customRecipients must be a non-empty array when audience.type is custom_emails",
    );
  }

  customRecipients.forEach((recipient, index) => {
    if (typeof recipient === "string") {
      const email = String(recipient).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error(`audience.customRecipients[${index}] must be a valid email`);
      }
      return;
    }

    if (!recipient || typeof recipient !== "object") {
      throw new Error(
        `audience.customRecipients[${index}] must be an email string or an object`,
      );
    }

    const email = String(recipient.email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(
        `audience.customRecipients[${index}].email must be a valid email`,
      );
    }
  });

  return true;
};

const audienceValidation = [
  body("audience")
    .isObject()
    .withMessage("audience is required"),

  body("audience.type")
    .isIn(audienceTypes)
    .withMessage("audience.type must be either 'dtusers' or 'custom_emails'"),

  body("audience.verifiedOnly")
    .optional()
    .isBoolean()
    .withMessage("audience.verifiedOnly must be a boolean"),

  body("audience.dtUserIds")
    .optional()
    .isArray()
    .withMessage("audience.dtUserIds must be an array"),

  body("audience.dtUserIds.*")
    .optional()
    .isMongoId()
    .withMessage("Each audience.dtUserIds value must be a valid Mongo ID"),

  body("audience.filters")
    .optional()
    .isObject()
    .withMessage("audience.filters must be an object"),

  body("audience.filters.annotatorStatus")
    .optional()
    .isIn(marketingStatusValues)
    .withMessage("audience.filters.annotatorStatus is invalid"),

  body("audience.filters.microTaskerStatus")
    .optional()
    .isIn(marketingStatusValues)
    .withMessage("audience.filters.microTaskerStatus is invalid"),

  body("audience.filters.qaStatus")
    .optional()
    .isIn(qaStatusValues)
    .withMessage("audience.filters.qaStatus is invalid"),

  body("audience.filters.country")
    .optional()
    .isString()
    .withMessage("audience.filters.country must be a string")
    .isLength({ max: 100 })
    .withMessage("audience.filters.country must not exceed 100 characters"),

  body().custom((_, { req }) => {
    if (req.body?.audience?.type !== "custom_emails") {
      return true;
    }

    return validateCustomRecipients(req.body?.audience?.customRecipients);
  }),
];

const countryOptionsQueryValidation = [
  query("verifiedOnly")
    .optional()
    .isBoolean()
    .withMessage("verifiedOnly must be a boolean"),

  query("annotatorStatus")
    .optional()
    .isIn([...marketingStatusValues, "all"])
    .withMessage("annotatorStatus is invalid"),

  query("microTaskerStatus")
    .optional()
    .isIn([...marketingStatusValues, "all"])
    .withMessage("microTaskerStatus is invalid"),

  query("qaStatus")
    .optional()
    .isIn([...qaStatusValues, "all"])
    .withMessage("qaStatus is invalid"),
];

const sendCampaignValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("name is required")
    .isLength({ max: 120 })
    .withMessage("name must not exceed 120 characters"),

  body("subject")
    .trim()
    .notEmpty()
    .withMessage("subject is required")
    .isLength({ max: 200 })
    .withMessage("subject must not exceed 200 characters"),

  body("htmlContent")
    .optional()
    .isString()
    .withMessage("htmlContent must be a string"),

  body("textContent")
    .optional()
    .isString()
    .withMessage("textContent must be a string"),

  body()
    .custom((_, { req }) => {
      if (!req.body?.htmlContent && !req.body?.textContent) {
        throw new Error("Either htmlContent or textContent is required");
      }

      return true;
    }),

  body("sender")
    .optional()
    .isObject()
    .withMessage("sender must be an object"),

  body("sender.email")
    .optional()
    .isEmail()
    .withMessage("sender.email must be a valid email"),

  body("sender.name")
    .optional()
    .isString()
    .isLength({ max: 120 })
    .withMessage("sender.name must be a string with maximum 120 characters"),

  body("delivery")
    .optional()
    .isObject()
    .withMessage("delivery must be an object"),

  body("delivery.provider")
    .optional()
    .isIn(deliveryProviders)
    .withMessage("delivery.provider must be 'mailjet'"),

  body("delivery.batchSize")
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage("delivery.batchSize must be between 1 and 200"),

  body("delivery.delayBetweenBatchesMs")
    .optional()
    .isInt({ min: 0, max: 60000 })
    .withMessage("delivery.delayBetweenBatchesMs must be between 0 and 60000"),

  ...audienceValidation,
];

const campaignIdValidation = [
  param("campaignId")
    .isMongoId()
    .withMessage("campaignId must be a valid Mongo ID"),
];

router.use(authenticateAdmin);
router.use(rateLimiters.api);

router.get(
  "/audience/countries",
  countryOptionsQueryValidation,
  marketingController.getAudienceCountryOptions,
);
router.post("/campaigns/preview", audienceValidation, marketingController.previewAudience);
router.post("/campaigns/send", sendCampaignValidation, marketingController.sendCampaign);
router.get("/campaigns", marketingController.getCampaigns);
router.get(
  "/campaigns/:campaignId",
  campaignIdValidation,
  marketingController.getCampaignById,
);

module.exports = router;
