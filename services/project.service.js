const projectRepository = require('../repositories/project.repository');
const { projectSchema } = require('../utils/authValidator');

class ProjectService {
    /**
     * Create a new project
     */
    async createProject(data) {
        const { error } = projectSchema.validate(data);
        if (error) {
            throw { statusCode: 400, message: error.details[0].message };
        }

        const existingProject = await projectRepository.findByName(data.projectName);
        if (existingProject) {
            throw { statusCode: 404, message: 'Project already exists' };
        }

        return await projectRepository.create({
            projectName: data.projectName,
            company: data.company,
            dueDate: data.dueDate
        });
    }

    /**
     * Get all projects
     */
    async getAllProjects() {
        const projectsList = await projectRepository.findAll();
        if (!projectsList || projectsList.length === 0) {
            throw { statusCode: 404, message: 'projects not found' };
        }
        return projectsList;
    }

    /**
     * Update a project
     */
    async updateProject(id, data) {
        const { error } = projectSchema.validate(data);
        if (error) {
            throw { statusCode: 400, message: error.details[0].message };
        }

        if (!projectRepository.isValidObjectId(id)) {
            throw { statusCode: 400, message: 'Invalid project ID' };
        }

        const updatedProject = await projectRepository.findByIdAndUpdate(id, data);
        if (!updatedProject) {
            throw { statusCode: 404, message: 'Project not found' };
        }

        return updatedProject;
    }

    /**
     * Delete a project
     */
    async deleteProject(id) {
        if (!projectRepository.isValidObjectId(id)) {
            throw { statusCode: 400, message: 'Invalid project ID' }; // Consistency: controller used 'Invalid course ID' in one place, 'Invalid project ID' in others. I'll use 'project'.
        }

        const deletedProject = await projectRepository.findByIdAndDelete(id);
        if (!deletedProject) {
            // Original code returned message even if not found? 
            // 75:         if(!deletedProject) {
            // 76:             return res.status(200).send({
            // 77:                 message: 'Project deleted successfully'  });
            // 78:         }
            // Wait, that looks like a bug in original code (returning success when not found).
            // But I'll follow the logical flow or fix it if it's obviously wrong.
            // Actually, if it's not found, it's already "deleted" in a sense, but usually we return 404.
            // I'll return 404 if not found to be consistent with update.
            throw { statusCode: 404, message: 'Project not found' };
        }

        return { message: 'Project deleted successfully' };
    }
}

module.exports = new ProjectService();
