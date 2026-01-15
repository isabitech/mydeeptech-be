import Project from '../models/projects.model.js';
import { NotFoundError, ValidationError } from '../utils/responseHandler.js';

/**
 * Simple CRUD service for generic projects.
 */
class ProjectService {
    /**
     * Creates a new project after ensuring the name is unique.
     */
    async createProject(data) {
        // Ensure project name uniqueness before creation
        const existingProject = await Project.findOne({ projectName: data.projectName });
        if (existingProject) {
            throw new ValidationError('Project already exists');
        }

        // Initialize and persist the new project record
        const project = new Project(data);
        await project.save();
        return project;
    }

    async getAllProjects() {
        return await Project.find();
    }

    async getProjectById(id) {
        // Fetch project by ID and validate existence
        const project = await Project.findById(id);
        if (!project) {
            throw new NotFoundError('Project not found');
        }
        return project;
    }

    async updateProject(id, data) {
        // Execute atomic update with validation enforcement
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
