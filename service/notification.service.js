const mongoose = require('mongoose');
const DTUser = require('../models/dtUser.model');
const { createNotification } = require('../utils/notificationService');

class AdminNotificationService {
    static async createAdminNotification(payload) {
        const { recipientId, recipientType, title, message, type, priority, actionUrl, actionText, relatedData, scheduleFor, targetUsers } = payload;
        if (!title || !message || !type) {
            const error = new Error('Title, message, and type are required');
            error.statusCode = 400;
            throw error;
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
            const error = new Error('recipientId or recipientType=all required');
            error.statusCode = 400;
            throw error;
        }
        const notifications = await Promise.all(
            recipients.map(userId =>
                createNotification({
                    userId,
                    type,
                    title,
                    message,
                    data: {
                        actionUrl,
                        actionText,
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

    static updateAdminNotification(notificationId, body) {
        return {
            notificationId,
            updatedFields: Object.keys(body),
            updatedAt: new Date().toISOString()
        };
    }

    static deleteAdminNotification(notificationId) {
        return { notificationId };
    }

    static getAnalytics() {
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
            },
            userEngagement: {
                topEngagedUsers: [
                    {
                        userId: '507f1f77bcf86cd799439011',
                        fullName: 'John Doe',
                        notificationsReceived: 12,
                        notificationsRead: 11,
                        readRate: 91.7
                    }
                ],
                engagementDistribution: {
                    highEngagement: 45,
                    mediumEngagement: 78,
                    lowEngagement: 33
                }
            }
        };
    }

    static getAdminNotifications() {
        return {
            notifications: [],
            totalNotifications: 0
        };
    }

    static createAnnouncement(adminEmail, payload) {
        const { title, message, priority = 'normal', targetUsers = 'all' } = payload;

        if (!title || !message) {
            const error = new Error('Title and message are required for announcements');
            error.statusCode = 400;
            throw error;
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

    static getNotificationStats(adminEmail) {
        return {
            statistics: {
                totalNotifications: 0,
                unreadNotifications: 0,
                readNotifications: 0,
                announcements: 0,
                systemNotifications: 0,
                userNotifications: 0,
                recentActivity: {
                    today: 0,
                    thisWeek: 0,
                    thisMonth: 0
                },
                notificationTypes: {
                    assessment_completed: 0,
                    application_status: 0,
                    project_updates: 0,
                    system_announcements: 0,
                    payment_updates: 0
                }
            },
            generatedAt: new Date(),
            adminRequester: adminEmail
        };
    }

    static async cleanupNotifications(adminEmail, payload) {
        const { daysOld = 30, notificationType = 'all' } = payload;

        return {
            deletedCount: 0,
            criteria: {
                daysOld,
                notificationType
            },
            cleanupDate: new Date(),
            performedBy: adminEmail
        };
    }

    static async broadcastNotification(adminEmail, payload) {
        const { title, message, priority = 'medium', targetUsers = 'all', type = 'system_announcement' } = payload;

        if (!title || !message) {
            const error = new Error('Title and message are required for broadcast notifications');
            error.statusCode = 400;
            throw error;
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
            title,
            message,
            priority,
            targetUsers,
            recipientCount: recipients.length,
            createdBy: adminEmail,
            createdAt: new Date()
        };
    }
}

module.exports = AdminNotificationService;
