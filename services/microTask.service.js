const mongoose = require("mongoose");
const MicroTask = require("../models/microTask.model");
const TaskSlot = require("../models/taskSlot.model");
const MicroTaskSubmission = require("../models/microTaskSubmission.model");
const SubmissionImage = require("../models/submissionImage.model");
const Task = require("../models/task.model");
const TaskApplication = require("../models/taskApplication.model");
const TaskSubmission = require("../models/task-submission.model");

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
      const task = new Task(taskData);
      const savedTask = await task.save();

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
  async getAllMicroTasks(query, userId) {
    try {

      const {
        page = 1,
        limit = 10,
        status,
        category,
        createdBy,
        search,
      } = query;

    const pageNumber = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 10;
    const skip = (pageNumber - 1) * pageSize;

    let matchStage = {};

    if (status && status !== "all") matchStage.status = status;
    if (category && category !== "all") matchStage.category = category;
    if (createdBy) matchStage.createdBy = new mongoose.Types.ObjectId(createdBy);


    if (search && search.trim()) {
      const searchValue = search.trim();

      matchStage.$or = [
        { taskTitle: { $regex: searchValue, $options: "i" } },
        { description: { $regex: searchValue, $options: "i" } }
      ];
    }


    let appliedTaskIds = [];
    if (userId) {
      appliedTaskIds = await TaskApplication.distinct("task", {
        applicant: userId,
      });

      matchStage._id = { $nin: appliedTaskIds };
      matchStage.isActive = true;
    }

     const result = await Task.aggregate([
        {
          $match: matchStage,
        },

        // Join createdBy
        {
          $lookup: {
            from: "dtusers",
            localField: "createdBy",
            foreignField: "_id",
            as: "createdBy",
          },
        },
        { $unwind: "$createdBy" },

        // 🔥 Join TaskApplications + compute stats
        {
          $lookup: {
            from: "taskapplications",
            let: { taskId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$task", "$$taskId"] },
                },
              },
              {
                $group: {
                  _id: "$status",
                  count: { $sum: 1 },
                },
              },
            ],
            as: "submissionStatsRaw",
          },
        },

        // 🔥 Transform stats into your desired structure
        {
          $addFields: {
            submissionStats: {
              total: { $sum: "$submissionStatsRaw.count" },

              pending: {
                $sum: {
                  $map: {
                    input: "$submissionStatsRaw",
                    as: "s",
                    in: {
                      $cond: [{ $eq: ["$$s._id", "pending"] }, "$$s.count", 0],
                    },
                  },
                },
              },

              in_progress: {
                $sum: {
                  $map: {
                    input: "$submissionStatsRaw",
                    as: "s",
                    in: {
                      $cond: [
                        { $in: ["$$s._id", ["ongoing", "processing", "active"]] },
                        "$$s.count",
                        0,
                      ],
                    },
                  },
                },
              },

              completed: {
                $sum: {
                  $map: {
                    input: "$submissionStatsRaw",
                    as: "s",
                    in: {
                      $cond: [{ $eq: ["$$s._id", "completed"] }, "$$s.count", 0],
                    },
                  },
                },
              },

              approved: {
                $sum: {
                  $map: {
                    input: "$submissionStatsRaw",
                    as: "s",
                    in: {
                      $cond: [{ $eq: ["$$s._id", "approved"] }, "$$s.count", 0],
                    },
                  },
                },
              },

              rejected: {
                $sum: {
                  $map: {
                    input: "$submissionStatsRaw",
                    as: "s",
                    in: {
                      $cond: [{ $eq: ["$$s._id", "rejected"] }, "$$s.count", 0],
                    },
                  },
                },
              },
            },
          },
        },

        // Clean up
        {
          $project: {
            submissionStatsRaw: 0,
            "createdBy.password": 0,
          },
        },

        // Pagination
        {
          $facet: {
            data: [
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: pageSize },
            ],
            metadata: [{ $count: "total" }],
          },
        },
      ]);

    const tasks = result[0].data;
    const total = result[0].metadata[0]?.total || 0;

      return {
        tasks,
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


async getTasksByFilters(query = {}, userId = null) {
  const {
    page = 1,
    limit = 10,
    status,
    category,
    createdBy,
    search,
  } = query;

  console.log("Filters received:", { status, category, createdBy, search, userId });

  const pageNumber = parseInt(page) || 1;
  const pageSize = parseInt(limit) || 10;
  const skip = (pageNumber - 1) * pageSize;

    let statusFilter = {};

    if (status && status === "ongoing") {
      statusFilter = {
        status: { $in: ["pending", "ongoing", "completed"] },
      };
    } else if (status && status !== "all") {
      statusFilter = { status };
    }

  const result = await TaskApplication.aggregate([
    //  Initial match
    {
      $match: {
          ...(userId && { applicant: new mongoose.Types.ObjectId(userId) }),
          // ...(createdBy && { createdBy: new mongoose.Types.ObjectId(createdBy) }),
          ...statusFilter,
      },
    },

    // Join task
    {
      $lookup: {
        from: "tasks",
        let: { taskId: "$task" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$taskId"] } } },
          {
            $project: {
              taskTitle: 1,
              category: 1,
              status: 1,
              description: 1,
              payRate: 1,
              currency: 1,
              instructions: 1,
              maxParticipants: 1,
              dueDate: 1,
              totalImagesRequired: 1,
              isActive: 1,
              taskLink: 1,
            },
          },
        ],
        as: "task",
      },
    },
    { $unwind: "$task" },

    // Join applicant (SAFE)
    {
      $lookup: {
        from: "dtusers",
        let: { applicantId: "$applicant" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$applicantId"] } } },
          {
            $project: {
              fullName: 1,
              email: 1,
              phone: 1,
            },
          },
        ],
        as: "applicant",
      },
    },
    { $unwind: "$applicant" },

    // Join images (NEW)
    {
      $lookup: {
        from: "task_image_uploads", // confirm collection name
        let: { imageIds: "$images" },
        pipeline: [
          {
            $match: {
              $expr: { $in: ["$_id", "$$imageIds"] },
            },
          },
          {
            $project: {
              _id: 1,
              url: 1,
              label: 1,
              publicId: 1,
              uploadedAt: 1,
              createdAt: 1,
              updatedAt: 1,
              metadata: 1,
              status: 1,
              rejectionMessage: 1,
              reviewedBy: 1,
              reviewedAt: 1,
              status: 1,
            },
          },
          // optional: sort images
          { $sort: { createdAt: -1 } },
        ],
        as: "images",
      },
    },

    // Post-join filtering
    {
      $match: {
        ...(category && category !== "all" && { "task.category": category }),
        ...(search && {
          $or: [
            { "task.taskTitle": { $regex: search, $options: "i" } },
            { "task.category": { $regex: search, $options: "i" } },
            { "applicant.fullName": { $regex: search, $options: "i" } },
            { "applicant.email": { $regex: search, $options: "i" } },
          ],
        }),
      },
    },

    // Pagination + final shape
    {
      $facet: {
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: pageSize },

          {
            $project: {
              _id: 1,
              status: 1,
              createdAt: 1,
              task: 1,
              images: 1, // now populated
              applicant: 1,
              isComplete: 1,
              uploadProgress: 1,
              dueDate: 1,
              approvedDate: 1,
              submittedAt: 1,
              reviewedAt: 1,
              reviewNote: 1,
              rejectedAt: 1,
              rejectedBy: 1,
              rejectionMessage: 1,
            },
          },
        ],
        metadata: [{ $count: "total" }],
      },
    },
  ]);

  const tasks = result[0]?.data || [];
  const total = result[0]?.metadata[0]?.total || 0;

  return {
    tasks,
    pagination: {
      current_page: pageNumber,
      per_page: pageSize,
      total_items: total,
      total_pages: Math.ceil(total / pageSize),
    },
  };
}


  async getTaskApplicationForUser(taskId, userId){
      const taskApplication = await TaskApplication.findOne({
        task: taskId,
        applicant: userId,
      })
      .populate('task', 'taskTitle category description currency payRate totalImagesRequired')
      .populate('applicant', 'fullName email')
      .populate('images', 'url publicId label status rejectionMessage dateTaken metadata');
      return taskApplication || null;
  }

  /**
   * Get micro task by ID with slots and submission stats
   * @param {String} taskId - Task ID
   * @returns {Object} Task with complete information
   */
  async getMicroTaskById(taskId) {
    try {
      const task = await Task.findById(taskId)
        .populate("createdBy", "fullName email");

      if (!task) {
        throw new Error("Micro task not found");
      }


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
      const task = await Task.findByIdAndUpdate(
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
  
    const task = await Task.findById(taskId);
    if (!task) throw new Error("Micro task not found");

    // Find all applications for this task
    const applications = await TaskApplication.find({ task: taskId });

    // Delete each application individually so the pre-middleware fires
    // (this handles Cloudinary cleanup + task_image_upload deletion)
    await Promise.all(
      applications.map((app) =>
        TaskApplication.findOneAndDelete({ _id: app._id })
      )
    );

    await Task.findByIdAndDelete(taskId);

    return {
      success: true,
      message: "Micro task and all associated data deleted successfully",
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

      const availableTasks = await Task.find({
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
        Task.aggregate([
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