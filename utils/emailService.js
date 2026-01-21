const brevo = require('@sendinblue/client');
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');

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
    assessmentInvitation: {
        subject: 'Assessment Required - {{assessmentTitle}}',
        htmlContent: `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f8f9fa; }
                    .button { background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
                    .footer { padding: 20px; font-size: 12px; color: #666; }
                    .deadline { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Assessment Invitation</h1>
                    </div>
                    <div class="content">
                        <h2>Hello {{userName}},</h2>
                        <p>You have been invited to take the <strong>{{assessmentTitle}}</strong> assessment for the <strong>{{projectTitle}}</strong> project.</p>
                        
                        <div class="deadline">
                            <strong>Assessment Details:</strong><br>
                            • Duration: {{estimatedDuration}} minutes<br>
                            • Tasks: {{numberOfTasks}} tasks<br>
                            • Type: Multimedia conversation creation<br>
                            {{#hasDeadline}}• Deadline: {{deadline}}{{/hasDeadline}}
                        </div>
                        
                        <p><strong>What to expect:</strong></p>
                        <ul>
                            <li>Create engaging conversations using video reels</li>
                            <li>Demonstrate your annotation skills</li>
                            <li>Complete within the time limit</li>
                            <li>Professional review of your work</li>
                        </ul>
                        
                        {{#hasRetakeInfo}}
                        <div style="background-color: #e7f3ff; border-left: 4px solid #007bff; padding: 10px; margin: 15px 0;">
                            <strong>Retake Information:</strong><br>
                            This is attempt #{{attemptNumber}}. You have {{retriesLeft}} retries remaining.
                        </div>
                        {{/hasRetakeInfo}}
                        
                        <a href="{{assessmentLink}}" class="button">Start Assessment</a>
                        
                        <p><em>Note: You must complete this assessment to be eligible for the project. The assessment will be reviewed by our QA team within 24-48 hours.</em></p>
                    </div>
                    <div class="footer">
                        <p>If you have any questions, please contact our support team.</p>
                        <p>© {{currentYear}} Deep Tech Platform</p>
                    </div>
                </div>
            </body>
            </html>
        `
    },
    
    assessmentStarted: {
        subject: 'Assessment Started - {{assessmentTitle}}',
        htmlContent: `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #17a2b8; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f8f9fa; }
                    .timer-info { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                    .tips { background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Assessment In Progress</h1>
                    </div>
                    <div class="content">
                        <h2>Good luck, {{userName}}!</h2>
                        <p>You have successfully started the <strong>{{assessmentTitle}}</strong> assessment.</p>
                        
                        <div class="timer-info">
                            <strong>⏰ Time Information:</strong><br>
                            • Started at: {{startTime}}<br>
                            • Time limit: {{timeLimit}} minutes<br>
                            • Must complete by: {{endTime}}
                        </div>
                        
                        <div class="tips">
                            <strong>💡 Quick Tips:</strong><br>
                            • Take your time to create quality conversations<br>
                            • Use the pause feature if you need a break<br>
                            • Your progress is automatically saved<br>
                            • Review your work before final submission
                        </div>
                        
                        <p><strong>Support:</strong> If you experience any technical issues, contact our support team immediately.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    },
    
    assessmentSubmitted: {
        subject: 'Assessment Submitted Successfully - {{assessmentTitle}}',
        htmlContent: `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f8f9fa; }
                    .summary { background-color: #e7f3ff; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; }
                    .next-steps { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Assessment Submitted</h1>
                    </div>
                    <div class="content">
                        <h2>Thank you, {{userName}}!</h2>
                        <p>Your <strong>{{assessmentTitle}}</strong> assessment has been successfully submitted and is now under review.</p>
                        
                        <div class="summary">
                            <strong>📊 Submission Summary:</strong><br>
                            • Submitted at: {{submissionTime}}<br>
                            • Tasks completed: {{tasksCompleted}}/{{totalTasks}}<br>
                            • Time taken: {{timeTaken}}<br>
                            • Conversations created: {{conversationsCreated}}
                        </div>
                        
                        <div class="next-steps">
                            <strong>🔍 What happens next:</strong><br>
                            • Our QA team will review your submission<br>
                            • Review typically takes 24-48 hours<br>
                            • You'll receive an email with the results<br>
                            • If approved, you'll be eligible for the project
                        </div>
                        
                        <p><strong>Reference ID:</strong> {{submissionId}}</p>
                        <p><em>Keep this reference ID for your records.</em></p>
                    </div>
                </div>
            </body>
            </html>
        `
    },
    
    assessmentApproved: {
        subject: '🎉 Assessment Approved - Welcome to {{projectTitle}}',
        htmlContent: `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f8f9fa; }
                    .success { background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; }
                    .score-info { background-color: #e7f3ff; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; }
                    .button { background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 Congratulations!</h1>
                    </div>
                    <div class="content">
                        <h2>Excellent work, {{userName}}!</h2>
                        <p>We're pleased to inform you that your <strong>{{assessmentTitle}}</strong> assessment has been <strong>approved</strong>.</p>
                        
                        <div class="success">
                            <strong>✅ Assessment Status: APPROVED</strong><br>
                            You are now qualified to work on the <strong>{{projectTitle}}</strong> project!
                        </div>
                        
                        <div class="score-info">
                            <strong>📈 Your Results:</strong><br>
                            • Overall Score: {{overallScore}}/10<br>
                            • Review Date: {{reviewDate}}<br>
                            {{#hasFeedback}}• Feedback: {{feedback}}{{/hasFeedback}}
                        </div>
                        
                        <a href="{{projectLink}}" class="button">Access Project</a>
                        
                        <p><strong>Next Steps:</strong></p>
                        <ul>
                            <li>Access the project dashboard using the link above</li>
                            <li>Review the project guidelines and requirements</li>
                            <li>Start working on assigned tasks</li>
                            <li>Maintain the quality standards demonstrated in your assessment</li>
                        </ul>
                        
                        <p><em>Welcome to our team of skilled annotators!</em></p>
                    </div>
                </div>
            </body>
            </html>
        `
    },
    
    assessmentRejected: {
        subject: 'Assessment Results - {{assessmentTitle}}',
        htmlContent: `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f8f9fa; }
                    .result { background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; }
                    .feedback { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                    .retake { background-color: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin: 20px 0; }
                    .button { background-color: #17a2b8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Assessment Results</h1>
                    </div>
                    <div class="content">
                        <h2>Hello {{userName}},</h2>
                        <p>Thank you for completing the <strong>{{assessmentTitle}}</strong> assessment.</p>
                        
                        <div class="result">
                            <strong>Assessment Status: Not Approved</strong><br>
                            Unfortunately, your submission did not meet the required standards for this project.
                        </div>
                        
                        {{#hasFeedback}}
                        <div class="feedback">
                            <strong>📝 Reviewer Feedback:</strong><br>
                            {{feedback}}
                        </div>
                        {{/hasFeedback}}
                        
                        <div class="feedback">
                            <strong>📊 Your Results:</strong><br>
                            • Overall Score: {{overallScore}}/10<br>
                            • Review Date: {{reviewDate}}
                        </div>
                        
                        {{#canRetake}}
                        <div class="retake">
                            <strong>🔄 Retake Opportunity:</strong><br>
                            You can retake this assessment after the 24-hour cooldown period.<br>
                            {{#nextAttemptTime}}Next attempt available: {{nextAttemptTime}}{{/nextAttemptTime}}
                        </div>
                        
                        <a href="{{retakeLink}}" class="button">Retake Assessment</a>
                        {{/canRetake}}
                        
                        {{^canRetake}}
                        <div class="retake">
                            <strong>Maximum attempts reached.</strong><br>
                            You have used all available retake attempts for this assessment.
                        </div>
                        {{/canRetake}}
                        
                        <p><strong>Improvement Tips:</strong></p>
                        <ul>
                            <li>Review the assessment guidelines carefully</li>
                            <li>Focus on creating natural, engaging conversations</li>
                            <li>Pay attention to detail and quality</li>
                            <li>Take your time to review before submitting</li>
                        </ul>
                    </div>
                </div>
            </body>
            </html>
        `
    },
    
    assessmentReminder: {
        subject: 'Reminder: Complete Your Assessment - {{assessmentTitle}}',
        htmlContent: `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #ffc107; color: #212529; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f8f9fa; }
                    .urgent { background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; }
                    .button { background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>⏰ Assessment Reminder</h1>
                    </div>
                    <div class="content">
                        <h2>Don't miss out, {{userName}}!</h2>
                        <p>You have a pending <strong>{{assessmentTitle}}</strong> assessment that requires your attention.</p>
                        
                        <div class="urgent">
                            <strong>⚠️ Time Sensitive:</strong><br>
                            {{#hasDeadline}}Assessment deadline: {{deadline}}{{/hasDeadline}}<br>
                            {{#timeRemaining}}Time remaining: {{timeRemaining}}{{/timeRemaining}}
                        </div>
                        
                        <p>Complete your assessment now to remain eligible for the <strong>{{projectTitle}}</strong> project.</p>
                        
                        <a href="{{assessmentLink}}" class="button">Complete Assessment Now</a>
                        
                        <p><em>Don't let this opportunity pass you by!</em></p>
                    </div>
                </div>
            </body>
            </html>
        `
    }
};

/**
 * Send assessment invitation email
 */
const sendAssessmentInvitation = async ({
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

        const emailData = {
            sender: {
                name: 'Deep Tech Platform',
                email: process.env.SENDER_EMAIL || 'noreply@deeptech.com'
            },
            to: [{
                email: userEmail,
                name: userName
            }],
            subject,
            htmlContent
        };

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
const sendAssessmentStarted = async ({
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

        const emailData = {
            sender: {
                name: 'Deep Tech Platform',
                email: process.env.SENDER_EMAIL || 'noreply@deeptech.com'
            },
            to: [{
                email: userEmail,
                name: userName
            }],
            subject,
            htmlContent
        };

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
const sendAssessmentSubmitted = async ({
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

        const emailData = {
            sender: {
                name: 'Deep Tech Platform',
                email: process.env.SENDER_EMAIL || 'noreply@deeptech.com'
            },
            to: [{
                email: userEmail,
                name: userName
            }],
            subject,
            htmlContent
        };

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
const sendAssessmentResult = async ({
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

        const emailData = {
            sender: {
                name: 'Deep Tech Platform',
                email: process.env.SENDER_EMAIL || 'noreply@deeptech.com'
            },
            to: [{
                email: userEmail,
                name: userName
            }],
            subject,
            htmlContent
        };

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
const sendAssessmentReminder = async ({
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

        const emailData = {
            sender: {
                name: 'Deep Tech Platform',
                email: process.env.SENDER_EMAIL || 'noreply@deeptech.com'
            },
            to: [{
                email: userEmail,
                name: userName
            }],
            subject,
            htmlContent
        };

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
const sendBulkAssessmentEmails = async (emailRequests) => {
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

module.exports = {
    sendAssessmentInvitation,
    sendAssessmentStarted,
    sendAssessmentSubmitted,
    sendAssessmentResult,
    sendAssessmentReminder,
    sendBulkAssessmentEmails,
    emailTemplates
};