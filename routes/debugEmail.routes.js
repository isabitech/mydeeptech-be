const express = require('express');
const router = express.Router();
// const { sendAdminReplyNotificationEmail } = require('../utils/supportEmailTemplates');
const mail = require('../services/mail-service/mail-service');
const { canSendDailyEmail, markDailyEmailSent, getDailyEmailStatus } = require('../utils/dailyEmailTracker');
const { authenticateAdmin } = require('../middleware/adminAuth');

/**
 * Debug endpoint to test email sending
 */
router.post('/test-admin-reply-email', authenticateAdmin, async (req, res) => {
  try {
    const { userEmail, ticketId, ticketNumber, adminName, message } = req.body;

    if (!userEmail || !ticketNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userEmail, ticketNumber, message'
      });
    }

    console.log(`🧪 DEBUG: Testing admin reply email to ${userEmail}`);

    // Mock ticket object for testing
    const mockTicket = {
      _id: ticketId || '507f1f77bcf86cd799439011',
      ticketNumber: ticketNumber,
      subject: 'Test Chat Support',
      userId: '507f1f77bcf86cd799439012'
    };

    // Mock admin reply
    const mockAdminReply = {
      senderName: adminName || 'Test Admin',
      message: message,
      timestamp: new Date()
    };

    console.log(`🧪 Mock ticket:`, mockTicket);
    console.log(`🧪 Mock admin reply:`, mockAdminReply);

    // Send test email
    const emailResult = await mail.sendAdminReplyNotificationEmail(
      userEmail,
      mockTicket,
      mockAdminReply
    );

    console.log(`🧪 Email result:`, emailResult);

    res.json({
      success: true,
      message: 'Test email sent successfully',
      emailResult: emailResult,
      testData: {
        userEmail,
        ticketNumber,
        adminName: adminName || 'Test Admin',
        message
      }
    });

  } catch (error) {
    console.error('🧪 ❌ Error in test email endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * Debug endpoint to check email status
 */
router.get('/email-status/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { emailType = 'admin_reply' } = req.query;

    console.log(`🧪 DEBUG: Checking email status for user ${userId}, type: ${emailType}`);

    const canSend = await canSendDailyEmail(userId, emailType);
    const status = await getDailyEmailStatus(userId, emailType);

    console.log(`🧪 Can send: ${canSend}`);
    console.log(`🧪 Status:`, status);

    res.json({
      success: true,
      userId,
      emailType,
      canSend,
      status
    });

  } catch (error) {
    console.error('🧪 ❌ Error checking email status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check email status',
      error: error.message
    });
  }
});

module.exports = router;