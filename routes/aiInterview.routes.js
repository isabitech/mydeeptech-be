const express = require("express");
const AiInterviewController = require("../controllers/aiInterview.controller");
const { authenticateToken } = require("../middleware/auth");
const { rateLimiters } = require("../middleware/simpleRateLimit");
const {
  resumeUpload,
  isCloudinaryConfigured,
} = require("../config/cloudinary");

const router = express.Router();

router.use(authenticateToken);
router.use(rateLimiters.user);

router.get("/overview", AiInterviewController.getCandidateOverview);
router.get("/tracks", AiInterviewController.getTracks);
router.get("/tracks/:trackId", AiInterviewController.getTrack);
router.post("/sessions", AiInterviewController.startSession);
router.get("/sessions/:sessionId", AiInterviewController.getSession);
router.patch("/sessions/:sessionId/draft", AiInterviewController.saveDraft);
router.post("/sessions/:sessionId/answer", AiInterviewController.submitAnswer);
router.post(
  "/sessions/:sessionId/focus-events",
  AiInterviewController.submitFocusLossEvents,
);
router.get("/results/:sessionId", AiInterviewController.getResult);

router.post(
  "/uploads/resume",
  rateLimiters.upload,
  (req, res, next) => {
    if (!isCloudinaryConfigured) {
      return res.status(500).json({
        success: false,
        message:
          "File upload service is temporarily unavailable. Please try again later.",
        error: "CLOUDINARY_CONFIG_ERROR",
      });
    }

    const upload = resumeUpload.fields([
      { name: "resume", maxCount: 1 },
      { name: "cv", maxCount: 1 },
      { name: "document", maxCount: 1 },
      { name: "file", maxCount: 1 },
    ]);

    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
          error: err.code || "UPLOAD_ERROR",
        });
      }

      if (req.files) {
        const fileField =
          req.files.resume ||
          req.files.cv ||
          req.files.document ||
          req.files.file;
        if (fileField && fileField[0]) {
          req.file = fileField[0];
        }
      }

      next();
    });
  },
  AiInterviewController.uploadResume,
);

module.exports = router;
