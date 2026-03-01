const BaseMailService = require('./base.service');

class AssessmentMailService extends BaseMailService {

    static async sendAssessmentInvitationEmail(recipientEmail, recipientName, assessmentData = {}) {
        console.log(`Preparing to send assessment invitation email to ${recipientEmail}`);
        let htmlTemplate = this.getMailTemplate('sendAssessmentInvitationEmail');
        
        const { 
            assessmentTitle = 'Multimedia Assessment',
            projectName = 'Project',
            dueDate,
            instructions = 'Please complete the assessment as soon as possible.',
            estimatedTime = '30-60 minutes'
        } = assessmentData;
        
        const formattedDueDate = dueDate ? new Date(dueDate).toLocaleString() : 'No specific deadline';
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{assessmentTitle}}', assessmentTitle);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectName}}', projectName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{dueDate}}', formattedDueDate);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{instructions}}', instructions);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{estimatedTime}}', estimatedTime);
        
        const message = `Hi ${recipientName}, you have been invited to complete the "${assessmentTitle}" assessment for ${projectName}. Estimated time: ${estimatedTime}. Due: ${formattedDueDate}`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: `Assessment Invitation: ${assessmentTitle} - MyDeepTech`,
            htmlTemplate,
            message,
            senderEmail: 'no-reply@mydeeptech.ng',
            senderName: 'MyDeepTech'
        });
    }

    static async sendAssessmentCompletionEmail(recipientEmail, recipientName, assessmentData = {}) {
        console.log(`Preparing to send assessment completion email to ${recipientEmail}`);
        let htmlTemplate = this.getMailTemplate('sendAssessmentCompletionEmail');
        
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
            senderEmail: 'no-reply@mydeeptech.ng',
            senderName: 'MyDeepTech'
        });
    }

}

module.exports = AssessmentMailService;