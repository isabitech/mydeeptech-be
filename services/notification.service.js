const mongoose = require('mongoose');
const DTUser = require('../models/dtUser.model');
const { createNotification } = require('../utils/notificationService');
const notificationRepository = require('../repositories/notification-repository');

class AdminNotificationService {
    /**
     * Create administrative notification for one or many users
     */
    async createAdminNotification(payload) {
        const { recipientId, recipientType, title, message, type, priority, relatedData, scheduleFor, targetUsers } = payload;
        
        if (!title || !message || !type) {
            throw { statusCode: 400, message: 'Title, message, and type are required' };
        }

        let recipients = [];
        if (
            recipientType === 'all' &&
            (!targetUsers ||
                targetUsers === 'all' ||
                targetUsers === 'dtusers' ||
                targetUsers === 'annotators' ||
                targetUsers === 'micro_taskers')
        ) {
            const dtusers = await DTUser.find({}, '_id');
            recipients = dtusers.map(u => u._id);
        } else if (recipientId) {
            recipients = [recipientId];
        } else {
            throw { statusCode: 400, message: 'recipientId or recipientType=all required' };
        }

        const notifications = await Promise.all(
            recipients.map(userId =>
                createNotification({
                    userId,
                    type,
                    title,
                    message,
                    priority: priority || 'medium',
                    scheduleFor: scheduleFor ? new Date(scheduleFor) : null,
                    actionUrl: relatedData?.actionUrl || null,
                    actionText: relatedData?.actionText || null,
                    data: {
                        ...relatedData
                    }
                })
            )
        );

        return {
            notificationIds: notifications.map(n => n.id),
            recipientCount: recipients.length,
            isScheduled: !!scheduleFor,
            createdAt: new Date().toISOString()
        };
    }

    /**
     * Update an administrative notification
     */
    async updateAdminNotification(notificationId, body) {
        const { title, message, type, priority, relatedData, scheduleFor } = body;
        
        if (!title || !message || !type) {
            throw { statusCode: 400, message: 'Title, message, and type are required' };
        }

        const updatedNotification = await notificationRepository.findByIdAndUpdate(
            notificationId, 
            {
                title,
                message,
                type,
                priority: priority || 'medium',
                scheduleFor: scheduleFor ? new Date(scheduleFor) : null,
                actionUrl: relatedData?.actionUrl || null,
                actionText: relatedData?.actionText || null,
                data: {
                    ...relatedData
                },
                updatedAt: new Date()
            }
        );

        if (!updatedNotification) {
            throw { statusCode: 404, message: 'Notification not found' };
        }

        return {
            notificationId,
            notification: updatedNotification,
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Delete an administrative notification
     */
    async deleteAdminNotification(notificationId) {
        const deletedNotification = await notificationRepository.findByIdAndDelete(notificationId);
        
        if (!deletedNotification) {
            throw { statusCode: 404, message: 'Notification not found' };
        }

        return { 
            notificationId,
            deletedNotification,
            deletedAt: new Date().toISOString()
        };
    }

    /**
     * Get notification analytics (Mock/Aggregation placeholder)
     */
    getAnalytics() {
        // Return existing placeholder logic for now
        return {
            period: {
                startDate: '2025-11-07T00:00:00.000Z',
                endDate: '2025-11-14T23:59:59.000Z',
                duration: '7 days'
            },
            overview: {
                totalSent: 156,
                totalRead: 98,
                totalUnread: 58,
                readRate: 62.8,
                averageReadTime: '2.3 hours',
                engagementRate: 45.2
            },
            performance: {
                byType: [
                    { type: 'account_update', sent: 45, read: 35, readRate: 77.8, avgReadTime: '1.2 hours' }
                ],
                byPriority: [
                    { priority: 'high', sent: 25, read: 22, readRate: 88.0 }
                ],
                dailyTrend: [
                    { date: '2025-11-14', sent: 23, read: 15, readRate: 65.2 }
                ]
            }
        };
    }

    /**
     * Get admin notifications with full filtering (uses repository)
     */
    async getAdminNotifications(payloads) {
        const filter = this._buildFilter(payloads);
        
        // Get notifications with pagination
        const notifications = await notificationRepository.findWithPagination({
            filter,
            sort: { createdAt: -1 },
            skip: payloads.skip,
            limit: payloads.limit
        });

        // Get total count for pagination
        const totalNotifications = await notificationRepository.countAll(filter);

        // Get unread count
        const unreadFilter = { ...filter, isRead: false };
        const unreadNotifications = await notificationRepository.countAll(unreadFilter);

        // Get recent notifications count (last 7 days)
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 7);
        const recentFilter = { ...filter, createdAt: { $gte: recentDate } };
        const recentNotifications = await notificationRepository.countAll(recentFilter);

        return {
            notifications,
            totalNotifications,
            unreadNotifications,
            recentNotifications
        };
    }

    /**
     * Build complex filter for admin notifications
     * @private
     */
    _buildFilter(payloads) {
        const { type, priority, recipientId, isRead, startDate, endDate } = payloads;
        const filter = { userModel: 'DTUser' };
        
        if (type) filter.type = type;
        if (priority) filter.priority = priority;
        if (recipientId) filter.userId = recipientId;
        if (isRead !== undefined) filter.isRead = isRead;
        
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const endDateObj = new Date(endDate);
                endDateObj.setDate(endDateObj.getDate() + 1);
                filter.createdAt.$lt = endDateObj;
            }
        }
        return filter;
    }

    /**
     * Create an announcement
     */
    createAnnouncement(adminEmail, payload) {
        const { title, message, priority = 'normal', targetUsers = 'all' } = payload;

        if (!title || !message) {
            throw { statusCode: 400, message: 'Title and message are required for announcements' };
        }

        return {
            announcement: {
                id: new mongoose.Types.ObjectId(),
                title,
                message,
                priority,
                targetUsers,
                createdBy: adminEmail,
                createdAt: new Date(),
                status: 'active'
            }
        };
    }

    /**
     * Get high-level notification statistics
     */
    getNotificationStats(adminEmail) {
        return {
            statistics: {
                totalNotifications: 0,
                unreadNotifications: 0,
                readNotifications: 0,
                announcements: 0,
                systemNotifications: 0,
                userNotifications: 0,
                recentActivity: { today: 0, thisWeek: 0, thisMonth: 0 }
            },
            generatedAt: new Date(),
            adminRequester: adminEmail
        };
    }

    /**
     * Cleanup old notifications
     */
    async cleanupNotifications(adminEmail, payload) {
        const { daysOld = 30, notificationType = 'all' } = payload;
        // Logical placeholder - actual implementation would use notificationRepository.deleteMany
        return {
            deletedCount: 0,
            criteria: { daysOld, notificationType },
            cleanupDate: new Date(),
            performedBy: adminEmail
        };
    }

    /**
     * Broadcast a notification to all users
     */
    async broadcastNotification(adminEmail, payload) {
        const { title, message, priority = 'medium', targetUsers = 'all', type = 'system_announcement' } = payload;

        if (!title || !message) {
            throw { statusCode: 400, message: 'Title and message are required' };
        }

        const dtusers = await DTUser.find({}, '_id');
        const recipients = dtusers.map(u => u._id);

        await Promise.all(
            recipients.map(userId =>
                createNotification({
                    userId,
                    type,
                    title,
                    message,
                    priority,
                    data: {
                        targetUsers,
                        createdBy: adminEmail
                    }
                })
            )
        );

        return {
            broadcastId: new Date().getTime(),
            recipientCount: recipients.length,
            createdBy: adminEmail,
            createdAt: new Date()
        };
    }
}

module.exports = new AdminNotificationService();
