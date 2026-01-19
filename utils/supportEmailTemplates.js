import { sendEmail } from './brevoSMTP.js';

/**
 * Send ticket creation confirmation email to user
 * @param {string} userEmail - User's email address
 * @param {Object} ticket - Support ticket details
 */
export const sendTicketCreationEmail = async (userEmail, ticket) => {
    try {
        const subject = `Support Ticket Created - ${ticket.ticketNumber}`;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Support Ticket Created</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
                    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); overflow: hidden; }
                    .header { background: linear-gradient(135deg, #007bff, #0056b3); color: white; padding: 30px; text-align: center; }
                    .content { padding: 30px; }
                    .ticket-info { background: #f8f9fa; border-left: 4px solid #007bff; padding: 20px; margin: 20px 0; border-radius: 5px; }
                    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; }
                    .btn { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                    .status-badge { background: #28a745; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; font-weight: bold; }
                    .priority-badge { padding: 5px 10px; border-radius: 15px; font-size: 12px; font-weight: bold; }
                    .priority-low { background: #e3f2fd; color: #1976d2; }
                    .priority-medium { background: #fff3e0; color: #f57c00; }
                    .priority-high { background: #fce4ec; color: #c2185b; }
                    .priority-urgent { background: #ffebee; color: #d32f2f; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 28px;">🎫 Support Ticket Created</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">We've received your support request</p>
                    </div>
                    
                    <div class="content">
                        <p style="font-size: 16px; margin-bottom: 25px;">
                            Hello! Your support ticket has been successfully created and our team has been notified.
                        </p>
                        
                        <div class="ticket-info">
                            <h3 style="margin-top: 0; color: #007bff;">📋 Ticket Details</h3>
                            <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
                            <p><strong>Subject:</strong> ${ticket.subject}</p>
                            <p><strong>Category:</strong> ${ticket.category.replace('_', ' ').toUpperCase()}</p>
                            <p><strong>Priority:</strong> 
                                <span class="priority-badge priority-${ticket.priority}">${ticket.priority.toUpperCase()}</span>
                            </p>
                            <p><strong>Status:</strong> 
                                <span class="status-badge">OPEN</span>
                            </p>
                            <p><strong>Created:</strong> ${new Date(ticket.createdAt).toLocaleString()}</p>
                        </div>
                        
                        <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin: 25px 0;">
                            <h4 style="margin-top: 0; color: #0056b3;">📝 Your Message</h4>
                            <p style="font-style: italic; color: #555; margin-bottom: 0;">"${ticket.description}"</p>
                        </div>
                        
                        <h3 style="color: #333;">🕐 What happens next?</h3>
                        <ul style="color: #555; line-height: 1.8;">
                            <li>Our support team will review your ticket within 24 hours</li>
                            <li>You'll receive email notifications for any updates</li>
                            <li>You can reply to this email to add more information</li>
                            <li>Track your ticket status in your dashboard</li>
                        </ul>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL || 'https://mydeeptech.ng'}/dashboard/support" class="btn">
                                View Ticket in Dashboard
                            </a>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p style="margin: 0 0 10px 0; color: #333;"><strong>📞 Need Immediate Help?</strong></p>
                        <p style="margin: 5px 0;">
                            📧 Email: <a href="mailto:support@mydeeptech.ng" style="color: #007bff;">support@mydeeptech.ng</a><br>
                            💬 Live Chat: Available on our website<br>
                            🕐 Response Time: Within 24 hours
                        </p>
                        
                        <hr style="border: none; height: 1px; background: #dee2e6; margin: 20px 0;">
                        <p style="margin: 0; font-size: 12px; color: #6c757d;">
                            This email was sent regarding your support ticket ${ticket.ticketNumber}.<br>
                            MyDeepTech Support Team | <a href="https://mydeeptech.ng" style="color: #007bff;">mydeeptech.ng</a>
                        </p>
                    </div>
                </div>
            </body>
            </html>
         `;

        const textContent = `
                Support Ticket Created - ${ticket.ticketNumber}

                Hello! Your support ticket has been successfully created.

                Ticket Details:
                - Ticket Number: ${ticket.ticketNumber}
                - Subject: ${ticket.subject}
                - Category: ${ticket.category.replace('_', ' ').toUpperCase()}
                - Priority: ${ticket.priority.toUpperCase()}
                - Status: OPEN
                - Created: ${new Date(ticket.createdAt).toLocaleString()}

                Your Message: "${ticket.description}"

                What happens next?
                - Our support team will review your ticket within 24 hours
                - You'll receive email notifications for any updates
                - You can reply to this email to add more information

                Need immediate help? Contact us at support@mydeeptech.ng

                MyDeepTech Support Team
            
        `;

        await sendEmail({ to: userEmail, subject, text: textContent, html: htmlContent });
        console.log(`✅ Ticket creation email sent to ${userEmail} for ticket ${ticket.ticketNumber}`);
    } catch (error) {
        console.error('❌ Error sending ticket creation email:', error);
        throw error;
    }
};

/**
 * Send ticket status update email to user
 * @param {string} userEmail - User's email address
 * @param {Object} ticket - Support ticket details
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 */
export const sendTicketStatusUpdateEmail = async (userEmail, ticket, oldStatus, newStatus) => {
    try {
        const subject = `Ticket Status Update - ${ticket.ticketNumber}`;

        let statusMessage = '';
        let statusColor = '#007bff';
        let nextSteps = '';

        switch (newStatus) {
            case 'in_progress':
                statusMessage = 'Your ticket is now being actively worked on by our support team.';
                statusColor = '#ffc107';
                nextSteps = 'Our team is investigating your issue. You\'ll be notified of any updates or if we need additional information.';
                break;
            case 'waiting_for_user':
                statusMessage = 'We need additional information from you to proceed.';
                statusColor = '#fd7e14';
                nextSteps = 'Please check your ticket for our latest message and provide the requested information.';
                break;
            case 'resolved':
                statusMessage = 'Great news! Your support ticket has been resolved.';
                statusColor = '#28a745';
                nextSteps = 'Please review the resolution and let us know if you need any clarification or if the issue persists.';
                break;
            case 'closed':
                statusMessage = 'Your support ticket has been closed.';
                statusColor = '#6c757d';
                nextSteps = 'If you need further assistance with this issue, feel free to create a new support ticket.';
                break;
        }

        const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Ticket Status Update</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background: linear-gradient(135deg, ${statusColor}, ${statusColor}cc); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .status-update { background: #f8f9fa; border-left: 4px solid ${statusColor}; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; }
            .btn { display: inline-block; padding: 12px 24px; background: ${statusColor}; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .status-badge { background: ${statusColor}; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; display: inline-block; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0; font-size: 28px;">📬 Ticket Update</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">${ticket.ticketNumber}</p>
            </div>
            
            <div class="content">
                <div class="status-update">
                    <h3 style="margin-top: 0; color: ${statusColor};">Status Changed</h3>
                    <p style="font-size: 16px; margin-bottom: 15px;">
                        <strong>${ticket.subject}</strong>
                    </p>
                    <p style="margin-bottom: 15px;">
                        Status: <del style="color: #999;">${oldStatus.replace('_', ' ').toUpperCase()}</del> → 
                        <span class="status-badge">${newStatus.replace('_', ' ').toUpperCase()}</span>
                    </p>
                    <p style="color: #555; font-size: 16px; margin-bottom: 0;">
                        ${statusMessage}
                    </p>
                </div>
                
                <h3 style="color: #333;">🔄 Next Steps</h3>
                <p style="color: #555; font-size: 16px;">
                    ${nextSteps}
                </p>
                
                ${newStatus === 'resolved' ? `
                <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 25px 0;">
                    <h4 style="margin-top: 0; color: #155724;">🌟 Help us improve!</h4>
                    <p style="color: #155724; margin-bottom: 15px;">
                        How was your support experience? Your feedback helps us serve you better.
                    </p>
                    <a href="${process.env.FRONTEND_URL || 'https://mydeeptech.ng'}/dashboard/support/rate/${ticket._id}" 
                       style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                        Rate Your Experience
                    </a>
                </div>
                ` : ''}
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'https://mydeeptech.ng'}/dashboard/support/${ticket._id}" class="btn">
                        View Ticket Details
                    </a>
                </div>
            </div>
            
            <div class="footer">
                <p style="margin: 0 0 10px 0; color: #333;"><strong>📞 Need Help?</strong></p>
                <p style="margin: 5px 0;">
                    📧 Reply to this email or contact: <a href="mailto:support@mydeeptech.ng" style="color: #007bff;">support@mydeeptech.ng</a>
                </p>
                
                <hr style="border: none; height: 1px; background: #dee2e6; margin: 20px 0;">
                <p style="margin: 0; font-size: 12px; color: #6c757d;">
                    This email was sent regarding your support ticket ${ticket.ticketNumber}.<br>
                    MyDeepTech Support Team | <a href="https://mydeeptech.ng" style="color: #007bff;">mydeeptech.ng</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

        const textContent = `
Ticket Status Update - ${ticket.ticketNumber}

${ticket.subject}

Status changed from ${oldStatus.replace('_', ' ').toUpperCase()} to ${newStatus.replace('_', ' ').toUpperCase()}

${statusMessage}

Next Steps:
${nextSteps}

View your ticket: ${process.env.FRONTEND_URL || 'https://mydeeptech.ng'}/dashboard/support/${ticket._id}

Need help? Reply to this email or contact support@mydeeptech.ng

MyDeepTech Support Team
    `;

        await sendEmail({ to: userEmail, subject, text: textContent, html: htmlContent });
        console.log(`✅ Status update email sent to ${userEmail} for ticket ${ticket.ticketNumber}`);
    } catch (error) {
        console.error('❌ Error sending status update email:', error);
        throw error;
    }
};

/**
 * Send new ticket notification email to admin
 * @param {string} adminEmail - Admin's email address
 * @param {Object} ticket - Support ticket details
 * @param {Object} user - User who created the ticket
 */
export const sendNewTicketNotificationToAdmin = async (adminEmail, ticket, user) => {
    try {
        const subject = `New Support Ticket - ${ticket.ticketNumber} (${ticket.priority.toUpperCase()})`;

        const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>New Support Ticket</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .ticket-info { background: #f8f9fa; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .user-info { background: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .priority-high, .priority-urgent { background: #fff5f5; border-left-color: #e53e3e !important; }
            .btn { display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0; font-size: 28px;">🚨 New Support Ticket</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Admin Notification</p>
            </div>
            
            <div class="content">
                <p style="font-size: 16px; margin-bottom: 25px; color: #dc3545; font-weight: bold;">
                    A new support ticket requires attention from the support team.
                </p>
                
                <div class="ticket-info ${ticket.priority === 'high' || ticket.priority === 'urgent' ? 'priority-high' : ''}">
                    <h3 style="margin-top: 0; color: #dc3545;">📋 Ticket Information</h3>
                    <p><strong>Ticket #:</strong> ${ticket.ticketNumber}</p>
                    <p><strong>Subject:</strong> ${ticket.subject}</p>
                    <p><strong>Category:</strong> ${ticket.category.replace('_', ' ').toUpperCase()}</p>
                    <p><strong>Priority:</strong> <span style="background: ${ticket.priority === 'urgent' ? '#dc3545' : ticket.priority === 'high' ? '#fd7e14' : '#ffc107'}; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px;">${ticket.priority.toUpperCase()}</span></p>
                    <p><strong>Created:</strong> ${new Date(ticket.createdAt).toLocaleString()}</p>
                </div>
                
                <div class="user-info">
                    <h4 style="margin-top: 0; color: #495057;">👤 User Details</h4>
                    <p><strong>Name:</strong> ${user.fullName}</p>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>User ID:</strong> ${user._id}</p>
                </div>
                
                <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin: 25px 0;">
                    <h4 style="margin-top: 0; color: #0056b3;">💬 User's Message</h4>
                    <p style="font-style: italic; color: #555; margin-bottom: 0;">"${ticket.description}"</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.ADMIN_URL || 'https://admin.mydeeptech.ng'}/support/tickets/${ticket._id}" class="btn">
                        Review & Assign Ticket
                    </a>
                </div>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 0; color: #856404;">
                        <strong>⏰ Reminder:</strong> Please respond to support tickets within 24 hours to maintain our service quality standards.
                    </p>
                </div>
            </div>
            
            <div class="footer">
                <p style="margin: 0; font-size: 12px; color: #6c757d;">
                    This is an automated notification for MyDeepTech support team.<br>
                    Admin Panel | <a href="https://admin.mydeeptech.ng" style="color: #007bff;">admin.mydeeptech.ng</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

        const textContent = `
New Support Ticket - ${ticket.ticketNumber} (${ticket.priority.toUpperCase()})

A new support ticket requires attention from the support team.

Ticket Information:
- Ticket #: ${ticket.ticketNumber}
- Subject: ${ticket.subject}
- Category: ${ticket.category.replace('_', ' ').toUpperCase()}
- Priority: ${ticket.priority.toUpperCase()}
- Created: ${new Date(ticket.createdAt).toLocaleString()}

User Details:
- Name: ${user.fullName}
- Email: ${user.email}
- User ID: ${user._id}

User's Message: "${ticket.description}"

Review ticket: ${process.env.ADMIN_URL || 'https://admin.mydeeptech.ng'}/support/tickets/${ticket._id}

Please respond within 24 hours to maintain service quality standards.

MyDeepTech Support Admin
    `;

        await sendEmail({ to: adminEmail, subject, text: textContent, html: htmlContent });
        console.log(`✅ New ticket notification email sent to admin ${adminEmail} for ticket ${ticket.ticketNumber}`);
    } catch (error) {
        console.error('❌ Error sending admin notification email:', error);
        throw error;
    }
};

/**
 * Send ticket assignment notification email to admin
 * @param {string} adminEmail - Admin's email address
 * @param {Object} ticket - Support ticket details
 */
export const sendTicketAssignmentEmail = async (adminEmail, ticket) => {
    try {
        const subject = `Ticket Assigned to You - ${ticket.ticketNumber}`;

        const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Ticket Assignment</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background: linear-gradient(135deg, #17a2b8, #138496); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .assignment-info { background: #e1f5f8; border-left: 4px solid #17a2b8; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .btn { display: inline-block; padding: 12px 24px; background: #17a2b8; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0; font-size: 28px;">🎯 Ticket Assigned</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">You have a new assignment</p>
            </div>
            
            <div class="content">
                <p style="font-size: 16px; margin-bottom: 25px;">
                    A support ticket has been assigned to you. Please review and respond as soon as possible.
                </p>
                
                <div class="assignment-info">
                    <h3 style="margin-top: 0; color: #17a2b8;">📋 Assigned Ticket</h3>
                    <p><strong>Ticket #:</strong> ${ticket.ticketNumber}</p>
                    <p><strong>Subject:</strong> ${ticket.subject}</p>
                    <p><strong>Category:</strong> ${ticket.category.replace('_', ' ').toUpperCase()}</p>
                    <p><strong>Priority:</strong> ${ticket.priority.toUpperCase()}</p>
                    <p><strong>Assigned:</strong> ${new Date().toLocaleString()}</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.ADMIN_URL || 'https://admin.mydeeptech.ng'}/support/tickets/${ticket._id}" class="btn">
                        Start Working on Ticket
                    </a>
                </div>
            </div>
            
            <div class="footer">
                <p style="margin: 0; font-size: 12px; color: #6c757d;">
                    MyDeepTech Support Admin Panel<br>
                    <a href="https://admin.mydeeptech.ng" style="color: #007bff;">admin.mydeeptech.ng</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

        await sendEmail({ to: adminEmail, subject, text: '', html: htmlContent });
        console.log(`✅ Assignment email sent to admin ${adminEmail} for ticket ${ticket.ticketNumber}`);
    } catch (error) {
        console.error('❌ Error sending assignment email:', error);
        throw error;
    }
};

/**
 * Calculate waiting time for customer
 */
const getWaitingTime = (startTime) => {
    const now = new Date();
    const start = new Date(startTime);
    const diffMs = now - start;

    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
};

/**
 * Send email notification to support team when no agents are online
 * @param {string} supportEmail - Support email address
 * @param {Object} ticket - Support ticket details
 * @param {Object} user - User details
 */
export const sendOfflineAgentNotification = async (supportEmail, ticket, user) => {
    try {
        const subject = `🚨 URGENT: New Chat Request - No Agents Online - ${ticket.ticketNumber}`;

        const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Urgent Chat Request</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; }
            .header { background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 30px; text-align: center; }
            .urgent-badge { background: #ffc107; color: #212529; padding: 8px 16px; border-radius: 20px; font-weight: bold; display: inline-block; margin-bottom: 15px; }
            .content { padding: 30px; }
            .ticket-info { background: #f8f9fa; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; }
            .user-info { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0; }
            .priority-high { color: #dc3545; font-weight: bold; }
            .priority-medium { color: #fd7e14; font-weight: bold; }
            .priority-low { color: #28a745; font-weight: bold; }
            .action-button { display: inline-block; background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            .footer { background: #343a40; color: #adb5bd; padding: 20px; text-align: center; }
            .timestamp { color: #6c757d; font-size: 14px; }
            .message-preview { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="urgent-badge">URGENT - NO AGENTS ONLINE</div>
                <h1>🚨 Immediate Attention Required</h1>
                <p>A customer has started a chat session but no support agents are currently online</p>
            </div>
            
            <div class="content">
                <div class="ticket-info">
                    <h2>📋 Ticket Information</h2>
                    <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
                    <p><strong>Type:</strong> Live Chat Support</p>
                    <p><strong>Priority:</strong> <span class="priority-${ticket.priority}">${ticket.priority.toUpperCase()}</span></p>
                    <p><strong>Category:</strong> ${ticket.category.replace('_', ' ').toUpperCase()}</p>
                    <p><strong>Status:</strong> Waiting for Agent</p>
                    <p class="timestamp"><strong>Started At:</strong> ${new Date(ticket.createdAt).toLocaleString()}</p>
                </div>
 
                <div class="user-info">
                    <h2>👤 Customer Information</h2>
                    <p><strong>Name:</strong> ${user.fullName || user.username || 'N/A'}</p>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>User ID:</strong> ${user._id}</p>
                </div>
 
                ${ticket.description ? `
                <div class="message-preview">
                    <h3>💬 Initial Message</h3>
                    <p><em>"${ticket.description}"</em></p>
                </div>
                ` : ''}
 
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'https://mydeeptech.ng'}/admin/support/chat/${ticket._id}" 
                       class="action-button">
                        🚀 JOIN CHAT NOW
                    </a>
                </div>
 
                <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>⚠️ Action Required:</strong></p>
                    <ul>
                        <li>Log in to the admin platform immediately</li>
                        <li>Join the chat to assist the customer</li>
                        <li>Customer is waiting for real-time support</li>
                        <li>Response time impacts customer satisfaction</li>
                    </ul>
                </div>
            </div>
 
            <div class="footer">
                <p><strong>MyDeepTech Support System</strong></p>
                <p>This is an automated notification. Customer waiting time: <strong>${getWaitingTime(ticket.createdAt)}</strong></p>
                <p style="font-size: 12px; margin-top: 15px;">
                    💡 To stop receiving these notifications, contact system administrator<br>
                    📱 Mobile app notifications are also recommended for faster response times
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

        const textContent = `
🚨 URGENT: New Chat Request - No Agents Online

Ticket: ${ticket.ticketNumber}
Customer: ${user.fullName || user.username} (${user.email})
Priority: ${ticket.priority.toUpperCase()}
Started: ${new Date(ticket.createdAt).toLocaleString()}

${ticket.description ? `Initial Message: "${ticket.description}"` : ''}

ACTION REQUIRED:
- Log in to admin platform immediately
- Join chat to assist customer
- Customer is waiting for real-time support

Login: ${process.env.FRONTEND_URL || 'https://mydeeptech.ng'}/admin/login
Direct Chat: ${process.env.FRONTEND_URL || 'https://mydeeptech.ng'}/admin/support/chat/${ticket._id}

MyDeepTech Support System
    `;

        await sendEmail({ to: supportEmail, subject, text: textContent, html: htmlContent });
        console.log(`📧 Offline agent notification sent to ${supportEmail} for ticket ${ticket.ticketNumber}`);
        return { success: true };

    } catch (error) {
        console.error('❌ Error sending offline agent notification:', error);
        return { success: false, error: error.message };
    }
};