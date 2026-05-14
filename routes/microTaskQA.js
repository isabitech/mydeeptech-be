const express = require("express");
const router = express.Router();
const microTaskQAController = require("../controllers/microTaskQA.controller");
const { body, param } = require("express-validator");
const { authenticateToken } = require("../middleware/auth");
const {
  requireRole,
  requireApprovedQAOrAdmin,
} = require("../middleware/permission-role.middleware");

// Validation rules
const submissionIdValidation = [
  param("submissionId")
    .isMongoId()
    .withMessage("Invalid submission ID")
];

const imageIdValidation = [
  param("imageId")
    .isMongoId()
    .withMessage("Invalid image ID")
];

const imageReviewValidation = [
  body("status")
    .isIn(["approved", "rejected", "needs_replacement"])
    .withMessage("Status must be 'approved', 'rejected', or 'needs_replacement'"),
  
  body("rejection_reason")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Rejection reason must not exceed 500 characters"),
  
  body("quality_notes")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Quality notes must not exceed 1000 characters")
];

const submissionReviewValidation = [
  body("status")
    .isIn(["approved", "rejected", "partially_rejected"])
    .withMessage("Status must be 'approved', 'rejected', or 'partially_rejected'"),
  
  body("quality_score")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Quality score must be between 0 and 100"),
  
  body("review_notes")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Review notes must not exceed 2000 characters"),
  
  body("rejected_slots")
    .optional()
    .isArray()
    .withMessage("Rejected slots must be an array"),
  
  body("rejected_slots.*.slotId")
    .optional()
    .isMongoId()
    .withMessage("Invalid slot ID in rejected_slots"),
  
  body("rejected_slots.*.reason")
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage("Rejection reason must be between 1 and 500 characters")
];

const bulkApprovalValidation = [
  body("submissionIds")
    .isArray({ min: 1 })
    .withMessage("submissionIds must be a non-empty array"),
  
  body("submissionIds.*")
    .isMongoId()
    .withMessage("Each submission ID must be a valid MongoDB ID")
];

const assignReviewerValidation = [
  body("reviewerId")
    .isMongoId()
    .withMessage("Invalid reviewer ID")
];

// QA Review routes
router.get("/queue", 
  authenticateToken, 
  requireApprovedQAOrAdmin(),
  microTaskQAController.getSubmissionsPendingReview
);

router.get("/queue/summary", 
  authenticateToken, 
  requireApprovedQAOrAdmin(),
  microTaskQAController.getReviewQueueSummary
);

router.get("/statistics", 
  authenticateToken, 
  requireApprovedQAOrAdmin(),
  microTaskQAController.getReviewStatistics
);

router.get("/submissions/:submissionId", 
  authenticateToken, 
  requireApprovedQAOrAdmin(),
  submissionIdValidation, 
  microTaskQAController.getSubmissionForReview
);

router.post("/images/:imageId/review", 
  authenticateToken, 
  requireApprovedQAOrAdmin(),
  imageIdValidation, 
  imageReviewValidation, 
  microTaskQAController.reviewImage
);

router.post("/submissions/:submissionId/complete", 
  authenticateToken, 
  requireApprovedQAOrAdmin(),
  submissionIdValidation, 
  submissionReviewValidation, 
  microTaskQAController.completeSubmissionReview
);

router.post("/submissions/bulk-approve", 
  authenticateToken, 
  requireApprovedQAOrAdmin(),
  bulkApprovalValidation, 
  microTaskQAController.bulkApproveSubmissions
);

router.post("/submissions/:submissionId/assign", 
  authenticateToken, 
  requireRole("ADMIN"), 
  submissionIdValidation, 
  assignReviewerValidation, 
  microTaskQAController.assignReviewer
);

router.get("/my-reviews", 
  authenticateToken, 
  requireApprovedQAOrAdmin(),
  microTaskQAController.getReviewerSubmissions
);

module.exports = router;
