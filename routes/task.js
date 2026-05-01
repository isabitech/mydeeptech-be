const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/permission-role.middleware');

// Admin routes - Task management
router.post("/createTasks", 
  authenticateToken, 
  requireRole(['admin']), 
  taskController.createTask
);

router.get("/getAllTasks", 
  authenticateToken, 
  requireRole(['admin']), 
  taskController.getAllTasks
);

router.get("/getTask/:id", 
  authenticateToken, 
  requireRole(['admin']), 
  taskController.getTask
);

router.put("/updateTask/:id",
  authenticateToken,
  requireRole(['admin']),
  taskController.updateTask
);

router.delete("/deleteTask/:id",
  authenticateToken,
  requireRole(['admin']),
  taskController.deleteTask
);

router.post("/assignTask",
  authenticateToken,
  requireRole(['admin']),
  taskController.assignTask
);

// User routes - Assigned tasks
router.get("/assigned-tasks",
  authenticateToken,
  taskController.getAssignedTasks
);

module.exports = router;