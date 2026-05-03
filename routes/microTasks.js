const express = require("express");
const router = express.Router();
const microTaskController = require("../controllers/microTask.controller");
const { body, param, query } = require("express-validator");
const { authenticateToken } = require("../middleware/auth");
const { requireRole } = require("../middleware/permission-role.middleware");
const { imageUpload, uploadMicroTaskImages } = require("../config/cloudinary");

// Validation rules
const createTaskValidation = [
  body("title")
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be between 3 and 200 characters"),
  
  body("description")
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be between 10 and 2000 characters"),
  
  body("category")
    .isIn(["mask_collection", "age_progression"])
    .withMessage("Category must be either 'mask_collection' or 'age_progression'"),
  
  body("payRate")
    .isFloat({ min: 0 })
    .withMessage("Pay rate must be a positive number"),
  
  body("payRateCurrency")
    .optional()
    .isIn(["USD", "EUR", "GBP", "NGN", "KES", "GHS"])
    .withMessage("Invalid currency"),
  
  body("maxParticipants")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max participants must be a positive integer"),
  
  body("deadline")
    .optional()
    .isISO8601()
    .withMessage("Deadline must be a valid date"),
  
  body("instructions")
    .optional()
    .isLength({ max: 5000 })
    .withMessage("Instructions must not exceed 5000 characters"),
  
  body("quality_guidelines")
    .optional()
    .isLength({ max: 5000 })
    .withMessage("Quality guidelines must not exceed 5000 characters")
];

const updateTaskValidation = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be between 3 and 200 characters"),
  
  body("description")
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be between 10 and 2000 characters"),
  
  body("payRate")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Pay rate must be a positive number"),
  
  body("maxParticipants")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max participants must be a positive integer"),
  
  body("deadline")
    .optional()
    .isISO8601()
    .withMessage("Deadline must be a valid date"),
  
  body("status")
    .optional()
    .isIn(["draft", "active", "paused", "completed", "cancelled"])
    .withMessage("Invalid status")
];

const taskIdValidation = [
  param("taskId")
    .isMongoId()
    .withMessage("Invalid task ID")
];

// Admin routes - Task management
router.post("/",
  authenticateToken,
  requireRole("admin", "super_admin", "QA_REVIEWER"),
  createTaskValidation, 
  microTaskController.createMicroTask
);

router.get("/",
  authenticateToken,
  requireRole("admin", "super_admin", "QA_REVIEWER"),
  microTaskController.getAllMicroTasks
);

router.get("/statistics", 
  authenticateToken, 
  requireRole("admin", "super_admin", "QA_REVIEWER"), 
  microTaskController.getTaskStatistics
);

router.get("/submission/:submissionId", 
  authenticateToken,
  microTaskController.getTaskSubmissionById
);

router.delete("/submission/:submissionId/deleteImage", 
  authenticateToken,
  microTaskController.getTaskSubmissionByIdAndDeleteImage
);

router.get("/:taskId", 
  authenticateToken, 
  requireRole("admin", "super_admin", "QA_REVIEWER"), 
  taskIdValidation, 
  microTaskController.getMicroTaskById
);

router.put("/:taskId",
  authenticateToken,
  requireRole("admin", "super_admin", "QA_REVIEWER"),
  taskIdValidation, 
  updateTaskValidation, 
  microTaskController.updateMicroTask
);

router.delete("/:taskId",
  authenticateToken,
  requireRole("admin", "super_admin", "QA_REVIEWER"),
  taskIdValidation, 
  microTaskController.deleteMicroTask
);

router.patch("/:taskId/status",
  authenticateToken,
  requireRole("admin", "super_admin", "QA_REVIEWER"),
  taskIdValidation,
  [
    body("status")
      .isIn(["active", "paused", "completed", "cancelled"])
      .withMessage("Invalid status")
  ],
  microTaskController.toggleTaskStatus
);

router.get("/:taskId/slots", 
  authenticateToken, 
  requireRole("admin", "super_admin", "QA_REVIEWER"),
  taskIdValidation, 
  microTaskController.getTaskSlots
);

router.post("/:taskId/duplicate",
  authenticateToken,
  requireRole("admin", "super_admin", "QA_REVIEWER"),
  taskIdValidation,
  [
    body("title")
      .optional()
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage("Title must be between 3 and 200 characters")
  ],
  microTaskController.duplicateTask
);

// User routes - Available tasks
router.get("/available/me",
  authenticateToken,
  requireRole("annotator", "user"),
  microTaskController.getAvailableTasksForUser
);

// User routes - Available tasks
router.get("/available/me",
  authenticateToken,
  requireRole("annotator", "user"),
  microTaskController.getAvailableTasksForUser
);

router.post('/upload',
  authenticateToken,
  uploadMicroTaskImages,
  microTaskController.uploadTaskImages
);



module.exports = router;