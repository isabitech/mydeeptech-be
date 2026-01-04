import brevo from '@getbrevo/brevo';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

// Initialize Brevo API
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
    brevo.TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY
);

/**
 * Email templates for multimedia assessment system
 */
const emailTemplates = {
    // ... (templates remain unchanged)
};

/**
 * Send assessment invitation email
 */
export const sendAssessmentInvitation = async ({
    userEmail,
    userName,
    assessmentTitle,
    projectTitle,
    assessmentLink,
    estimatedDuration = 60,
    numberOfTasks = 5,
    deadline = null,
    attemptNumber = 1,
    maxRetries = 3
}) => {
    try {
        const template = emailTemplates.assessmentInvitation;

        // Prepare template data
        const templateData = {
            userName,
            assessmentTitle,
            projectTitle,
            assessmentLink,
            estimatedDuration,
            numberOfTasks,
            currentYear: new Date().getFullYear(),
            hasDeadline: !!deadline,
            deadline: deadline ? new Date(deadline).toLocaleDateString() : null,
            hasRetakeInfo: attemptNumber > 1,
            attemptNumber,
            retriesLeft: maxRetries - attemptNumber + 1
        };

        // Replace template variables
        let htmlContent = template.htmlContent;
        let subject = template.subject;

        Object.keys(templateData).forEach(key => {
            const value = templateData[key];
            if (value !== null && value !== undefined) {
                htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
                subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
            }
        });

        // Handle Handlebars-style conditionals (basic implementation)
        htmlContent = processConditionals(htmlContent, templateData);

        const emailData = new brevo.SendSmtpEmail();
        emailData.sender = {
            name: 'Deep Tech Platform',
            email: process.env.SENDER_EMAIL || 'noreply@deeptech.com'
        };
        emailData.to = [{
            email: userEmail,
            name: userName
        }];
        emailData.subject = subject;
        emailData.htmlContent = htmlContent;

        const result = await apiInstance.sendTransacEmail(emailData);
        console.log('Assessment invitation email sent successfully:', result.messageId);

        return {
            success: true,
            messageId: result.messageId,
            template: 'assessmentInvitation'
        };
    } catch (error) {
        console.error('Error sending assessment invitation email:', error);
        throw new Error(`Failed to send assessment invitation: ${error.message}`);
    }
};

/**
 * Send assessment started confirmation
 */
export const sendAssessmentStarted = async ({
    userEmail,
    userName,
    assessmentTitle,
    startTime,
    timeLimit = 60
}) => {
    try {
        const template = emailTemplates.assessmentStarted;
        const endTime = new Date(new Date(startTime).getTime() + timeLimit * 60000);

        const templateData = {
            userName,
            assessmentTitle,
            startTime: new Date(startTime).toLocaleString(),
            timeLimit,
            endTime: endTime.toLocaleString()
        };

        let htmlContent = template.htmlContent;
        let subject = template.subject;

        Object.keys(templateData).forEach(key => {
            htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), templateData[key]);
            subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), templateData[key]);
        });

        const emailData = new brevo.SendSmtpEmail();
        emailData.sender = {
            name: 'Deep Tech Platform',
            email: process.env.SENDER_EMAIL || 'noreply@deeptech.com'
        };
        emailData.to = [{
            email: userEmail,
            name: userName
        }];
        emailData.subject = subject;
        emailData.htmlContent = htmlContent;

        const result = await apiInstance.sendTransacEmail(emailData);
        console.log('Assessment started email sent successfully:', result.messageId);

        return {
            success: true,
            messageId: result.messageId,
            template: 'assessmentStarted'
        };
    } catch (error) {
        console.error('Error sending assessment started email:', error);
        throw new Error(`Failed to send assessment started email: ${error.message}`);
    }
};

/**
 * Send assessment submission confirmation
 */
export const sendAssessmentSubmitted = async ({
    userEmail,
    userName,
    assessmentTitle,
    submissionId,
    submissionTime,
    tasksCompleted,
    totalTasks,
    timeTaken,
    conversationsCreated = 0
}) => {
    try {
        const template = emailTemplates.assessmentSubmitted;

        const templateData = {
            userName,
            assessmentTitle,
            submissionId,
            submissionTime: new Date(submissionTime).toLocaleString(),
            tasksCompleted,
            totalTasks,
            timeTaken,
            conversationsCreated
        };

        let htmlContent = template.htmlContent;
        let subject = template.subject;

        Object.keys(templateData).forEach(key => {
            htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), templateData[key]);
            subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), templateData[key]);
        });

        const emailData = new brevo.SendSmtpEmail();
        emailData.sender = {
            name: 'Deep Tech Platform',
            email: process.env.SENDER_EMAIL || 'noreply@deeptech.com'
        };
        emailData.to = [{
            email: userEmail,
            name: userName
        }];
        emailData.subject = subject;
        emailData.htmlContent = htmlContent;

        const result = await apiInstance.sendTransacEmail(emailData);
        console.log('Assessment submitted email sent successfully:', result.messageId);

        return {
            success: true,
            messageId: result.messageId,
            template: 'assessmentSubmitted'
        };
    } catch (error) {
        console.error('Error sending assessment submitted email:', error);
        throw new Error(`Failed to send assessment submitted email: ${error.message}`);
    }
};

/**
 * Send assessment result email (approved/rejected)
 */
export const sendAssessmentResult = async ({
    userEmail,
    userName,
    assessmentTitle,
    projectTitle = null,
    decision,
    overallScore,
    feedback = '',
    canRetake = false,
    nextAttemptTime = null,
    projectLink = null,
    retakeLink = null
}) => {
    try {
        const isApproved = decision === 'Approve';
        const template = isApproved ?
            emailTemplates.assessmentApproved :
            emailTemplates.assessmentRejected;

        const templateData = {
            userName,
            assessmentTitle,
            projectTitle: projectTitle || 'the project',
            overallScore,
            reviewDate: new Date().toLocaleDateString(),
            hasFeedback: !!feedback,
            feedback,
            canRetake,
            nextAttemptTime: nextAttemptTime ? new Date(nextAttemptTime).toLocaleString() : null,
            projectLink: projectLink || '#',
            retakeLink: retakeLink || '#'
        };

        let htmlContent = template.htmlContent;
        let subject = template.subject;

        Object.keys(templateData).forEach(key => {
            const value = templateData[key];
            if (value !== null && value !== undefined) {
                htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
                subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
            }
        });

        // Process conditionals
        htmlContent = processConditionals(htmlContent, templateData);

        const emailData = new brevo.SendSmtpEmail();
        emailData.sender = {
            name: 'Deep Tech Platform',
            email: process.env.SENDER_EMAIL || 'noreply@deeptech.com'
        };
        emailData.to = [{
            email: userEmail,
            name: userName
        }];
        emailData.subject = subject;
        emailData.htmlContent = htmlContent;

        const result = await apiInstance.sendTransacEmail(emailData);
        console.log(`Assessment result email sent successfully (${decision}):`, result.messageId);

        return {
            success: true,
            messageId: result.messageId,
            template: isApproved ? 'assessmentApproved' : 'assessmentRejected'
        };
    } catch (error) {
        console.error('Error sending assessment result email:', error);
        throw new Error(`Failed to send assessment result email: ${error.message}`);
    }
};

/**
 * Send assessment reminder email
 */
export const sendAssessmentReminder = async ({
    userEmail,
    userName,
    assessmentTitle,
    projectTitle,
    assessmentLink,
    deadline = null,
    timeRemaining = null
}) => {
    try {
        const template = emailTemplates.assessmentReminder;

        const templateData = {
            userName,
            assessmentTitle,
            projectTitle,
            assessmentLink,
            hasDeadline: !!deadline,
            deadline: deadline ? new Date(deadline).toLocaleString() : null,
            timeRemaining
        };

        let htmlContent = template.htmlContent;
        let subject = template.subject;

        Object.keys(templateData).forEach(key => {
            const value = templateData[key];
            if (value !== null && value !== undefined) {
                htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
                subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
            }
        });

        htmlContent = processConditionals(htmlContent, templateData);

        const emailData = new brevo.SendSmtpEmail();
        emailData.sender = {
            name: 'Deep Tech Platform',
            email: process.env.SENDER_EMAIL || 'noreply@deeptech.com'
        };
        emailData.to = [{
            email: userEmail,
            name: userName
        }];
        emailData.subject = subject;
        emailData.htmlContent = htmlContent;

        const result = await apiInstance.sendTransacEmail(emailData);
        console.log('Assessment reminder email sent successfully:', result.messageId);

        return {
            success: true,
            messageId: result.messageId,
            template: 'assessmentReminder'
        };
    } catch (error) {
        console.error('Error sending assessment reminder email:', error);
        throw new Error(`Failed to send assessment reminder email: ${error.message}`);
    }
};

/**
 * Process basic Handlebars-style conditionals
 */
const processConditionals = (content, data) => {
    // Handle {{#variable}} ... {{/variable}} blocks
    const conditionalRegex = /{{#(\w+)}}(.*?){{\/\1}}/gs;

    return content.replace(conditionalRegex, (match, variable, innerContent) => {
        const value = data[variable];
        // Show content if variable is truthy
        return value ? innerContent : '';
    }).replace(/{{[\^#](\w+)}}(.*?){{\/\1}}/gs, (match, variable, innerContent) => {
        const value = data[variable];
        // Show content if variable is falsy (for {{^variable}} syntax)
        return !value ? innerContent : '';
    });
};

/**
 * Batch send emails (for bulk notifications)
 */
export const sendBulkAssessmentEmails = async (emailRequests) => {
    const results = {
        sent: 0,
        failed: 0,
        errors: []
    };

    for (const request of emailRequests) {
        try {
            let result;

            switch (request.type) {
                case 'invitation':
                    result = await sendAssessmentInvitation(request.data);
                    break;
                case 'reminder':
                    result = await sendAssessmentReminder(request.data);
                    break;
                case 'result':
                    result = await sendAssessmentResult(request.data);
                    break;
                default:
                    throw new Error(`Unknown email type: ${request.type}`);
            }

            results.sent++;
        } catch (error) {
            results.failed++;
            results.errors.push({
                userEmail: request.data.userEmail,
                error: error.message
            });
        }
    }

    return results;
};

export { emailTemplates };
