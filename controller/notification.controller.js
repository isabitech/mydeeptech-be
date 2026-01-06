import notificationService from '../services/notification.service.js';
import { ResponseHandler, ValidationError } from '../utils/responseHandler.js';
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
    const userId = req.user?.userId || req.dtuser?.userId;
    const data = await notificationService.getUserNotifications(userId, req.query);
    ResponseHandler.success(res, data, 'Notifications retrieved successfully');
  }

  /**
   * Mark notification as read
   * PATCH /api/notifications/:notificationId/read
   */
  async markAsRead(req, res) {
    const userId = req.user?.userId || req.dtuser?.userId;
    const notification = await notificationService.markAsRead(req.params.notificationId, userId);
    ResponseHandler.success(res, notification, 'Notification marked as read');
  }

  /**
   * Mark all as read
   * PATCH /api/notifications/read-all
   */
  async markAllAsRead(req, res) {
    const userId = req.user?.userId || req.dtuser?.userId;
    await notificationService.markAllAsRead(userId);
    ResponseHandler.success(res, null, 'All notifications marked as read');
  }

  /**
   * Delete notification
   * DELETE /api/notifications/:notificationId
   */
  async deleteNotification(req, res) {
    const userId = req.user?.userId || req.dtuser?.userId;
    await notificationService.deleteNotification(req.params.notificationId, userId);
    ResponseHandler.success(res, null, 'Notification deleted successfully');
  }

  // ADMIN METHODS

  /**
   * Create a new notification for users (Admin)
   * POST /api/admin/notifications
   */
  async createAdminNotification(req, res) {
    const { error, value } = NotificationController.createNotificationSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);

    const { recipientId, recipientType, ...notificationData } = value;

    if (recipientType === 'all') {
      const dtusers = await DTUser.find({}, '_id');
      const recipients = dtusers.map(u => u._id);

      await Promise.all(recipients.slice(0, 100).map(userId =>
        notificationService.createNotification({
          userId,
          ...notificationData
        })
      ));

      ResponseHandler.success(res, { recipientCount: recipients.length }, 'Broadcast initiated successfully', 201);
    } else if (recipientId) {
      const notification = await notificationService.createNotification({
        userId: recipientId,
        ...notificationData
      });
      ResponseHandler.success(res, notification, 'Notification created successfully', 201);
    } else {
      throw new ValidationError('recipientId is required for single notification');
    }
  }

  /**
   * Get all notifications for admin dashboard
   * GET /api/admin/notifications
   */
  async getAdminNotifications(req, res) {
    const data = await notificationService.getAdminNotifications(req.query);
    ResponseHandler.success(res, data, 'Admin notifications retrieved successfully');
  }
}

export default new NotificationController();