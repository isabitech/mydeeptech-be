const BaseMailService = require('./base.service');
const envConfig = require('../../config/envConfig');

class AuthMailService extends BaseMailService {

    static async sendVerificationEmail(recipientEmail, recipientName, userId) {
        console.log(`Preparing to send verification email to ${recipientEmail} for user ID: ${userId}`);
        const FRONTEND_URL = envConfig.NODE_ENV === 'production' ? 'https://mydeeptech.ng' : 'http://localhost:5173';
        const verificationUrl = `${FRONTEND_URL}/verify-email/${userId}?email=${encodeURIComponent(recipientEmail)}`;
        let htmlTemplate = this.getMailTemplate('sendVerificationEmail');
        const username = recipientEmail.split("@")[0];

        const message = `
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
            senderEmail: 'no-reply@mydeeptech.ng',
            senderName: 'MyDeepTech'
        });
    }

    static async sendPasswordResetEmail(recipientEmail, recipientName, resetToken) {
        const FRONTEND_URL = envConfig.NODE_ENV === 'production' ? 'https://mydeeptech.ng' : 'http://localhost:5173';
        const resetUrl = `${FRONTEND_URL}/reset-password/${resetToken}?email=${encodeURIComponent(recipientEmail)}`;
        let htmlTemplate = this.getMailTemplate('sendPasswordResetEmail');
        const username = recipientEmail.split("@")[0];
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{name}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{resetUrl}}', resetUrl);
        const message = `Hi ${(recipientName || username)}, please reset your password.`;
        return await this.sendMail({ 
            recipientEmail, 
            recipientName, 
            message, 
            subject: "Reset Your Password - MyDeepTech", 
            htmlTemplate,
            senderEmail: 'no-reply@mydeeptech.ng',
            senderName: 'MyDeepTech'
        });
    }

    static async sendPasswordResetEmailWithType(recipientEmail, recipientName, resetToken, userType = 'dtuser') {
        console.log(`Preparing to send password reset email to ${recipientEmail} for ${userType}`);
        let htmlTemplate = this.getMailTemplate('sendPasswordResetEmail');
        
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
            senderEmail: 'no-reply@mydeeptech.ng',
            senderName: 'MyDeepTech'
        });
    }

    static async sendPasswordResetConfirmationEmail(recipientEmail, recipientName, userType = 'user') {
        console.log(`Sending password reset confirmation to ${recipientEmail}`);
        
        let htmlTemplate = this.getMailTemplate('sendPasswordResetConfirmationEmail');
        
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
            senderEmail: 'no-reply@mydeeptech.ng',
            senderName: 'MyDeepTech'
        });
    }

    static async sendAdminVerificationEmail(recipientEmail, recipientName, verificationCode) {
        console.log(`Preparing to send admin verification email to ${recipientEmail}`);
        let htmlTemplate = this.getMailTemplate('sendAdminVerificationEmail');
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{verificationCode}}', verificationCode);
        
        const message = `Hi ${recipientName}, your admin verification code is: ${verificationCode}. This code expires in 15 minutes.`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: '🔐 Admin Account Verification - MyDeepTech',
            htmlTemplate,
            message,
            senderEmail: 'no-reply@mydeeptech.ng',
            senderName: 'MyDeepTech'
        });
    }

    static async sendAnnotatorApprovalEmail(recipientEmail, recipientName) {
        console.log(`Preparing to send annotator approval email to ${recipientEmail}`);
        let htmlTemplate = this.getMailTemplate('sendAnnotatorApprovalEmail');
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        
        const message = `Congratulations ${recipientName}! You have been approved as an annotator on MyDeepTech. You can now access your dashboard and start applying to projects.`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: 'Congratulations! You are now an approved annotator - MyDeepTech',
            htmlTemplate,
            message,
            senderEmail: 'no-reply@mydeeptech.ng',
            senderName: 'MyDeepTech'
        });
    }

    static async sendAnnotatorRejectionEmail(recipientEmail, recipientName) {
        console.log(`Preparing to send annotator rejection email to ${recipientEmail}`);
        let htmlTemplate = this.getMailTemplate('sendAnnotatorRejectionEmail');
        
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        
        const message = `Hi ${recipientName}, thank you for your interest in becoming an annotator. While your annotator application was not approved, you have been approved as a micro-tasker and can still participate in smaller tasks on our platform.`;
        
        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: 'Application Update - Micro Tasker Approval - MyDeepTech',
            htmlTemplate,
            message,
            senderEmail: 'no-reply@mydeeptech.ng',
            senderName: 'MyDeepTech'
        });
    }

}

module.exports = AuthMailService;