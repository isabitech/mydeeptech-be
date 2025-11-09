const express = require('express');
const { signup, login, getAllUsers, getUsers } = require('../controller/user.js'); // Ensure this path is correct
const { createProject, getProject, updateProject, deleteProject } = require('../controller/project.js')
const { createTask, getTask, getAllTasks, assignTask} = require('../controller/task.js')
const {validateVisitor} = require('../controller/validateuser.js')
const dtUserController = require("../controller/dtUser.controller.js");
const { createDTUser, verifyEmail, submitResult, updateUserStatus, setupPassword, dtUserLogin, getDTUserProfile, updateDTUserProfile, resetDTUserPassword, resendVerificationEmail, getAvailableProjects, applyToProject, getUserActiveProjects, getUserInvoices, getUnpaidInvoices, getPaidInvoices, getInvoiceDetails, getInvoiceDashboard } = require("../controller/dtUser.controller.js");
const { authenticateToken, authorizeProfileAccess } = require('../middleware/auth.js');



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
router.get("/verifyDTusermail/:id", verifyEmail);
router.post("/setupPassword", setupPassword);
router.post("/dtUserLogin", dtUserLogin);
router.post("/resendVerificationEmail", resendVerificationEmail);
router.get("/dtUserProfile/:userId", authenticateToken, authorizeProfileAccess, getDTUserProfile);
router.patch("/dtUserProfile/:userId", authenticateToken, authorizeProfileAccess, updateDTUserProfile);
router.patch("/dtUserResetPassword", authenticateToken, resetDTUserPassword);

// Project routes for DTUsers (approved annotators only)
router.get("/projects", authenticateToken, getAvailableProjects);
router.post("/projects/:projectId/apply", authenticateToken, applyToProject);
router.get("/activeProjects/:userId", authenticateToken, getUserActiveProjects);

// DTUser Invoice Routes
router.get('/invoices', authenticateToken, getUserInvoices);
router.get('/invoices/unpaid', authenticateToken, getUnpaidInvoices);
router.get('/invoices/paid', authenticateToken, getPaidInvoices);
router.get('/invoices/dashboard', authenticateToken, getInvoiceDashboard);
router.get('/invoices/:invoiceId', authenticateToken, getInvoiceDetails);

/*router.post("/:id/DTusertosubmitresult", submitResult;
router.put("/Dtuserstatusupdate/:id/status", updateUserStatus); */

module.exports = router;
