const BaseMailService = require('./base.service');

class ProjectMailService extends BaseMailService {

    static async sendProjectApplicationNotification(recipientEmail, recipientName, applicationData) {
        console.log(`Sending project application notification to ${recipientEmail}`);
        
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
            senderEmail: 'projects@mydeeptech.ng',
            senderName: 'MyDeepTech Projects'
        });
    }

    static async sendProjectApprovalNotification(recipientEmail, recipientName, projectData) {
        console.log(`Sending project approval notification to ${recipientEmail}`);
        
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
            senderEmail: 'projects@mydeeptech.ng',
            senderName: 'MyDeepTech Projects'
        });
    }

    static async sendProjectRejectionNotification(recipientEmail, recipientName, projectData) {
        console.log(`Sending project rejection notification to ${recipientEmail}`);
        
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
            senderEmail: 'projects@mydeeptech.ng',
            senderName: 'MyDeepTech Projects'
        });
    }

    static async sendApplicantRemovalNotification(recipientEmail, recipientName, removalData) {
        console.log(`Sending applicant removal notification to ${recipientEmail}`);
        
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
            senderEmail: 'projects@mydeeptech.ng',
            senderName: 'MyDeepTech Projects'
        });
    }

    static async sendProjectAnnotatorRemovedNotification(recipientEmail, recipientName, removalData) {
        console.log(`Sending project annotator removed notification to ${recipientEmail}`);
        
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
            senderEmail: 'projects@mydeeptech.ng',
            senderName: 'MyDeepTech Projects'
        });
    }

    static async sendProjectDeletionOTP(recipientEmail, recipientName, deletionData) {
        console.log(`Preparing to send project deletion OTP to ${recipientEmail}`);
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
            senderEmail: 'projects@mydeeptech.ng',
            senderName: 'MyDeepTech Projects'
        });
    }

}

module.exports = ProjectMailService;