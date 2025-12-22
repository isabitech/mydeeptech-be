const express = require('express');
const { getAllDTUsers, getAllAdminUsers, getAdminDashboard, approveAnnotator, approveUserForQA, rejectUserForQA, getAllQAUsers, rejectAnnotator, getDTUserAdmin, createAdmin, requestAdminVerification, confirmAdminVerification, verifyAdminOTP, adminLogin } = require('../controller/dtUser.controller.js');
const { createAnnotationProject, getAllAnnotationProjects, getAnnotationProjectDetails, updateAnnotationProject, deleteAnnotationProject, requestProjectDeletionOTP, verifyOTPAndDeleteProject, getAnnotationProjectApplications, approveAnnotationProjectApplication, rejectAnnotationProjectApplication, removeApprovedApplicant, getRemovableApplicants, exportApprovedAnnotatorsCSV, attachAssessmentToProject, removeAssessmentFromProject, getAvailableAssessments } = require('../controller/annotationProject.controller.js');
const { createInvoice, getAllInvoices, getInvoiceDetails, updatePaymentStatus, sendInvoiceReminder, deleteInvoice } = require('../controller/invoice.controller.js');
const { getAdminNotifications, createAnnouncement, getNotificationStats, cleanupNotifications, broadcastNotification } = require('../controller/notification.controller.js');
const { getAdminAssessments, getAdminAssessmentsOverview } = require('../controller/assessment.controller.js');
const { addVideoReel, getAllVideoReels, getVideoReelById, updateVideoReel, deleteVideoReel, bulkAddVideoReels, getVideoReelAnalytics } = require('../controller/videoReel.controller.js');
const { createAssessmentConfig, getAllAssessmentConfigs, getAssessmentConfigById, updateAssessmentConfig, deleteAssessmentConfig, getAssessmentConfigByProject } = require('../controller/multimediaAssessmentConfig.controller.js');
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
router.patch('/dtusers/:userId/qa-approve', authenticateAdmin, approveUserForQA);
router.patch('/dtusers/:userId/qa-reject', authenticateAdmin, rejectUserForQA);
router.get('/qa-users', authenticateAdmin, getAllQAUsers);
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

// Project Assessment Integration Routes
router.post('/projects/:projectId/assessment', authenticateAdmin, attachAssessmentToProject);
router.delete('/projects/:projectId/assessment', authenticateAdmin, removeAssessmentFromProject);

// Application Management Routes
router.get('/applications', authenticateAdmin, getAnnotationProjectApplications);
router.patch('/applications/:applicationId/approve', authenticateAdmin, approveAnnotationProjectApplication);
router.patch('/applications/:applicationId/reject', authenticateAdmin, rejectAnnotationProjectApplication);
router.delete('/applications/:applicationId/remove', authenticateAdmin, removeApprovedApplicant);

// Project Applicant Management Routes
router.get('/projects/:projectId/removable-applicants', authenticateAdmin, getRemovableApplicants);
router.get('/projects/:projectId/export-approved-csv', authenticateAdmin, exportApprovedAnnotatorsCSV);

// Invoice Management Routes
router.post('/invoices', authenticateAdmin, createInvoice);
router.get('/invoices', authenticateAdmin, getAllInvoices);
router.get('/invoices/:invoiceId', authenticateAdmin, getInvoiceDetails);
router.patch('/invoices/:invoiceId/payment-status', authenticateAdmin, updatePaymentStatus);
router.post('/invoices/:invoiceId/send-reminder', authenticateAdmin, sendInvoiceReminder);
router.delete('/invoices/:invoiceId', authenticateAdmin, deleteInvoice);

// Notification Management Routes
router.get('/notifications', authenticateAdmin, getAdminNotifications);
router.post('/notifications', authenticateAdmin, require('../controller/notification.controller.js').createAdminNotification);
router.put('/notifications/:notificationId', authenticateAdmin, require('../controller/notification.controller.js').updateAdminNotification);
router.delete('/notifications/:notificationId', authenticateAdmin, require('../controller/notification.controller.js').deleteAdminNotification);
router.post('/notifications/announcement', authenticateAdmin, createAnnouncement);
router.get('/notifications/stats', authenticateAdmin, getNotificationStats);
router.delete('/notifications/cleanup', authenticateAdmin, cleanupNotifications);
router.get('/notifications/analytics', authenticateAdmin, require('../controller/notification.controller.js').getAdminNotificationAnalytics);

// Admin Notification Broadcast Endpoint
router.post('/notifications/broadcast', authenticateAdmin, broadcastNotification);

// Assessment Management Routes
router.get('/assessments', authenticateAdmin, getAdminAssessments);
router.get('/assessments/overview', authenticateAdmin, getAdminAssessmentsOverview);
router.get('/assessments/available', authenticateAdmin, getAllAssessmentConfigs);

// Assessment Configuration Management Routes  
router.post('/assessments/config', authenticateAdmin, createAssessmentConfig);
router.get('/assessments/config', authenticateAdmin, getAllAssessmentConfigs);
router.get('/assessments/config/:assessmentId', authenticateAdmin, getAssessmentConfigById);
router.patch('/assessments/config/:assessmentId', authenticateAdmin, updateAssessmentConfig);
router.delete('/assessments/config/:assessmentId', authenticateAdmin, deleteAssessmentConfig);

// Multimedia Assessment - Video Reel Management Routes
router.post('/multimedia-assessments/reels/add', authenticateAdmin, addVideoReel);
router.post('/multimedia-assessments/reels/bulk-add', authenticateAdmin, bulkAddVideoReels);
router.get('/multimedia-assessments/reels', authenticateAdmin, getAllVideoReels);
router.get('/multimedia-assessments/reels/:reelId', authenticateAdmin, getVideoReelById);
router.put('/multimedia-assessments/reels/:reelId', authenticateAdmin, updateVideoReel);
router.delete('/multimedia-assessments/reels/:reelId', authenticateAdmin, deleteVideoReel);
router.get('/multimedia-assessments/reels/analytics', authenticateAdmin, getVideoReelAnalytics);

module.exports = router;