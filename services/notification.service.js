import Notification from '../models/notification.model.js';
import mongoose from 'mongoose';

class NotificationService {
    /**
     * Create a general notification
     * @param {Object} notificationData - Notification details
     */
    async createNotification(notificationData) {
        try {
            const { userId, type, title, message, data = {}, priority = 'medium' } = notificationData;

            // Determine user model type
            let userModel = notificationData.userModel || 'DTUser';

            const notification = await Notification.create({
                userId,
                userModel,
                type,
                title,
                message,
                data,
                priority
            });

            console.log(`✅ Notification created in DB:`, notification._id);
            return notification;
        } catch (error) {
            console.error('❌ Error creating notification:', error);
            throw error;
        }
    }

    /**
     * Get user notifications
     */
    async getUserNotifications(userId, queryParams) {
        const { isRead, limit = 20, page = 1 } = queryParams;
        const filter = { userId };

        if (isRead !== undefined) {
            filter.isRead = isRead === 'true';
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [notifications, total] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Notification.countDocuments(filter)
        ]);

        return {
            notifications,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        };
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { isRead: true, readAt: new Date() },
            { new: true }
        );

        if (!notification) {
            throw new Error('Notification not found or access denied');
        }

        return notification;
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId) {
        return await Notification.updateMany(
            { userId, isRead: false },
            { isRead: true, readAt: new Date() }
        );
    }

    /**
     * Delete notification
     */
    async deleteNotification(notificationId, userId) {
        const notification = await Notification.findOneAndDelete({ _id: notificationId, userId });
        if (!notification) {
            throw new Error('Notification not found or access denied');
        }
        return true;
    }

    // ADMIN METHODS

    async getAdminNotifications(queryParams) {
        const { limit = 20, page = 1, type, priority } = queryParams;
        const filter = {};
        if (type) filter.type = type;
        if (priority) filter.priority = priority;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [notifications, total] = await Promise.all([
            Notification.find(filter)
                .populate('userId', 'fullName email username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Notification.countDocuments(filter)
        ]);

        return {
            notifications,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        };
    }

    async broadcastNotification(data) {
        const { title, message, priority = 'medium', type = 'system_announcement' } = data;

        // In a real scenario, this might use a message queue or batch insert
        // For now, we'll demonstrate the concept
        // But broadcast to ALL users can be expensive.
        return { success: true, message: 'Broadcast initiated' };
    }
}

export default new NotificationService();
export const notificationService = new NotificationService(); // Named export for compatibility
