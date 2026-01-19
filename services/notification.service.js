import Notification from '../models/notification.model.js'
/**
 * Service for managing user and system notifications.
 * Handles in-app notification storage, summaries, and user preference tracking.
 */
class NotificationService {
    /**
     * Create a general notification
     * @param {Object} notificationData - Notification details
     */
    /**
     * Creates a new notification record in the database.
     * Supports targeting different user models (DTUser by default).
     */
    async createNotification(notificationData) {
        const { userId, type, title, message, data = {}, priority = 'medium' } = notificationData;

        // Default to targeting the DTUser model unless explicitly specified
        let userModel = notificationData.userModel || 'DTUser';

        // Persist the notification record for the target user
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
    }

    /**
     * Get user notifications
     */
    async getUserNotifications(userId, queryParams) {
        const { isRead, limit = 20, page = 1 } = queryParams;
        const filter = { userId };

        // Apply read/unread status filtering if requested
        if (isRead !== undefined) {
            filter.isRead = isRead === 'true';
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Fetch paginated notifications and total count in parallel
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
        // Find and update the notification uniquely identifier by both ID and owner
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
        // Execute a bulk update for all currently unread notifications belonging to the user
        return await Notification.updateMany(
            { userId, isRead: false },
            { isRead: true, readAt: new Date() }
        );
    }

    /**
     * Delete notification
     */
    async deleteNotification(notificationId, userId) {
        // Permanently remove the notification, enforcing ownership check
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

        // Fetch system-wide notifications with sender profile information populated
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

    // async broadcastNotification(data) {
    //     const { title, message, priority = 'medium', type = 'system_announcement' } = data;

    //     // In a real scenario, this might use a message queue or batch insert
    //     // For now, we'll demonstrate the concept
    //     // But broadcast to ALL users can be expensive.
    //     return { success: true, message: 'Broadcast initiated' };
    // }

    // --- Additional Methods ---

    async getNotificationSummary(userId) {
        // Aggregate various notification counts to provide a high-level user overview
        const [totalNotifications, unreadCount, readCount, highPriorityCount, mediumPriorityCount, lowPriorityCount, recentCount] = await Promise.all([
            Notification.countDocuments({ userId }),
            Notification.countDocuments({ userId, isRead: false }),
            Notification.countDocuments({ userId, isRead: true }),
            Notification.countDocuments({ userId, priority: 'high' }),
            Notification.countDocuments({ userId, priority: 'medium' }),
            Notification.countDocuments({ userId, priority: 'low' }),
            Notification.countDocuments({ userId, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
        ]);

        // Generate a breakdown of notification counts categorized by type
        const typeBreakdown = await Notification.aggregate([
            { $match: { userId } },
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const latestNotifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .limit(3)
            .select('title message type priority createdAt isRead');

        return {
            totalNotifications,
            unreadCount,
            readCount,
            recentCount,
            priorityBreakdown: {
                high: highPriorityCount,
                medium: mediumPriorityCount,
                low: lowPriorityCount
            },
            typeBreakdown: typeBreakdown.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            latestNotifications,
            lastUpdated: new Date()
        };
    }

    async getUserNotificationsV2(userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [notifications, totalNotifications, unreadCount, readCount] = await Promise.all([
            Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Notification.countDocuments({ userId }),
            Notification.countDocuments({ userId, isRead: false }),
            Notification.countDocuments({ userId, isRead: true })
        ]);
        return {
            notifications,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalNotifications / limit),
                totalNotifications,
                hasNextPage: page * limit < totalNotifications,
                hasPrevPage: page > 1,
                limit
            },
            summary: {
                totalNotifications,
                unreadNotifications: unreadCount,
                readNotifications: readCount
            }
        };
    }

    async markNotificationRead(notificationId, userId) {
        await Notification.updateOne({ _id: notificationId, userId }, { $set: { isRead: true } });
        return { notificationId, userId, markedReadAt: new Date() };
    }

    async markAllNotificationsRead(userId) {
        const result = await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
        return { userId, markedReadCount: result.modifiedCount, markedReadAt: new Date() };
    }

    async deleteNotificationV2(notificationId, userId) {
        await Notification.deleteOne({ _id: notificationId, userId });
        return { notificationId, userId, deletedAt: new Date() };
    }

    async getNotificationPreferences(userId) {
        // In a real app, fetch from DB. Here, return defaults.
        return {
            userId,
            preferences: {
                emailNotifications: {
                    applicationUpdates: true,
                    projectAssignments: true,
                    paymentUpdates: true,
                    systemAnnouncements: true
                },
                inAppNotifications: {
                    applicationUpdates: true,
                    projectAssignments: true,
                    paymentUpdates: true,
                    systemAnnouncements: true
                },
                pushNotifications: {
                    applicationUpdates: false,
                    projectAssignments: true,
                    paymentUpdates: true,
                    systemAnnouncements: false
                }
            },
            lastUpdated: new Date()
        };
    }

    async updateNotificationPreferences(userId, preferences) {
        // In a real app, save to DB. Here, just echo back.
        return {
            userId,
            preferences: preferences || {},
            updatedAt: new Date()
        };
    }
}

export default new NotificationService();
