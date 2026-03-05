const NotificationModel = require('../models/notification.model');

class NotificationRepository {
    constructor() {}

    static async getAdminNotifications(payloads) {

        const { limit, skip, type, priority, recipientType, recipientId, isRead, startDate, endDate, userId } = payloads;

        // Build filter query
        const filterQuery = { userModel: 'DTUser' };
        
        if (userId) {
            filterQuery.userId = userId;
        }
        
        if (type) {
            filterQuery.type = type;
        }
        
        if (priority) {
            filterQuery.priority = priority;
        }
        
        if (recipientId) {
            filterQuery.userId = recipientId;
        }
        
        if (isRead !== undefined) {
            filterQuery.isRead = isRead;
        }
        
        if (startDate || endDate) {
            filterQuery.createdAt = {};
            if (startDate) {
                filterQuery.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                // Add one day to endDate to include the entire end day
                const endDateObj = new Date(endDate);
                endDateObj.setDate(endDateObj.getDate() + 1);
                filterQuery.createdAt.$lt = endDateObj;
            }
        }

        // Calculate recent notifications (last 24 hours)
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const [totalNotifications, notifications, unreadNotifications, recentNotifications] = await Promise.all([
            NotificationModel.countDocuments(filterQuery),
            NotificationModel.find(filterQuery)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            NotificationModel.countDocuments({ ...filterQuery, isRead: false }),
            NotificationModel.countDocuments({ 
                ...filterQuery, 
                createdAt: { $gte: twentyFourHoursAgo } 
            })
        ]);

        return {
            notifications,
            totalNotifications,
            unreadNotifications,
            recentNotifications
        };
    }

    static async getUserNotifications(payloads) {

        const { limit, skip } = payloads;

        const [notifications, totalNotifications] = await Promise.all([
            NotificationModel.find({ userModel: 'DTUser' })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            NotificationModel.countDocuments({ userModel: 'DTUser' })
        ]);

        return {
            notifications,
            totalNotifications
        };
    }

    static async updateAdminNotification(notificationId, updateData) {
        try {
            const updatedNotification = await NotificationModel.findByIdAndUpdate(
                notificationId,
                {
                    title: updateData.title,
                    message: updateData.message,
                    type: updateData.type,
                    priority: updateData.priority,
                    scheduleFor: updateData.scheduleFor || null,
                    actionUrl: updateData.actionUrl || null,
                    actionText: updateData.actionText || null,
                    data: {
                        ...updateData.relatedData
                    },
                    updatedAt: new Date()
                },
                { new: true, runValidators: true }
            );

            if (!updatedNotification) {
                throw new Error('Notification not found');
            }

            return updatedNotification;
        } catch (error) {
            throw error;
        }
    }

    static async deleteAdminNotification(notificationId) {
        try {
            const deletedNotification = await NotificationModel.findByIdAndDelete(notificationId);
            
            if (!deletedNotification) {
                throw new Error('Notification not found');
            }

            return deletedNotification;
        } catch (error) {
            throw error;
        }
    }
}
module.exports = NotificationRepository;