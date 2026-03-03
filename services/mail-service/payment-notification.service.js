const BaseMailService = require('./base.service');

class PaymentNotificationService extends BaseMailService {
    /**
     * Send payment confirmation email to individual recipient
     */
    static async sendPaymentConfirmation(recipientEmail, recipientName, paymentData) {
        console.log(`Sending payment confirmation to ${recipientEmail}`);
        
        let htmlTemplate = this.getMailTemplate('sendPaymentConfirmation');
        
        const { 
            invoiceNumber, 
            projectName, 
            amountUSD, 
            amountNGN, 
            exchangeRate,
            paymentReference,
            paymentDate = new Date(),
            batchId
        } = paymentData;
        
        const formattedAmountUSD = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amountUSD);
        
        const formattedAmountNGN = new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN'
        }).format(amountNGN);
        
        const formattedDate = new Date(paymentDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Replace template placeholders
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{recipientName}}', recipientName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{invoiceNumber}}', invoiceNumber);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{projectName}}', projectName || 'N/A');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{formattedAmountUSD}}', formattedAmountUSD);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{formattedAmountNGN}}', formattedAmountNGN);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{exchangeRate}}', Number(exchangeRate).toFixed(2));
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{formattedDate}}', formattedDate);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{paymentReference}}', paymentReference);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{batchId}}', batchId);

        const textContent = `
            Payment Sent Successfully! - Invoice #${invoiceNumber}
            
            Dear ${recipientName},
            
            Your payment has been successfully processed and sent via Paystack.
            
            Payment Details:
            - Invoice Number: #${invoiceNumber}
            - Project: ${projectName || 'N/A'}
            - Original Amount (USD): ${formattedAmountUSD}
            - Amount Sent (NGN): ${formattedAmountNGN}
            - Exchange Rate: ₦${Number(exchangeRate).toFixed(2)} per $1
            - Payment Date: ${formattedDate}
            - Payment Reference: ${paymentReference}
            
            Your payment should reflect in your bank account within 1-2 business days.
            
            This invoice is now marked as PAID in our system.
            
            Questions? Contact payments@mydeeptech.ng with batch ID: ${batchId}
            
            Thank you for your excellent work!
            
            Best regards,
            MyDeepTech Payments Team
        `;

        return await this.sendMail({
            recipientEmail,
            recipientName,
            subject: `Payment Sent - Invoice #${invoiceNumber} (${formattedAmountNGN})`,
            message: textContent,
            htmlTemplate,
            senderEmail: 'payments@mydeeptech.ng',
            senderName: 'MyDeepTech Payments'
        });
    }

    /**
     * Send bulk payment summary email to admin/initiator
     */
    static async sendBulkPaymentSummary(adminEmail, adminName, summaryData) {
        console.log(`Sending bulk payment summary to admin: ${adminEmail}`);
        
        let htmlTemplate = this.getMailTemplate('sendBulkPaymentSummary');
        
        const {
            batchId,
            paystackBatchId,
            totalTransfers,
            successfulTransfers,
            totalAmountUSD,
            totalAmountNGN,
            exchangeRate,
            paidInvoices = [],
            errors = [],
            processedAt = new Date()
        } = summaryData;
        
        const formattedTotalUSD = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(totalAmountUSD);
        
        const formattedTotalNGN = new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN'
        }).format(totalAmountNGN);
        
        const formattedDate = new Date(processedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const successRate = totalTransfers > 0 ? Math.round((successfulTransfers/totalTransfers) * 100) : 0;

        // Generate invoice rows for the table
        const invoiceRows = paidInvoices.map(invoice => `
            <tr>
                <td>${invoice.invoiceNumber}</td>
                <td>${invoice.recipient}</td>
                <td>$${Number(invoice.usdAmount).toFixed(2)}</td>
                <td>₦${Number(invoice.ngnAmount).toFixed(2)}</td>
                <td><span style="color: #28a745; font-weight: bold;">✅ PAID</span></td>
            </tr>
        `).join('');

        const errorRows = errors.length > 0 ? errors.map(error => `
            <tr style="background-color: #f8d7da;">
                <td>${error.invoiceNumber || error.invoiceId}</td>
                <td>N/A</td>
                <td>N/A</td>
                <td>N/A</td>
                <td><span style="color: #dc3545; font-weight: bold;">❌ ${error.error}</span></td>
            </tr>
        `).join('') : '';

        // Replace template placeholders
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{adminName}}', adminName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{batchId}}', batchId);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{paystackBatchId}}', paystackBatchId || 'N/A');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{totalTransfers}}', totalTransfers.toString());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{successfulTransfers}}', successfulTransfers.toString());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{successRate}}', successRate.toString());
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{formattedTotalUSD}}', formattedTotalUSD);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{formattedTotalNGN}}', formattedTotalNGN);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{exchangeRate}}', Number(exchangeRate).toFixed(2));
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{formattedDate}}', formattedDate);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{invoiceRows}}', invoiceRows);

        // Handle conditional content for errors
        if (errors.length > 0) {
            htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{#if hasErrors}}', '');
            htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{/if}}', '');
            htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{errorCount}}', errors.length.toString());
            htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{errorRows}}', errorRows);
        } else {
            // Remove error section if no errors
            const errorSectionRegex = /{{#if hasErrors}}.*?{{\/if}}/gs;
            htmlTemplate = htmlTemplate.replace(errorSectionRegex, '');
        }

        const textContent = `
            Bulk Payment Complete - Batch ID: ${batchId}
            
            Hello ${adminName},
            
            Your bulk payment transfer has been completed.
            
            Payment Summary:
            - Batch ID: ${batchId}
            ${paystackBatchId ? `- Paystack Batch ID: ${paystackBatchId}` : ''}
            - Total Transfers: ${totalTransfers}
            - Successful: ${successfulTransfers}/${totalTransfers} (${successRate}%)
            - Total Amount (USD): ${formattedTotalUSD}
            - Total Amount Sent (NGN): ${formattedTotalNGN}
            - Exchange Rate: ₦${Number(exchangeRate).toFixed(2)} per $1
            - Processed At: ${formattedDate}
            
            Successfully Processed (${successfulTransfers}):
            ${paidInvoices.map(inv => `- Invoice #${inv.invoiceNumber} → ${inv.recipient} (₦${Number(inv.ngnAmount).toFixed(2)})`).join('\n')}
            
            ${errors.length > 0 ? `
            Failed Transfers (${errors.length}):
            ${errors.map(err => `- Invoice #${err.invoiceNumber || err.invoiceId} → ${err.error}`).join('\n')}
            ` : ''}
            
            All recipients have been notified via email about their payments.
            Transfers will reflect in bank accounts within 1-2 business days.
            
            Contact payments@mydeeptech.ng for support.
            Reference: ${batchId}
            
            Best regards,
            MyDeepTech Payments Team
        `;

        return await this.sendMail({
            recipientEmail: adminEmail,
            recipientName: adminName,
            subject: `💰 Bulk Payment Complete - ${successfulTransfers}/${totalTransfers} Transfers (${formattedTotalNGN})`,
            message: textContent,
            htmlTemplate,
            senderEmail: 'payments@mydeeptech.ng',
            senderName: 'MyDeepTech Payments'
        });
    }

    /**
     * Send admin notification for individual transfer success
     */
    static async sendAdminTransferNotification(adminEmail, adminName, transferData) {
        console.log(`Sending admin transfer notification to ${adminEmail}`);
        
        const { 
            invoiceNumber, 
            projectName, 
            amountUSD, 
            amountNGN, 
            exchangeRate,
            paymentReference,
            paymentDate = new Date(),
            recipientName,
            recipientEmail,
            batchId
        } = transferData;
        
        const formattedAmountUSD = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amountUSD);
        
        const formattedAmountNGN = new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN'
        }).format(amountNGN);
        
        const formattedDate = new Date(paymentDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Use bulk payment summary template as base (can be customized later)
        let htmlTemplate = this.getMailTemplate('sendBulkPaymentSummary');
        
        // Replace template placeholders for admin notification
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{adminName}}', adminName);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{batchId}}', batchId || 'N/A');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{formattedTotalAmount}}', formattedAmountNGN);
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{successfulTransfers}}', '1');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{totalTransfers}}', '1');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{failedTransfers}}', '0');
        htmlTemplate = this.replaceTemplatePlaceholders(htmlTemplate, '{{transferList}}', 
            `<tr><td>${invoiceNumber}</td><td>${recipientName}</td><td>${formattedAmountUSD}</td><td>${formattedAmountNGN}</td><td>✅ Success</td></tr>`
        );

        const textContent = `
            Transfer Successfully Completed - Invoice #${invoiceNumber}
            
            Dear ${adminName},
            
            A Paystack transfer has been successfully completed:
            
            Transfer Details:
            - Invoice Number: #${invoiceNumber}
            - Project: ${projectName || 'N/A'}
            - Amount (USD): ${formattedAmountUSD}
            - Amount Sent (NGN): ${formattedAmountNGN}
            - Exchange Rate: ₦${Number(exchangeRate).toFixed(2)} per $1
            - Transfer Date: ${formattedDate}
            - Reference: ${paymentReference}
            - Batch ID: ${batchId || 'N/A'}
            
            Recipient Information:
            - Name: ${recipientName}
            - Email: ${recipientEmail}
            
            The recipient has been notified and payment should reflect in their account within 1-2 business days.
            Invoice status has been updated to PAID.
            
            View full transfer details in the admin dashboard.
            
            Best regards,
            MyDeepTech Payments System
        `;

        return await this.sendMail({
            recipientEmail: adminEmail,
            recipientName: adminName,
            subject: `💰 Transfer Completed - Invoice #${invoiceNumber} (${formattedAmountNGN})`,
            message: textContent,
            htmlTemplate,
            senderEmail: 'payments@mydeeptech.ng',
            senderName: 'MyDeepTech Payments'
        });
    }
}

module.exports = PaymentNotificationService;