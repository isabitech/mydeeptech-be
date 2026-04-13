const projects = require('../models/projects.model');

class ProjectRepository {
    /**
     * Find all projects
     */
    async findAll() {
        return await projects.find();
    }

    /**
     * Find a project by name
     */
    async findByName(projectName) {
        return await projects.findOne({ projectName });
    }

    /**
     * Find a project by ID
     */
    async findById(id) {
        return await projects.findById(id);
    }

    /**
     * Create a new project
     */
    async create(data) {
        const project = new projects(data);
        return await project.save();
    }

    /**
     * Update a project by ID
     */
    async findByIdAndUpdate(id, data) {
        return await projects.findByIdAndUpdate(
            id,
            data,
            { new: true, runValidators: true }
        );
    }

    /**
     * Delete a project by ID
     */
    async findByIdAndDelete(id) {
        return await projects.findByIdAndDelete(id);
    }
}

module.exports = new ProjectRepository();
