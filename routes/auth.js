const express = require('express');
const userController = require('../controllers/user.js'); // Ensure this path is correct
const projectController = require('../controllers/project.js')
const taskController = require('../controllers/task.js')
const { validateVisitor } = require('../controllers/validateuser.js')
const dtUserController = require("../controllers/dtUser.controller.js");
const { authenticateToken, authorizeProfileAccess } = require('../middleware/auth.js');
const { dtUserLoginSchema, dtUserPasswordResetSchema, dtUserPasswordSchema, dtUserPasswordResetSchema, } = require('../utils/authValidator.js')
const validateRequest = require('../middleware/validate-request.middleware');
// Import password reset controllers
const passwordResetController = require('../controllers/passwordReset.controller.js');

// Import Cloudinary upload middleware for result submissions
const { resultFileUpload, idDocumentUpload, resumeUpload } = require('../config/cloudinary');

const router = express.Router()

router.post('/signup', userController.signup);
router.post('/login', userController.login);

// ======================
// PASSWORD RESET ROUTES  
// ======================

// Regular User Password Reset
router.post('/forgot-password', passwordResetController.forgotPassword);
router.post('/reset-password', passwordResetController.resetPassword);

// DTUser Password Reset
router.post('/dtuser-forgot-password', passwordResetController.dtUserForgotPassword);
router.post('/dtuser-reset-password', passwordResetController.dtUserResetPassword);

// Token verification (optional - for frontend validation)
router.get('/verify-reset-token/:token', passwordResetController.verifyResetToken);

// ======================
// OTHER AUTH ROUTES
// ======================

router.get('/getAllUsers', userController.getAllUsers);
router.get('/getUsers', userController.getUsers);
router.get('/users/:userId', userController.getUserById);
router.get('/roles', userController.getRoles);
router.get('/roles/statistics', userController.getRoleStatistics);
router.post('/createProject', projectController.createProject);
router.get('/getProject', projectController.getProject);
router.put('/updateProject/:id', projectController.updateProject);
router.delete('/deleteProject/:id', projectController.deleteProject);
router.post('/createTasks', taskController.createTask);
router.get('/getTask/:id', taskController.getTask);
router.get('/getAllTasks', taskController.getAllTasks);
router.post('/assignTask', taskController.assignTask);
router.post('/emailValidation', validateVisitor);
router.post("/createDTuser", validateRequest({ body: signupSchema }), dtUserController.createDTUser);
router.get("/verifyDTusermail/:id", validateRequest({ params: idSchema, query: resendVerificationEmailSchema }), dtUserController.verifyEmail);
router.post("/setupPassword", validateRequest({ body: dtUserPasswordSchema }), dtUserController.setupPassword);
router.post("/dtUserLogin", validateRequest({ body: loginSchema }), dtUserController.dtUserLogin);
router.get("/me", authenticateToken, dtUserController.me);
router.post("/resendVerificationEmail", validateRequest({ body: resendVerificationEmailSchema }), dtUserController.resendVerificationEmail);
router.get("/dtUserProfile/:userId", authenticateToken, authorizeProfileAccess, validateRequest({ params: idSchema }), dtUserController.getDTUserProfile);
router.patch("/dtUserProfile/:userId", authenticateToken, authorizeProfileAccess, validateRequest({ params: idSchema, body: dtUserProfileUpdateSchema }), dtUserController.updateDTUserProfile);
router.patch("/dtUserResetPassword", authenticateToken, validateRequest({ body: dtUserPasswordResetSchema }), dtUserController.resetDTUserPassword);

// Project routes for DTUsers (approved annotators only)
router.get("/projects", authenticateToken, dtUserController.getAvailableProjects);
// router.post("/projects/manually-apply", dtUserController.manuallyAddUserToProject);
router.post("/projects/:projectId/apply", authenticateToken, dtUserController.applyToProject);
router.get("/projects/:projectId/guidelines", authenticateToken, dtUserController.getProjectGuidelines);
router.get("/activeProjects/:userId", authenticateToken, dtUserController.getUserActiveProjects);

// DTUser Invoice Routes
router.get('/invoices', authenticateToken, dtUserController.getUserInvoices);
router.get('/invoices/unpaid', authenticateToken, dtUserController.getUnpaidInvoices);
router.get('/invoices/paid', authenticateToken, dtUserController.getPaidInvoices);
router.get('/invoices/dashboard', authenticateToken, dtUserController.getInvoiceDashboard);
router.get('/invoices/:invoiceId', authenticateToken, dtUserController.getInvoiceDetails);

// DTUser Dashboard Route - Personal overview for authenticated DTUsers
router.get('/dashboard', authenticateToken, dtUserController.getDTUserDashboard);

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
}, dtUserController.submitResultWithCloudinary);

router.get('/result-submissions', authenticateToken, dtUserController.getUserResultSubmissions);

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
}, dtUserController.uploadIdDocument);

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
}, dtUserController.uploadResume);

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
