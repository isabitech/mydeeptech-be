const notificationRepository = require('../repositories/notification-repository');

class UserNotificationService {
    toInt(value, fallback) {
        const parsed = parseInt(value, 10);
        return Number.isNaN(parsed) ? fallback : parsed;
    }

    buildPagination({ page, limit, total }) {
        return {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalNotifications: total,
            hasNextPage: page * limit < total,
            hasPrevPage: page > 1,
            limit
        };
    }

    buildPriorityBreakdown({ high, medium, low }) {
        return { high, medium, low };
    }

    buildTypeBreakdown(typeBreakdown = []) {
        return typeBreakdown.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});
    }

    /**
     * Get notification summary for a user
     */
    async getSummary(userId) {
        const [
            totalNotifications,
            unreadCount,
            readCount,
            highPriorityCount,
            mediumPriorityCount,
            lowPriorityCount,
            recentNotifications,
            typeBreakdown,
            latestNotifications
        ] = await Promise.all([
            notificationRepository.countAll({ userId, userModel: 'DTUser' }),
            notificationRepository.countByStatus(userId, false),
            notificationRepository.countByStatus(userId, true),
            notificationRepository.countByPriority(userId, 'high'),
            notificationRepository.countByPriority(userId, 'medium'),
            notificationRepository.countByPriority(userId, 'low'),
            notificationRepository.countRecent(userId),
            notificationRepository.getTypeBreakdown(userId),
            notificationRepository.getLatest(userId)
        ]);

        return {
            totalNotifications,
            unreadCount,
            readCount,
            recentCount: recentNotifications,
            priorityBreakdown: this.buildPriorityBreakdown({
                high: highPriorityCount,
                medium: mediumPriorityCount,
                low: lowPriorityCount
            }),
            typeBreakdown: this.buildTypeBreakdown(typeBreakdown),
            latestNotifications,
            lastUpdated: new Date()
        };
    }

    /**
     * Get user notifications with pagination
     */
    async getUserNotifications(userId, query) {
        const page = this.toInt(query.page, 1);
        const limit = this.toInt(query.limit, 20);
        const skip = (page - 1) * limit;

        const filter = { userId, userModel: 'DTUser' };
        const sort = { createdAt: -1 };

        const [notifications, totalNotifications, unreadCount, readCount] = await Promise.all([
            notificationRepository.findWithPagination({ filter, sort, skip, limit }),
            notificationRepository.countAll(filter),
            notificationRepository.countByStatus(userId, false),
            notificationRepository.countByStatus(userId, true)
        ]);

        return {
            notifications,
            pagination: this.buildPagination({ page, limit, total: totalNotifications }),
            summary: {
                totalNotifications,
                unreadCount,
                readCount
            }
        };
    }

    /**
     * Mark a single notification as read
     */
    async markAsRead(notificationId, userId) {
        const updatedNotification = await notificationRepository.findOneAndUpdate(
            { _id: notificationId, userId },
            { $set: { isRead: true, readAt: new Date() } }
        );

        if (!updatedNotification) {
            throw new Error('Notification not found or access denied');
        }

        return {
            notificationId: updatedNotification._id,
            userId,
            isRead: updatedNotification.isRead,
            readAt: updatedNotification.readAt
        };
    }

    /**
     * Mark all notifications for a user as read
     */
    async markAllAsRead(userId) {
        // Handle various ID formats as seen in original code
        const query = { userId, userModel: 'DTUser', isRead: false };
        
        const updateResult = await notificationRepository.updateMany(
            query,
            { $set: { isRead: true, readAt: new Date() } }
        );

        return {
            userId,
            markedReadCount: updateResult.modifiedCount,
            markedReadAt: new Date()
        };
    }

    /**
     * Delete a single notification
     */
    async deleteNotification(notificationId, userId) {
        const deletedNotification = await notificationRepository.findOneAndDelete({
            _id: notificationId,
            userId
        });

        if (!deletedNotification) {
            throw new Error('Notification not found or access denied');
        }

        return {
            notificationId: deletedNotification._id,
            userId,
            deletedAt: new Date()
        };
    }

    /**
     * Get default notification preferences
     */
    getNotificationPreferences(userId) {
        // Return default preferences until user preference model is implemented
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

    /**
     * Update notification preferences (mock)
     */
    updateNotificationPreferences(userId, preferences) {
        // Mock update until model is implemented
        return {
            userId,
            preferences: preferences || {},
            updatedAt: new Date()
        };
    }
}

module.exports = new UserNotificationService();
