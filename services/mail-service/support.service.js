const BaseMailService = require('./base.service');

class SupportMailService extends BaseMailService {

    static async sendSupportTicketCreationEmail(recipientEmail, recipientName, ticketData) {
        console.log(`Preparing to send support ticket creation email to ${recipientEmail}`);
        let htmlTemplate = this.getMailTemplate('sendSupportTicketCreationEmail');
        
        const { ticketNumber, subject, category, priority, description, createdAt } = ticketData;
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{ticketNumber}}', ticketNumber);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{subject}}', subject);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{category}}', category.replace('_', ' ').toUpperCase());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{priority}}', priority.toUpperCase());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{description}}', description);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{createdAt}}', new Date(createdAt).toLocaleString());
        
        const message = `Support ticket ${ticketNumber} created successfully. Subject: ${subject}. Priority: ${priority}.`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: `Support Ticket Created: ${ticketNumber} - MyDeepTech`,
            htmlTemplate,
            message,
            senderEmail: 'no-reply@mydeeptech.ng',
            senderName: 'MyDeepTech'
        });
    }

    static async sendadminSupportTicketNotification(recipientEmail, recipientName, ticketData, userData) {
        console.log(`Preparing to send admin support ticket notification to ${recipientEmail}`);
        let htmlTemplate = this.getMailTemplate('sendAdminSupportTicketNotification');
        
        const { ticketNumber, subject, category, priority, description, createdAt } = ticketData;
        const { fullName: userFullName, email: userEmail } = userData;
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{ticketNumber}}', ticketNumber);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{subject}}', subject);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{category}}', category.replace('_', ' ').toUpperCase());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{priority}}', priority.toUpperCase());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{description}}', description);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{userFullName}}', userFullName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{userEmail}}', userEmail);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{createdAt}}', new Date(createdAt).toLocaleString());
        
        const message = `New support ticket ${ticketNumber} from ${userFullName} (${userEmail}). Subject: ${subject}. Priority: ${priority}.`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: `[ADMIN] New Support Ticket: ${ticketNumber} - MyDeepTech`,
            htmlTemplate,
            message,
            senderEmail: 'no-reply@mydeeptech.ng',
            senderName: 'MyDeepTech'
        });
    }

    static async sendNewTicketNotificationToAdmin(recipientEmail, ticketData, userData) {
        console.log(`Sending new ticket notification to admin: ${recipientEmail}`);
        
        let htmlTemplate = this.getMailTemplate('sendNewTicketNotificationToAdmin');
        
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
            senderEmail: 'no-reply@mydeeptech.ng',
            senderName: 'MyDeepTech'
        });
    }

    static async sendAdminReplyNotificationEmail(recipientEmail, ticketData, replyData) {
        console.log(`Sending admin reply notification to ${recipientEmail}`);
        
        let htmlTemplate = this.getMailTemplate('sendAdminReplyNotificationEmail');
        
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
            senderEmail: 'no-reply@mydeeptech.ng',
            senderName: 'MyDeepTech'
        });
    }

}

module.exports = SupportMailService;