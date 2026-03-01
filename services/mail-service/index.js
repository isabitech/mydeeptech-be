const AuthMailService = require('./auth.service');
const ProjectMailService = require('./project.service');
const AssessmentMailService = require('./assessment.service');
const SupportMailService = require('./support.service');
const InvoiceMailService = require('./invoice.service');

class MailService {
    // Authentication related emails
    static async sendVerificationEmail(recipientEmail, recipientName, userId) {
        return await AuthMailService.sendVerificationEmail(recipientEmail, recipientName, userId);
    }

    static async sendPasswordResetEmail(recipientEmail, recipientName, resetToken) {
        return await AuthMailService.sendPasswordResetEmail(recipientEmail, recipientName, resetToken);
    }

    static async sendPasswordResetEmailWithType(recipientEmail, recipientName, resetToken, userType = 'dtuser') {
        return await AuthMailService.sendPasswordResetEmailWithType(recipientEmail, recipientName, resetToken, userType);
    }

    static async sendPasswordResetConfirmationEmail(recipientEmail, recipientName, userType = 'user') {
        return await AuthMailService.sendPasswordResetConfirmationEmail(recipientEmail, recipientName, userType);
    }

    static async sendAdminVerificationEmail(recipientEmail, recipientName, verificationCode) {
        return await AuthMailService.sendAdminVerificationEmail(recipientEmail, recipientName, verificationCode);
    }

    static async sendAnnotatorApprovalEmail(recipientEmail, recipientName) {
        return await AuthMailService.sendAnnotatorApprovalEmail(recipientEmail, recipientName);
    }

    static async sendAnnotatorRejectionEmail(recipientEmail, recipientName) {
        return await AuthMailService.sendAnnotatorRejectionEmail(recipientEmail, recipientName);
    }

    // Project related emails
    static async sendProjectApplicationNotification(recipientEmail, recipientName, applicationData) {
        return await ProjectMailService.sendProjectApplicationNotification(recipientEmail, recipientName, applicationData);
    }

    static async sendProjectApprovalNotification(recipientEmail, recipientName, projectData) {
        return await ProjectMailService.sendProjectApprovalNotification(recipientEmail, recipientName, projectData);
    }

    static async sendProjectRejectionNotification(recipientEmail, recipientName, projectData) {
        return await ProjectMailService.sendProjectRejectionNotification(recipientEmail, recipientName, projectData);
    }

    static async sendApplicantRemovalNotification(recipientEmail, recipientName, removalData) {
        return await ProjectMailService.sendApplicantRemovalNotification(recipientEmail, recipientName, removalData);
    }

    static async sendProjectAnnotatorRemovedNotification(recipientEmail, recipientName, removalData) {
        return await ProjectMailService.sendProjectAnnotatorRemovedNotification(recipientEmail, recipientName, removalData);
    }

    static async sendProjectDeletionOTP(recipientEmail, recipientName, deletionData) {
        return await ProjectMailService.sendProjectDeletionOTP(recipientEmail, recipientName, deletionData);
    }

    // Assessment related emails
    static async sendAssessmentInvitationEmail(recipientEmail, recipientName, assessmentData = {}) {
        return await AssessmentMailService.sendAssessmentInvitationEmail(recipientEmail, recipientName, assessmentData);
    }

    static async sendAssessmentCompletionEmail(recipientEmail, recipientName, assessmentData = {}) {
        return await AssessmentMailService.sendAssessmentCompletionEmail(recipientEmail, recipientName, assessmentData);
    }

    // Support related emails
    static async sendSupportTicketCreationEmail(recipientEmail, recipientName, ticketData) {
        return await SupportMailService.sendSupportTicketCreationEmail(recipientEmail, recipientName, ticketData);
    }

    static async sendadminSupportTicketNotification(recipientEmail, recipientName, ticketData, userData) {
        return await SupportMailService.sendadminSupportTicketNotification(recipientEmail, recipientName, ticketData, userData);
    }

    static async sendNewTicketNotificationToAdmin(recipientEmail, ticketData, userData) {
        return await SupportMailService.sendNewTicketNotificationToAdmin(recipientEmail, ticketData, userData);
    }

    static async sendAdminReplyNotificationEmail(recipientEmail, ticketData, replyData) {
        return await SupportMailService.sendAdminReplyNotificationEmail(recipientEmail, ticketData, replyData);
    }

    // Invoice related emails
    static async sendDTUserInvoiceNotification(recipientEmail, recipientName, invoiceData) {
        return await InvoiceMailService.sendDTUserInvoiceNotification(recipientEmail, recipientName, invoiceData);
    }

    static async sendPartnerInvoiceEmail(recipientEmail, recipientName, invoiceData) {
        return await InvoiceMailService.sendPartnerInvoiceEmail(recipientEmail, recipientName, invoiceData);
    }

    // Legacy methods for backward compatibility
    static async sendProjectUpdateEmail(recipientEmail, recipientName, projectId, updateDetails) {
        // TODO: Implement if needed
        console.log('sendProjectUpdateEmail - Not implemented yet');
    }

    static async sendResultSubmissionNotification(recipientEmail, recipientName, submissionId) {
        // TODO: Implement if needed
        console.log('sendResultSubmissionNotification - Not implemented yet');
    }

    static async sendGeneralNotification(recipientEmail, recipientName, subject, message) {
        // TODO: Implement if needed
        console.log('sendGeneralNotification - Not implemented yet');
    }
}

module.exports = MailService;