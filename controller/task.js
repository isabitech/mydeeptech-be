const Tasks = require('../models/task.model');
const taskAssignment = require('../models/taskAssignment.model');
const {taskSchema, taskAssignmentSchema} = require('../utils/authValidator');
const Users = require('../models/user');

const createTask = async (req, res) =>  {
    try {
        const {error} = taskSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const {taskLink, taskGuidelineLink, taskName, createdBy,  dueDate} = req.body
        const task = {taskLink, taskGuidelineLink, taskName, createdBy, dueDate}

        const newTask = new tasks(task)
        await newTask.save();

        res.status(200).send({


            responseCode: "90",
            responseMessage: 'Task created successfully',
            data: newTask
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.details[0].message });
    }
};

const getTask = async (req, res) => {
    try {
        const task = tasks.findById({ id : req.params.id})
        if (!task) 
            return res.status(404).send('Task not found')

        res.status(200).send({
            responseCode: '90',
            responseMessage: 'Task found successfully',
            data: task
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.details[0].message });
    }
};

const getAllTasks = async (req, res) => {
    try {
        const task = tasks.find()
        if(!task)
            return res.status(404).send('Task not found')

        res.status(200).send({
            responseCode: '90',
            responseMessage: 'All Tasks fetched successfully',
            data: task
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.details[0].message }); 
    }
};

const assignTask = async (req, res) => {
    try {
        // Step 1: Validate input with Joi
        const { error } = taskAssignmentSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const { taskId, userId } = req.body;

        // Step 2: Check if Task exists
        const task = await Tasks.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: `Task with ID ${taskId} does not exist.` });
        }

        // Step 3: Check if User exists
        const user = await Users.findById(userId);
        if (!user) {
            return res.status(404).json({ message: `User with ID ${userId} does not exist.` });
        }

        // Step 4: Create a new task assignment
        const taskAssign = { taskId, userId }; // Construct assignment object
        const newAssignment = new taskAssignment(taskAssign);
        await newAssignment.save();

        // Step 5: Return success response
        res.status(200).send({
            responseCode: '90',
            responseMessage: 'Task assigned successfully',
            data: newAssignment,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};


module.exports = {createTask, getTask, getAllTasks, assignTask};