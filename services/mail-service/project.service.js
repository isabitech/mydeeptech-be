const BaseMailService = require('./base.service');
const envConfig = require('../../config/envConfig');

class ProjectMailService extends BaseMailService {

    static async sendProjectApplicationNotification(recipientEmail, recipientName, applicationData) {

        let htmlTemplate = this.getMailTemplate('sendProjectApplicationNotification');

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
            senderEmail: envConfig.email.senders.projects.email,
            senderName: envConfig.email.senders.projects.name
        });
    }

    static async sendProjectApprovalNotification(recipientEmail, recipientName, projectData) {

        let htmlTemplate = this.getMailTemplate('sendProjectApprovalNotification');

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
            senderEmail: envConfig.email.senders.projects.email,
            senderName: envConfig.email.senders.projects.name
        });
    }

    static async sendProjectRejectionNotification(recipientEmail, recipientName, projectData) {
        
        let htmlTemplate = this.getMailTemplate('sendProjectRejectionNotification');
        
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
            senderEmail: envConfig.email.senders.projects.email,
            senderName: envConfig.email.senders.projects.name
        });
    }

    static async sendApplicantRemovalNotification(recipientEmail, recipientName, removalData) {
        
        let htmlTemplate = this.getMailTemplate('sendApplicantRemovalNotification');
        
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
            senderEmail: envConfig.email.senders.projects.email,
            senderName: envConfig.email.senders.projects.name
        });
    }

    static async sendProjectAnnotatorRemovedNotification(recipientEmail, recipientName, removalData) {
        
        let htmlTemplate = this.getMailTemplate('sendProjectAnnotatorRemovedNotification');
        
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
            senderEmail: envConfig.email.senders.projects.email,
            senderName: envConfig.email.senders.projects.name
        });
    }

    static async sendProjectDeletionOTP(recipientEmail, recipientName, deletionData) {
        let htmlTemplate = this.getMailTemplate('sendProjectDeletionOTP');
        
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
            senderEmail: envConfig.email.senders.projects.email,
            senderName: envConfig.email.senders.projects.name
        });
    }

    static async sendProjectInvitation(recipientEmail, recipientName, templateData) {
        let htmlTemplate = this.getMailTemplate('project-invitation');
        
        // Replace all template placeholders
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{annotatorName}}', templateData.annotatorName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectName}}', templateData.projectName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectCategory}}', templateData.projectCategory);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectDescription}}', templateData.projectDescription);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{customMessage}}', templateData.customMessage);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectUrl}}', templateData.projectUrl);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{payRate}}', templateData.payRate);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{deadline}}', templateData.deadline);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{companyName}}', templateData.companyName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{supportEmail}}', templateData.supportEmail);
        
        const message = `You've been invited to apply for the project "${templateData.projectName}" - ${templateData.projectCategory}. ${templateData.customMessage}`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: `Invitation: ${templateData.projectName} - AI Recommended Project`,
            htmlTemplate,
            message,
            senderEmail: envConfig.email.senders.projects.email,
            senderName: envConfig.email.senders.projects.name
        });
    }

    static async sendTaskApplicationRejectionNotification(recipientEmail, recipientName, taskData) {
        
        let htmlTemplate = this.getMailTemplate('sendTaskApplicationRejectionNotification');
        
        const message = `
            Task Application Update
            
            Thank you for your interest in our task. After careful review, we regret to inform you that your application was not approved at this time.
            
            Task: ${taskData.taskTitle}
            Category: ${taskData.category || 'General'}
            ${taskData.rejectionReason ? `Reason: ${taskData.rejectionReason}` : ''}
        `;

        // Build rejection reason section conditionally
        const rejectionReasonSection = taskData.rejectionReason ? 
            `<section class="reason-section" aria-labelledby="reason-heading">
                <h2 id="reason-heading" class="visually-hidden">Rejection Reason</h2>
                <div class="detail-row">
                    <span class="label">Reason:</span> ${taskData.rejectionReason}
                </div>
            </section>` : '';

        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{applicantName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{taskTitle}}', taskData.taskTitle);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{category}}', taskData.category || 'General');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{rejectionReasonSection}}', rejectionReasonSection);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{adminName}}', taskData.adminName || 'Admin Team');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{supportEmail}}', envConfig.email.senders.support.email);

        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: 'Task Application Update - MyDeepTech',
            message,
            htmlTemplate,
            senderEmail: envConfig.email.senders.projects.email,
            senderName: envConfig.email.senders.projects.name
        });
    }

    static async sendTaskImageRejectionNotification(recipientEmail, recipientName, taskData) {
        
        let htmlTemplate = this.getMailTemplate('sendTaskImageRejectionNotification');
        
        const message = `
            Task Image Rejected
            
            We regret to inform you that one of your submitted images for the task has been rejected by our review team.
            
            Task: ${taskData.taskTitle}
            Category: ${taskData.category || 'General'}
            Rejection Message: ${taskData.rejectionMessage}
            
            Please review the feedback and resubmit a new image that meets our quality standards.
        `;

        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{applicantName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{taskTitle}}', taskData.taskTitle);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{category}}', taskData.category || 'General');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{rejectionMessage}}', taskData.rejectionMessage || 'Quality standards not met');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{adminName}}', taskData.adminName || 'Admin Team');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{supportEmail}}', envConfig.email.senders.support?.email || 'support@mydeeptech.com');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{imageId}}', taskData.imageId || 'N/A');

        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: 'Task Image Rejected - Action Required - MyDeepTech',
            message,
            htmlTemplate,
            senderEmail: envConfig.email.senders.projects.email,
            senderName: envConfig.email.senders.projects.name
        });
    }

}

module.exports = ProjectMailService;