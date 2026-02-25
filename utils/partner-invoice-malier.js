const sendEmail = require('./brevoSMTP');
const AppError = require('./app-error');



const escapeHtml = (str = '') =>
    String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

class PartnerInvoiceMailer {
    static async sendInvoiceEmail(invoice) {
        const {
            email,
            name,
            amount,
            due_date,
            description,
            action_url,
            companyName = "MyDeepTech"
        } = invoice;

        if (!email) {
            throw new AppError({
                message: "Recipient email is required to send invoice",
                statusCode: 400
            });
        }

        if (!action_url) {
            throw new AppError({
                message: "Action URL is required for payment button",
                statusCode: 400
            });
        }

        const safeName = escapeHtml(name);
        const safeDescription = escapeHtml(description);
        const safeAmount = Number(amount).toFixed(2);

        const formattedDueDate = new Date(due_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background-color:#f2f4f6;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;background:#f2f4f6;">
        <tr><td align="center">

        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px;border-radius:6px;">
        <tr>
        <td align="center" style="padding-bottom:30px;font-size:18px;font-weight:bold;">
        ${companyName}
        </td>
        </tr>

        <tr>
        <td style="font-size:16px;padding-bottom:20px;">
        <strong>Hi ${safeName},</strong>
        </td>
        </tr>

        <tr>
        <td style="font-size:14px;color:#555;padding-bottom:25px;line-height:1.6;">
        This is a reminder that you have an outstanding invoice.
        </td>
        </tr>

        <tr>
        <td style="background:#f0f3f7;padding:20px;border-radius:4px;font-size:14px;">
        <strong>Amount Due:</strong> $${safeAmount}<br>
        <strong>Due By:</strong> ${formattedDueDate}
        </td>
        </tr>

        <tr>
        <td align="center" style="padding:30px 0;">
        <a href="${action_url}" 
        style="background:#1a73e8;color:#ffffff;padding:12px 25px;text-decoration:none;border-radius:4px;font-size:14px;display:inline-block;">
        Pay Invoice
        </a>
        </td>
        </tr>

        <tr>
        <td style="padding-top:20px;border-top:1px solid #eaeaea;font-size:14px;">
        <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr style="border-bottom:1px solid #eaeaea;">
        <td style="color:#777;">Description</td>
        <td align="right" style="color:#777;">Amount</td>
        </tr>
        <tr>
        <td>${safeDescription}</td>
        <td align="right">$${safeAmount}</td>
        </tr>
        <tr>
        <td style="padding-top:15px;"><strong>Total</strong></td>
        <td align="right" style="padding-top:15px;"><strong>$${safeAmount}</strong></td>
        </tr>
        </table>
        </td>
        </tr>

        <tr>
        <td style="padding-top:30px;font-size:14px;color:#555;line-height:1.6;">
        If you have any questions, simply reply to this email.
        <br><br>
        Regards,<br>
        ${companyName} Team
        </td>
        </tr>

        <tr>
        <td style="padding-top:30px;border-top:1px solid #eaeaea;font-size:12px;color:#888;">
        If the button above does not work, copy and paste this URL into your browser:<br><br>
        <a href="${action_url}" style="color:#1a73e8;text-decoration:none;">
        ${action_url}
        </a>
        </td>
        </tr>
        </table>

        </td></tr></table>
        </body>
        </html>
        `;

        const textContent = `
        Invoice Reminder

        Hi ${safeName},

        Amount Due: $${safeAmount}
        Due Date: ${formattedDueDate}
        Description: ${safeDescription}

        Please complete your payment before the due date.

        Payment Link:
        ${action_url}
        `;

        const response = await sendEmail({
            to: email,
            subject: `Invoice Reminder - $${safeAmount} Due ${formattedDueDate}`,
            html: htmlContent,
            text: textContent
        });

        if (!response || response.statusCode >= 400) {
            throw new AppError({
                message: "Failed to send invoice email",
                statusCode: 500
            });
        }

        return response;
    }
}

module.exports = PartnerInvoiceMailer;