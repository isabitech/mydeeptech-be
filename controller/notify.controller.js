const Notification = require('../models/notification.model');

class NotifyController {
    async summary(req, res) {

        const userId = req.userId || req.user?.userId;
        console.log(`📊 User ${userId} requesting notification summary`);
        // Get notification counts and summary data
        try {
            const [totalNotifications, unreadCount, readCount, highPriorityCount, mediumPriorityCount, lowPriorityCount, recentNotifications] = await Promise.all([
                Notification.countDocuments({ userId }),
                Notification.countDocuments({ userId, isRead: false }),
                Notification.countDocuments({ userId, isRead: true }),
                Notification.countDocuments({ userId, priority: 'high' }),
                Notification.countDocuments({ userId, priority: 'medium' }),
                Notification.countDocuments({ userId, priority: 'low' }),
                Notification.find({ userId, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }).countDocuments() // Last 24 hours
            ]);
            // Get type breakdown
            const typeBreakdown = await Notification.aggregate([
                { $match: { userId } },
                { $group: { _id: '$type', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);
            // Get most recent notifications (last 3)
            const latestNotifications = await Notification.find({ userId })
                .sort({ createdAt: -1 })
                .limit(3)
                .select('title message type priority createdAt isRead');
            res.status(200).json({
                success: true,
                message: "Notification summary retrieved successfully",
                data: {
                    totalNotifications,
                    unreadCount,
                    readCount,
                    recentCount: recentNotifications,
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
                }
            });
        } catch (error) {
            console.error("❌ Error fetching notification summary:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching notification summary",
                error: error.message
            });
        }
    }
    async UserNotifications(req, res) {

        const userId = req.userId || req.user?.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        console.log(`📥 User ${userId} requesting notifications - page ${page}, limit ${limit}`);
        try {
            // Fetch notifications for this user
            const [notifications, totalNotifications, unreadCount, readCount] = await Promise.all([
                Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
                Notification.countDocuments({ userId }),
                Notification.countDocuments({ userId, isRead: false }),
                Notification.countDocuments({ userId, isRead: true })
            ]);

            console.log(`📥 Found ${totalNotifications} total, ${unreadCount} unread, ${readCount} read notifications for user ${userId}`);

            res.status(200).json({
                success: true,
                message: "User notifications retrieved successfully",
                data: {
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
                        unreadCount: unreadCount,  // Changed from unreadNotifications to unreadCount
                        readCount: readCount       // Changed from readNotifications to readCount
                    }
                }
            });
        } catch (error) {
            console.error("❌ Error fetching user notifications:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching notifications",
                error: error.message
            });
        }
    }
    async markAsRead(req, res) {

        const { notificationId } = req.params;
        const userId = req.userId || req.user?.userId;

        console.log(`📖 User ${userId} marking notification ${notificationId} as read`);
        try {
            // Update the notification in the database
            const updatedNotification = await Notification.findOneAndUpdate(
                {
                    _id: notificationId,
                    userId: userId
                },
                {
                    $set: {
                        isRead: true,
                        readAt: new Date()
                    }
                },
                {
                    new: true,
                    runValidators: true
                }
            );

            if (!updatedNotification) {
                return res.status(404).json({
                    success: false,
                    message: "Notification not found or access denied"
                });
            }

            res.status(200).json({
                success: true,
                message: "Notification marked as read successfully",
                data: {
                    notificationId: updatedNotification._id,
                    userId: userId,
                    isRead: updatedNotification.isRead,
                    readAt: updatedNotification.readAt
                }
            });

        } catch (error) {
            console.error("❌ Error marking notification as read:", error);
            res.status(500).json({
                success: false,
                message: "Server error updating notification",
                error: error.message
            });
        }
    }

    async markAllAsRead(req, res) {

        const userId = req.userId || req.user?.userId;
        console.log(`📚 User ${userId} marking ALL notifications as read`);
        console.log(`📚 User ID type: ${typeof userId}`);
        try {
            // First, let's see what notifications exist for this user
            const existingNotifications = await Notification.find({ userId });
            console.log(`📚 Found ${existingNotifications.length} total notifications for user ${userId}`);
            const unreadNotifications = await Notification.find({ userId, isRead: false });
            console.log(`📚 Found ${unreadNotifications.length} unread notifications for user ${userId}`);
            // If no unread notifications found, let's check with string conversion
            if (unreadNotifications.length === 0) {
                console.log(`📚 Trying with string conversion of userId...`);
                const userIdString = String(userId);
                const unreadWithString = await Notification.find({ userId: userIdString, isRead: false });
                console.log(`📚 Found ${unreadWithString.length} unread notifications with string userId`);
                // Also try with ObjectId conversion
                const mongoose = require('mongoose');
                if (mongoose.Types.ObjectId.isValid(userId)) {
                    const userIdObj = new mongoose.Types.ObjectId(userId);
                    const unreadWithObj = await Notification.find({ userId: userIdObj, isRead: false });
                    console.log(`📚 Found ${unreadWithObj.length} unread notifications with ObjectId conversion`);
                }
            }
           // Update all unread notifications for this user
            const updateResult = await Notification.updateMany(
                {
                    userId: userId,
                    isRead: false
                },
                {
                    $set: {
                        isRead: true,
                        readAt: new Date()
                    }
                }
            );

            console.log(`📚 Update result: ${updateResult.modifiedCount} documents modified out of ${updateResult.matchedCount} matched`);

            res.status(200).json({
                success: true,
                message: "All notifications marked as read successfully",
                data: {
                    userId: userId,
                    markedReadCount: updateResult.modifiedCount,
                    markedReadAt: new Date()
                }
            });

        } catch (error) {
            console.error("❌ Error marking all notifications as read:", error);
            res.status(500).json({
                success: false,
                message: "Server error updating notifications",
                error: error.message
            });
        }
    }

    async deleteNotification(req, res) {
        try {
            const { notificationId } = req.params;
            const userId = req.userId || req.user?.userId;

            console.log(`🗑️ User ${userId} deleting notification ${notificationId}`);

            // Delete the notification from the database
            const deletedNotification = await Notification.findOneAndDelete({
                _id: notificationId,
                userId: userId
            });

            if (!deletedNotification) {
                return res.status(404).json({
                    success: false,
                    message: "Notification not found or access denied"
                });
            }

            res.status(200).json({
                success: true,
                message: "Notification deleted successfully",
                data: {
                    notificationId: deletedNotification._id,
                    userId: userId,
                    deletedAt: new Date()
                }
            });

        } catch (error) {
            console.error("❌ Error deleting notification:", error);
            res.status(500).json({
                success: false,
                message: "Server error deleting notification",
                error: error.message
            });
        }
    }

    async getNotificationPreferences(req, res) {
        try {
            const userId = req.userId || req.user?.userId;

            console.log(`⚙️ User ${userId} requesting notification preferences`);

            // Return default preferences until user preference model is implemented
            const defaultPreferences = {
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
            };

            res.status(200).json({
                success: true,
                message: "Notification preferences retrieved successfully",
                data: {
                    userId: userId,
                    preferences: defaultPreferences,
                    lastUpdated: new Date()
                }
            });

        } catch (error) {
            console.error("❌ Error fetching notification preferences:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching notification preferences",
                error: error.message
            });
        }
    }
    async updateNotificationPreferences(req, res) {
        try {
            const userId = req.userId || req.user?.userId;
            const { preferences } = req.body;

            console.log(`⚙️ User ${userId} updating notification preferences`);

            // For now, just return the provided preferences until user preference model is implemented
            res.status(200).json({
                success: true,
                message: "Notification preferences updated successfully",
                data: {
                    userId: userId,
                    preferences: preferences || {},
                    updatedAt: new Date()
                }
            });

        } catch (error) {
            console.error("❌ Error updating notification preferences:", error);
            res.status(500).json({
                success: false,
                message: "Server error updating notification preferences",
                error: error.message
            });
        }
    }
}

module.exports = new NotifyController();