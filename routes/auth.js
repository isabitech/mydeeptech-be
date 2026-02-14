const express = require('express');
const { signup, login, getAllUsers, getUsers, updateUserRole, getUserById, getRoles, getRoleStatistics } = require('../controllers/user.js'); // Ensure this path is correct
const { createProject, getProject, updateProject, deleteProject } = require('../controllers/project.js')
const { createTask, getTask, getAllTasks, assignTask} = require('../controllers/task.js')
const {validateVisitor} = require('../controllers/validateuser.js')
const dtUserController = require("../controllers/dtUser.controller.js");
const { createDTUser, verifyEmail, submitResult, updateUserStatus, setupPassword, dtUserLogin, getDTUserProfile, updateDTUserProfile, resetDTUserPassword, resendVerificationEmail, getAvailableProjects, applyToProject, getUserActiveProjects, getUserInvoices, getUnpaidInvoices, getPaidInvoices, getInvoiceDetails, getInvoiceDashboard, getDTUserDashboard, submitResultWithCloudinary, getUserResultSubmissions, uploadIdDocument, uploadResume, getProjectGuidelines } = require("../controllers/dtUser.controller.js");
const { authenticateToken, authorizeProfileAccess } = require('../middleware/auth.js');

// Import password reset controllers
const { 
  forgotPassword, 
  resetPassword, 
  dtUserForgotPassword, 
  dtUserResetPassword, 
  verifyResetToken 
} = require('../controllers/passwordReset.controller.js');

// Import Cloudinary upload middleware for result submissions
const { resultFileUpload, idDocumentUpload, resumeUpload } = require('../config/cloudinary');



const router = express.Router()

router.post('/signup', signup);
router.post('/login', login);

// ======================
// PASSWORD RESET ROUTES  
// ======================

// Regular User Password Reset
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// DTUser Password Reset
router.post('/dtuser-forgot-password', dtUserForgotPassword);
router.post('/dtuser-reset-password', dtUserResetPassword);

// Token verification (optional - for frontend validation)
router.get('/verify-reset-token/:token', verifyResetToken);

// ======================
// OTHER AUTH ROUTES
// ======================

router.get('/getAllUsers', getAllUsers);
router.get('/getUsers', getUsers);
router.get('/users/:userId', getUserById);
router.get('/roles', getRoles);
router.get('/roles/statistics', getRoleStatistics);
router.post('/createProject', createProject);
router.get('/getProject', getProject);
router.put('/updateProject/:id', updateProject);
router.delete('/deleteProject/:id', deleteProject);
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
router.get("/projects/:projectId/guidelines", authenticateToken, getProjectGuidelines);
router.get("/activeProjects/:userId", authenticateToken, getUserActiveProjects);

// DTUser Invoice Routes
router.get('/invoices', authenticateToken, getUserInvoices);
router.get('/invoices/unpaid', authenticateToken, getUnpaidInvoices);
router.get('/invoices/paid', authenticateToken, getPaidInvoices);
router.get('/invoices/dashboard', authenticateToken, getInvoiceDashboard);
router.get('/invoices/:invoiceId', authenticateToken, getInvoiceDetails);

// DTUser Dashboard Route - Personal overview for authenticated DTUsers
router.get('/dashboard', authenticateToken, getDTUserDashboard);

// DTUser Result Submission Routes (NEW) - flexible field names
router.post('/submit-result', authenticateToken, (req, res, next) => {
  // Create a flexible upload handler that accepts different field names
  const upload = resultFileUpload.fields([
    { name: 'resultFile', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'result', maxCount: 1 },
    { name: 'upload', maxCount: 1 },
    { name: 'screenshots', maxCount: 1 }  // Added support for 'screenshots' field
  ]);

  upload(req, res, (err) => {
    if (err) {
      console.error('❌ Upload error:', err);
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
        error: err.code || 'UPLOAD_ERROR'
      });
    }

    // Find which field was used and normalize to req.file
    if (req.files) {
      const fileField = req.files.resultFile || req.files.file || req.files.result || req.files.upload || req.files.screenshots;
      if (fileField && fileField[0]) {
        req.file = fileField[0];
        console.log(`📁 File received via field: ${req.file.fieldname}`);
      }
    }

    // Proceed to the controller
    next();
  });
}, submitResultWithCloudinary);

router.get('/result-submissions', authenticateToken, getUserResultSubmissions);

// Upload ID Document Route - adds to profile information
router.post('/upload-id-document', authenticateToken, (req, res, next) => {
  console.log('🚀 ID document upload endpoint hit');

  // Create a flexible upload handler for ID documents
  const upload = idDocumentUpload.fields([
    { name: 'idDocument', maxCount: 1 },
    { name: 'id_document', maxCount: 1 },
    { name: 'document', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ]);


  upload(req, res, (err) => {
    if (err) {
      console.error('❌ ID document upload error:', err);
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
        error: err.code || 'UPLOAD_ERROR'
      });
    }

    // Find which field was used and normalize to req.file
    if (req.files) {
      const fileField = req.files.idDocument || req.files.id_document || req.files.document || req.files.file;
      if (fileField && fileField[0]) {
        req.file = fileField[0];
        console.log(`🆔 ID document received via field: ${req.file.fieldname}`);
      }
    }

    // Proceed to the controller
    next();
  });
}, uploadIdDocument);

// Upload Resume Route - adds to profile information  
router.post('/upload-resume', authenticateToken, (req, res, next) => {
  // Create a flexible upload handler for resumes
  const upload = resumeUpload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'cv', maxCount: 1 },
    { name: 'document', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ]);

  upload(req, res, (err) => {
    if (err) {
      console.error('❌ Resume upload error:', err);
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
        error: err.code || 'UPLOAD_ERROR'
      });
    }

    // Find which field was used and normalize to req.file
    if (req.files) {
      const fileField = req.files.resume || req.files.cv || req.files.document || req.files.file;
      if (fileField && fileField[0]) {
        req.file = fileField[0];
        console.log(`📄 Resume received via field: ${req.file.fieldname}`);
      }
    }

    // Proceed to the controller
    next();
  });
}, uploadResume);

// Debug endpoint to test file upload (temporary)
router.post('/debug-upload', authenticateToken, (req, res) => {
  console.log('🐛 Debug upload endpoint hit');
  console.log('Headers:', req.headers);
  console.log('Body keys:', Object.keys(req.body));
  console.log('Files:', req.files);
  console.log('File:', req.file);
  
  res.json({
    success: true,
    message: 'Debug endpoint - check server logs for details',
    data: {
      headers: req.headers,
      bodyKeys: Object.keys(req.body),
      hasFiles: !!req.files,
      hasFile: !!req.file,
      contentType: req.get('Content-Type')
    }
  });
});

/*router.post("/:id/DTusertosubmitresult", submitResult;
router.put("/Dtuserstatusupdate/:id/status", updateUserStatus); */

module.exports = router;
