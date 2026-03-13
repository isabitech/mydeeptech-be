const { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } = require('@getbrevo/brevo');
const envConfig = require('../../config/envConfig');

class BrevoEmailService {
  constructor() {
    this.name = 'Brevo';
    this.client = new TransactionalEmailsApi();
    this.client.setApiKey(TransactionalEmailsApiApiKeys.apiKey, envConfig.email.brevo.BREVO_API_KEY);
  }

  /**
   * Send email using Brevo
   */
  async sendEmail(options) {
    try {
      const { to, subject, templateName, templateData, html, text } = options;
      
      console.log('🔷 Brevo Email Service - Sending email:');
      console.log('   To:', to);
      console.log('   Subject:', subject);
      console.log('   Template:', templateName);
      console.log('   API Key configured:', !!envConfig.email.brevo.BREVO_API_KEY);

      // Convert single email to array
      const recipients = Array.isArray(to) ? to : [to];
      
      const emailData = {
        sender: {
          email: envConfig.email.brevo.BREVO_SENDER_EMAIL || 'noreply@hvnc.com',
          name: envConfig.email.brevo.BREVO_SENDER_NAME || 'HVNC System'
        },
        to: recipients.map(email => ({ email })),
        subject: subject
      };

      // Use template if provided, otherwise use HTML/text content
      if (templateName && templateData) {
        // For template-based emails, we'll use HTML content for now
        // In a production setup, you'd configure templates in Brevo dashboard
        emailData.htmlContent = this.generateTemplateContent(templateName, templateData);
        emailData.textContent = this.generateTextContent(templateName, templateData);
      } else {
        emailData.htmlContent = html || this.generateDefaultHtml(subject, text);
        emailData.textContent = text || subject;
      }

      console.log('🔷 Brevo Email Data:', {
        sender: emailData.sender,
        to: emailData.to,
        subject: emailData.subject,
        hasHtmlContent: !!emailData.htmlContent,
        hasTextContent: !!emailData.textContent
      });

      const result = await this.client.sendTransacEmail(emailData);
      
      console.log('✅ Brevo Email sent successfully');
      console.log('   Response:', JSON.stringify(result, null, 2));
      
      return {
        success: true,
        messageId: result.messageId,
        provider: 'brevo',
        response: result
      };

    } catch (error) {
      console.error('❌ Brevo email error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        body: error.body
      });
      throw new Error(`Failed to send email via Brevo: ${error.message}`);
    }
  }

  /**
   * Generate HTML content from template
   */
  generateTemplateContent(templateName, data) {
    switch (templateName) {
      case 'hvnc-access-code':
        return this.generateAccessCodeTemplate(data);
      case 'hvnc-session-started':
        return this.generateSessionStartedTemplate(data);
      case 'hvnc-session-ended':
        return this.generateSessionEndedTemplate(data);
      case 'hvnc-security-alert':
        return this.generateSecurityAlertTemplate(data);
      case 'hvnc-shift-reminder':
        return this.generateShiftReminderTemplate(data);
      case 'hvnc-admin-notification':
        return this.generateAdminNotificationTemplate(data);
      default:
        return this.generateDefaultTemplate(data);
    }
  }

  /**
   * Generate text content from template
   */
  generateTextContent(templateName, data) {
    switch (templateName) {
      case 'hvnc-access-code':
        return `Hello ${data.userName},

Your HVNC access code for ${data.deviceName} is: ${data.accessCode}

This code will expire in ${data.expiresInMinutes} minutes.

Device: ${data.deviceName} (${data.deviceId})
Valid until: ${new Date(data.expiresAt).toLocaleString()}

Please keep this code secure and do not share it with anyone.

Best regards,
HVNC System`;

      case 'hvnc-session-started':
        return `Hello ${data.userName},

Your HVNC session on ${data.deviceName} has started.

Session ID: ${data.sessionId}
Started at: ${new Date(data.startedAt).toLocaleString()}
IP Address: ${data.ipAddress}

Best regards,
HVNC System`;

      case 'hvnc-security-alert':
        return `Security Alert: ${data.alertType}

${data.alertMessage}

Device: ${data.deviceName}
Time: ${new Date(data.timestamp).toLocaleString()}
IP Address: ${data.ipAddress}
Severity: ${data.severity.toUpperCase()}

Please review this alert and take appropriate action if necessary.`;

      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Access code email template
   */
  generateAccessCodeTemplate(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Your HVNC Access Code</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c5aa0; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .code-box { background: #fff; border: 2px dashed #007bff; padding: 20px; margin: 20px 0; text-align: center; border-radius: 5px; }
        .code { font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 4px; font-family: 'Courier New', monospace; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔐 Your HVNC Access Code</h1>
    </div>
    
    <div class="content">
        <h2>Hello ${data.userName},</h2>
        
        <p>Your access code for the HVNC device <strong>${data.deviceName}</strong> has been generated.</p>
        
        <div class="code-box">
            <div class="code">${data.accessCode}</div>
            <p><small>Enter this code to access your device</small></p>
        </div>
        
        <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>📋 Session Details</h3>
            <p><strong>Device:</strong> ${data.deviceName} (${data.deviceId})</p>
            <p><strong>Valid Until:</strong> ${new Date(data.expiresAt).toLocaleString()}</p>
            <p><strong>Expires In:</strong> ${data.expiresInMinutes} minutes</p>
        </div>
        
        <div class="warning">
            <strong>⚠️ Security Notice:</strong>
            <ul>
                <li>Keep this code secure and do not share it with anyone</li>
                <li>The code will expire automatically after the specified time</li>
                <li>Only use this code from authorized locations</li>
                <li>Contact support if you didn't request this code</li>
            </ul>
        </div>
        
        ${data.dashboardUrl !== '#' ? `<p style="text-align: center;"><a href="${data.dashboardUrl}" class="button">Go to Dashboard</a></p>` : ''}
    </div>
    
    <div class="footer">
        <p>This is an automated email from the HVNC system.</p>
        ${data.supportUrl !== '#' ? `<p><a href="${data.supportUrl}">Need help?</a></p>` : ''}
    </div>
</body>
</html>`;
  }

  /**
   * Session started email template
   */
  generateSessionStartedTemplate(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>HVNC Session Started</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .info-box { background: #e8f5e8; border: 1px solid #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>✅ Session Started</h1>
    </div>
    
    <div class="content">
        <h2>Hello ${data.userName},</h2>
        
        <p>Your HVNC session on <strong>${data.deviceName}</strong> has been started successfully.</p>
        
        <div class="info-box">
            <h3>📊 Session Information</h3>
            <p><strong>Session ID:</strong> ${data.sessionId}</p>
            <p><strong>Device:</strong> ${data.deviceName}</p>
            <p><strong>Started:</strong> ${new Date(data.startedAt).toLocaleString()}</p>
            <p><strong>IP Address:</strong> ${data.ipAddress}</p>
        </div>
        
        <p>You can now use the device remotely. The session will remain active as long as you're within your scheduled shift hours.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Session ended email template
   */
  generateSessionEndedTemplate(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>HVNC Session Ended</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .stats-box { background: #fff; border: 1px solid #dee2e6; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚪 Session Ended</h1>
    </div>
    
    <div class="content">
        <h2>Hello ${data.userName},</h2>
        
        <p>Your HVNC session on <strong>${data.deviceName}</strong> has ended.</p>
        
        <div class="stats-box">
            <h3>📈 Session Summary</h3>
            <p><strong>Session ID:</strong> ${data.sessionId}</p>
            <p><strong>Device:</strong> ${data.deviceName}</p>
            <p><strong>Duration:</strong> ${data.duration}</p>
            <p><strong>Started:</strong> ${new Date(data.startedAt).toLocaleString()}</p>
            <p><strong>Ended:</strong> ${new Date(data.endedAt).toLocaleString()}</p>
            <p><strong>End Reason:</strong> ${data.endReason.replace(/_/g, ' ').toUpperCase()}</p>
            <p><strong>Commands Executed:</strong> ${data.commandsExecuted}</p>
        </div>
        
        <p>Thank you for using the HVNC system. Your session data has been logged for security and tracking purposes.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Security alert email template
   */
  generateSecurityAlertTemplate(data) {
    const severityColors = {
      low: '#17a2b8',
      medium: '#ffc107',
      high: '#fd7e14',
      critical: '#dc3545'
    };

    const severityColor = severityColors[data.severity] || '#6c757d';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>HVNC Security Alert</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${severityColor}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .alert-box { background: #fff; border-left: 4px solid ${severityColor}; padding: 15px; margin: 20px 0; }
        .severity { display: inline-block; background: ${severityColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔐 Security Alert</h1>
    </div>
    
    <div class="content">
        <h2>Hello ${data.userName},</h2>
        
        <p>A security event has been detected related to your HVNC access.</p>
        
        <div class="alert-box">
            <h3>${data.alertType} <span class="severity">${data.severity.toUpperCase()}</span></h3>
            <p><strong>Message:</strong> ${data.alertMessage}</p>
            <p><strong>Device:</strong> ${data.deviceName}</p>
            <p><strong>Time:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
            <p><strong>IP Address:</strong> ${data.ipAddress || 'Unknown'}</p>
        </div>
        
        <p><strong>What should you do?</strong></p>
        <ul>
            <li>Review your recent activity and ensure all access was authorized</li>
            <li>Check if you recognize the IP address and location</li>
            <li>Contact support if you didn't perform this action</li>
            <li>Consider changing your access credentials if unauthorized access is suspected</li>
        </ul>
        
        <p style="color: #dc3545;"><strong>If you didn't cause this alert, please contact support immediately.</strong></p>
    </div>
</body>
</html>`;
  }

  /**
   * Shift reminder email template
   */
  generateShiftReminderTemplate(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Upcoming Shift Reminder</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #17a2b8; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .reminder-box { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>⏰ Shift Reminder</h1>
    </div>
    
    <div class="content">
        <h2>Hello ${data.userName},</h2>
        
        <p>This is a reminder that your shift on <strong>${data.deviceName}</strong> is starting soon.</p>
        
        <div class="reminder-box">
            <h3>📅 Shift Details</h3>
            <p><strong>Device:</strong> ${data.deviceName}</p>
            <p><strong>Start Time:</strong> ${data.shiftStartTime} ${data.timezone}</p>
            <p><strong>End Time:</strong> ${data.shiftEndTime} ${data.timezone}</p>
            <p><strong>Starts in:</strong> ${data.minutesUntilStart} minutes</p>
        </div>
        
        <p>Please ensure you're ready to begin your shift on time. You'll need to request an access code to start your session.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Admin notification template
   */
  generateAdminNotificationTemplate(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>HVNC Admin Notification</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6f42c1; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .notification-box { background: #fff; border: 1px solid #dee2e6; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .severity { display: inline-block; background: #6c757d; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>👨‍💼 Admin Notification</h1>
    </div>
    
    <div class="content">
        <h2>HVNC System Alert</h2>
        
        <div class="notification-box">
            <h3>${data.notificationType} <span class="severity">${data.severity.toUpperCase()}</span></h3>
            <p><strong>Message:</strong> ${data.message}</p>
            <p><strong>Time:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
            
            ${data.details ? `
            <h4>Details:</h4>
            <pre style="background: #f8f9fa; padding: 10px; border-radius: 3px; white-space: pre-wrap;">${JSON.stringify(data.details, null, 2)}</pre>
            ` : ''}
            
            ${data.actionRequired ? '<p style="color: #dc3545;"><strong>⚠️ Action Required</strong></p>' : ''}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Default template for unknown template names
   */
  generateDefaultTemplate(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>HVNC Notification</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    </style>
</head>
<body>
    <h2>HVNC System Notification</h2>
    <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; white-space: pre-wrap;">${JSON.stringify(data, null, 2)}</pre>
</body>
</html>`;
  }

  /**
   * Generate default HTML for plain text emails
   */
  generateDefaultHtml(subject, text) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${subject}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    </style>
</head>
<body>
    <h2>${subject}</h2>
    <div style="white-space: pre-wrap;">${text}</div>
</body>
</html>`;
  }
}

module.exports = new BrevoEmailService();