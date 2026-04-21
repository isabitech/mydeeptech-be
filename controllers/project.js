// Layer: Controller
const projectService = require('../services/project.service');

/**
 * @desc Create a new project
 * @route POST /api/projects
 * @access Private/Admin
 */
const createProject = async (req, res) => {
    try {
        const newProject = await projectService.createProject(req.body);
        return res.status(200).send(newProject);
    } catch (error) {
        console.error('Error creating project:', error);
        if (error.statusCode) {
            return res.status(error.statusCode).send(error.message);
        }
        res.status(500).send('An error occurred while creating the project');
    }
};

/**
 * @desc Get all projects
 * @route GET /api/projects
 * @access Private/Admin
 */
const getProject = async (req, res) => {
    try {
        const projects = await projectService.getAllProjects();
        res.status(200).send({
            responseCode: 200,
            message: 'Projects found',
            data: projects
        });
    } catch (error) {
        console.error('Error fetching projects:', error);
        if (error.statusCode === 404) {
            return res.status(404).send(error.message);
        }
        res.status(500).send('An error occurred while fetching projects');
    }
};

/**
 * @desc Update a project
 * @route PUT /api/projects/:id
 * @access Private/Admin
 */
const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedProject = await projectService.updateProject(id, req.body);
        res.status(200).send({ 
            message: 'Project updated successfully', 
            project: updatedProject 
        });
    } catch (error) {
        console.error('Error updating project:', error);
        if (error.statusCode) {
            // Note: Original code returned error.details[0].message for validation errors
            // The service throws with the same message structure if validation fails.
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: 'An error occurred while updating the project' });
    }
};

/**
 * @desc Delete a project
 * @route DELETE /api/projects/:id
 * @access Private/Admin
 */
const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await projectService.deleteProject(id);
        return res.status(200).send(result);
    } catch (error) {
        console.error('Error deleting project:', error);
        if (error.statusCode) {
            // Original code handling for delete project was a bit inconsistent
            // Let's ensure we return the status and message.
            return res.status(error.statusCode).send(error.message);
        }
        res.status(500).send('An error occurred while deleting the project');
    }
};

module.exports = { createProject, getProject, updateProject, deleteProject };
