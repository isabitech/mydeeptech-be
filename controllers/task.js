const Tasks = require('../models/task.model');
const taskAssignment = require('../models/taskAssignment.model');
const {taskSchema, taskAssignmentSchema} = require('../utils/authValidator');
const DTUser = require('../models/dtUser.model');

const createTask = async (req, res) =>  {
    try {
        const {error} = taskSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const {taskLink, taskGuidelineLink, taskName, dueDate} = req.body;
        
        // Check if a task with the same taskLink already exists
        const existingTask = await Tasks.findOne({ taskLink });
        if (existingTask) {
            return res.status(409).json({
                message: `A task with this link already exists. Task: "${existingTask.taskName}"`,
                success: false,
                error: "Duplicate task link",
                data: null,
            });
        }

        // Set createdBy automatically from authenticated user
        const task = {
            taskLink, 
            taskGuidelineLink, 
            taskName, 
            createdBy: req.user.userId,
            dueDate
        };

        const newTask = new Tasks(task);
        await newTask.save();

        res.status(200).send({
            success: true,
            responseMessage: 'Task created successfully',
            data: newTask,
        });
        
    } catch (error) {
        console.error(error);
        // Handle MongoDB duplicate key error
        if (error.code === 11000) {
            const duplicatedField = Object.keys(error.keyPattern)[0];
            return res.status(409).json({ 
                message: `A task with this ${duplicatedField} already exists. Please use a different ${duplicatedField}.` 
            });
        }

        res.status(500).json({ message: error.details ? error.details[0].message : error.message });
    }
};

const getTask = async (req, res) => {
    try {
        const task = await Tasks.findById({ id : req.params.id })
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
    try {
        const tasks = await Tasks.find().populate('createdBy', 'fullName email');
        if(!tasks)
            return res.status(404).send('Task not found');

        res.status(200).send({
            success: true,
            message: 'All Tasks fetched successfully',
            data: tasks
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.details ? error.details[0]?.message : error.message }); 
    }
};

const assignTask = async (req, res) => {
    try {
        // Step 1: Validate input with Joi
        const { error } = taskAssignmentSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0]?.message });
        }

        const { taskId, userId } = req.body;

        // Step 2: Check if Task exists
        const task = await Tasks.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: `Task with ID ${taskId} does not exist.` });
        }

        // Step 3: Check if User exists
        const user = await DTUser.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: `User with ID ${userId} does not exist.` });
        }

        // Step 4: Create a new task assignment
        const taskAssign = { taskId, userId }; // Construct assignment object
        const newAssignment = new taskAssignment(taskAssign);
        await newAssignment.save();

        // Step 5: Return success response
        res.status(200).send({
            success: true,
            message: 'Task assigned successfully',
            data: newAssignment,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || 'Internal server error', success: false, data: null });
    }
};

const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if Task exists
        const task = await Tasks.findById(id);
        if (!task) {
            return res.status(404).json({ success: false, message: `Task with ID ${id} does not exist.` });
        }

        // Delete the task
        await Tasks.findByIdAndDelete(id);

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

const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { taskLink, taskGuidelineLink, taskName, dueDate } = req.body;

        // Check if task exists
        const existingTask = await Tasks.findById(id);
        if (!existingTask) {
            return res.status(404).json({ success: false, message: `Task with ID ${id} does not exist.`,  });
        }

        // If taskLink is being updated, check for duplicates
        if (taskLink && taskLink !== existingTask.taskLink) {
            const duplicateTask = await Tasks.findOne({ 
                taskLink, 
                _id: { $ne: id } // Exclude current task from duplicate check
            });
            if (duplicateTask) {
                return res.status(409).json({ 
                    success: false,
                    message: `A task with this link already exists. Task: "${duplicateTask.taskName}"`,
                    data: null
                });
            }
        }

        // Update the task
        const updatedTask = await Tasks.findByIdAndUpdate(
            id,
            {
                ...(taskLink && { taskLink }),
                ...(taskGuidelineLink && { taskGuidelineLink }),
                ...(taskName && { taskName }),
                ...(dueDate && { dueDate })
            },
            { new: true, runValidators: true }
        );

        res.status(200).send({
            success: true,
            message: 'Task updated successfully',
            data: updatedTask
        });
    } catch (error) {
        console.error(error);
        
        // Handle MongoDB duplicate key error
        if (error.code === 11000) {
            const duplicatedField = Object.keys(error.keyPattern)[0];
            return res.status(409).json({ 
                success: false,
                message: `A task with this ${duplicatedField} already exists. Please use a different ${duplicatedField}.` 
            });
        }
        
        res.status(500).json({ message: error.message || 'Internal server error', success: false, data: null });
    }
};

const getAssignedTasks = async (req, res) => {
    try {
        // Get user ID from authenticated token
        const userId = req.user.userId;
        console.log("🔍 Looking for assignments for userId:", userId);

        // Find all task assignments for this user
        const assignments = await taskAssignment.find({ userId })
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
            assignmentId: assignment._id,
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


module.exports = {createTask, getTask, getAllTasks, assignTask, deleteTask, updateTask, getAssignedTasks};