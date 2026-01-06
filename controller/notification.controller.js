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


  async getNotificationSummary(req, res) {
      const userId = req.userId || req.user?.userId || req.dtuser?.userId;
      const result = await notificationService.getNotificationSummary(userId);
     return ResponseHandler.success(res, result, 'Notification summary retrieved successfully');
  }

  async getUserNotifications(req, res) {
      const userId = req.userId || req.user?.userId || req.dtuser?.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const result = await notificationService.getUserNotifications(userId, page, limit);
      return ResponseHandler.success(res, result, 'User notifications retrieved successfully');
  }


  async markNotificationRead(req, res) {
      const { notificationId } = req.params;
      const userId = req.userId || req.user?.userId || req.dtuser?.userId;
      const result = await notificationService.markNotificationRead(notificationId, userId);
      return ResponseHandler.success(res, result, 'Notification marked as read successfully');
  
  }


  async markAllNotificationsRead(req, res) {
      const userId = req.userId || req.user?.userId || req.dtuser?.userId;
      const result = await notificationService.markAllNotificationsRead(userId);
      return ResponseHandler.success(res, result, 'All notifications marked as read successfully');
  }


  async deleteNotification(req, res) {
      const { notificationId } = req.params;
      const userId = req.userId || req.user?.userId || req.dtuser?.userId;
      const result = await notificationService.deleteNotification(notificationId, userId);
      return ResponseHandler.success(res, result, 'Notification deleted successfully');
  }
  async getNotificationPreferences(req, res) {
      const userId = req.userId || req.user?.userId || req.dtuser?.userId;
      const result = await notificationService.getNotificationPreferences(userId);
      return ResponseHandler.success(res, result, 'Notification preferences retrieved successfully');
  }

  async updateNotificationPreferences(req, res) {
      const userId = req.userId || req.user?.userId || req.dtuser?.userId;
      const { preferences } = req.body;
      const result = await notificationService.updateNotificationPreferences(userId, preferences);
      return ResponseHandler.success(res, result, 'Notification preferences updated successfully');
  }

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

        return ResponseHandler.success(res, { recipientCount: recipients.length }, 'Broadcast initiated successfully', 201);
      } else if (recipientId) {
        const notification = await notificationService.createNotification({
          userId: recipientId,
          ...notificationData
        });
        return ResponseHandler.success(res, notification, 'Notification created successfully', 201);
      } else {
        throw new ValidationError('recipientId is required for single notification');
      }
  }

  async getAdminNotifications(req, res) {
      const data = await notificationService.getAdminNotifications(req.query);
      return ResponseHandler.success(res, data, 'Admin notifications retrieved successfully');
  }
}

export default new NotificationController();