const envConfig = require('../config/envConfig');

/**
 * HVNC Email Service
 * Handles sending access codes, notifications, and other HVNC-related emails
 */

/**
 * Get email service based on configuration
 */
function getEmailService() {
  const provider = envConfig.email.defaultProvider || 'brevo';
  
  switch (provider.toLowerCase()) {
    case 'brevo':
      return require('./providers/brevo-email.service');
    case 'mailjet':
      return require('./providers/mailjet-email.service');
    case 'nodemailer':
      return require('./providers/nodemailer-email.service');
    default:
      console.warn(`Unknown email provider: ${provider}, falling back to nodemailer`);
      return require('./providers/nodemailer-email.service');
  }
}

/**
 * Send access code to user
 * @param {Object} user - User object
 * @param {Object} device - Device object
 * @param {string} accessCode - The access code
 * @param {Date} expiresAt - Expiration date/time
 */
async function sendAccessCode(user, device, accessCode, expiresAt) {
  const emailService = getEmailService();
  
  const templateData = {
    userName: user.full_name || user.email,
    userEmail: user.email,
    accessCode: accessCode,
    deviceName: device.pc_name,
    deviceId: device.device_id,
    expiresAt: expiresAt.toISOString(),
    expiresInMinutes: Math.round((expiresAt - new Date()) / (1000 * 60)),
    supportUrl: envConfig.FRONTEND_URL ? `${envConfig.FRONTEND_URL}/support` : '#',
    dashboardUrl: envConfig.FRONTEND_URL ? `${envConfig.FRONTEND_URL}/dashboard` : '#'
  };

  const emailOptions = {
    to: user.email,
    subject: `Your HVNC Access Code for ${device.pc_name}`,
    templateName: 'hvnc-access-code',
    templateData: templateData
  };

  return emailService.sendEmail(emailOptions);
}

/**
 * Send session started notification
 */
async function sendSessionStartedNotification(user, device, session) {
  const emailService = getEmailService();
  
  const templateData = {
    userName: user.full_name || user.email,
    deviceName: device.pc_name,
    sessionId: session.session_id,
    startedAt: session.started_at.toISOString(),
    ipAddress: session.ip_address
  };

  const emailOptions = {
    to: user.email,
    subject: `HVNC Session Started - ${device.pc_name}`,
    templateName: 'hvnc-session-started',
    templateData: templateData
  };

  return emailService.sendEmail(emailOptions);
}

/**
 * Send session ended notification
 */
async function sendSessionEndedNotification(user, device, session) {
  const emailService = getEmailService();
  
  const duration = session.duration_minutes || 0;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  
  const templateData = {
    userName: user.full_name || user.email,
    deviceName: device.pc_name,
    sessionId: session.session_id,
    startedAt: session.started_at.toISOString(),
    endedAt: session.ended_at.toISOString(),
    duration: `${hours}h ${minutes}m`,
    endReason: session.end_reason,
    commandsExecuted: session.commands_executed || 0
  };

  const emailOptions = {
    to: user.email,
    subject: `HVNC Session Ended - ${device.pc_name}`,
    templateName: 'hvnc-session-ended',
    templateData: templateData
  };

  return emailService.sendEmail(emailOptions);
}

/**
 * Send security alert
 */
async function sendSecurityAlert(user, device, alert) {
  const emailService = getEmailService();
  
  const templateData = {
    userName: user.full_name || user.email,
    alertType: alert.type,
    alertMessage: alert.message,
    deviceName: device?.pc_name || 'Unknown Device',
    timestamp: alert.timestamp || new Date().toISOString(),
    ipAddress: alert.ip_address,
    severity: alert.severity || 'medium'
  };

  const emailOptions = {
    to: user.email,
    subject: `🔐 HVNC Security Alert - ${alert.type}`,
    templateName: 'hvnc-security-alert',
    templateData: templateData
  };

  return emailService.sendEmail(emailOptions);
}

/**
 * Send shift reminder
 */
async function sendShiftReminder(user, device, shift, minutesUntilStart) {
  const emailService = getEmailService();
  
  const templateData = {
    userName: user.full_name || user.email,
    deviceName: device.pc_name,
    shiftStartTime: shift.start_time,
    shiftEndTime: shift.end_time,
    minutesUntilStart: minutesUntilStart,
    timezone: shift.timezone
  };

  const emailOptions = {
    to: user.email,
    subject: `Upcoming Shift Reminder - ${device.pc_name}`,
    templateName: 'hvnc-shift-reminder',
    templateData: templateData
  };

  return emailService.sendEmail(emailOptions);
}

/**
 * Send admin notification
 */
async function sendAdminNotification(adminEmails, notification) {
  const emailService = getEmailService();
  
  const templateData = {
    notificationType: notification.type,
    message: notification.message,
    details: notification.details,
    timestamp: notification.timestamp || new Date().toISOString(),
    severity: notification.severity || 'info',
    actionRequired: notification.actionRequired || false
  };

  const emailOptions = {
    to: adminEmails,
    subject: `HVNC Admin Alert - ${notification.type}`,
    templateName: 'hvnc-admin-notification',
    templateData: templateData
  };

  return emailService.sendEmail(emailOptions);
}

/**
 * Send bulk notification to multiple users
 */
async function sendBulkNotification(users, notification) {
  const emailService = getEmailService();
  const results = [];

  for (const user of users) {
    try {
      const templateData = {
        userName: user.full_name || user.email,
        ...notification.templateData
      };

      const emailOptions = {
        to: user.email,
        subject: notification.subject,
        templateName: notification.templateName,
        templateData: templateData
      };

      const result = await emailService.sendEmail(emailOptions);
      results.push({ user: user.email, status: 'sent', result });
    } catch (error) {
      console.error(`Failed to send email to ${user.email}:`, error);
      results.push({ user: user.email, status: 'failed', error: error.message });
    }
  }

  return results;
}

/**
 * Test email configuration
 */
async function testEmailConfig() {
  try {
    const emailService = getEmailService();
    
    const testEmail = {
      to: 'test@example.com',
      subject: 'HVNC Email Service Test',
      html: '<h1>Test Email</h1><p>If you receive this, the email service is working correctly.</p>',
      text: 'Test Email - If you receive this, the email service is working correctly.'
    };

    // Note: This won't actually send due to invalid email, but will test the service connection
    const result = await emailService.sendEmail(testEmail);
    return { success: true, service: emailService.name, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendAccessCode,
  sendSessionStartedNotification,
  sendSessionEndedNotification,
  sendSecurityAlert,
  sendShiftReminder,
  sendAdminNotification,
  sendBulkNotification,
  testEmailConfig
};