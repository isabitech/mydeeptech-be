const express = require('express');
const { signup, login, getAllUsers, getUsers } = require('../controller/user.js'); // Ensure this path is correct
const { createProject, getProject, updateProject, deleteProject } = require('../controller/project.js')
const { createTask, getTask, getAllTasks, assignTask} = require('../controller/task.js')
const {validateVisitor} = require('../controller/validateuser.js')
const dtUserController = require("../controller/dtUser.controller.js");
const { createDTUser, verifyEmail, submitResult, getAllDTUsers, getDTUser,updateUserStatus,} = require("../controller/dtUser.controller.js");



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
router.get('/getTask/:id', getTask);
router.get('/getAllTasks', getAllTasks);
router.post('/assignTask', assignTask);
router.post('/emailValidation', validateVisitor);
router.post("/createDTuser", createDTUser);
/*router.get("/verifyDTusermail/:id", verifyEmail);
router.post("/:id/DTusertosubmitresult", submitResult);
router.get("/allDTusers", getAllDTUsers);
router.put("/Dtuserstatusupdate/:id/status", updateUserStatus);
router.get("/DTsingleuser/:id", getDTUser); */

module.exports = router;
