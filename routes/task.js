const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task');
const { requireRole } = require('../middleware/permission-role.middleware');
const { authenticateAdmin } = require('../middleware/adminAuth');
const { authenticateToken } = require('../middleware/auth');

// Admin routes - Task management
router.post("/createTasks", 
  authenticateAdmin, 
  taskController.createTask
);

router.get("/getAllTasks", 
  authenticateAdmin, 
  taskController.getAllTasks
);

router.get("/getTask/:taskId", 
  authenticateAdmin, 
  taskController.getTask
);

router.get("/getSingleTask/:applicationId",
  authenticateToken,
  taskController.getSingleTask
);

router.put("/updateTask/:taskId",
  authenticateAdmin,
  taskController.updateTask
);

router.delete("/deleteTask/:taskId",
  authenticateAdmin,
  taskController.deleteTask
);

router.get("/me",
  authenticateToken,
  taskController.getMyTasks
);

router.post("/assignTaskToUsers",
  authenticateAdmin,
  taskController.assignTaskToUsers
);

router.get("/usersAssignToTask",
  authenticateAdmin,
  taskController.getUsersAssignedToTask
);

// Admin routes - Assigned tasks
router.get("/assigned-tasks",
  authenticateAdmin,
  taskController.getUsersAssignedToTask
);

// Admin routes - Assigned tasks
router.get("/get-paginated-users",
  authenticateAdmin,
  taskController.getPaginatedUsers
);



module.exports = router;