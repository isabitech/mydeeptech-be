// routes/candidateTestSubmission.route.js
const express = require("express");
const router = express.Router();
const assessmentReviewController = require("../controllers/assessmentreview.controller");
const {
  validateCreateSubmission,
  validateUpdateSubmission,
  validateSubmissionId,
  validateUserIdParam,
} = require("../validations/assessmentreview.validation");
const { authenticateToken } = require("../middleware/auth");
const { authenticateAdmin } = require("../middleware/adminAuth");

router.post(
  "/",
  authenticateToken,
  validateCreateSubmission,
  assessmentReviewController.create,
);
router.get(
  "/",
  authenticateToken,
  authenticateAdmin,
  assessmentReviewController.getAll,
);
router.get("/user", authenticateToken, assessmentReviewController.getByUserId);
router.get(
  "/:id",
  authenticateToken,
  validateSubmissionId,
  assessmentReviewController.getById,
);
router.put(
  "/:id",
  authenticateToken,
  validateSubmissionId,
  validateUpdateSubmission,
  assessmentReviewController.update,
);
router.delete(
  "/:id",
  authenticateToken,
  authenticateAdmin,
  validateSubmissionId,

  assessmentReviewController.delete,
);

module.exports = router;
