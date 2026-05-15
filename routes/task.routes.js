const express = require("express");
const router = express.Router();
const microTaskController = require("../controllers/task.controller");
const { body, param, query } = require("express-validator");
const { authenticateToken } = require("../middleware/auth");
const { requireRole } = require("../middleware/permission-role.middleware");
const {
  uploadMicroTaskIllustrations,
  uploadMicroTaskImages,
} = require("../config/cloudinary");
const { authenticateAdmin } = require("../middleware/adminAuth.js");

const getFirstBodyValue = (bodyPayload, fieldNames = []) => {
  for (const fieldName of fieldNames) {
    if (bodyPayload?.[fieldName] !== undefined) {
      return bodyPayload[fieldName];
    }
  }

  return undefined;
};

const validateTaskStringField = ({
  fieldNames,
  label,
  min,
  max,
  required = false,
}) =>
  body().custom((_, { req }) => {
    const rawValue = getFirstBodyValue(req.body, fieldNames);

    if (
      !required &&
      (rawValue === undefined || rawValue === null || rawValue === "")
    ) {
      return true;
    }

    if (typeof rawValue !== "string") {
      throw new Error(`${label} must be a string`);
    }

    const trimmedValue = rawValue.trim();

    if (trimmedValue.length < min || trimmedValue.length > max) {
      throw new Error(`${label} must be between ${min} and ${max} characters`);
    }

    return true;
  });

const validateTaskEnumField = ({ fieldNames, label, allowedValues }) =>
  body().custom((_, { req }) => {
    const rawValue = getFirstBodyValue(req.body, fieldNames);

    if (rawValue === undefined || rawValue === null || rawValue === "") {
      return true;
    }

    if (!allowedValues.includes(rawValue)) {
      throw new Error(`Invalid ${label.toLowerCase()}`);
    }

    return true;
  });

const validateTaskDateField = ({ fieldNames, label }) =>
  body().custom((_, { req }) => {
    const rawValue = getFirstBodyValue(req.body, fieldNames);

    if (rawValue === undefined || rawValue === null || rawValue === "") {
      return true;
    }

    const parsedDate = new Date(rawValue);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error(`${label} must be a valid date`);
    }

    return true;
  });

// Validation rules
const createTaskValidation = [
  validateTaskStringField({
    fieldNames: ["title", "taskTitle"],
    label: "Title",
    min: 3,
    max: 200,
    required: true,
  }),
  
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
  
  validateTaskEnumField({
    fieldNames: ["payRateCurrency", "currency"],
    label: "currency",
    allowedValues: ["USD", "EUR", "GBP", "NGN", "KES", "GHS"],
  }),
  
  body("maxParticipants")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max participants must be a positive integer"),
  
  validateTaskDateField({
    fieldNames: ["deadline", "dueDate"],
    label: "Deadline",
  }),
  
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
  validateTaskStringField({
    fieldNames: ["title", "taskTitle"],
    label: "Title",
    min: 3,
    max: 200,
  }),
  
  body("description")
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be between 10 and 2000 characters"),
  
  body("payRate")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Pay rate must be a positive number"),

  validateTaskEnumField({
    fieldNames: ["payRateCurrency", "currency"],
    label: "currency",
    allowedValues: ["USD", "EUR", "GBP", "NGN", "KES", "GHS"],
  }),
  
  body("maxParticipants")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max participants must be a positive integer"),
  
  validateTaskDateField({
    fieldNames: ["deadline", "dueDate"],
    label: "Deadline",
  }),
  
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

const submissionIdValidation = [
  param("submissionId")
    .isMongoId()
    .withMessage("Invalid submission ID"),
];

const adminReviewedSubmissionsValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100")
    .toInt(),
  query("status")
    .optional()
    .isIn(["all", "under_review", "approved", "rejected", "partially_rejected"])
    .withMessage("Invalid admin reviewed submissions status"),
  query("sort")
    .optional()
    .isIn(["recently_reviewed", "oldest_reviewed", "newest_submitted", "oldest_submitted"])
    .withMessage("Invalid sort option"),
];

const adminOverrideValidation = [
  body("status")
    .isIn(["approved", "rejected", "partially_rejected"])
    .withMessage("Invalid override status"),
  body("quality_score")
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage("quality_score must be between 0 and 100"),
  body("review_notes")
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage("review_notes must not exceed 2000 characters"),
  body("sync_images")
    .optional()
    .isBoolean()
    .withMessage("sync_images must be a boolean")
    .toBoolean(),
];

const exportTaskDatasetValidation = [
  query("status")
    .optional()
    .isIn(["approved", "rejected", "partially_rejected"])
    .withMessage("Invalid export status"),
];

// Admin routes - Create Task
router.post("/",
  authenticateToken,
  requireRole("admin", "super_admin", "QA_REVIEWER"),
  uploadMicroTaskIllustrations,
  createTaskValidation, 
  microTaskController.createMicroTask
);

// Admin routes - Fetch All Task
router.get("/",
  authenticateToken,
  requireRole("admin", "super_admin", "QA_REVIEWER"),
  microTaskController.getAllMicroTasks
);

// User routes - Available tasks
router.get("/all",
  authenticateToken,
  microTaskController.getAllMicroTasks
);

router.get("/filters",
  authenticateToken,
  microTaskController.getTasksByFilters
);


// User routes - Apply for a task
router.post("/apply",
  authenticateToken,
  microTaskController.applyForTask
);


router.post("/approve_or_reject_application",
  authenticateAdmin,
  microTaskController.approveOrRejectApplication
);
router.post("/reject-image",
    authenticateAdmin,
  microTaskController.rejectTaskImage
);

// User routes - Task Statistics
router.get("/statistics", 
  authenticateToken, 
  requireRole("admin", "super_admin", "QA_REVIEWER"), 
  microTaskController.getTaskStatistics
);

router.get("/:taskId/reviewed-submissions",
  authenticateToken,
  requireRole("admin", "super_admin"),
  taskIdValidation,
  adminReviewedSubmissionsValidation,
  microTaskController.getReviewedSubmissionsForTask
);

router.post("/:taskId/reviewed-submissions/:submissionId/override",
  authenticateToken,
  requireRole("admin", "super_admin"),
  taskIdValidation,
  submissionIdValidation,
  adminOverrideValidation,
  microTaskController.overrideReviewedSubmission
);

router.get("/:taskId/export-dataset",
  authenticateToken,
  requireRole("admin", "super_admin"),
  taskIdValidation,
  exportTaskDatasetValidation,
  microTaskController.exportTaskDataset
);


// User routes - Get Task details for a specific application
router.get("/:taskId", 
  authenticateToken, 
  requireRole("admin", "super_admin", "QA_REVIEWER"), 
  taskIdValidation, 
  microTaskController.getMicroTaskById
);

// User routes - Update Task details for a specific application
router.put("/:taskId",
  authenticateToken,
  requireRole("admin", "super_admin", "QA_REVIEWER"),
  uploadMicroTaskIllustrations,
  taskIdValidation, 
  updateTaskValidation, 
  microTaskController.updateMicroTask
);

// User routes - Delete a specific task
router.delete("/:taskId",
  authenticateToken,
  requireRole("admin", "super_admin", "QA_REVIEWER"),
  taskIdValidation, 
  microTaskController.deleteMicroTask
);

// User routes - Toggle task status
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

router.get("/:taskId/application", 
  authenticateToken, 
  taskIdValidation, 
  microTaskController.getTaskApplicationForUser
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

router.post('/upload',
  authenticateToken,
  uploadMicroTaskImages,
  microTaskController.uploadTaskImages
);

// User routes - Get applied task details
router.get("/submission/:submissionId", 
  authenticateToken,
  microTaskController.getTaskSubmissionById
);

// User routes - Delete uploaded image from a application
router.delete("/submission/:submissionId/deleteImage", 
  authenticateToken,
  microTaskController.getTaskSubmissionByIdAndDeleteImage
);

module.exports = router;
