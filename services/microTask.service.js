const mongoose = require("mongoose");
const MicroTask = require("../models/microTask.model");
const TaskSlot = require("../models/taskSlot.model");
const MicroTaskSubmission = require("../models/microTaskSubmission.model");
const SubmissionImage = require("../models/submissionImage.model");
const Task = require("../models/task.model");
const TaskApplication = require("../models/taskApplication.model");
const TaskSubmission = require("../models/task-submission.model");
const {
  getPendingTaskApplicationMatch,
  getRawTaskApplicationStatus,
  getTaskApplicationBucketStatus,
} = require("../utils/taskApplicationStatus");
const {
  cloudinary,
  generateThumbnail,
  generateOptimizedUrl,
} = require("../config/cloudinary");

function createBadRequestError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function isProvided(value) {
  return value !== undefined && value !== null;
}

function maybeParseJson(value, fieldName) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    throw createBadRequestError(`Invalid ${fieldName} JSON payload.`);
  }
}

function normalizeNumericValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? value : parsed;
}

function normalizeBooleanValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  return value;
}

function normalizeDateValue(value) {
  if (!isProvided(value) || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed;
}

function normalizeIllustrationImageEntry(entry) {
  if (typeof entry === "string") {
    const url = entry.trim();
    if (!url) {
      return [];
    }

    return [
      {
        url,
        publicId: "",
        thumbnail: "",
        optimizedUrl: "",
        originalName: "",
        format: "",
        resourceType: "image",
        size: 0,
        uploadedAt: new Date(),
      },
    ];
  }

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw createBadRequestError(
      "Each illustration image must be a URL string or an object with a url field.",
    );
  }

  const url = typeof entry.url === "string" ? entry.url.trim() : "";
  if (!url) {
    throw createBadRequestError(
      "Each illustration image must include a non-empty url field.",
    );
  }

  return [
    {
      url,
      publicId:
        typeof entry.publicId === "string"
          ? entry.publicId
          : typeof entry.public_id === "string"
            ? entry.public_id
            : "",
      thumbnail: typeof entry.thumbnail === "string" ? entry.thumbnail : "",
      optimizedUrl:
        typeof entry.optimizedUrl === "string"
          ? entry.optimizedUrl
          : typeof entry.optimized_url === "string"
            ? entry.optimized_url
            : "",
      originalName:
        typeof entry.originalName === "string"
          ? entry.originalName
          : typeof entry.original_name === "string"
            ? entry.original_name
            : "",
      format: typeof entry.format === "string" ? entry.format : "",
      resourceType:
        typeof entry.resourceType === "string"
          ? entry.resourceType
          : typeof entry.resource_type === "string"
            ? entry.resource_type
            : "image",
      size:
        Number.isFinite(Number(entry.size)) && entry.size !== ""
          ? Number(entry.size)
          : 0,
      uploadedAt: entry.uploadedAt || entry.uploaded_at || new Date(),
    },
  ];
}

function normalizeIllustrationImages(value, fieldName = "illustrationImages") {
  if (!isProvided(value) || value === "") {
    return [];
  }

  const parsed = maybeParseJson(value, fieldName);

  if (Array.isArray(parsed)) {
    return parsed.flatMap((entry) =>
      normalizeIllustrationImages(entry, fieldName),
    );
  }

  if (typeof parsed === "string") {
    const reparsed = maybeParseJson(parsed, fieldName);
    if (reparsed !== parsed) {
      return normalizeIllustrationImages(reparsed, fieldName);
    }
  }

  return normalizeIllustrationImageEntry(parsed);
}

function buildIllustrationImageFromUploadResult(file, uploadResult) {
  return {
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id,
    thumbnail: generateThumbnail(uploadResult.public_id, 200),
    optimizedUrl: generateOptimizedUrl(uploadResult.public_id, {
      width: 1200,
      height: 1200,
      crop: "limit",
    }),
    originalName: file.originalname || uploadResult.original_filename || "",
    format: uploadResult.format || "",
    resourceType: uploadResult.resource_type || "image",
    size: uploadResult.bytes || file.size || 0,
    uploadedAt: new Date(),
  };
}

async function uploadIllustrationFiles(files = []) {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const uploadedImages = [];

  try {
    for (const file of files) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "mydeeptech/micro_task_illustrations",
            resource_type: "image",
          },
          (error, result) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(result);
          },
        );

        uploadStream.end(file.buffer);
      });

      uploadedImages.push(
        buildIllustrationImageFromUploadResult(file, uploadResult),
      );
    }

    return uploadedImages;
  } catch (error) {
    await destroyIllustrationImages(uploadedImages);
    throw new Error(
      `Failed to upload illustration images to Cloudinary: ${error.message}`,
    );
  }
}

async function destroyIllustrationImage(image) {
  const publicId = image?.publicId;
  if (!publicId) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (error) {
    console.warn(
      `Failed to delete illustration image from Cloudinary (${publicId}): ${error.message}`,
    );
  }
}

async function destroyIllustrationImages(images = []) {
  await Promise.all(
    (images || []).map((image) => destroyIllustrationImage(image)),
  );
}

function getIllustrationImageKeys(image = {}) {
  return [image.publicId, image.url].filter(Boolean);
}

async function destroyIllustrationImagesIfUnreferenced(taskId, images = []) {
  for (const image of images || []) {
    const publicId = image?.publicId;
    if (!publicId) {
      continue;
    }

    const isReferencedElsewhere = await Task.exists({
      _id: { $ne: taskId },
      "illustrationImages.publicId": publicId,
    });

    if (!isReferencedElsewhere) {
      await destroyIllustrationImage(image);
    }
  }
}

function normalizeTaskData(taskData = {}) {
  const normalized = { ...taskData };

  if (isProvided(normalized.title) && !isProvided(normalized.taskTitle)) {
    normalized.taskTitle = normalized.title;
  }

  if (
    isProvided(normalized.payRateCurrency) &&
    !isProvided(normalized.currency)
  ) {
    normalized.currency = normalized.payRateCurrency;
  }

  if (isProvided(normalized.deadline) && !isProvided(normalized.dueDate)) {
    normalized.dueDate = normalized.deadline;
  }

  delete normalized.title;
  delete normalized.payRateCurrency;
  delete normalized.deadline;

  if (isProvided(normalized.payRate)) {
    normalized.payRate = normalizeNumericValue(normalized.payRate);
  }

  if (isProvided(normalized.maxParticipants)) {
    normalized.maxParticipants = normalizeNumericValue(
      normalized.maxParticipants,
    );
  }

  if (isProvided(normalized.totalImagesRequired)) {
    normalized.totalImagesRequired = normalizeNumericValue(
      normalized.totalImagesRequired,
    );
  }

  if (isProvided(normalized.isActive)) {
    normalized.isActive = normalizeBooleanValue(normalized.isActive);
  }

  if (isProvided(normalized.dueDate)) {
    normalized.dueDate = normalizeDateValue(normalized.dueDate);
  }

  if (isProvided(normalized.imageRequirements)) {
    normalized.imageRequirements = maybeParseJson(
      normalized.imageRequirements,
      "imageRequirements",
    );
  }

  if (isProvided(normalized.illustrationImages)) {
    normalized.illustrationImages = normalizeIllustrationImages(
      normalized.illustrationImages,
    );
  }

  return normalized;
}

class MicroTaskService {
  
  /**
   * Create a new micro task
   * @param {Object} taskData - Task creation data
   * @returns {Object} Created task with generated slots
   */
  async createMicroTask(taskData, options = {}) {
    try {
      const normalizedTaskData = normalizeTaskData(taskData);
      const uploadedIllustrationImages = await uploadIllustrationFiles(
        options.uploadedIllustrationFiles || [],
      );

      // Validate and set required count based on category
      if (normalizedTaskData.category === "mask_collection") {
        normalizedTaskData.required_count = 20;
      } else if (normalizedTaskData.category === "age_progression") {
        normalizedTaskData.required_count = 15;
      }

      normalizedTaskData.illustrationImages = [
        ...(normalizedTaskData.illustrationImages || []),
        ...uploadedIllustrationImages,
      ];

      // Create the task
      const task = new Task(normalizedTaskData);
      let savedTask;

      try {
        savedTask = await task.save();
      } catch (error) {
        await destroyIllustrationImages(uploadedIllustrationImages);
        throw error;
      }

      // Return task with slots
      return await this.getMicroTaskById(savedTask._id);
      
    } catch (error) {
      if (error.status) {
        throw error;
      }

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

              under_review: {
                $sum: {
                  $map: {
                    input: "$submissionStatsRaw",
                    as: "s",
                    in: {
                      $cond: [
                        { $eq: ["$$s._id", "under_review"] },
                        "$$s.count",
                        0,
                      ],
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

              partially_rejected: {
                $sum: {
                  $map: {
                    input: "$submissionStatsRaw",
                    as: "s",
                    in: {
                      $cond: [
                        { $eq: ["$$s._id", "partially_rejected"] },
                        "$$s.count",
                        0,
                      ],
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

    if (status === "pending") {
      statusFilter = getPendingTaskApplicationMatch();
    } else if (status && status === "ongoing") {
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
              illustrationImages: 1,
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

  const shouldNormalizeStatusForResponse =
    !status || status === "all" || status === "pending";

  const tasks = (result[0]?.data || []).map((task) => {
    const workflowStatus = getRawTaskApplicationStatus(task);
    const bucketStatus = getTaskApplicationBucketStatus(task);

    return {
      ...task,
      status: shouldNormalizeStatusForResponse ? bucketStatus : workflowStatus,
      workflowStatus,
      bucketStatus,
    };
  });
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
      .populate('task', 'taskTitle category description currency payRate totalImagesRequired illustrationImages')
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

      const submissionStats = await TaskApplication.aggregate([
        { $match: { task: task._id } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        }
      ]);

      const stats = {
        total: 0,
        pending: 0,
        in_progress: 0,
        completed: 0,
        under_review: 0,
        approved: 0,
        partially_rejected: 0,
        rejected: 0
      };

      submissionStats.forEach(stat => {
        if (["ongoing", "processing", "active"].includes(stat._id)) {
          stats.in_progress += stat.count;
        } else if (Object.prototype.hasOwnProperty.call(stats, stat._id)) {
          stats[stat._id] = stat.count;
        }
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
  
  async updateMicroTask(taskId, updateData, options = {}) {
    try {
      const existingTask = await Task.findById(taskId);

      if (!existingTask) {
        throw new Error("Micro task not found");
      }

      const normalizedUpdateData = normalizeTaskData(updateData);
      const uploadedIllustrationImages = await uploadIllustrationFiles(
        options.uploadedIllustrationFiles || [],
      );
      const hasIllustrationImagesField = Object.prototype.hasOwnProperty.call(
        updateData || {},
        "illustrationImages",
      );

      if (hasIllustrationImagesField) {
        normalizedUpdateData.illustrationImages = [
          ...(normalizedUpdateData.illustrationImages || []),
          ...uploadedIllustrationImages,
        ];
      } else if (uploadedIllustrationImages.length > 0) {
        normalizedUpdateData.illustrationImages = [
          ...(existingTask.illustrationImages || []),
          ...uploadedIllustrationImages,
        ];
      }

      let task;

      try {
        task = await Task.findByIdAndUpdate(
        taskId,
        normalizedUpdateData,
        { new: true, runValidators: true }
      ).populate("createdBy", "fullName email");
      } catch (error) {
        await destroyIllustrationImages(uploadedIllustrationImages);
        throw error;
      }

      if (!task) {
        throw new Error("Micro task not found");
      }

      if (hasIllustrationImagesField) {
        const nextIllustrationImages = normalizedUpdateData.illustrationImages || [];
        const nextImageKeys = new Set(
          nextIllustrationImages.flatMap((image) => getIllustrationImageKeys(image)),
        );
        const removedImages = (existingTask.illustrationImages || []).filter(
          (image) =>
            !getIllustrationImageKeys(image).some((key) => nextImageKeys.has(key)),
        );

        await destroyIllustrationImagesIfUnreferenced(taskId, removedImages);
      }

      return task;

    } catch (error) {
      if (error.status) {
        throw error;
      }

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
    await destroyIllustrationImagesIfUnreferenced(
      taskId,
      task.illustrationImages || [],
    );

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
        TaskApplication.aggregate([
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
        pending: 0,
        in_progress: 0,
        completed: 0,
        under_review: 0,
        approved: 0,
        partially_rejected: 0,
        rejected: 0
      };

      taskStats.forEach(stat => {
        tasks[stat._id] = stat.count;
        tasks.total += stat.count;
      });

      submissionStats.forEach(stat => {
        if (["ongoing", "processing", "active"].includes(stat._id)) {
          submissions.in_progress += stat.count;
        } else if (Object.prototype.hasOwnProperty.call(submissions, stat._id)) {
          submissions[stat._id] = stat.count;
        }
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
