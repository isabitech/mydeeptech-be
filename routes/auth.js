import express from 'express';
import userController from '../controller/user.js';
import projectController from '../controller/project.js';
import taskController from '../controller/task.js';
import validateUserController from '../controller/validateuser.js';
import dtUserController from "../controller/dtUser.controller.js";
import { authenticateToken, authorizeProfileAccess } from '../middleware/auth.js';
import passwordResetController from '../controller/passwordReset.controller.js';
import { resultFileUpload, idDocumentUpload, resumeUpload } from '../config/cloudinary.js';
import tryCatch from '../utils/tryCatch.js';

const router = express.Router();

const { signup, login, getAllUsers, getUsers } = userController;
const { createProject, getProject, updateProject, deleteProject } = projectController;
const { createTask, getTask, getAllTasks, assignTask } = taskController;
const { validateVisitor } = validateUserController;
const {
  createDTUser, verifyEmail, setupPassword, dtUserLogin,
  getDTUserProfile, updateDTUserProfile, resetDTUserPassword,
  resendVerificationEmail, getAvailableProjects, applyToProject,
  getUserActiveProjects, getUserInvoices, getUnpaidInvoices,
  getPaidInvoices, getInvoiceDetails, getInvoiceDashboard,
  getDTUserDashboard, submitResultWithCloudinary, getUserResultSubmissions,
  uploadIdDocument, uploadResume, getProjectGuidelines
} = dtUserController;

const {
  forgotPassword, resetPassword, dtUserForgotPassword,
  dtUserResetPassword, verifyResetToken
} = passwordResetController;

router.post('/signup', tryCatch(signup));
router.post('/login', tryCatch(login));

// ======================
// PASSWORD RESET ROUTES  
// ======================

// Regular User Password Reset
router.post('/forgot-password', tryCatch(forgotPassword));
router.post('/reset-password', tryCatch(resetPassword));

// DTUser Password Reset
router.post('/dtuser-forgot-password', tryCatch(dtUserForgotPassword));
router.post('/dtuser-reset-password', tryCatch(dtUserResetPassword));

// Token verification (optional - for frontend validation)
router.get('/verify-reset-token/:token', tryCatch(verifyResetToken));

// ======================
// OTHER AUTH ROUTES
// ======================

// Regular User Auth Routes (Admin only for listing)
router.get('/getAllUsers', authenticateToken, tryCatch(getAllUsers));
router.get('/getUsers', authenticateToken, tryCatch(getUsers));
router.post('/createProject', authenticateToken, tryCatch(createProject));
router.get('/getProject', authenticateToken, tryCatch(getProject));
router.put('/updateProject/:id', authenticateToken, tryCatch(updateProject));
router.delete('/deleteProject/:id', authenticateToken, tryCatch(deleteProject));
router.post('/createTasks', authenticateToken, tryCatch(createTask));
router.get('/getTask/:id', authenticateToken, tryCatch(getTask));
router.get('/getAllTasks', authenticateToken, tryCatch(getAllTasks));
router.post('/assignTask', authenticateToken, tryCatch(assignTask));
router.post('/emailValidation', tryCatch(validateVisitor));
router.post("/createDTuser", tryCatch(createDTUser));
router.get("/verifyDTusermail/:id", tryCatch(verifyEmail));
router.post("/setupPassword", tryCatch(setupPassword));
router.post("/dtUserLogin", tryCatch(dtUserLogin));
router.post("/resendVerificationEmail", tryCatch(resendVerificationEmail));
router.get("/dtUserProfile/:userId", authenticateToken, authorizeProfileAccess, tryCatch(getDTUserProfile));
router.patch("/dtUserProfile/:userId", authenticateToken, authorizeProfileAccess, tryCatch(updateDTUserProfile));
router.patch("/dtUserResetPassword", authenticateToken, tryCatch(resetDTUserPassword));

// Project routes for DTUsers (approved annotators only)
router.get("/projects", authenticateToken, tryCatch(getAvailableProjects));
router.post("/projects/:projectId/apply", authenticateToken, tryCatch(applyToProject));
router.get("/projects/:projectId/guidelines", authenticateToken, tryCatch(getProjectGuidelines));
router.get("/activeProjects/:userId", authenticateToken, tryCatch(getUserActiveProjects));

// DTUser Invoice Routes
router.get('/invoices', authenticateToken, tryCatch(getUserInvoices));
router.get('/invoices/unpaid', authenticateToken, tryCatch(getUnpaidInvoices));
router.get('/invoices/paid', authenticateToken, tryCatch(getPaidInvoices));
router.get('/invoices/dashboard', authenticateToken, tryCatch(getInvoiceDashboard));
router.get('/invoices/:invoiceId', authenticateToken, tryCatch(getInvoiceDetails));

// DTUser Dashboard Route - Personal overview for authenticated DTUsers
router.get('/dashboard', authenticateToken, tryCatch(getDTUserDashboard));

router.post('/submit-result', authenticateToken, (req, res, next) => {
  const upload = resultFileUpload.fields([
    { name: 'resultFile', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'result', maxCount: 1 },
    { name: 'upload', maxCount: 1 },
    { name: 'screenshots', maxCount: 1 }
  ]);

  upload(req, res, (err) => {
    if (err) return next(err);

    if (req.files) {
      const fileField = req.files.resultFile || req.files.file || req.files.result || req.files.upload || req.files.screenshots;
      if (fileField && fileField[0]) {
        req.file = fileField[0];
      }
    }
    next();
  });
}, tryCatch(submitResultWithCloudinary));

router.get('/result-submissions', authenticateToken, tryCatch(getUserResultSubmissions));

// Upload ID Document Route - adds to profile information
router.post('/upload-id-document', authenticateToken, (req, res, next) => {
  const upload = idDocumentUpload.fields([
    { name: 'idDocument', maxCount: 1 },
    { name: 'id_document', maxCount: 1 },
    { name: 'document', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ]);

  upload(req, res, (err) => {
    if (err) return next(err);

    if (req.files) {
      const fileField = req.files.idDocument || req.files.id_document || req.files.document || req.files.file;
      if (fileField && fileField[0]) {
        req.file = fileField[0];
      }
    }
    next();
  });
}, tryCatch(uploadIdDocument));

// Upload Resume Route - adds to profile information  
router.post('/upload-resume', authenticateToken, (req, res, next) => {
  const upload = resumeUpload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'cv', maxCount: 1 },
    { name: 'document', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ]);

  upload(req, res, (err) => {
    if (err) return next(err);

    if (req.files) {
      const fileField = req.files.resume || req.files.cv || req.files.document || req.files.file;
      if (fileField && fileField[0]) {
        req.file = fileField[0];
      }
    }
    next();
  });
}, tryCatch(uploadResume));

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

export default router;
