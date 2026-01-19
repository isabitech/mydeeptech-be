import { sendProjectEmail } from './brevoSMTP.js';

/**
 * Send assessment invitation email to user
 * @param {string} email - User's email address
 * @param {string} fullName - User's full name
 * @param {Object} assessmentInfo - Assessment details
 */
export const sendAssessmentInvitationEmail = async (email, fullName, assessmentInfo = {}) => {
    const subject = `Assessment Invitation - ${assessmentInfo.title || 'Multimedia Assessment'}`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Assessment Invitation - MyDeeptech</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">📋 Assessment Invitation</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">You're invited to take an assessment</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <p style="font-size: 18px; margin-bottom: 20px;">Hi <strong>${fullName}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
                You have been invited to take the <strong>${assessmentInfo.title || 'Multimedia Assessment'}</strong> 
                on MyDeeptech. This assessment will help us evaluate your skills and match you with suitable projects.
            </p>
            
            ${assessmentInfo.description ? `
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #856404;">Assessment Details</h3>
                <p style="margin-bottom: 0;">${assessmentInfo.description}</p>
            </div>
            ` : ''}
            
            <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1976d2;">Assessment Guidelines</h3>
                <ul style="margin-bottom: 0; padding-left: 20px;">
                    <li>Complete the assessment in the allocated time</li>
                    <li>Follow all instructions carefully</li>
                    <li>Ensure you have a stable internet connection</li>
                    <li>Contact support if you encounter any issues</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://mydeeptech.ng/dashboard/assessments" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    Take Assessment
                </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
                If you have any questions about this assessment, please contact our support team.
            </p>
            
            <div style="border-top: 2px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
                <p style="margin: 0; color: #888; font-size: 14px;">
                    © 2024 MyDeeptech. All rights reserved.<br>
                    <a href="https://mydeeptech.ng" style="color: #667eea;">mydeeptech.ng</a>
                </p>
            </div>
        </div>
    </body>
    </html>
  `;

    try {
        await sendProjectEmail({ to: email, subject, html: htmlContent });
        console.log(`✅ Assessment invitation email sent to ${email}`);
        return { success: true, message: 'Assessment invitation email sent successfully' };
    } catch (error) {
        console.error('❌ Error sending assessment invitation email:', error);
        return { success: false, message: 'Failed to send assessment invitation email', error: error.message };
    }
};

/**
 * Send assessment completion email to user
 * @param {string} email - User's email address
 * @param {string} fullName - User's full name
 * @param {Object} assessmentResult - Assessment completion details
 */
export const sendAssessmentCompletionEmail = async (email, fullName, assessmentResult = {}) => {
    const subject = `Assessment Completed - ${assessmentResult.assessmentTitle || 'Multimedia Assessment'}`;

    const isPass = assessmentResult.status === 'passed';
    const statusColor = isPass ? '#4caf50' : '#f44336';
    const statusIcon = isPass ? '✅' : '❌';
    const statusText = isPass ? 'Passed' : 'Not Passed';

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Assessment Completed - MyDeeptech</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">${statusIcon} Assessment Completed</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your assessment results are ready</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <p style="font-size: 18px; margin-bottom: 20px;">Hi <strong>${fullName}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
                You have completed the <strong>${assessmentResult.assessmentTitle || 'Multimedia Assessment'}</strong>. 
                Here are your results:
            </p>
            
            <div style="background: white; border: 2px solid ${statusColor}; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                <h2 style="margin: 0 0 10px 0; color: ${statusColor}; font-size: 24px;">
                    ${statusIcon} ${statusText}
                </h2>
                ${assessmentResult.finalScore ? `
                <p style="font-size: 18px; margin: 0; color: #666;">
                    Final Score: <strong>${assessmentResult.finalScore}/10</strong>
                </p>
                ` : ''}
            </div>
            
            ${assessmentResult.completionPercentage ? `
            <div style="background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #2e7d32;">Assessment Statistics</h3>
                <ul style="margin-bottom: 0; padding-left: 20px;">
                    <li>Completion: ${assessmentResult.completionPercentage}%</li>
                    ${assessmentResult.timeSpent ? `<li>Time Spent: ${Math.round(assessmentResult.timeSpent / 60)} minutes</li>` : ''}
                    ${assessmentResult.tasksCompleted ? `<li>Tasks Completed: ${assessmentResult.tasksCompleted}</li>` : ''}
                </ul>
            </div>
            ` : ''}
            
            ${isPass ? `
            <div style="background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #2e7d32;">🎉 Congratulations!</h3>
                <p style="margin-bottom: 0;">
                    You have successfully passed this assessment! You can now access projects and opportunities 
                    that require this qualification.
                </p>
            </div>
            ` : `
            <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #c62828;">Assessment Not Passed</h3>
                <p style="margin-bottom: 0;">
                    Unfortunately, you did not pass this assessment. You may be eligible to retake it after 
                    the cooldown period. Check your dashboard for retake availability.
                </p>
            </div>
            `}
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://mydeeptech.ng/dashboard/assessments" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    View Dashboard
                </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
                If you have any questions about your assessment results, please contact our support team.
            </p>
            
            <div style="border-top: 2px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
                <p style="margin: 0; color: #888; font-size: 14px;">
                    © 2024 MyDeeptech. All rights reserved.<br>
                    <a href="https://mydeeptech.ng" style="color: #667eea;">mydeeptech.ng</a>
                </p>
            </div>
        </div>
    </body>
    </html>
  `;

    try {
        await sendProjectEmail({ to: email, subject, html: htmlContent });
        console.log(`✅ Assessment completion email sent to ${email}`);
        return { success: true, message: 'Assessment completion email sent successfully' };
    } catch (error) {
        console.error('❌ Error sending assessment completion email:', error);
        return { success: false, message: 'Failed to send assessment completion email', error: error.message };
    }
};