import express from 'express';
import dtUserController from '../controller/dtUser.controller.js';
import annotationProjectController from '../controller/annotationProject.controller.js';
import invoiceController from '../controller/invoice.controller.js';
import notificationController from '../controller/notification.controller.js';
import assessmentController from '../controller/assessment.controller.js';
import videoReelController from '../controller/videoReel.controller.js';
import multimediaAssessmentConfigController from '../controller/multimediaAssessmentConfig.controller.js';
import { authenticateAdmin } from '../middleware/adminAuth.js';
import tryCatch from '../utils/tryCatch.js';

const router = express.Router();

const {
    getAllDTUsers, getAllAdminUsers, getAdminDashboard,
    approveAnnotator, approveUserForQA, rejectUserForQA,
    getAllQAUsers, rejectAnnotator, getDTUserAdmin,
    createAdmin, requestAdminVerification, confirmAdminVerification,
    verifyAdminOTP, adminLogin
} = dtUserController;

const {
    createAnnotationProject, getAllAnnotationProjects, getAnnotationProjectDetails,
    updateAnnotationProject, deleteAnnotationProject, requestProjectDeletionOTP,
    verifyOTPAndDeleteProject, getAnnotationProjectApplications,
    approveAnnotationProjectApplication, rejectAnnotationProjectApplication,
    rejectAnnotationProjectApplicationsBulk, getApprovedApplicants,
    removeApprovedApplicant, getRemovableApplicants, exportApprovedAnnotatorsCSV,
    attachAssessmentToProject, removeAssessmentFromProject, getAvailableAssessments
} = annotationProjectController;

const {
    createInvoice, getAllInvoices, getInvoiceDetails,
    updatePaymentStatus, sendInvoiceReminder, deleteInvoice,
    bulkAuthorizePayment, generatePaystackCSV, generateMPESACSV
} = invoiceController;

const {
    getAdminNotifications, createAnnouncement, getNotificationStats,
    cleanupNotifications, broadcastNotification,
    createAdminNotification, updateAdminNotification, deleteAdminNotification,
    getAdminNotificationAnalytics
} = notificationController;

const { getAdminAssessments, getAdminAssessmentsOverview } = assessmentController;

const {
    addVideoReel, getAllVideoReels, getVideoReelById,
    updateVideoReel, deleteVideoReel, bulkAddVideoReels,
    getVideoReelAnalytics
} = videoReelController;

const {
    createAssessmentConfig, getAllAssessmentConfigs, getAssessmentConfigById,
    updateAssessmentConfig, deleteAssessmentConfig, getAssessmentConfigByProject
} = multimediaAssessmentConfigController;

// Admin Authentication
router.post('/login', tryCatch(adminLogin));
router.post('/register', tryCatch(createAdmin));  // Simple register route for testing

// Admin Creation Routes - Two-step process with email verification
router.post('/create/request', tryCatch(requestAdminVerification));  // Step 1: Request verification code
router.post('/create/confirm', tryCatch(confirmAdminVerification));  // Step 2: Confirm with code

// Admin OTP Verification Route (for email verification after account creation)
router.post('/verify-otp', tryCatch(verifyAdminOTP));  // Verify OTP and complete account setup

// Legacy admin creation route (kept for backward compatibility)
router.post('/create', tryCatch(createAdmin));

// Admin Routes - All require admin authentication
router.get('/dashboard', authenticateAdmin, tryCatch(getAdminDashboard));
router.get('/dtusers', authenticateAdmin, tryCatch(getAllDTUsers));
router.get('/admin-users', authenticateAdmin, tryCatch(getAllAdminUsers));
router.get('/dtusers/:userId', authenticateAdmin, tryCatch(getDTUserAdmin));
router.patch('/dtusers/:userId/approve', authenticateAdmin, tryCatch(approveAnnotator));
router.patch('/dtusers/:userId/qa-approve', authenticateAdmin, tryCatch(approveUserForQA));
router.patch('/dtusers/:userId/qa-reject', authenticateAdmin, tryCatch(rejectUserForQA));
router.get('/qa-users', authenticateAdmin, tryCatch(getAllQAUsers));
router.patch('/dtusers/:userId/reject', authenticateAdmin, tryCatch(rejectAnnotator));

// Project Management Routes
router.post('/projects', authenticateAdmin, tryCatch(createAnnotationProject));
router.get('/projects', authenticateAdmin, tryCatch(getAllAnnotationProjects));
router.get('/projects/:projectId', authenticateAdmin, tryCatch(getAnnotationProjectDetails));
router.patch('/projects/:projectId', authenticateAdmin, tryCatch(updateAnnotationProject));
router.delete('/projects/:projectId', authenticateAdmin, tryCatch(deleteAnnotationProject));

// Project Deletion with OTP Routes (Projects Officer Authorization)
router.post('/projects/:projectId/request-deletion-otp', authenticateAdmin, tryCatch(requestProjectDeletionOTP));
router.post('/projects/:projectId/verify-deletion-otp', authenticateAdmin, tryCatch(verifyOTPAndDeleteProject));

// Project Assessment Integration Routes
router.post('/projects/:projectId/assessment', authenticateAdmin, tryCatch(attachAssessmentToProject));
router.delete('/projects/:projectId/assessment', authenticateAdmin, tryCatch(removeAssessmentFromProject));

// Application Management Routes
router.get('/applications', authenticateAdmin, tryCatch(getAnnotationProjectApplications));
router.patch('/applications/:applicationId/approve', authenticateAdmin, tryCatch(approveAnnotationProjectApplication));
router.post('/applications/bulk-reject', authenticateAdmin, tryCatch(rejectAnnotationProjectApplicationsBulk));
router.patch('/applications/:applicationId/reject', authenticateAdmin, tryCatch(rejectAnnotationProjectApplication));
router.delete('/applications/:applicationId/remove', authenticateAdmin, tryCatch(removeApprovedApplicant));

// Project Applicant Management Routes
router.get('/projects/:projectId/approved-applicants', authenticateAdmin, tryCatch(getApprovedApplicants));
router.get('/projects/:projectId/removable-applicants', authenticateAdmin, tryCatch(getRemovableApplicants));
router.get('/projects/:projectId/export-approved-csv', authenticateAdmin, tryCatch(exportApprovedAnnotatorsCSV));

// Invoice Management Routes
router.post('/invoices', authenticateAdmin, tryCatch(createInvoice));
router.get('/invoices', authenticateAdmin, tryCatch(getAllInvoices));
// Bulk Payment Routes for Nigerian Freelancers (must come before :invoiceId routes)
router.post('/invoices/bulk-authorize-payment', authenticateAdmin, tryCatch(bulkAuthorizePayment));
router.get('/invoices/generate-paystack-csv', authenticateAdmin, tryCatch(generatePaystackCSV));
router.get('/invoices/generate-mpesa-csv', authenticateAdmin, tryCatch(generateMPESACSV));
// Specific invoice routes (with parameters)
router.get('/invoices/:invoiceId', authenticateAdmin, tryCatch(getInvoiceDetails));
router.patch('/invoices/:invoiceId/payment-status', authenticateAdmin, tryCatch(updatePaymentStatus));
router.post('/invoices/:invoiceId/send-reminder', authenticateAdmin, tryCatch(sendInvoiceReminder));
router.delete('/invoices/:invoiceId', authenticateAdmin, tryCatch(deleteInvoice));

// Notification Management Routes
router.get('/notifications', authenticateAdmin, tryCatch(getAdminNotifications));
router.post('/notifications', authenticateAdmin, tryCatch(createAdminNotification));
router.put('/notifications/:notificationId', authenticateAdmin, tryCatch(updateAdminNotification));
router.delete('/notifications/:notificationId', authenticateAdmin, tryCatch(deleteAdminNotification));
router.post('/notifications/announcement', authenticateAdmin, tryCatch(createAnnouncement));
router.get('/notifications/stats', authenticateAdmin, tryCatch(getNotificationStats));
router.delete('/notifications/cleanup', authenticateAdmin, tryCatch(cleanupNotifications));
router.get('/notifications/analytics', authenticateAdmin, tryCatch(getAdminNotificationAnalytics));

// Admin Notification Broadcast Endpoint
router.post('/notifications/broadcast', authenticateAdmin, tryCatch(broadcastNotification));

// Assessment Management Routes
router.get('/assessments', authenticateAdmin, tryCatch(getAdminAssessments));
router.get('/assessments/overview', authenticateAdmin, tryCatch(getAdminAssessmentsOverview));
router.get('/assessments/available', authenticateAdmin, tryCatch(getAllAssessmentConfigs));

// Assessment Configuration Management Routes  
router.post('/assessments/config', authenticateAdmin, tryCatch(createAssessmentConfig));
router.get('/assessments/config', authenticateAdmin, tryCatch(getAllAssessmentConfigs));
router.get('/assessments/config/:assessmentId', authenticateAdmin, tryCatch(getAssessmentConfigById));
router.patch('/assessments/config/:assessmentId', authenticateAdmin, tryCatch(updateAssessmentConfig));
router.delete('/assessments/config/:assessmentId', authenticateAdmin, tryCatch(deleteAssessmentConfig));

// Multimedia Assessment - Video Reel Management Routes
router.post('/multimedia-assessments/reels/add', authenticateAdmin, tryCatch(addVideoReel));
router.post('/multimedia-assessments/reels/bulk-add', authenticateAdmin, tryCatch(bulkAddVideoReels));
router.get('/multimedia-assessments/reels', authenticateAdmin, tryCatch(getAllVideoReels));
router.get('/multimedia-assessments/reels/:reelId', authenticateAdmin, tryCatch(getVideoReelById));
router.put('/multimedia-assessments/reels/:reelId', authenticateAdmin, tryCatch(updateVideoReel));
router.delete('/multimedia-assessments/reels/:reelId', authenticateAdmin, tryCatch(deleteVideoReel));
router.get('/multimedia-assessments/reels/analytics', authenticateAdmin, tryCatch(getVideoReelAnalytics));

export default router;
