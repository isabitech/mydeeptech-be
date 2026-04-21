const express = require("express");
const AuthController = require("../controllers/auth.controller.js");
const AdminController = require("../controllers/admin.controller.js");
const annotationProjectController = require("../controllers/annotationProject.controller.js");
const InvoiceController = require("../controllers/invoice.controller.js");
const notificationController = require("../controllers/notification.controller.js");
const assessmentController = require("../controllers/assessment.controller.js");
const {
  addVideoReel,
  getAllVideoReels,
  getVideoReelById,
  updateVideoReel,
  deleteVideoReel,
  bulkAddVideoReels,
} = require("../controllers/videoReel.controller.js");
const {
  createAssessmentConfig,
  getAllAssessmentConfigs,
  getAssessmentConfigById,
  updateAssessmentConfig,
  deleteAssessmentConfig,
  getAssessmentConfigByProject,
} = require("../controllers/multimediaAssessmentConfig.controller.js");
const assessmentAnalyticsController = require("../controllers/assessmentAnalytics.controller.js");
const { authenticateAdmin } = require("../middleware/adminAuth.js");

const router = express.Router();

// Admin Authentication
router.post("/login", AdminController.adminLogin);
router.post("/register", AdminController.createAdmin);

// Admin Creation Routes - Two-step process with email verification
router.post("/create/request", AdminController.requestAdminVerification);
router.post("/create/confirm", AdminController.confirmAdminVerification);

// Admin OTP Verification Route
router.post("/verify-otp", AdminController.verifyAdminOTP);

// Legacy admin creation route
router.post("/create", AdminController.createAdmin);

// Admin Routes - All require admin authentication
router.get("/dashboard", authenticateAdmin, AdminController.getAdminDashboard);
router.get("/dtusers", authenticateAdmin, AdminController.getAllDTUsers);
router.get("/admin-users", authenticateAdmin, AdminController.getAllAdminUsers);
router.get(
  "/dtusers/:userId",
  authenticateAdmin,
  AdminController.getDTUserAdmin,
);
router.patch(
  "/dtusers/:userId/approve",
  authenticateAdmin,
  AdminController.approveAnnotator,
);
router.patch(
  "/dtusers/:userId/qa-approve",
  authenticateAdmin,
  AdminController.approveUserForQA,
);
router.patch(
  "/dtusers/:userId/qa-reject",
  authenticateAdmin,
  AdminController.rejectUserForQA,
);
router.get("/qa-users", authenticateAdmin, AdminController.getAllQAUsers);
router.patch(
  "/dtusers/:userId/reject",
  authenticateAdmin,
  AdminController.rejectAnnotator,
);

// Bulk Email Management Routes
router.post(
  "/dtusers/send-verification-emails",
  authenticateAdmin,
  AuthController.sendVerificationEmailsToUnverifiedUsers,
);

// Project Management Routes
router.post(
  "/projects",
  authenticateAdmin,
  annotationProjectController.createAnnotationProject,
);
router.get(
  "/projects",
  authenticateAdmin,
  annotationProjectController.getAllAnnotationProjects,
);
router.get(
  "/projects/:projectId",
  authenticateAdmin,
  annotationProjectController.getAnnotationProjectDetails,
);
router.patch(
  "/projects/:projectId",
  authenticateAdmin,
  annotationProjectController.updateAnnotationProject,
);
router.patch(
  "/projects/:projectId/toggle-status",
  authenticateAdmin,
  annotationProjectController.toggleProjectStatus,
);
router.patch(
  "/projects/:projectId/toggle-visibility",
  authenticateAdmin,
  annotationProjectController.toggleProjectVisibility,
);
router.delete(
  "/projects/:projectId",
  authenticateAdmin,
  annotationProjectController.deleteAnnotationProject,
);
router.delete(
  "/projects/:projectId/applicants/:applicantId",
  authenticateAdmin,
  annotationProjectController.deleteAnnotationProject,
);
router.get(
  "/projects/getApprovedApplicants/:projectId",
  authenticateAdmin,
  annotationProjectController.getApprovedApplicants,
);
router.put(
  "/projects/reject-applications-bulk",
  authenticateAdmin,
  annotationProjectController.rejectApplicationsBulk,
);

// Project Deletion with OTP Routes
router.post(
  "/projects/:projectId/request-deletion-otp",
  authenticateAdmin,
  annotationProjectController.requestProjectDeletionOTP,
);
router.post(
  "/projects/:projectId/verify-deletion-otp",
  authenticateAdmin,
  annotationProjectController.verifyOTPAndDeleteProject,
);

// Project Assessment Integration Routes
router.post(
  "/projects/:projectId/assessment",
  authenticateAdmin,
  annotationProjectController.attachAssessmentToProject,
);
router.delete(
  "/projects/:projectId/assessment",
  authenticateAdmin,
  annotationProjectController.removeAssessmentFromProject,
);

// Application Management Routes
router.get(
  "/applications",
  authenticateAdmin,
  annotationProjectController.getAnnotationProjectApplications,
);
router.patch(
  "/applications/:applicationId/approve",
  authenticateAdmin,
  annotationProjectController.approveAnnotationProjectApplication,
);
router.patch(
  "/applications/:applicationId/reject",
  authenticateAdmin,
  annotationProjectController.rejectAnnotationProjectApplication,
);
router.delete(
  "/applications/:applicationId/remove",
  authenticateAdmin,
  annotationProjectController.removeApprovedApplicant,
);

// Bulk Application Management Routes
router.post(
  "/applications/bulk/approve",
  authenticateAdmin,
  annotationProjectController.bulkApproveApplications,
);
router.post(
  "/applications/bulk/reject",
  authenticateAdmin,
  annotationProjectController.bulkRejectApplications,
);

// Project Applicant Management Routes
router.get(
  "/projects/:projectId/removable-applicants",
  authenticateAdmin,
  annotationProjectController.getRemovableApplicants,
);
router.get(
  "/projects/:projectId/export-approved-csv",
  authenticateAdmin,
  annotationProjectController.exportApprovedAnnotatorsCSV,
);

// Invoice Management Routes
router.post("/invoices", authenticateAdmin,InvoiceController.createInvoice);
router.get("/invoices", authenticateAdmin, InvoiceController.getAllInvoices);
router.post(
  "/invoices/bulk-authorize-payment",
  authenticateAdmin,
  InvoiceController.bulkAuthorizePayment,
);
router.get(
  "/invoices/generate-paystack-csv",
  authenticateAdmin,
  InvoiceController.generatePaystackCSV,
);
router.get("/invoices/generate-mpesa-csv", authenticateAdmin, InvoiceController.generateMPESACSV);
router.get("/invoices/:invoiceId", authenticateAdmin, InvoiceController.getInvoiceDetails);
router.patch(
  "/invoices/:invoiceId/payment-status",
  authenticateAdmin,
  InvoiceController.updatePaymentStatus,
);
router.post(
  "/invoices/:invoiceId/send-reminder",
  authenticateAdmin,
  InvoiceController.sendInvoiceReminder,
);
router.delete("/invoices/:invoiceId", authenticateAdmin, InvoiceController.deleteInvoice);

// Notification Management Routes
router.get(
  "/notifications",
  authenticateAdmin,
  notificationController.getAdminNotifications,
);
router.post(
  "/notifications",
  authenticateAdmin,
  notificationController.createAdminNotification,
);
router.put(
  "/notifications/:notificationId",
  authenticateAdmin,
  notificationController.updateAdminNotification,
);
router.delete(
  "/notifications/:notificationId",
  authenticateAdmin,
  notificationController.deleteAdminNotification,
);
router.post(
  "/notifications/announcement",
  authenticateAdmin,
  notificationController.createAnnouncement,
);
router.get(
  "/notifications/stats",
  authenticateAdmin,
  notificationController.getNotificationStats,
);
router.delete(
  "/notifications/cleanup",
  authenticateAdmin,
  notificationController.cleanupNotifications,
);
router.get(
  "/notifications/analytics",
  authenticateAdmin,
  notificationController.getAdminNotificationAnalytics,
);
router.post(
  "/notifications/broadcast",
  authenticateAdmin,
  notificationController.broadcastNotification,
);

// Assessment Management Routes
router.get(
  "/assessments",
  authenticateAdmin,
  assessmentController.getAdminAssessments,
);
router.get(
  "/assessments/overview",
  authenticateAdmin,
  assessmentController.getAdminAssessmentsOverview,
);
router.get(
  "/assessments/available",
  authenticateAdmin,
  getAllAssessmentConfigs,
);

// Assessment Configuration Management Routes
router.post("/assessments/config", authenticateAdmin, createAssessmentConfig);
router.get("/assessments/config", authenticateAdmin, getAllAssessmentConfigs);
router.get(
  "/assessments/config/:assessmentId",
  authenticateAdmin,
  getAssessmentConfigById,
);
router.patch(
  "/assessments/config/:assessmentId",
  authenticateAdmin,
  updateAssessmentConfig,
);
router.delete(
  "/assessments/config/:assessmentId",
  authenticateAdmin,
  deleteAssessmentConfig,
);

// Multimedia Assessment - Video Reel Management Routes
router.post(
  "/multimedia-assessments/reels/add",
  authenticateAdmin,
  addVideoReel,
);
router.post(
  "/multimedia-assessments/reels/bulk-add",
  authenticateAdmin,
  bulkAddVideoReels,
);
router.get(
  "/multimedia-assessments/reels",
  authenticateAdmin,
  getAllVideoReels,
);
router.get(
  "/multimedia-assessments/reels/:reelId",
  authenticateAdmin,
  getVideoReelById,
);
router.put(
  "/multimedia-assessments/reels/:reelId",
  authenticateAdmin,
  updateVideoReel,
);
router.delete(
  "/multimedia-assessments/reels/:reelId",
  authenticateAdmin,
  deleteVideoReel,
);
router.get(
  "/multimedia-assessments/reels/analytics",
  authenticateAdmin,
  assessmentAnalyticsController.getReelAnalytics,
);

// Assessment Analytics Routes
router.get(
  "/assessments/analytics/dashboard",
  authenticateAdmin,
  assessmentAnalyticsController.getAssessmentDashboard,
);
router.get(
  "/assessments/analytics/reels",
  authenticateAdmin,
  assessmentAnalyticsController.getReelAnalytics,
);
router.get(
  "/assessments/analytics/users",
  authenticateAdmin,
  assessmentAnalyticsController.getUserPerformanceAnalytics,
);
router.get(
  "/assessments/analytics/qa",
  authenticateAdmin,
  assessmentAnalyticsController.getQAAnalytics,
);
router.get(
  "/assessments/analytics/export",
  authenticateAdmin,
  assessmentAnalyticsController.exportAnalyticsCSV,
);

module.exports = router;
