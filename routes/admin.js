const express = require('express');
const { getAllDTUsers, getAllAdminUsers, getAdminDashboard, approveAnnotator, rejectAnnotator, getDTUserAdmin, createAdmin, requestAdminVerification, confirmAdminVerification, verifyAdminOTP, adminLogin } = require('../controller/dtUser.controller.js');
const { createAnnotationProject, getAllAnnotationProjects, getAnnotationProjectDetails, updateAnnotationProject, deleteAnnotationProject, requestProjectDeletionOTP, verifyOTPAndDeleteProject, getAnnotationProjectApplications, approveAnnotationProjectApplication, rejectAnnotationProjectApplication, removeApprovedApplicant, getRemovableApplicants } = require('../controller/annotationProject.controller.js');
const { createInvoice, getAllInvoices, getInvoiceDetails, updatePaymentStatus, sendInvoiceReminder, deleteInvoice } = require('../controller/invoice.controller.js');
const { getAdminNotifications, createAnnouncement, getNotificationStats, cleanupNotifications } = require('../controller/notification.controller.js');
const { getAdminAssessments } = require('../controller/assessment.controller.js');
const { authenticateAdmin } = require('../middleware/adminAuth.js');

const router = express.Router();

// Admin Authentication
router.post('/login', adminLogin);
router.post('/register', createAdmin);  // Simple register route for testing

// Admin Creation Routes - Two-step process with email verification
router.post('/create/request', requestAdminVerification);  // Step 1: Request verification code
router.post('/create/confirm', confirmAdminVerification);  // Step 2: Confirm with code

// Admin OTP Verification Route (for email verification after account creation)
router.post('/verify-otp', verifyAdminOTP);  // Verify OTP and complete account setup

// Legacy admin creation route (kept for backward compatibility)
router.post('/create', createAdmin);

// Admin Routes - All require admin authentication
router.get('/dashboard', authenticateAdmin, getAdminDashboard);
router.get('/dtusers', authenticateAdmin, getAllDTUsers);
router.get('/admin-users', authenticateAdmin, getAllAdminUsers);
router.get('/dtusers/:userId', authenticateAdmin, getDTUserAdmin);
router.patch('/dtusers/:userId/approve', authenticateAdmin, approveAnnotator);
router.patch('/dtusers/:userId/reject', authenticateAdmin, rejectAnnotator);

// Project Management Routes
router.post('/projects', authenticateAdmin, createAnnotationProject);
router.get('/projects', authenticateAdmin, getAllAnnotationProjects);
router.get('/projects/:projectId', authenticateAdmin, getAnnotationProjectDetails);
router.patch('/projects/:projectId', authenticateAdmin, updateAnnotationProject);
router.delete('/projects/:projectId', authenticateAdmin, deleteAnnotationProject);

// Project Deletion with OTP Routes (Projects Officer Authorization)
router.post('/projects/:projectId/request-deletion-otp', authenticateAdmin, requestProjectDeletionOTP);
router.post('/projects/:projectId/verify-deletion-otp', authenticateAdmin, verifyOTPAndDeleteProject);

// Application Management Routes
router.get('/applications', authenticateAdmin, getAnnotationProjectApplications);
router.patch('/applications/:applicationId/approve', authenticateAdmin, approveAnnotationProjectApplication);
router.patch('/applications/:applicationId/reject', authenticateAdmin, rejectAnnotationProjectApplication);
router.delete('/applications/:applicationId/remove', authenticateAdmin, removeApprovedApplicant);

// Project Applicant Management Routes
router.get('/projects/:projectId/removable-applicants', authenticateAdmin, getRemovableApplicants);

// Invoice Management Routes
router.post('/invoices', authenticateAdmin, createInvoice);
router.get('/invoices', authenticateAdmin, getAllInvoices);
router.get('/invoices/:invoiceId', authenticateAdmin, getInvoiceDetails);
router.patch('/invoices/:invoiceId/payment-status', authenticateAdmin, updatePaymentStatus);
router.post('/invoices/:invoiceId/send-reminder', authenticateAdmin, sendInvoiceReminder);
router.delete('/invoices/:invoiceId', authenticateAdmin, deleteInvoice);

// Notification Management Routes
router.get('/notifications', authenticateAdmin, getAdminNotifications);
router.post('/notifications/announcement', authenticateAdmin, createAnnouncement);
router.get('/notifications/stats', authenticateAdmin, getNotificationStats);
router.delete('/notifications/cleanup', authenticateAdmin, cleanupNotifications);

// Assessment Management Routes
router.get('/assessments', authenticateAdmin, getAdminAssessments);

module.exports = router;