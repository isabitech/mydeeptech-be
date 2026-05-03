const express = require('express');
const router = express.Router();
const taskAssignmentController = require('../controllers/taskAssignment.controller');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/permission-role.middleware');


// Admin route to assign task to users
router.post("/assign-tasks",
  authenticateToken,
  requireRole(['admin']),
  taskAssignmentController.assignTask
);

// Admin route to review task submission
// router.post("/review-submission",
//   authenticateToken,
//   requireRole(['admin']),
//   taskAssignmentController.reviewSubmission
// );

// User route to get their assigned tasks
// router.get("/assigned-tasks",
//   authenticateToken,
//   taskAssignmentController.getAssignedTasks
// );

module.exports = router;    