const Task = require('../models/task.model');
const TaskApplication = require('../models/taskApplication.model');
const { taskAssignmentSchema, createTaskValidator} = require('../utils/authValidator');
const DTUser = require('../models/dtUser.model');
const {
    getRawTaskApplicationStatus,
    getTaskApplicationBucketStatus,
} = require('../utils/taskApplicationStatus');

const serializeAssignmentForResponse = (assignment) => {
    const serializedAssignment =
        typeof assignment?.toObject === 'function'
            ? assignment.toObject()
            : assignment;

    if (!serializedAssignment) {
        return serializedAssignment;
    }

    const workflowStatus = getRawTaskApplicationStatus(serializedAssignment);

    return {
        ...serializedAssignment,
        workflowStatus,
        status: getTaskApplicationBucketStatus(serializedAssignment),
    };
};

const createTask = async (req, res) =>  {

    const { userId } = req.admin;

    const { error, value } = createTaskValidator.validate(req.body, {
            abortEarly: true,
    });

     if (error) return res.status(400).json({ message: error.details[0]?.message });
    const { taskLink, taskGuidelineLink, taskTitle, dueDate, description, category, currency, payRate, quality_guidelines, instructions, maxParticipants } = value;

   // Check if a task with the same taskTitle already exists
    const existingTask = await Task.findOne({ taskTitle }).populate('createdBy', 'fullName email');

    if (existingTask) {
        return res.status(409).json({
            message: `A task with the same title already exists. Task: "${existingTask.taskTitle}"`,
            success: false,
            error: "Please use a different task title.",
            data: null,
        });
    }

    // Set createdBy automatically from authenticated user
    const task = {
        taskLink,
        taskGuidelineLink,
        taskTitle,
        description,
        createdBy: userId,
        dueDate,
        description,
        category,
        currency,
        payRate,
        quality_guidelines,
        instructions,
        maxParticipants,
        isActive: true,
    };

    const newTask = new Task(task);
    await newTask.save();

    res.status(200).json({
        success: true,
        message: 'Task created successfully',
        data: newTask,
    });
};

const getTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) 
            return res.status(404).send('Task not found')

        res.status(200).send({
            success: true,
            message: 'Task found successfully',
            data: task
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.details ? error.details[0].message : error.message });
    }
};

const getAllTasks = async (req, res) => {

  const { status, page = 1, limit = 20, search, category } = req.query;

  const filter = {};

  if (status && status !== "all") {
    filter.isActive = status === "active";
  }

  if (category && category !== "all") {
    filter.category = category;
  }

  if (search && search.trim()) {
    filter.taskTitle = { $regex: search.trim(), $options: "i" };
  }

  const pageNumber = Number(page) || 1;
    const pageSize = Number(limit) || 10;
    const skip = (pageNumber - 1) * pageSize;

    const result = await Task.aggregate([
    // 🔹 Base filters
    {
        $match: {
        ...(status && status !== "all" && {
            isActive: status === "active",
        }),
        ...(category && category !== "all" && {
            category,
        }),
        },
    },

    // 🔹 Join createdBy
    {
        $lookup: {
        from: "dtusers",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy",
        },
    },
    { $unwind: "$createdBy" },

    // 🔹 Search across task + user
    {
        $match: {
        ...(search && search.trim() && {
            $or: [
            { taskTitle: { $regex: search.trim(), $options: "i" } },
            { description: { $regex: search.trim(), $options: "i" } },
            { "createdBy.fullName": { $regex: search.trim(), $options: "i" } },
            { "createdBy.email": { $regex: search.trim(), $options: "i" } },
            ],
        }),
        },
    },

    // 🔹 Remove sensitive fields
    {
        $project: {
        taskTitle: 1,
        description: 1,
        category: 1,
        status: 1,
        isActive: 1,
        createdAt: 1,
        payRate: 1,
        currency: 1,
        dueDate: 1,
        totalImagesRequired: 1,

        "createdBy._id": 1,
        "createdBy.fullName": 1,
        "createdBy.email": 1,
        },
    },

    // 🔥 Pagination + total count in ONE query
    {
        $facet: {
        data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: pageSize },
        ],
        metadata: [
            { $count: "total" }
        ],
        },
    },
    ]);

    const tasks = result[0].data;
    const total = result[0].metadata[0]?.total || 0;

  res.status(200).send({
    success: true,
    message: "All Tasks fetched successfully",
    data: tasks,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
  });
};

const assignTaskToUsers = async (req, res) => {
     // Step 1: Validate input with Joi
        const { error, value } = taskAssignmentSchema.validate(req.body, {
            abortEarly: true,
        });

        if (error) {
            return res.status(400).json({ message: error.details[0]?.message });
        }

        // userIds: Array of user IDs to assign the task to
        const { taskId, userIds } = value;

        if (!taskId || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
            success: false,
            message: "taskId and userIds (array) are required",
        });
        }

        // Step 2: Check if Task exists
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: `Task with ID ${taskId} does not exist.` });
        }

        // Step 3: Check if User exists
         const users = await DTUser.find({ _id: { $in: userIds } });
          if (users.length !== userIds.length) {
            return res.status(404).json({
                success: false,
                message: "One or more users not found",
            });
        }

        // Prevent duplicate assignments
        const existingAssignments = await TaskApplication.find({
            task: taskId,
            assignedTo: { $in: userIds },
        });

        const alreadyAssignedUserIds = existingAssignments.map(a =>  a.assignedTo.toString());

        const newUserIds = userIds.filter(
            id => !alreadyAssignedUserIds.includes(id)
        );


        if (task.maxParticipants && existingAssignments.length + newUserIds.length > task.maxParticipants) {
            return res.status(400).json({
                success: false,
                message: `Max participants exceeded. Max participants for this task is ${task.maxParticipants}`,
            });
        }

        // Build assignments
        const assignments = newUserIds.map(userId => ({
            task: taskId,
            assignedTo: userId,
            assignedBy: req.admin.userId,
            dueDate: task.dueDate,
        }));

        // Insert many
        const createdAssignments = await TaskApplication.insertMany(assignments);

        return res.status(200).json({
            success: true,
            message: "Task assigned successfully",
            data: createdAssignments,
        });
};

const getUsersAssignedToTask = async (req, res) => {

        const { taskId, page = 1, limit = 20 } = req.query;
        
        if (!taskId) {
            return res.status(400).json({ message: "Task ID is required", success: false, data: null });
        }

        // Check if Task exists
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: `Task with ID ${taskId} does not exist.`, success: false, data: null });
        }

        // Find all users for this task
      const assignedUsers = await TaskApplication.find({ task: taskId })
        .populate({
            path: 'task',
            select: 'taskTitle createdBy',
            populate: {
            path: 'createdBy',
            select: 'fullName email _id',
            },
        })
        .populate({
            path: 'assignedTo',
            select: 'fullName email _id',
        })
        .populate({
            path: 'assignedBy',
            select: 'fullName email _id',
        })
        .skip((page - 1) * limit)
        .limit(limit);

        const total = await TaskApplication.countDocuments({ task: taskId });

        res.status(200).json({
            success: true,
            message: 'Users assigned to task fetched successfully',
            data: assignedUsers,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
            },
        });
};

const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if Task exists
        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ success: false, message: `Task with ID ${id} does not exist.` });
        }

        // Delete the task
        await Task.findByIdAndDelete(id);

        res.status(200).send({
            success: true,
            message: 'Task deleted successfully',
            data: { deletedTaskId: id }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || 'Internal server error', success: false, data: null });
    }
};

const getMyTasks = async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const { userId } = req.user
    const assignmentFilter = {
        $or: [{ assignedTo: userId }, { applicant: userId }],
    };

    const assignments = await TaskApplication.find(assignmentFilter)
        .populate('task', 'taskTitle description dueDate createdBy payRate currency category')
        .populate('assignedBy', 'fullName email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

    const total = await TaskApplication.countDocuments(assignmentFilter);

    res.status(200).json({
        success: true,
        message: 'My assigned tasks fetched successfully',
        data: assignments.map(serializeAssignmentForResponse),
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / limit),
        },
    });
};

const getSingleTask = async (req, res) => {

        const { taskId } = req.params;
        const { userId } = req.user;

        const task = await Task.findById(taskId)
        .populate('createdBy', 'fullName email')

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found',
                data: null,
            });
        }

        res.status(200).json({
            success: true,
            message: 'Task fetched successfully',
            data: task,
        });
};


const updateTask = async (req, res) => {

        const { taskId } = req.params;

        const { taskTitle, taskLink, taskGuidelineLink, dueDate, isActive, description, category, currency, payRate, quality_guidelines, instructions, maxParticipants } = req.body;

        // Check if task exists
        const existingTask = await Task.findById(taskId);
        if (!existingTask) {
            return res.status(404).json({ success: false, message: `Task with ID ${taskId} does not exist.`,  });
        }

        // Update the task
        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            {
                ...(taskLink && { taskLink }),
                ...(taskGuidelineLink && { taskGuidelineLink }),
                ...(taskTitle && { taskTitle }),
                ...(dueDate && { dueDate }),
                ...(description && { description }),
                ...(isActive !== undefined && { isActive }),
                ...(category && { category }),
                ...(currency && { currency }),
                ...(payRate && { payRate }),
                ...(quality_guidelines && { quality_guidelines }),
                ...(instructions && { instructions }),
                ...(maxParticipants && { maxParticipants }),
            },
            { new: true, runValidators: true }
        );

        res.status(200).send({
            success: true,
            message: 'Task updated successfully',
            data: updatedTask
        });
};

const getAssignedTasks = async (req, res) => {
    try {
        // Get user ID from authenticated token
        const userId = req.user.userId;
        console.log("🔍 Looking for assignments for userId:", userId);

        // Find all task assignments for this user
        const assignments = await TaskApplication.find({ userId })
            .populate({
                path: 'taskId',
                populate: {
                    path: 'createdBy',
                    select: 'fullName email'
                }
            })
            .populate('userId', 'fullName email');

        // Filter out any assignments where task might have been deleted
        const validAssignments = assignments.filter(assignment => assignment.taskId);

        // Format the response to include task details
        const assignedTasks = validAssignments.map(assignment => ({
            applicationId: assignment._id,
            task: assignment.taskId, // This will now be the full populated task object
            assignedDate: assignment.createdAt,
            status: assignment.status || 'pending'
        }));

        res.status(200).send({
            success: true,
            message: 'Assigned tasks fetched successfully',
            data: assignedTasks
        });
    } catch (error) {
        console.error("❌ Error in getAssignedTasks:", error);
        res.status(500).json({ 
            message: error.message || 'Internal server error', 
            success: false, 
            data: null 
        });
    }
};

const getPaginatedUsers = async (req, res) => {

    const { page = 1, limit = 20, searchQuery } = req.query;

    const filter = {
        role: 'user',
    };

    if (searchQuery) {
        filter.$or = [
            { fullName: { $regex: searchQuery, $options: 'i' } },
            { email: { $regex: searchQuery, $options: 'i' } },
        ];
    } 

        const users = await DTUser.find(filter)
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await DTUser.countDocuments(filter);

        res.status(200).json({
            success: true,
            message: 'Users fetched successfully',
            data: users,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
            },
        });
};


module.exports = { createTask, getTask, getAllTasks, assignTaskToUsers, deleteTask, updateTask, getAssignedTasks, getUsersAssignedToTask, getPaginatedUsers, getMyTasks, getSingleTask};
