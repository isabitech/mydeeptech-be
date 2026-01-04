import notificationService from '../services/notification.service.js';
import ResponseHandler from '../utils/responseHandler.js';
import Joi from 'joi';
import DTUser from '../models/dtUser.model.js';

class NotificationController {
  // SCHEMAS
  static createNotificationSchema = Joi.object({
    recipientId: Joi.string().optional(),
    recipientType: Joi.string().valid('single', 'all').default('single'),
    title: Joi.string().required().trim(),
    message: Joi.string().required().trim(),
    type: Joi.string().required().valid('application_status', 'assessment_completed', 'system_announcement', 'message', 'payment', 'other'),
    priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
    actionUrl: Joi.string().allow('').optional(),
    actionText: Joi.string().allow('').optional(),
    relatedData: Joi.object().optional()
  });

  /**
   * Get user notifications
   * GET /api/notifications
   */
  async getUserNotifications(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      const data = await notificationService.getUserNotifications(userId, req.query);
      return ResponseHandler.success(res, data, 'Notifications retrieved successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Mark notification as read
   * PATCH /api/notifications/:notificationId/read
   */
  async markAsRead(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      const notification = await notificationService.markAsRead(req.params.notificationId, userId);
      return ResponseHandler.success(res, notification, 'Notification marked as read');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Mark all as read
   * PATCH /api/notifications/read-all
   */
  async markAllAsRead(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      await notificationService.markAllAsRead(userId);
      return ResponseHandler.success(res, null, 'All notifications marked as read');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Delete notification
   * DELETE /api/notifications/:notificationId
   */
  async deleteNotification(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      await notificationService.deleteNotification(req.params.notificationId, userId);
      return ResponseHandler.success(res, null, 'Notification deleted successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  // ADMIN METHODS

  /**
   * Create a new notification for users (Admin)
   * POST /api/admin/notifications
   */
  async createAdminNotification(req, res) {
    try {
      const { error, value } = NotificationController.createNotificationSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, error.details[0].message, 400);

      const { recipientId, recipientType, ...notificationData } = value;

      if (recipientType === 'all') {
        // Broadcast logic
        // This is a placeholder for a more complex background job
        const dtusers = await DTUser.find({}, '_id');
        const recipients = dtusers.map(u => u._id);

        // Demo: only first 100
        await Promise.all(recipients.slice(0, 100).map(userId =>
          notificationService.createNotification({
            userId,
            ...notificationData
          })
        ));

        return ResponseHandler.success(res, { recipientCount: recipients.length }, 'Broadcast initiated successfully', 201);
      } else if (recipientId) {
        const notification = await notificationService.createNotification({
          userId: recipientId,
          ...notificationData
        });
        return ResponseHandler.success(res, notification, 'Notification created successfully', 201);
      } else {
        return ResponseHandler.error(res, 'recipientId is required for single notification', 400);
      }
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Get all notifications for admin dashboard
   * GET /api/admin/notifications
   */
  async getAdminNotifications(req, res) {
    try {
      const data = await notificationService.getAdminNotifications(req.query);
      return ResponseHandler.success(res, data, 'Admin notifications retrieved successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }
}

export default new NotificationController();