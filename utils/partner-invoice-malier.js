const { sendEmail } = require('./brevoSMTP');
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
            <body style="margin:0;padding:0;background-color:#000000;font-family:Arial,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" align="center"
            style="padding:40px 0;background:#000000;">
            <tr>
            <td align="center">

            <table width="600" cellpadding="0" cellspacing="0" align="center"
            style="background:#ffffff;padding:40px;border-radius:6px;text-align:center;margin:0 auto;">

            <tr>
            <td style="padding-bottom:30px;font-size:22px;font-weight:bold;color:#000000;text-align:center;">
            ${companyName}
            </td>
            </tr>

            <tr>
            <td style="font-size:18px;padding-bottom:20px;color:#000000;text-align:center;">
            <strong>Hi ${safeName},</strong>
            </td>
            </tr>

            <tr>
            <td style="font-size:14px;color:#555555;padding-bottom:25px;line-height:1.6;text-align:center;">
            This is a reminder that you have an outstanding invoice.
            </td>
            </tr>

            <tr>
            <td align="center" style="padding-top:20px;">
            <table width="100%" cellpadding="20" cellspacing="0" align="center"
            style="background:#FFD700;border-radius:6px;margin:0 auto;text-align:center;">
            <tr>
            <td style="color:#000000;font-size:16px;font-weight:bold;text-align:center;">
            Amount Due: $${safeAmount}<br>
            Due By: ${formattedDueDate}
            </td>
            </tr>
            </table>
            </td>
            </tr>

            <tr>
            <td style="padding-top:30px;border-top:1px solid #eeeeee;font-size:14px;text-align:center;">

            <table width="100%" cellpadding="10" cellspacing="0" align="center"
            style="border-collapse:collapse;margin:0 auto;text-align:center;background:#ffffff;">

            <tr style="border-bottom:1px solid #eeeeee;">
            <td style="color:#000000;font-weight:bold;text-align:center;">Description</td>
            <td style="color:#000000;font-weight:bold;text-align:center;">Amount</td>
            </tr>

            <tr>
            <td style="color:#555555;text-align:center;">${safeDescription}</td>
            <td style="color:#555555;text-align:center;">$${safeAmount}</td>
            </tr>

            <tr>
            <td style="padding-top:15px;color:#000000;font-weight:bold;text-align:center;">Total</td>
            <td style="padding-top:15px;color:#000000;font-weight:bold;text-align:center;">$${safeAmount}</td>
            </tr>

            </table>
            </td>
            </tr>

            <tr>
            <td style="padding-top:30px;font-size:14px;color:#555555;line-height:1.6;text-align:center;">
            If you have any questions, simply reply to this email.
            <br><br>
            Regards,<br>
            <span style="color:#000000;font-weight:bold;">${companyName} Team</span>
            </td>
            </tr>

            </table>

            </td>
            </tr>
            </table>
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