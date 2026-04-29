const BaseMailService = require('./base.service');
const envConfig = require('../../config/envConfig');

class InvoiceMailService extends BaseMailService {

    static async sendDTUserInvoiceNotification(recipientEmail, recipientName, invoiceData) {
        let htmlTemplate = this.getMailTemplate('sendDTUserInvoiceNotification');

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
            senderEmail: envConfig.email.senders.payments.email,
            senderName: envConfig.email.senders.payments.name
        });
    }

    static async sendPartnerInvoiceEmail(recipientEmail, recipientName, invoiceData) {
        let htmlTemplate = this.getMailTemplate('sendPartnerInvoiceEmail');

        const { name, amount, due_date, description = 'Partner invoice', companyName = 'MyDeepTech', currency } = invoiceData;
        const formattedAmount = amount ? `${parseFloat(amount).toFixed(2)}` : 'TBD';
        const formattedDueDate = due_date ? new Date(due_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : 'TBD';
        const currencySymbols = {
            USD: '$',
            EUR: '€',
            GBP: '£',
            NGN: '₦',
            KES: 'KSh',
            GHS: 'GH₵'
        };
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{companyName}}', companyName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{formattedAmount}}', formattedAmount);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{formattedDueDate}}', formattedDueDate);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{description}}', description);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{currency}}', currencySymbols[currency] || '$');

        const message = `Hi ${recipientName}, you have received a new invoice for ${currencySymbols[currency] || '$'} ${formattedAmount} from ${companyName}. Due date: ${formattedDueDate}.`;

        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: `Invoice from ${companyName} - MyDeepTech`,
            htmlTemplate,
            message,
            senderEmail: envConfig.email.senders.payments.email,
            senderName: envConfig.email.senders.payments.name
        });
    }

}

module.exports = InvoiceMailService;