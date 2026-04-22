const projectRepository = require('../repositories/project.repository');
const { projectSchema } = require('../utils/authValidator');

class ProjectService {
    validateProjectData(data) {
        const { error } = projectSchema.validate(data);
        if (error) {
            throw { statusCode: 400, message: error.details[0].message };
        }
    }

    ensureValidProjectId(id) {
        if (!projectRepository.isValidObjectId(id)) {
            throw { statusCode: 400, message: 'Invalid project ID' };
        }
    }

    /**
     * Create a new project
     */
    async createProject(data) {
        this.validateProjectData(data);

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
        this.validateProjectData(data);
        this.ensureValidProjectId(id);

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
        this.ensureValidProjectId(id);

        const deletedProject = await projectRepository.findByIdAndDelete(id);
        if (!deletedProject) {
            throw { statusCode: 404, message: 'Project not found' };
        }

        return { message: 'Project deleted successfully' };
    }
}

module.exports = new ProjectService();
