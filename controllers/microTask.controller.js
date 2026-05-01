const microTaskService = require("../services/microTask.service");
const { validationResult } = require("express-validator");

class MicroTaskController {

  /**
   * Create a new micro task (Admin only)
   */
  async createMicroTask(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array()
        });
      }

      const taskData = {
        ...req.body,
        createdBy: req.user.userId
      };

      const task = await microTaskService.createMicroTask(taskData);

      res.status(201).json({
        success: true,
        message: "Micro task created successfully",
        data: task
      });

    } catch (error) {
      console.error("Error creating micro task:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create micro task"
      });
    }
  }

  /**
   * Get all micro tasks with filters
   */
  async getAllMicroTasks(req, res) {
    try {
      const tasks = await microTaskService.getAllMicroTasks(req.query);

      res.status(200).json({
        success: true,
        message: "Micro tasks retrieved successfully",
        data: tasks
      });

    } catch (error) {
      console.error("Error fetching micro tasks:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch micro tasks"
      });
    }
  }

  /**
   * Get micro task by ID
   */
  async getMicroTaskById(req, res) {
    try {
      const { taskId } = req.params;
      const task = await microTaskService.getMicroTaskById(taskId);

      res.status(200).json({
        success: true,
        message: "Micro task retrieved successfully",
        data: task
      });

    } catch (error) {
      console.error("Error fetching micro task:", error);
      res.status(404).json({
        success: false,
        message: error.message || "Micro task not found"
      });
    }
  }

  /**
   * Update micro task (Admin only)
   */
  async updateMicroTask(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array()
        });
      }

      const { taskId } = req.params;
      const task = await microTaskService.updateMicroTask(taskId, req.body);

      res.status(200).json({
        success: true,
        message: "Micro task updated successfully",
        data: task
      });

    } catch (error) {
      console.error("Error updating micro task:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update micro task"
      });
    }
  }

  /**
   * Delete micro task (Admin only)
   */
  async deleteMicroTask(req, res) {
    try {
      const { taskId } = req.params;
      const result = await microTaskService.deleteMicroTask(taskId);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });

    } catch (error) {
      console.error("Error deleting micro task:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to delete micro task"
      });
    }
  }

  /**
   * Get available tasks for current user
   */
  async getAvailableTasksForUser(req, res) {
    try {
      const userId = req.user.id;
      const tasks = await microTaskService.getAvailableTasksForUser(userId);

      res.status(200).json({
        success: true,
        message: "Available tasks retrieved successfully",
        data: {
          tasks,
          total: tasks.length
        }
      });

    } catch (error) {
      console.error("Error fetching available tasks:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch available tasks"
      });
    }
  }

  /**
   * Get task statistics (Admin only)
   */
  async getTaskStatistics(req, res) {
    try {
      const statistics = await microTaskService.getTaskStatistics();

      res.status(200).json({
        success: true,
        message: "Task statistics retrieved successfully",
        data: statistics
      });

    } catch (error) {
      console.error("Error fetching task statistics:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch task statistics"
      });
    }
  }

  /**
   * Toggle task status (activate/pause/complete)
   */
  async toggleTaskStatus(req, res) {
    try {
      const { taskId } = req.params;
      const { status } = req.body;

      if (!["active", "paused", "completed", "cancelled"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status. Allowed: active, paused, completed, cancelled"
        });
      }

      const task = await microTaskService.updateMicroTask(taskId, { status });

      res.status(200).json({
        success: true,
        message: `Task status updated to ${status}`,
        data: task
      });

    } catch (error) {
      console.error("Error updating task status:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update task status"
      });
    }
  }

  /**
   * Get task slots for a specific task
   */
  async getTaskSlots(req, res) {
    try {
      const { taskId } = req.params;
      const TaskSlot = require("../models/taskSlot.model");
      
      const slots = await TaskSlot.find({ taskId }).sort({ sequence: 1 });

      res.status(200).json({
        success: true,
        message: "Task slots retrieved successfully",
        data: {
          slots,
          total: slots.length
        }
      });

    } catch (error) {
      console.error("Error fetching task slots:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch task slots"
      });
    }
  }

  /**
   * Duplicate an existing task
   */
  async duplicateTask(req, res) {
    try {
      const { taskId } = req.params;
      const { title } = req.body;

      // Get original task
      const originalTask = await microTaskService.getMicroTaskById(taskId);
      if (!originalTask) {
        return res.status(404).json({
          success: false,
          message: "Original task not found"
        });
      }

      // Create duplicate with new title
      const duplicateData = {
        ...originalTask,
        title: title || `${originalTask.title} (Copy)`,
        status: "draft",
        createdBy: req.user.id
      };

      // Remove fields that shouldn't be copied
      delete duplicateData._id;
      delete duplicateData.slots;
      delete duplicateData.submissionStats;
      delete duplicateData.createdAt;
      delete duplicateData.updatedAt;

      const duplicateTask = await microTaskService.createMicroTask(duplicateData);

      res.status(201).json({
        success: true,
        message: "Task duplicated successfully",
        data: duplicateTask
      });

    } catch (error) {
      console.error("Error duplicating task:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to duplicate task"
      });
    }
  }
}

module.exports = new MicroTaskController();