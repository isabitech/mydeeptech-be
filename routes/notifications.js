const express = require('express');
const { authenticateToken } = require('../middleware/auth.js');
const Notification = require('../models/notification.model');
const NotifyController = require('../controller/notify.controller.js');

const router = express.Router();

// User notification endpoints (placeholder for future implementation)

/**
 * Get notification summary
 * GET /api/notifications/summary
 */
router.get('/summary', authenticateToken, NotifyController.summary);

/**
 * Get user's notifications
 * GET /api/notifications
 */
router.get('/', authenticateToken, NotifyController.UserNotifications);

/**
 * Mark notification as read
 * PATCH /api/notifications/:notificationId/read
 */
router.patch('/:notificationId/read', authenticateToken, NotifyController.markAsRead);

/**
 * Mark all notifications as read
 * PATCH /api/notifications/read-all
 */
router.patch('/read-all', authenticateToken, NotifyController.markAllAsRead);

/**
 * Delete a notification
 * DELETE /api/notifications/:notificationId
 */
router.delete('/:notificationId', authenticateToken, NotifyController.deleteNotification);

/**
 * Get notification preferences
 * GET /api/notifications/preferences
 */
router.get('/preferences', authenticateToken, NotifyController.getNotificationPreferences);
// Return default preferences until user preference model is implemented
/**
 * Update notification preferences
 * PUT /api/notifications/preferences
 */
router.put('/preferences', authenticateToken, NotifyController.updateNotificationPreferences);

module.exports = router;