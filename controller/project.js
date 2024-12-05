const  projects = require('../models/projects.model');
const {projectSchema} = require('../utils/authValidator')



const createProject = async (req, res)  =>{
    try {
        const { error } = projectSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });
        
        const existingProject = await projects.findOne({projectName: req.body.projectName});
        if(existingProject)
        return res.status(404).send('Project already exists')
        const project = {
            projectName: req.body.projectName,
            company: req.body.company,
            dueDate: req.body.dueDate
        }
        const newProject = new projects(project)
        await newProject.save()
        return res.status(200).send(newProject)
    } catch (error) {
        res.send(error)
        res.status(500).send('An error occurred while updating the project');
    }
};

const getProject = async (req, res)  => {
    const project = await projects.find()
    if(!project)res.status(404).send('projects not found')
        res.status(200).send({
            responseCode: 200,
            message: 'Projects found',
            data: project
    });
};

const updateProject = async (req, res) => {
    try {
        const { error } = loginSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const { id } = req.params
        const {projectName, company, dueDate} = req.body
        if (!ObjectId.isValid(id)) {
            return res.status(400).send('Invalid project ID');
        }
        
        const updatedProject = await projects.findByIdAndUpdate(
            new ObjectId(id),
            {projectName, company, dueDate},
            {new: true, runValidators: true}
        );
        if(!updatedProject)
        { return res.status(404).send('Project not found')

        }
        res.status(200).send({ message: 'Project updated successfully', project: updatedProject });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while updating the project');
    } 
};

const deleteProject = async (req, res) => {
    try {
        const {id} = req.params;
        if(!ObjectId.isValid(id)) {
        return res.status(400).send('Invalid course ID'); 
        };
        const deletedProject = await projects.findByIdAndDelete(
            new ObjectId(id),
        );
        if(!deletedProject) {
            return res.status(200).send({
                message: 'Project deleted successfully'  });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while updating the teacher');
    }
};

module.exports = {createProject, getProject, updateProject, deleteProject};
