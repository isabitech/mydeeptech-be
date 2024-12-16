const express = require('express');
const { signup, login, getAllUsers, getUsers } = require('../controller/user.js'); // Ensure this path is correct
const { createProject, getProject, updateProject, deleteProject } = require('../controller/project.js')
const { createTask} = require('../controller/task.js')



const router = express.Router()

router.post('/signup', signup);
router.post('/login', login);
router.get('/getAllUsers', getAllUsers);
router.get('/getUsers', getUsers)
router.post('/createProject', createProject);
router.get('/getProject', getProject)
router.put('/updateProject/:id', updateProject)
router.delete('/deleteProject/:id', deleteProject)
router.post('/createTasks', createTask);


module.exports = router;
