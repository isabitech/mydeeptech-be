import taskService from '../services/task.service.js';
import { ResponseHandler } from '../utils/responseHandler.js';
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
        try {
            const { error, value } = TaskController.taskSchema.validate(req.body);
            if (error) {
                return ResponseHandler.error(res, { statusCode: 400, message: error.details[0].message });
            }

            const newTask = await taskService.createTask(value);
            return ResponseHandler.success(res, newTask, 'Task created successfully', 201);
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async getTask(req, res) {
        try {
            const task = await taskService.getTaskById(req.params.id);
            return ResponseHandler.success(res, task, 'Task found successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async getAllTasks(req, res) {
        try {
            const tasks = await taskService.getAllTasks();
            return ResponseHandler.success(res, tasks, 'All Tasks fetched successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async assignTask(req, res) {
        try {
            const { error, value } = TaskController.taskAssignmentSchema.validate(req.body);
            if (error) {
                return ResponseHandler.error(res, { statusCode: 400, message: error.details[0].message });
            }

            const { taskId, userId } = value;
            const newAssignment = await taskService.assignTask(taskId, userId);
            return ResponseHandler.success(res, newAssignment, 'Task assigned successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }
}

export default new TaskController();