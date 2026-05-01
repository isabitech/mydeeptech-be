const express = require("express");
const router = express.Router();
const { body, param, query, validationResult } = require("express-validator");
const { authenticateToken } = require("../middleware/auth");
const { requireRole } = require("../middleware/permission-role.middleware");
const multer = require("multer");

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const microTaskSubmissionService = require("../services/microTaskSubmission.service");

// @route   GET /api/micro-task-submissions/me
// @desc    Get current user's submissions
// @access  Private
router.get("/me",
  authenticateToken,
  async (req, res) => {
    try {
      const submissions = await microTaskSubmissionService.getUserSubmissions(req.user.userId);
      
      res.json({
        success: true,
        data: { submissions }
      });
    } catch (error) {
      console.error("Error getting user submissions:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
  }
);

// @route   GET /api/micro-task-submissions/tasks/:taskId/eligibility
// @desc    Check if user can start a task
// @access  Private
router.get("/tasks/:taskId/eligibility",
  authenticateToken,
  [
    param("taskId").isMongoId().withMessage("Invalid task ID")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errors.array()
        });
      }

      const eligibility = await microTaskSubmissionService.checkUserEligibility(req.user.userId, req.params.taskId);
      
      res.json({
        success: true,
        data: eligibility
      });
    } catch (error) {
      console.error("Error checking eligibility:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
  }
);

// @route   POST /api/micro-task-submissions/tasks/:taskId/start
// @desc    Start a new task submission
// @access  Private
router.post("/tasks/:taskId/start",
  authenticateToken,
  [
    param("taskId").isMongoId().withMessage("Invalid task ID")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errors.array()
        });
      }

      const submission = await microTaskSubmissionService.startTaskSubmission(req.user.userId, req.params.taskId);
      
      res.status(201).json({
        success: true,
        message: "Task submission started",
        data: submission
      });
    } catch (error) {
      console.error("Error starting task submission:", error);
      
      if (error.message === "Profile incomplete") {
        return res.status(400).json({
          success: false,
          code: "PROFILE_INCOMPLETE",
          message: "Profile must be completed before participating in micro tasks",
          required_fields: error.required_fields || []
        });
      }
      
      if (error.message === "Task not available") {
        return res.status(400).json({
          success: false,
          message: "Task is not available for submissions"
        });
      }
      
      if (error.message === "Existing submission found") {
        return res.status(400).json({
          success: false,
          code: "EXISTING_SUBMISSION",
          message: "You already have an active submission for this task",
          existingSubmission: error.existingSubmission || null
        });
      }
      
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
  }
);

// @route   GET /api/micro-task-submissions/:submissionId
// @desc    Get submission details
// @access  Private
router.get("/:submissionId",
  authenticateToken,
  [
    param("submissionId").isMongoId().withMessage("Invalid submission ID")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errors.array()
        });
      }

      const submission = await microTaskSubmissionService.getSubmissionDetails(req.params.submissionId, req.user.userId);
      
      if (!submission) {
        return res.status(404).json({
          success: false,
          message: "Submission not found"
        });
      }
      
      res.json({
        success: true,
        data: submission
      });
    } catch (error) {
      console.error("Error getting submission details:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
  }
);

// @route   POST /api/micro-task-submissions/:submissionId/upload
// @desc    Upload image for a submission slot
// @access  Private
router.post("/:submissionId/upload",
  authenticateToken,
  upload.single("image"),
  [
    param("submissionId").isMongoId().withMessage("Invalid submission ID"),
    body("slotId").isMongoId().withMessage("Invalid slot ID")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errors.array()
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file provided"
        });
      }

      const result = await microTaskSubmissionService.uploadSubmissionImage(
        req.params.submissionId,
        req.body.slotId,
        req.file,
        req.user.userId
      );
      
      res.json({
        success: true,
        message: "Image uploaded successfully",
        data: result
      });
    } catch (error) {
      console.error("Error uploading submission image:", error);
      
      if (error.message === "Submission not found" || error.message === "Slot not found") {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      if (error.message === "Submission not editable") {
        return res.status(400).json({
          success: false,
          message: "This submission cannot be modified"
        });
      }
      
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
  }
);

// @route   DELETE /api/micro-task-submissions/:submissionId/slots/:slotId/image
// @desc    Delete image from a submission slot
// @access  Private
router.delete("/:submissionId/slots/:slotId/image",
  authenticateToken,
  [
    param("submissionId").isMongoId().withMessage("Invalid submission ID"),
    param("slotId").isMongoId().withMessage("Invalid slot ID")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errors.array()
        });
      }

      await microTaskSubmissionService.deleteSubmissionImage(
        req.params.submissionId,
        req.params.slotId,
        req.user.userId
      );
      
      res.json({
        success: true,
        message: "Image deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting submission image:", error);
      
      if (error.message === "Submission not found" || error.message === "Slot not found") {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      if (error.message === "Submission not editable") {
        return res.status(400).json({
          success: false,
          message: "This submission cannot be modified"
        });
      }
      
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
  }
);

// @route   POST /api/micro-task-submissions/:submissionId/submit
// @desc    Submit task for review
// @access  Private
router.post("/:submissionId/submit",
  authenticateToken,
  [
    param("submissionId").isMongoId().withMessage("Invalid submission ID")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errors.array()
        });
      }

      const submission = await microTaskSubmissionService.submitTaskForReview(req.params.submissionId, req.user.userId);
      
      res.json({
        success: true,
        message: "Task submitted for review",
        data: submission
      });
    } catch (error) {
      console.error("Error submitting task for review:", error);
      
      if (error.message === "Submission not found") {
        return res.status(404).json({
          success: false,
          message: "Submission not found"
        });
      }
      
      if (error.message === "All slots must be completed" || error.message === "Submission not ready") {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
  }
);

// Admin routes for QA review system
// @route   GET /api/micro-task-submissions/admin/review-queue
// @desc    Get submissions pending review (Admin/QA)
// @access  Private (Admin/QA_REVIEWER)
router.get("/admin/review-queue",
  authenticateToken,
  requireRole("ADMIN", "QA_REVIEWER"),
  [
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    query("category").optional().isIn(["mask_collection", "age_progression", "all"]).withMessage("Invalid category"),
    query("status").optional().isIn(["completed", "under_review", "all"]).withMessage("Invalid status")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errors.array()
        });
      }

      const { page = 1, limit = 20, category, status } = req.query;
      const filters = {};
      
      if (category && category !== "all") filters.category = category;
      if (status && status !== "all") filters.status = status;

      const result = await microTaskSubmissionService.getReviewQueue(filters, {
        page: parseInt(page),
        limit: parseInt(limit)
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Error getting review queue:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
  }
);

// @route   POST /api/micro-task-submissions/admin/:submissionId/review
// @desc    Review submission (Admin/QA)
// @access  Private (Admin/QA_REVIEWER)
router.post("/admin/:submissionId/review",
  authenticateToken,
  requireRole("ADMIN", "QA_REVIEWER"),
  [
    param("submissionId").isMongoId().withMessage("Invalid submission ID"),
    body("action").isIn(["approve", "reject", "partial_approval"]).withMessage("Invalid action"),
    body("feedback").optional().isString().isLength({ min: 1, max: 1000 }).withMessage("Feedback must be 1-1000 characters"),
    body("quality_score").optional().isInt({ min: 0, max: 100 }).withMessage("Quality score must be between 0-100"),
    body("slot_reviews").optional().isArray().withMessage("Slot reviews must be an array"),
    body("slot_reviews.*.slotId").isMongoId().withMessage("Invalid slot ID in slot reviews"),
    body("slot_reviews.*.status").isIn(["approved", "rejected"]).withMessage("Invalid slot review status"),
    body("slot_reviews.*.feedback").optional().isString().isLength({ max: 500 }).withMessage("Slot feedback too long")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errors.array()
        });
      }

      const reviewData = {
        action: req.body.action,
        feedback: req.body.feedback,
        quality_score: req.body.quality_score,
        slot_reviews: req.body.slot_reviews,
        reviewer_id: req.user.userId
      };

      const result = await microTaskSubmissionService.reviewSubmission(req.params.submissionId, reviewData);
      
      res.json({
        success: true,
        message: "Submission reviewed successfully",
        data: result
      });
    } catch (error) {
      console.error("Error reviewing submission:", error);
      
      if (error.message === "Submission not found") {
        return res.status(404).json({
          success: false,
          message: "Submission not found"
        });
      }
      
      if (error.message === "Submission not in reviewable state") {
        return res.status(400).json({
          success: false,
          message: "Submission cannot be reviewed in its current state"
        });
      }
      
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
  }
);

// @route   POST /api/micro-task-submissions/:submissionId/create-slots
// @desc    Create task slots for submission
// @access  Private
router.post("/:submissionId/create-slots",
  authenticateToken,
  [
    param("submissionId").isMongoId().withMessage("Invalid submission ID")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errors.array()
        });
      }

      console.log(`Creating slots for submission ${req.params.submissionId} by user ${req.user.userId}`);
      
      const slots = await microTaskSubmissionService.createTaskSlots(req.params.submissionId, req.user.userId);
      
      res.status(200).json({
        success: true,
        message: "Task slots created successfully",
        data: { 
          slotsCreated: slots.length,
          slots: slots 
        }
      });
    } catch (error) {
      console.error("Error creating task slots:", error);
      
      if (error.message === "Submission not found") {
        return res.status(404).json({
          success: false,
          message: "Submission not found"
        });
      }
      
      if (error.message === "Not authorized to access this submission") {
        return res.status(403).json({
          success: false,
          message: "Not authorized to access this submission"
        });
      }
      
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
  }
);

module.exports = router;