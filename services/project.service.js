import Project from '../models/projects.model.js';
import { NotFoundError, ValidationError } from '../utils/responseHandler.js';

class ProjectService {
    async createProject(data) {
        const existingProject = await Project.findOne({ projectName: data.projectName });
        if (existingProject) {
            throw new ValidationError('Project already exists');
        }

        const project = new Project(data);
        await project.save();
        return project;
    }

    async getAllProjects() {
        return await Project.find();
    }

    async getProjectById(id) {
        const project = await Project.findById(id);
        if (!project) {
            throw new NotFoundError('Project not found');
        }
        return project;
    }

    async updateProject(id, data) {
        const updatedProject = await Project.findByIdAndUpdate(
            id,
            data,
            { new: true, runValidators: true }
        );

        if (!updatedProject) {
            throw new NotFoundError('Project not found');
        }

        return updatedProject;
    }

    async deleteProject(id) {
        const deletedProject = await Project.findByIdAndDelete(id);
        if (!deletedProject) {
            throw new NotFoundError('Project not found');
        }
        return deletedProject;
    }
}

export default new ProjectService();
