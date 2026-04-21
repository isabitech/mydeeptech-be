const Tasks = require('../models/task.model');
const taskAssignment = require('../models/taskAssignment.model');
const { taskSchema, taskAssignmentSchema } = require('../utils/authValidator');
const Users = require('../models/user');

class TaskService {
    async createTask(body) {
        const { error } = taskSchema.validate(body);
        if (error) throw { status: 400, message: error.details[0].message };

        const { taskLink, taskGuidelineLink, taskName, createdBy, dueDate } = body;
        const newTask = new Tasks({ taskLink, taskGuidelineLink, taskName, createdBy, dueDate });
        await newTask.save();
        return newTask;
    }

    async getTask(id) {
        const task = await Tasks.findById(id);
        if (!task) throw { status: 404, message: 'Task not found' };
        return task;
    }

    async getAllTasks() {
        const tasks = await Tasks.find();
        if (!tasks || tasks.length === 0) throw { status: 404, message: 'No tasks found' };
        return tasks;
    }

    async assignTask(body) {
        const { error } = taskAssignmentSchema.validate(body);
        if (error) throw { status: 400, message: error.details[0].message };

        const { taskId, userId } = body;

        const task = await Tasks.findById(taskId);
        if (!task) throw { status: 404, message: `Task with ID ${taskId} does not exist.` };

        const user = await Users.findById(userId);
        if (!user) throw { status: 404, message: `User with ID ${userId} does not exist.` };

        const newAssignment = new taskAssignment({ taskId, userId });
        await newAssignment.save();
        return newAssignment;
    }
}

module.exports = new TaskService();
