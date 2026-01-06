import taskService from '../services/task.service.js';
import { ResponseHandler, ValidationError } from '../utils/responseHandler.js';
import Joi from 'joi';

class TaskController {
    static taskSchema = Joi.object({
        taskLink: Joi.string().uri().required(),
        taskGuidelineLink: Joi.string().min(4).required(),
        taskName: Joi.string().min(4).required(),
        createdBy: Joi.string().min(4).required(),
        dueDate: Joi.date().greater('now').required()
    });

    static taskAssignmentSchema = Joi.object({
        taskId: Joi.string().min(5).required(),
        userId: Joi.string().min(5).required()
    });

    async createTask(req, res) {
        const { error, value } = TaskController.taskSchema.validate(req.body);
        if (error) {
            throw new ValidationError(error.details[0].message);
        }

        const newTask = await taskService.createTask(value);
        ResponseHandler.success(res, newTask, 'Task created successfully', 201);
    }

    async getTask(req, res) {
        const task = await taskService.getTaskById(req.params.id);
        ResponseHandler.success(res, task, 'Task found successfully');
    }

    async getAllTasks(req, res) {
        const tasks = await taskService.getAllTasks();
        ResponseHandler.success(res, tasks, 'All Tasks fetched successfully');
    }

    async assignTask(req, res) {
        const { error, value } = TaskController.taskAssignmentSchema.validate(req.body);
        if (error) {
            throw new ValidationError(error.details[0].message);
        }

        const { taskId, userId } = value;
        const newAssignment = await taskService.assignTask(taskId, userId);
        ResponseHandler.success(res, newAssignment, 'Task assigned successfully');
    }
}

export default new TaskController();