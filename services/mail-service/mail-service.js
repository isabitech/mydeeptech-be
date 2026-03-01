// Modular Mail Service - Main Entry Point
// All email functionality is now split into focused service classes:
// - AuthMailService: Email verification, password reset, admin auth
// - ProjectMailService: Project applications, approvals, rejections
// - AssessmentMailService: Assessment invitations and completions  
// - SupportMailService: Support tickets and admin replies
// - InvoiceMailService: DTUser and partner invoices
//
// This main MailService class aggregates all methods for backward compatibility
// while maintaining the same external interface.

const MailService = require('./index');

module.exports = MailService;