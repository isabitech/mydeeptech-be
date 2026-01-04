import projectService from '../services/project.service.js';
import { ResponseHandler } from '../utils/responseHandler.js';
import Joi from 'joi';

class ProjectController {
    static projectSchema = Joi.object({
        projectName: Joi.string().min(4).required(),
        company: Joi.string().min(4).required(),
        dueDate: Joi.date().greater('now').required()
    });

    async createProject(req, res) {
        try {
            const { error, value } = ProjectController.projectSchema.validate(req.body);
            if (error) {
                return ResponseHandler.error(res, { statusCode: 400, message: error.details[0].message });
            }

            const newProject = await projectService.createProject(value);
            return ResponseHandler.success(res, newProject, 'Project created successfully', 201);
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async getProjects(req, res) {
        try {
            const projects = await projectService.getAllProjects();
            return ResponseHandler.success(res, projects, 'Projects found');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async updateProject(req, res) {
        try {
            const { error, value } = ProjectController.projectSchema.validate(req.body);
            if (error) {
                return ResponseHandler.error(res, { statusCode: 400, message: error.details[0].message });
            }

            const { id } = req.params;
            const updatedProject = await projectService.updateProject(id, value);
            return ResponseHandler.success(res, updatedProject, 'Project updated successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }

    async deleteProject(req, res) {
        try {
            const { id } = req.params;
            await projectService.deleteProject(id);
            return ResponseHandler.success(res, null, 'Project deleted successfully');
        } catch (error) {
            return ResponseHandler.error(res, error);
        }
    }
}

export default new ProjectController();
