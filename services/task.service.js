import Task from '../models/task.model.js';
import TaskAssignment from '../models/taskAssignment.model.js';
import User from '../models/user.js';
import { NotFoundError, ValidationError } from '../utils/responseHandler.js';

class TaskService {
    async createTask(data) {
        const newTask = new Task(data);
        await newTask.save();
        return newTask;
    }

    async getTaskById(id) {
        const task = await Task.findById(id);
        if (!task) {
            throw new NotFoundError('Task not found');
        }
        return task;
    }

    async getAllTasks() {
        return await Task.find();
    }

    async assignTask(taskId, userId) {
        // Check if Task exists
        const task = await Task.findById(taskId);
        if (!task) {
            throw new NotFoundError(`Task with ID ${taskId} does not exist.`);
        }

        // Check if User exists
        const user = await User.findById(userId);
        if (!user) {
            throw new NotFoundError(`User with ID ${userId} does not exist.`);
        }

        const newAssignment = new TaskAssignment({ taskId, userId });
        await newAssignment.save();
        return newAssignment;
    }
}

export default new TaskService();
