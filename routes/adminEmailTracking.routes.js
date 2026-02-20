const express = require('express');
const router = express.Router();
const { canSendDailyEmail, markDailyEmailSent, getDailyEmailStatus, resetDailyEmailLimit } = require('../utils/dailyEmailTracker');
const { authenticateAdmin } = require('../middleware/adminAuth');

/**
 * @swagger
 * /api/admin/email-tracking/status/{userId}:
 *   get:
 *     summary: Get daily email status for a user
 *     tags: [Admin - Email Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to check email status for
 *       - in: query
 *         name: emailType
 *         schema:
 *           type: string
 *           default: admin_reply
 *         description: Type of email to check (admin_reply, chat_notification, etc.)
 *     responses:
 *       200:
 *         description: Email status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     canSend:
 *                       type: boolean
 *                     lastSent:
 *                       type: string
 *                     expiresIn:
 *                       type: number
 *                     key:
 *                       type: string
 *                     today:
 *                       type: string
 */
router.get('/status/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { emailType = 'admin_reply' } = req.query;

    const status = await getDailyEmailStatus(userId, emailType);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('❌ Error getting email status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get email status',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/email-tracking/reset/{userId}:
 *   post:
 *     summary: Reset daily email limit for a user
 *     tags: [Admin - Email Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to reset email limit for
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailType:
 *                 type: string
 *                 default: admin_reply
 *                 description: Type of email to reset
 *     responses:
 *       200:
 *         description: Email limit reset successfully
 *       500:
 *         description: Server error
 */
router.post('/reset/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { emailType = 'admin_reply' } = req.body;

    const resetSuccess = await resetDailyEmailLimit(userId, emailType);

    if (resetSuccess) {
      res.json({
        success: true,
        message: `Daily email limit reset for user ${userId} (${emailType})`
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to reset daily email limit'
      });
    }
  } catch (error) {
    console.error('❌ Error resetting email limit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset email limit',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/email-tracking/check/{userId}:
 *   get:
 *     summary: Check if daily email can be sent to user
 *     tags: [Admin - Email Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to check
 *       - in: query
 *         name: emailType
 *         schema:
 *           type: string
 *           default: admin_reply
 *         description: Type of email to check
 *     responses:
 *       200:
 *         description: Check completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 canSend:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.get('/check/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { emailType = 'admin_reply' } = req.query;

    const canSend = await canSendDailyEmail(userId, emailType);
    const status = await getDailyEmailStatus(userId, emailType);

    res.json({
      success: true,
      canSend: canSend,
      message: canSend 
        ? 'Email can be sent to user today' 
        : `Daily email limit reached. Last sent: ${status.lastSent}`,
      details: status
    });
  } catch (error) {
    console.error('❌ Error checking email eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check email eligibility',
      error: error.message
    });
  }
});

module.exports = router;
