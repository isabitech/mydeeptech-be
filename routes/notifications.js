const express = require('express');
const { authenticateToken } = require('../middleware/auth.js');
const Notification = require('../models/notification.model');

const router = express.Router();

// User notification endpoints (placeholder for future implementation)

/**
 * Get notification summary
 * GET /api/notifications/summary
 */
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;
    
    console.log(`📊 User ${userId} requesting notification summary`);

    // Get notification counts and summary data
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
});

/**
 * Get user's notifications
 * GET /api/notifications
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch notifications for this user
    const [notifications, totalNotifications, unreadCount, readCount] = await Promise.all([
      Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments({ userId }),
      Notification.countDocuments({ userId, isRead: false }),
      Notification.countDocuments({ userId, isRead: true })
    ]);

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
          unreadNotifications: unreadCount,
          readNotifications: readCount
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
});

/**
 * Mark notification as read
 * PATCH /api/notifications/:notificationId/read
 */
router.patch('/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId || req.user?.userId;
    
    console.log(`📖 User ${userId} marking notification ${notificationId} as read`);

    // For now, just return success until notification model is implemented
    res.status(200).json({
      success: true,
      message: "Notification marked as read successfully",
      data: {
        notificationId: notificationId,
        userId: userId,
        markedReadAt: new Date()
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
});

/**
 * Mark all notifications as read
 * PATCH /api/notifications/read-all
 */
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;

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
});

/**
 * Delete a notification
 * DELETE /api/notifications/:notificationId
 */
router.delete('/:notificationId', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId || req.user?.userId;
    
    console.log(`🗑️ User ${userId} deleting notification ${notificationId}`);

    // For now, just return success until notification model is implemented
    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
      data: {
        notificationId: notificationId,
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
});

/**
 * Get notification preferences
 * GET /api/notifications/preferences
 */
router.get('/preferences', authenticateToken, async (req, res) => {
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
});

/**
 * Update notification preferences
 * PUT /api/notifications/preferences
 */
router.put('/preferences', authenticateToken, async (req, res) => {
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
});

module.exports = router;