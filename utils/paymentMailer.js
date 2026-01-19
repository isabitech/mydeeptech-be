import brevo from '@getbrevo/brevo';

// Initialize Brevo API client
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

/**
 * Send new invoice notification to DTUser
 */
export const sendInvoiceNotification = async (dtUserEmail, dtUserName, invoiceData) => {
  const { invoiceNumber, projectName, amount, currency, dueDate, description } = invoiceData;

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD'
  }).format(amount);

  const formattedDueDate = new Date(dueDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #ddd; }
            .invoice-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .invoice-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .invoice-item:last-child { border-bottom: none; font-weight: bold; font-size: 1.1em; }
            .amount { color: #28a745; font-weight: bold; font-size: 1.2em; }
            .due-date { color: #dc3545; font-weight: bold; }
            .button { display: inline-block; background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; color: #666; font-size: 14px; }
            .important { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>💰 New Invoice from MyDeepTech</h1>
            <p>Invoice #${invoiceNumber}</p>
        </div>
        
        <div class="content">
            <h2>Hello ${dtUserName},</h2>
            
            <p>We've generated a new invoice for your completed work. Thank you for your excellent contribution to our annotation projects!</p>
            
            <div class="invoice-details">
                <h3>📋 Invoice Details</h3>
                <div class="invoice-item">
                    <span>Invoice Number:</span>
                    <span><strong>INV-${invoiceNumber}</strong></span>
                </div>
                <div class="invoice-item">
                    <span>Project:</span>
                    <span>${projectName}</span>
                </div>
                <div class="invoice-item">
                    <span>Description:</span>
                    <span>${description || 'Project completion payment'}</span>
                </div>
                <div class="invoice-item">
                    <span>Due Date:</span>
                    <span class="due-date">${formattedDueDate}</span>
                </div>
                <div class="invoice-item">
                    <span>Amount Due:</span>
                    <span class="amount">${formattedAmount}</span>
                </div>
            </div>
            
            <div class="important">
                <h4>⚠️ Important Payment Information</h4>
                <p>Please log in to your MyDeepTech account to view the complete invoice details and payment instructions.</p>
            </div>
            
            <div style="text-align: center;">
                <a href="https://mydeeptech.ng/dashboard/invoices" class="button">View Invoice Details</a>
            </div>
            
            <h4>💳 Payment Instructions</h4>
            <ol>
                <li>Log in to your MyDeepTech account</li>
                <li>Navigate to the Invoices section</li>
                <li>View your unpaid invoices</li>
                <li>Follow the payment instructions provided</li>
                <li>Payment confirmation will be sent automatically</li>
            </ol>
            
            <p><strong>Questions about this invoice?</strong><br>
            Contact our payments team at <a href="mailto:payments@mydeeptech.ng">payments@mydeeptech.ng</a></p>
        </div>
        
        <div class="footer">
            <p><strong>MyDeepTech Payments</strong></p>
            <p>This is an automated message from our payment system.</p>
            <p>© 2025 MyDeepTech. All rights reserved.</p>
        </div>
    </body>
    </html>
  `;

  const textContent = `
    New Invoice from MyDeepTech
    
    Hello ${dtUserName},
    
    We've generated a new invoice for your completed work.
    
    Invoice Details:
    - Invoice Number: INV-${invoiceNumber}
    - Project: ${projectName}
    - Description: ${description || 'Project completion payment'}
    - Amount Due: ${formattedAmount}
    - Due Date: ${formattedDueDate}
    
    Please log in to your MyDeepTech account to view complete invoice details and payment instructions.
    
    Visit: https://mydeeptech.ng/dashboard/invoices
    
    Questions? Contact: payments@mydeeptech.ng
    
    Best regards,
    MyDeepTech Payments Team
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `New Invoice #${invoiceNumber} - ${formattedAmount} Due`;
  sendSmtpEmail.htmlContent = htmlContent;
  sendSmtpEmail.textContent = textContent;
  sendSmtpEmail.sender = {
    name: process.env.BREVO_PAYMENTS_SENDER_NAME || 'MyDeepTech Payments',
    email: 'payments@mydeeptech.ng'
  };
  sendSmtpEmail.to = [{ email: dtUserEmail, name: dtUserName }];

  // Add reply-to for payments team
  sendSmtpEmail.replyTo = {
    email: 'payments@mydeeptech.ng',
    name: 'MyDeepTech Payments'
  };

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Invoice notification email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Error sending invoice notification email:', error);
    throw error;
  }
};

/**
 * Send payment confirmation to DTUser
 */
export const sendPaymentConfirmation = async (dtUserEmail, dtUserName, invoiceData, paymentDetails) => {
  const { invoiceNumber, projectName, amount, currency, paidAt } = invoiceData;
  const { paymentMethod, paymentReference } = paymentDetails;

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD'
  }).format(amount);

  const formattedPaidDate = new Date(paidAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #ddd; }
            .payment-details { background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #c3e6cb; }
            .payment-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #c3e6cb; }
            .payment-item:last-child { border-bottom: none; font-weight: bold; font-size: 1.1em; }
            .amount { color: #28a745; font-weight: bold; font-size: 1.2em; }
            .checkmark { color: #28a745; font-size: 3em; text-align: center; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>✅ Payment Sent!</h1>
            <p>Invoice #${invoiceNumber} has been paid</p>
        </div>
        
        <div class="content">
            <div class="checkmark">✅</div>
            
            <h2>Hello ${dtUserName},</h2>
            
            <p>Great news! We've sent your payment for invoice #${invoiceNumber}. Thank you for your prompt payment.</p>
            
            <div class="payment-details">
                <h3>💳 Payment Confirmation</h3>
                <div class="payment-item">
                    <span>Invoice Number:</span>
                    <span><strong>INV-${invoiceNumber}</strong></span>
                </div>
                <div class="payment-item">
                    <span>Project:</span>
                    <span>${projectName}</span>
                </div>
                <div class="payment-item">
                    <span>Amount Paid:</span>
                    <span class="amount">${formattedAmount}</span>
                </div>
                <div class="payment-item">
                    <span>Payment Date:</span>
                    <span>${formattedPaidDate}</span>
                </div>
                ${paymentMethod ? `
                <div class="payment-item">
                    <span>Payment Method:</span>
                    <span>${paymentMethod.replace('_', ' ').toUpperCase()}</span>
                </div>
                ` : ''}
                ${paymentReference ? `
                <div class="payment-item">
                    <span>Reference:</span>
                    <span>${paymentReference}</span>
                </div>
                ` : ''}
            </div>
            
            <p><strong>What happens next?</strong></p>
            <ul>
                <li>This invoice is now marked as <strong>PAID</strong> in our system</li>
                <li>You can view your payment history in your dashboard</li>
                <li>A payment receipt has been generated for your records</li>
            </ul>
            
            <p>Thank you for your excellent work on our annotation projects. We look forward to continuing our collaboration!</p>
            
            <p><strong>Need a copy of your receipt?</strong><br>
            Log in to your dashboard or contact <a href="mailto:payments@mydeeptech.ng">payments@mydeeptech.ng</a></p>
        </div>
        
        <div class="footer">
            <p><strong>MyDeepTech Payments</strong></p>
            <p>This is an automated payment confirmation.</p>
            <p>© 2025 MyDeepTech. All rights reserved.</p>
        </div>
    </body>
    </html>
  `;

  const textContent = `
    Payment Sent - Invoice #${invoiceNumber}
    
    Hello ${dtUserName},
    
    Great news! We've sent your payment.
    
    Payment Details:
    - Invoice Number: INV-${invoiceNumber}
    - Project: ${projectName}
    - Amount Paid: ${formattedAmount}
    - Payment Date: ${formattedPaidDate}
    ${paymentMethod ? `- Payment Method: ${paymentMethod.replace('_', ' ').toUpperCase()}` : ''}
    ${paymentReference ? `- Reference: ${paymentReference}` : ''}
    
    This invoice is now marked as PAID in our system.
    
    Thank you for your excellent work!
    
    Best regards,
    MyDeepTech Payments Team
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Payment Sent - Invoice #${invoiceNumber} (${formattedAmount})`;
  sendSmtpEmail.htmlContent = htmlContent;
  sendSmtpEmail.textContent = textContent;
  sendSmtpEmail.sender = {
    name: process.env.BREVO_PAYMENTS_SENDER_NAME || 'MyDeepTech Payments',
    email: 'payments@mydeeptech.ng'
  };
  sendSmtpEmail.to = [{ email: dtUserEmail, name: dtUserName }];
  sendSmtpEmail.replyTo = {
    email: 'payments@mydeeptech.ng',
    name: 'MyDeepTech Payments'
  };

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Payment confirmation email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Error sending payment confirmation email:', error);
    throw error;
  }
};

/**
 * Send payment reminder to DTUser for overdue invoices
 */
export const sendPaymentReminder = async (dtUserEmail, dtUserName, invoiceData) => {
  const { invoiceNumber, projectName, amount, currency, dueDate, daysOverdue } = invoiceData;

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD'
  }).format(amount);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #ddd; }
            .overdue-alert { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0; color: #721c24; }
            .amount { color: #dc3545; font-weight: bold; font-size: 1.2em; }
            .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>⚠️ Payment Reminder</h1>
            <p>Invoice #${invoiceNumber} is ${daysOverdue} days overdue</p>
        </div>
        
        <div class="content">
            <h2>Hello ${dtUserName},</h2>
            
            <div class="overdue-alert">
                <h4>⚠️ Overdue Payment Notice</h4>
                <p>This invoice was due on ${new Date(dueDate).toLocaleDateString()} and is now <strong>${daysOverdue} days overdue</strong>.</p>
            </div>
            
            <p>We hope this email finds you well. We wanted to remind you about an outstanding invoice that requires your attention.</p>
            
            <p><strong>Invoice Details:</strong><br>
            Invoice #${invoiceNumber}<br>
            Project: ${projectName}<br>
            Amount Due: <span class="amount">${formattedAmount}</span></p>
            
            <div style="text-align: center;">
                <a href="https://mydeeptech.ng/dashboard/invoices" class="button">Pay Now</a>
            </div>
            
            <p>Please process this payment at your earliest convenience to keep your account in good standing.</p>
            
            <p><strong>Having trouble making payment?</strong><br>
            Please contact our payments team immediately at <a href="mailto:payments@mydeeptech.ng">payments@mydeeptech.ng</a></p>
        </div>
        
        <div class="footer">
            <p><strong>MyDeepTech Payments</strong></p>
            <p>This is an automated payment reminder.</p>
        </div>
    </body>
    </html>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `⚠️ Payment Reminder - Invoice #${invoiceNumber} (${daysOverdue} days overdue)`;
  sendSmtpEmail.htmlContent = htmlContent;
  sendSmtpEmail.sender = {
    name: process.env.BREVO_PAYMENTS_SENDER_NAME || 'MyDeepTech Payments',
    email: 'payments@mydeeptech.ng'
  };
  sendSmtpEmail.to = [{ email: dtUserEmail, name: dtUserName }];
  sendSmtpEmail.replyTo = {
    email: 'payments@mydeeptech.ng',
    name: 'MyDeepTech Payments'
  };

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Payment reminder email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Error sending payment reminder email:', error);
    throw error;
  }
};

export default {
  sendInvoiceNotification,
  sendPaymentConfirmation,
  sendPaymentReminder
};