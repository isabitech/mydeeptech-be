const path = require('path');
const fs = require('fs');
const mailJet = require('../../utils/mailjet-init');
const envConfig = require('../../config/envConfig');
const AppError = require('../../utils/app-error');

const getMailTemplate = (templateName) => {
    const emailTemplatePath = path.join(__dirname, '..', 'emailTemplates', `${templateName}.html`);
    if (!fs.existsSync(emailTemplatePath)) {
        throw new AppError({ message: `Email template "${templateName}" not found`, statusCode: 500 });
    }
    const template = fs.readFileSync(emailTemplatePath, 'utf-8');
    return template;
}

class MailService {
    constructor(){}

    static async sendVerificationEmail(recipientEmail, recipientName, userId) {
        console.log(`Preparing to send verification email to ${recipientEmail} for user ID: ${userId}`);
        const FRONTEND_URL = envConfig.NODE_ENV === 'production' ? 'https://mydeeptech.ng' : 'http://localhost:5173';
        const verificationUrl = `${FRONTEND_URL}/verify-email/${userId}?email=${encodeURIComponent(recipientEmail)}`;
        let htmlTemplate = getMailTemplate('sendVerificationEmail');
        const username = recipientEmail.split("@")[0];

        const message  =  `
                Hello ${(recipientName || username)},
                
                Thank you for signing up with MyDeepTech!
                
                To verify your email address, please visit:
                ${verificationUrl}
                
                If you didn't create an account with us, please ignore this email.
                
                Best regards,
                The MyDeepTech Team
                `;

        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{name}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{verificationUrl}}', verificationUrl);
          return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: 'Verify Your Email Address - MyDeepTech',
            message,
            htmlTemplate,
        });
    }

    static async sendPasswordResetEmail(recipientEmail, recipientName, resetToken) {
        const FRONTEND_URL = envConfig.NODE_ENV === 'production' ? 'https://mydeeptech.ng' : 'http://localhost:5173';
        const resetUrl = `${FRONTEND_URL}/reset-password/${resetToken}?email=${encodeURIComponent(recipientEmail)}`;
        let htmlTemplate = getMailTemplate('sendPasswordResetEmail');
        const username = recipientEmail.split("@")[0];
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{name}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{resetUrl}}', resetUrl);
        const message = `Hi ${(recipientName || username)}, please reset your password.`;
        return await this.sendMail({ recipientEmail, recipientName, message, subject: "Reset Your Password - MyDeepTech", htmlTemplate });
    }

    // DTUser Password Reset Email (supports both user types)
    static async sendPasswordResetEmailWithType(recipientEmail, recipientName, resetToken, userType = 'dtuser') {
        console.log(`Preparing to send password reset email to ${recipientEmail} for ${userType}`);
        let htmlTemplate = getMailTemplate('sendPasswordResetEmail');
        
        const FRONTEND_URL = envConfig.NODE_ENV === 'production' ? 'https://mydeeptech.ng' : 'http://localhost:5173';
        const resetUrl = userType === 'dtuser' 
            ? `${FRONTEND_URL}/reset-password?token=${resetToken}&type=dtuser`
            : `${FRONTEND_URL}/reset-password?token=${resetToken}&type=user`;
            
        const username = recipientEmail.split("@")[0];
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{name}}', recipientName || username);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{resetUrl}}', resetUrl);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{userType}}', userType);
        
        const message = `Hi ${recipientName || username}, please reset your password using the secure link provided.`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: "Reset Your Password - MyDeepTech",
            htmlTemplate,
            message,
        });
    }

    static async sendProjectUpdateEmail(recipientEmail, recipientName, projectId, updateDetails) {}

    static async sendResultSubmissionNotification(recipientEmail, recipientName, submissionId) {}

    // DTUser Invoice Notification
    static async sendDTUserInvoiceNotification(recipientEmail, recipientName, invoiceData) {
        console.log(`Preparing to send DTUser invoice notification to ${recipientEmail}`);
        let htmlTemplate = getMailTemplate('sendDTUserInvoiceNotification');
        
        const { invoiceNumber, projectName, amount, currency = 'USD', dueDate, description } = invoiceData;
        const formattedAmount = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
        const formattedDueDate = new Date(dueDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{invoiceNumber}}', invoiceNumber);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectName}}', projectName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{formattedAmount}}', formattedAmount);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{formattedDueDate}}', formattedDueDate);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{description}}', description || 'Project completion payment');
        
        const message = `Hi ${recipientName}, a new invoice ${invoiceNumber} for ${formattedAmount} has been generated for your project: ${projectName}. Due date: ${formattedDueDate}.`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: `New Invoice ${invoiceNumber} - MyDeepTech`,
            htmlTemplate,
            message,
        });
    }

    // Partner Invoice Email
    static async sendPartnerInvoiceEmail(recipientEmail, recipientName, invoiceData) {
        console.log(`Preparing to send partner invoice to ${recipientEmail}`);
        let htmlTemplate = getMailTemplate('sendPartnerInvoiceEmail');
        
        const { name, amount, due_date, description = 'Partner invoice', companyName = 'MyDeepTech' } = invoiceData;
        const formattedAmount = amount ? `$${parseFloat(amount).toFixed(2)}` : 'TBD';
        const formattedDueDate = due_date ? new Date(due_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : 'TBD';
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{companyName}}', companyName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{formattedAmount}}', formattedAmount);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{formattedDueDate}}', formattedDueDate);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{description}}', description);
        
        const message = `Hi ${recipientName}, you have received a new invoice for ${formattedAmount} from ${companyName}. Due date: ${formattedDueDate}.`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: `Invoice from ${companyName} - MyDeepTech`,
            htmlTemplate,
            message,
        });
    }

    // Admin Verification Email
    static async sendAdminVerificationEmail(recipientEmail, recipientName, verificationCode) {
        console.log(`Preparing to send admin verification email to ${recipientEmail}`);
        let htmlTemplate = getMailTemplate('sendAdminVerificationEmail');
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{verificationCode}}', verificationCode);
        
        const message = `Hi ${recipientName}, your admin verification code is: ${verificationCode}. This code expires in 15 minutes.`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: '🔐 Admin Account Verification - MyDeepTech',
            htmlTemplate,
            message,
        });
    }

    // Annotator Approval Email
    static async sendAnnotatorApprovalEmail(recipientEmail, recipientName) {
        console.log(`Preparing to send annotator approval email to ${recipientEmail}`);
        let htmlTemplate = getMailTemplate('sendAnnotatorApprovalEmail');
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        
        const message = `Congratulations ${recipientName}! You have been approved as an annotator on MyDeepTech. You can now access your dashboard and start applying to projects.`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: 'Congratulations! You are now an approved annotator - MyDeepTech',
            htmlTemplate,
            message,
        });
    }

    // Annotator Rejection Email
    static async sendAnnotatorRejectionEmail(recipientEmail, recipientName) {
        console.log(`Preparing to send annotator rejection email to ${recipientEmail}`);
        let htmlTemplate = getMailTemplate('sendAnnotatorRejectionEmail');
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        
        const message = `Hi ${recipientName}, thank you for your interest in becoming an annotator. While your annotator application was not approved, you have been approved as a micro-tasker and can still participate in smaller tasks on our platform.`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: 'Application Update - Micro Tasker Approval - MyDeepTech',
            htmlTemplate,
            message,
        });
    }

    // Project Deletion OTP Email
    static async sendProjectDeletionOTP(recipientEmail, recipientName, deletionData) {
        console.log(`Preparing to send project deletion OTP to ${recipientEmail}`);
        let htmlTemplate = getMailTemplate('sendProjectDeletionOTP');
        
        const { projectName, otp, expiryTime, requestedBy, reason = 'Not specified' } = deletionData;
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectName}}', projectName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{otp}}', otp);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{expiryTime}}', expiryTime.toLocaleString());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{requestedBy}}', requestedBy);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{reason}}', reason);
        
        const message = `URGENT: Project deletion authorization required for "${projectName}". Your OTP: ${otp}. Requested by: ${requestedBy}. Expires: ${expiryTime.toLocaleString()}`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: `🚨 PROJECT DELETION AUTHORIZATION REQUIRED - ${projectName}`,
            htmlTemplate,
            message,
        });
    }

    // Support Ticket Creation Email
    static async sendSupportTicketCreationEmail(recipientEmail, recipientName, ticketData) {
        console.log(`Preparing to send support ticket creation email to ${recipientEmail}`);
        let htmlTemplate = getMailTemplate('sendSupportTicketCreationEmail');
        
        const { ticketNumber, subject, category, priority, description, createdAt } = ticketData;
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{ticketNumber}}', ticketNumber);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{subject}}', subject);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{category}}', category.replace('_', ' ').toUpperCase());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{priority}}', priority.toUpperCase());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{description}}', description);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{createdAt}}', new Date(createdAt).toLocaleString());
        
        const message = `Your support ticket ${ticketNumber} has been created successfully. Our team will review it within 24 hours.`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: `Support Ticket Created - ${ticketNumber}`,
            htmlTemplate,
            message,
        });
    }

    // Admin Support Ticket Notification
    static async sendadminSupportTicketNotification(recipientEmail, recipientName, ticketData, userData) {
        console.log(`Preparing to send admin support ticket notification to ${recipientEmail}`);
        let htmlTemplate = getMailTemplate('sendAdminSupportTicketNotification');
        
        const { ticketNumber, subject, category, priority, description, createdAt } = ticketData;
        const { fullName: userFullName, email: userEmail } = userData;
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{ticketNumber}}', ticketNumber);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{subject}}', subject);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{category}}', category.replace('_', ' ').toUpperCase());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{priority}}', priority.toUpperCase());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{description}}', description);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{createdAt}}', new Date(createdAt).toLocaleString());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{userFullName}}', userFullName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{userEmail}}', userEmail);
        
        const message = `New support ticket ${ticketNumber} created by ${userFullName} (${userEmail}). Priority: ${priority}. Category: ${category}.`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: `🎫 New Support Ticket: ${ticketNumber} - ${category}`,
            htmlTemplate,
            message,
        });
    }

    // Assessment Invitation Email
    static async sendAssessmentInvitationEmail(recipientEmail, recipientName, assessmentData = {}) {
        console.log(`Preparing to send assessment invitation email to ${recipientEmail}`);
        let htmlTemplate = getMailTemplate('sendAssessmentInvitationEmail');
        
        const { title = 'Multimedia Assessment', timeLimit = '60 minutes', description = 'Complete your assessment to continue' } = assessmentData;
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{assessmentTitle}}', title);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{timeLimit}}', timeLimit);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{description}}', description);
        
        const message = `Hi ${recipientName}, you've been invited to complete the "${title}" assessment. Time limit: ${timeLimit}.`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: `Assessment Invitation: ${title} - MyDeepTech`,
            htmlTemplate,
            message,
        });
    }

    // Assessment Completion Email
    static async sendAssessmentCompletionEmail(recipientEmail, recipientName, assessmentData = {}) {
        console.log(`Preparing to send assessment completion email to ${recipientEmail}`);
        let htmlTemplate = getMailTemplate('sendAssessmentCompletionEmail');
        
        const { 
            assessmentTitle = 'Multimedia Assessment',
            projectName = 'Unknown Project',
            submissionId = 'N/A',
            completedTasks = 0,
            totalTimeSpent = '0 minutes',
            submittedAt 
        } = assessmentData;
        
        const formattedSubmissionTime = submittedAt ? new Date(submittedAt).toLocaleString() : new Date().toLocaleString();
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{assessmentTitle}}', assessmentTitle);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectName}}', projectName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{submissionId}}', submissionId);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{completedTasks}}', completedTasks);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{totalTimeSpent}}', totalTimeSpent);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{submittedAt}}', formattedSubmissionTime);
        
        const message = `Hi ${recipientName}, you have successfully completed the "${assessmentTitle}" assessment for ${projectName}. Completed tasks: ${completedTasks}. Time spent: ${totalTimeSpent}. Submitted at: ${formattedSubmissionTime}.`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: `Assessment Completed: ${assessmentTitle} - MyDeepTech`,
            htmlTemplate,
            message,
        });
    }

    static async sendGeneralNotification(recipientEmail, recipientName, subject, message) {}

    static async sendPasswordResetConfirmationEmail(recipientEmail, recipientName, userType = 'user') {
        console.log(`Sending password reset confirmation to ${recipientEmail}`);
        
        let htmlTemplate = getMailTemplate('sendPasswordResetConfirmationEmail');
        
        const message = `
            Hello ${recipientName},
            
            Your password has been successfully reset for your ${userType} account.
            
            If you didn't make this change, please contact our support team immediately.
            
            Best regards,
            The MyDeepTech Team
        `;

        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{userName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{userType}}', userType);
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: 'Password Reset Confirmation - MyDeepTech',
            message,
            htmlTemplate,
        });
    }

    static async sendNewTicketNotificationToAdmin(recipientEmail, ticketData, userData) {
        console.log(`Sending new ticket notification to admin: ${recipientEmail}`);
        
        let htmlTemplate = getMailTemplate('sendNewTicketNotificationToAdmin');
        
        const message = `
            New Support Ticket Created
            
            Ticket ID: ${ticketData._id || ticketData.id}
            Subject: ${ticketData.subject || 'No subject'}
            User: ${userData.fullName} (${userData.email})
            Message: ${ticketData.messages?.[0]?.message || ticketData.message || 'No message'}
        `;

        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{ticketId}}', ticketData._id || ticketData.id);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{subject}}', ticketData.subject || 'No subject');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{userName}}', userData.fullName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{userEmail}}', userData.email);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{priority}}', ticketData.priority || 'Normal');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{createdAt}}', new Date(ticketData.createdAt).toLocaleString());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{message}}', ticketData.messages?.[0]?.message || ticketData.message || 'No message');
        
        return await this.sendMail({
            recipientEmail,
            recipientName: 'Support Team',
            subject: 'New Support Ticket - MyDeepTech',
            message,
            htmlTemplate,
        });
    }

    static async sendAdminReplyNotificationEmail(recipientEmail, ticketData, replyData) {
        console.log(`Sending admin reply notification to ${recipientEmail}`);
        
        let htmlTemplate = getMailTemplate('sendAdminReplyNotificationEmail');
        
        const message = `
            Admin Reply to Your Support Ticket
            
            Ticket ID: ${ticketData._id || ticketData.id}
            Subject: ${ticketData.subject || 'No subject'}
            From: ${replyData.senderName}
            Reply: ${replyData.message}
        `;

        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{userName}}', recipientEmail.split('@')[0]);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{ticketId}}', ticketData._id || ticketData.id);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{subject}}', ticketData.subject || 'No subject');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{senderName}}', replyData.senderName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{repliedAt}}', new Date().toLocaleString());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{replyMessage}}', replyData.message);
        
        return await this.sendMail({
            recipientEmail,
            recipientName: recipientEmail.split('@')[0],
            subject: 'Admin Reply to Your Ticket - MyDeepTech',
            message,
            htmlTemplate,
        });
    }

    static async sendProjectApplicationNotification(recipientEmail, recipientName, applicationData) {
        console.log(`Sending project application notification to ${recipientEmail}`);
        
        let htmlTemplate = getMailTemplate('sendProjectApplicationNotification');
        
        const message = `
            New Project Application
            
            Project: ${applicationData.projectName}
            Category: ${applicationData.projectCategory}
            Applicant: ${applicationData.applicantName || 'Unknown'} (${applicationData.applicantEmail || 'Unknown'})
            Pay Rate: $${applicationData.payRate || 0}/hour
        `;

        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{adminName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectName}}', applicationData.projectName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectCategory}}', applicationData.projectCategory);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{applicantName}}', applicationData.applicantName || 'Unknown');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{applicantEmail}}', applicationData.applicantEmail || 'Unknown');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{payRate}}', applicationData.payRate || 0);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{appliedAt}}', new Date(applicationData.appliedAt).toLocaleString());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{coverLetter}}', applicationData.coverLetter || '');
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: 'New Project Application - MyDeepTech',
            message,
            htmlTemplate,
        });
    }

    static async sendProjectApprovalNotification(recipientEmail, recipientName, projectData) {
        console.log(`Sending project approval notification to ${recipientEmail}`);
        
        let htmlTemplate = getMailTemplate('sendProjectApprovalNotification');
        
        const message = `
            Congratulations! Your application has been approved.
            
            Project: ${projectData.projectName}
            Category: ${projectData.projectCategory}
        `;

        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{applicantName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectName}}', projectData.projectName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectCategory}}', projectData.projectCategory);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{payRate}}', projectData.payRate || '');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectGuidelineVideo}}', projectData.projectGuidelineVideo || '');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectCommunityLink}}', projectData.projectCommunityLink || '');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectTrackerLink}}', projectData.projectTrackerLink || '');
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: 'Application Approved - MyDeepTech',
            message,
            htmlTemplate,
        });
    }

    static async sendProjectRejectionNotification(recipientEmail, recipientName, projectData) {
        console.log(`Sending project rejection notification to ${recipientEmail}`);
        
        let htmlTemplate = getMailTemplate('sendProjectRejectionNotification');
        
        const message = `
            Project Application Update
            
            Thank you for your interest in our project. After careful review, we regret to inform you that your application was not approved at this time.
            
            Project: ${projectData.projectName}
            Category: ${projectData.projectCategory}
        `;

        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{applicantName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectName}}', projectData.projectName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectCategory}}', projectData.projectCategory);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{adminName}}', projectData.adminName || 'Admin');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{rejectionReason}}', projectData.rejectionReason || '');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{reviewNotes}}', projectData.reviewNotes || '');
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: 'Application Update - MyDeepTech',
            message,
            htmlTemplate,
        });
    }

    static async sendApplicantRemovalNotification(recipientEmail, recipientName, removalData) {
        console.log(`Sending applicant removal notification to ${recipientEmail}`);
        
        let htmlTemplate = getMailTemplate('sendApplicantRemovalNotification');
        
        const message = `
            Project Status Update
            
            You have been removed from the following project:
            
            Project: ${removalData.projectName}
            Project ID: ${removalData.projectId}
            Reason: ${removalData.removalReason || 'Not specified'}
        `;

        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{applicantName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectName}}', removalData.projectName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectId}}', removalData.projectId);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{removalReason}}', removalData.removalReason || '');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{removedBy}}', removalData.removedBy);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{removedAt}}', new Date(removalData.removedAt).toLocaleString());
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: 'Project Status Update - MyDeepTech',
            message,
            htmlTemplate,
        });
    }

    static async sendProjectAnnotatorRemovedNotification(recipientEmail, recipientName, removalData) {
        console.log(`Sending project annotator removed notification to ${recipientEmail}`);
        
        let htmlTemplate = getMailTemplate('sendProjectAnnotatorRemovedNotification');
        
        const message = `
            Project Team Update
            
            An annotator has been removed from one of your projects:
            
            Project: ${removalData.projectName}
            Removed Annotator: ${removalData.removedApplicant.name} (${removalData.removedApplicant.email})
            Reason: ${removalData.removalReason || 'Not specified'}
        `;

        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{adminName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectName}}', removalData.projectName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectId}}', removalData.projectId);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{removedApplicant.name}}', removalData.removedApplicant.name);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{removedApplicant.email}}', removalData.removedApplicant.email);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{removalReason}}', removalData.removalReason || '');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{removedAt}}', new Date(removalData.removedAt).toLocaleString());
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: 'Project Team Update - MyDeepTech',
            message,
            htmlTemplate,
        });
    }

    static replaceTemplatePlaceholders (template, placeholder, value) {
        const regex = new RegExp(placeholder, 'g');
        return template.replace(regex, value);
    }

    static async sendMail(options = {}) {

    const { recipientEmail, recipientName, subject, message, htmlTemplate } = options || {};

    if (!recipientEmail || !subject) {
        throw new AppError({ message: 'Recipient email and subject are required', statusCode: 400 });
    }

        try {
           const infoMail =  await mailJet
            .post('send', { version: 'v3.1' })
            .request({
                Messages: [
                    {
                        From: {
                            Email: envConfig.email.mailjet.MAILJET_SENDER_EMAIL,
                            Name: envConfig.email.mailjet.MAILJET_SENDER_NAME || "MyDeepTech"
                        },
                        To: [
                            {
                                Email: recipientEmail,
                                Name: recipientName,
                            },
                        ],
                        Subject: subject,
                        HTMLPart: htmlTemplate,
                        TextPart: message,
                    },
                ],
            });
           return infoMail;
        } catch (error) {
            console.error("Error sending email via MAIL_JET:", {
                message: error.message,
                statusCode: error.statusCode,
                response: error.response?.data,
                timestamp: new Date().toISOString(),
                error
            });
            throw new AppError({ message: `Error sending email via MAIL_JET: ${error.message}`, statusCode: 500 });
        }   
    }
}

module.exports = MailService;