import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import notificationController from '../controller/notification.controller.js';
import tryCatch from '../utils/tryCatch.js';

const router = express.Router();

// User notification endpoints

router.get('/summary', authenticateToken, tryCatch(notificationController.getNotificationSummary));

router.get('/', authenticateToken, tryCatch(notificationController.getUserNotifications));

router.patch('/:notificationId/read', authenticateToken, tryCatch(notificationController.markNotificationRead));
router.patch('/read-all', authenticateToken, tryCatch(notificationController.markAllNotificationsRead));

router.delete('/:notificationId', authenticateToken, tryCatch(notificationController.deleteNotification));

router.get('/preferences', authenticateToken, tryCatch(notificationController.getNotificationPreferences));

router.put('/preferences', authenticateToken, tryCatch(notificationController.updateNotificationPreferences));

export default router;
