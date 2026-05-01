const MicroTask = require("../models/microTask.model");
const TaskSlot = require("../models/taskSlot.model");
const MicroTaskSubmission = require("../models/microTaskSubmission.model");
const SubmissionImage = require("../models/submissionImage.model");

class MicroTaskService {
  
  /**
   * Create a new micro task
   * @param {Object} taskData - Task creation data
   * @returns {Object} Created task with generated slots
   */
  async createMicroTask(taskData) {
    try {
      // Validate and set required count based on category
      if (taskData.category === "mask_collection") {
        taskData.required_count = 20;
      } else if (taskData.category === "age_progression") {
        taskData.required_count = 15;
      }

      // Create the task
      const task = new MicroTask(taskData);
      const savedTask = await task.save();

      // Generate slots based on category
      let slots = [];
      if (taskData.category === "mask_collection") {
        slots = TaskSlot.generateMaskCollectionSlots(savedTask._id);
      } else if (taskData.category === "age_progression") {
        slots = TaskSlot.generateAgeProgressionSlots(savedTask._id);
      }

      // Save all slots
      if (slots.length > 0) {
        await TaskSlot.insertMany(slots);
      }

      // Return task with slots
      return await this.getMicroTaskById(savedTask._id);
      
    } catch (error) {
      throw new Error(`Error creating micro task: ${error.message}`);
    }
  }

  /**
   * Get all micro tasks with filtering and pagination
   * @param {Object} query - Filter and pagination options
   * @returns {Object} Tasks with pagination info
   */
  async getAllMicroTasks(query) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        category,
        createdBy,
        search
      } = query;

      const filter = {};

      // Apply filters
      if (status) filter.status = status;
      if (category) filter.category = category;
      if (createdBy) filter.createdBy = createdBy;
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (page - 1) * limit;

      const [tasks, total] = await Promise.all([
        MicroTask.find(filter)
          .populate("createdBy", "fullName email")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        MicroTask.countDocuments(filter)
      ]);

      // Get submission counts for each task
      const tasksWithStats = await Promise.all(
        tasks.map(async (task) => {
          const submissionStats = await MicroTaskSubmission.aggregate([
            { $match: { taskId: task._id } },
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 }
              }
            }
          ]);

          const stats = {
            total: 0,
            in_progress: 0,
            completed: 0,
            under_review: 0,
            approved: 0,
            rejected: 0
          };

          submissionStats.forEach(stat => {
            stats[stat._id] = stat.count;
            stats.total += stat.count;
          });

          return {
            ...task.toJSON(),
            submissionStats: stats
          };
        })
      );

      return {
        tasks: tasksWithStats,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total_items: total,
          total_pages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      throw new Error(`Error fetching micro tasks: ${error.message}`);
    }
  }

  /**
   * Get micro task by ID with slots and submission stats
   * @param {String} taskId - Task ID
   * @returns {Object} Task with complete information
   */
  async getMicroTaskById(taskId) {
    try {
      const task = await MicroTask.findById(taskId)
        .populate("createdBy", "fullName email");

      if (!task) {
        throw new Error("Micro task not found");
      }

      // Get task slots
      const slots = await TaskSlot.find({ taskId }).sort({ sequence: 1 });

      // Get submission statistics
      const submissionStats = await MicroTaskSubmission.aggregate([
        { $match: { taskId: task._id } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        }
      ]);

      const stats = {
        total: 0,
        in_progress: 0,
        completed: 0,
        under_review: 0,
        approved: 0,
        rejected: 0
      };

      submissionStats.forEach(stat => {
        stats[stat._id] = stat.count;
        stats.total += stat.count;
      });

      return {
        ...task.toJSON(),
        slots,
        submissionStats: stats
      };

    } catch (error) {
      throw new Error(`Error fetching micro task: ${error.message}`);
    }
  }

  /**
   * Update micro task
   * @param {String} taskId - Task ID
   * @param {Object} updateData - Update data
   * @returns {Object} Updated task
   */
  async updateMicroTask(taskId, updateData) {
    try {
      const task = await MicroTask.findByIdAndUpdate(
        taskId,
        updateData,
        { new: true, runValidators: true }
      ).populate("createdBy", "fullName email");

      if (!task) {
        throw new Error("Micro task not found");
      }

      return task;

    } catch (error) {
      throw new Error(`Error updating micro task: ${error.message}`);
    }
  }

  /**
   * Delete micro task and all associated data
   * @param {String} taskId - Task ID
   * @returns {Object} Deletion result
   */
  async deleteMicroTask(taskId) {
    try {
      const task = await MicroTask.findById(taskId);
      if (!task) {
        throw new Error("Micro task not found");
      }

      // Get all submissions for this task
      const submissions = await MicroTaskSubmission.find({ taskId });
      const submissionIds = submissions.map(sub => sub._id);

      // Delete in order: images, submissions, slots, task
      await SubmissionImage.deleteMany({ submissionId: { $in: submissionIds } });
      await MicroTaskSubmission.deleteMany({ taskId });
      await TaskSlot.deleteMany({ taskId });
      await MicroTask.findByIdAndDelete(taskId);

      return {
        success: true,
        message: "Micro task and all associated data deleted successfully"
      };

    } catch (error) {
      throw new Error(`Error deleting micro task: ${error.message}`);
    }
  }

  /**
   * Get micro tasks available for a user
   * @param {String} userId - User ID
   * @returns {Array} Available tasks for the user
   */
  async getAvailableTasksForUser(userId) {
    try {
      // Get tasks user hasn't started yet
      const existingSubmissions = await MicroTaskSubmission.find({ userId }).select('taskId');
      const submittedTaskIds = existingSubmissions.map(sub => sub.taskId);

      const availableTasks = await MicroTask.find({
        status: 'active',
        _id: { $nin: submittedTaskIds }
      })
      .populate("createdBy", "fullName")
      .sort({ createdAt: -1 });

      // Add slot information and check availability
      const tasksWithSlots = await Promise.all(
        availableTasks.map(async (task) => {
          const slots = await TaskSlot.find({ taskId: task._id }).sort({ sequence: 1 });
          
          // Check if task has reached max participants
          if (task.maxParticipants) {
            const currentParticipants = await MicroTaskSubmission.countDocuments({
              taskId: task._id,
              status: { $in: ["in_progress", "completed", "under_review", "approved"] }
            });
            
            if (currentParticipants >= task.maxParticipants) {
              return null; // Task is full
            }
          }

          return {
            ...task.toJSON(),
            slots: slots.length,
            estimated_time: this.calculateEstimatedTime(task.category, task.required_count)
          };
        })
      );

      return tasksWithSlots.filter(task => task !== null);

    } catch (error) {
      throw new Error(`Error fetching available tasks: ${error.message}`);
    }
  }

  /**
   * Calculate estimated completion time for a task
   * @param {String} category - Task category
   * @param {Number} count - Required count
   * @returns {String} Estimated time
   */
  calculateEstimatedTime(category, count) {
    if (category === "mask_collection") {
      return "30-45 minutes"; // Estimate for 20 mask images
    } else if (category === "age_progression") {
      return "20-30 minutes"; // Estimate for 15 age progression images
    }
    return "30 minutes";
  }

  /**
   * Get task statistics for dashboard
   * @returns {Object} Task statistics
   */
  async getTaskStatistics() {
    try {
      const [taskStats, submissionStats] = await Promise.all([
        MicroTask.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 }
            }
          }
        ]),
        MicroTaskSubmission.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 }
            }
          }
        ])
      ]);

      const tasks = {
        total: 0,
        active: 0,
        completed: 0,
        draft: 0,
        paused: 0,
        cancelled: 0
      };

      const submissions = {
        total: 0,
        in_progress: 0,
        completed: 0,
        under_review: 0,
        approved: 0,
        rejected: 0
      };

      taskStats.forEach(stat => {
        tasks[stat._id] = stat.count;
        tasks.total += stat.count;
      });

      submissionStats.forEach(stat => {
        submissions[stat._id] = stat.count;
        submissions.total += stat.count;
      });

      return {
        tasks,
        submissions,
        generated_at: new Date()
      };

    } catch (error) {
      throw new Error(`Error fetching task statistics: ${error.message}`);
    }
  }
}

module.exports = new MicroTaskService();