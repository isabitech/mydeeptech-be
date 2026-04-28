const express = require("express");
const AiInterviewController = require("../controllers/aiInterview.controller");
const { authenticateAdmin } = require("../middleware/adminAuth");
const { rateLimiters } = require("../middleware/simpleRateLimit");

const router = express.Router();

router.use(authenticateAdmin);
router.use(rateLimiters.api);

router.get("/overview", AiInterviewController.getAdminOverview);
router.get("/", AiInterviewController.getAdminSessions);
router.get("/:sessionId", AiInterviewController.getAdminReport);
router.post("/schedule", AiInterviewController.scheduleInterview);
router.patch("/:sessionId/decision", AiInterviewController.updateAdminDecision);
router.patch("/:sessionId/note", AiInterviewController.updateAdminNote);

module.exports = router;
