const express = require("express");
const router = express.Router();
const submissionController = require("../controllers/submission.controller");
const { body, param } = require("express-validator");
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

// Validation rules
const taskIdValidation = [
  param("taskId")
    .isMongoId()
    .withMessage("Invalid task ID")
];

const submissionIdValidation = [
  param("submissionId")
    .isMongoId()
    .withMessage("Invalid submission ID")
];

const slotIdValidation = [
  param("slotId")
    .isMongoId()
    .withMessage("Invalid slot ID")
];

const imageIdValidation = [
  param("imageId")
    .isMongoId()
    .withMessage("Invalid image ID")
];

// User submission routes
router.post("/tasks/:taskId/start", 
  authenticateToken, 
  requireRole("ANNOTATOR", "USER"), 
  taskIdValidation, 
  submissionController.startSubmission
);

router.get("/tasks/:taskId/eligibility", 
  verifyToken, 
  checkRole(["ANNOTATOR", "USER"]), 
  taskIdValidation, 
  submissionController.checkSubmissionEligibility
);

router.get("/me", 
  verifyToken, 
  checkRole(["ANNOTATOR", "USER"]), 
  submissionController.getUserSubmissions
);

router.get("/:submissionId", 
  verifyToken, 
  submissionIdValidation, 
  submissionController.getSubmissionById
);

router.get("/:submissionId/progress", 
  verifyToken, 
  submissionIdValidation, 
  submissionController.getSubmissionProgress
);

router.get("/:submissionId/slots", 
  verifyToken, 
  submissionIdValidation, 
  submissionController.getSubmissionSlots
);

router.post("/:submissionId/slots/:slotId/upload", 
  verifyToken, 
  checkRole(["ANNOTATOR", "USER"]), 
  submissionIdValidation, 
  slotIdValidation,
  upload.single('image'), // 'image' is the field name for the uploaded file
  submissionController.uploadImage
);

router.delete("/:submissionId/images/:imageId", 
  verifyToken, 
  checkRole(["ANNOTATOR", "USER"]), 
  submissionIdValidation, 
  imageIdValidation, 
  submissionController.deleteImage
);

router.post("/:submissionId/submit", 
  verifyToken, 
  checkRole(["ANNOTATOR", "USER"]), 
  submissionIdValidation, 
  submissionController.submitForReview
);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field. Use "image" as field name'
      });
    }
  }
  
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed'
    });
  }
  
  next(error);
});

module.exports = router;