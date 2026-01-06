import projectService from '../services/project.service.js';
import { ResponseHandler, ValidationError } from '../utils/responseHandler.js';
import Joi from 'joi';

class ProjectController {
    static projectSchema = Joi.object({
        projectName: Joi.string().min(4).required(),
        company: Joi.string().min(4).required(),
        dueDate: Joi.date().greater('now').required()
    });

    async createProject(req, res) {
        const { error, value } = ProjectController.projectSchema.validate(req.body);
        if (error) {
            throw new ValidationError(error.details[0].message);
        }

        const newProject = await projectService.createProject(value);
        ResponseHandler.success(res, newProject, 'Project created successfully', 201);
    }

    async getProjects(req, res) {
        const projects = await projectService.getAllProjects();
        ResponseHandler.success(res, projects, 'Projects found');
    }

    async updateProject(req, res) {
        const { error, value } = ProjectController.projectSchema.validate(req.body);
        if (error) {
            throw new ValidationError(error.details[0].message);
        }

        const { id } = req.params;
        const updatedProject = await projectService.updateProject(id, value);
        ResponseHandler.success(res, updatedProject, 'Project updated successfully');
    }

    async deleteProject(req, res) {
        const { id } = req.params;
        await projectService.deleteProject(id);
        ResponseHandler.success(res, null, 'Project deleted successfully');
    }
}

export default new ProjectController();
