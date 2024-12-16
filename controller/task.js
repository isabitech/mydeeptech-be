const tasks = require('../models/task.model');
const {taskSchema} = require('../utils/authValidator')

const createTask = async (req, res) =>  {
    try {
        const {error} = taskSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const {tasklink, taskGuidelineLink, taskName, createdBy,  dueDate} = req.body
        const task = {tasklink, taskGuidelineLink, taskName, createdBy, dueDate}

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
}

module.exports = {createTask};