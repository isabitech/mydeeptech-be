const AdminNotificationService = require('../services/notification.service.js');

const createAdminNotification = async (req, res) => {
  try {
    const data = await AdminNotificationService.createAdminNotification(req.body);

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Server error creating notification',
      error: error.message
    });
  }
};

const updateAdminNotification = async (req, res) => {
  try {
    const data = AdminNotificationService.updateAdminNotification(
      req.params.notificationId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: 'Notification updated successfully',
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating notification',
      error: error.message
    });
  }
};

const deleteAdminNotification = async (req, res) => {
  try {
    const data = AdminNotificationService.deleteAdminNotification(req.params.notificationId);

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully by admin',
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting notification',
      error: error.message
    });
  }
};

const getAdminNotificationAnalytics = async (req, res) => {
  try {
    const data = AdminNotificationService.getAnalytics();

    res.status(200).json({
      success: true,
      message: 'Notification analytics retrieved successfully',
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error fetching analytics',
      error: error.message
    });
  }
};

const getAdminNotifications = async (req, res) => {
  try {
    const { notifications, totalNotifications } =
      AdminNotificationService.getAdminNotifications();

    res.status(200).json({
      success: true,
      message: 'Admin notifications retrieved successfully',
      data: {
        notifications,
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalNotifications,
          hasNextPage: false,
          hasPrevPage: false,
          limit: 10
        },
        summary: {
          totalNotifications,
          unreadNotifications: 0,
          recentNotifications: 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error fetching notifications',
      error: error.message
    });
  }
};

const createAnnouncement = async (req, res) => {
  try {
    const data = AdminNotificationService.createAnnouncement(
      req.admin.email,
      req.body
    );

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Server error creating announcement',
      error: error.message
    });
  }
};

const getNotificationStats = async (req, res) => {
  try {
    const data = AdminNotificationService.getNotificationStats(req.admin.email);

    res.status(200).json({
      success: true,
      message: 'Notification statistics retrieved successfully',
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error fetching notification statistics',
      error: error.message
    });
  }
};

const cleanupNotifications = async (req, res) => {
  try {
    const data = await AdminNotificationService.cleanupNotifications(
      req.admin.email,
      req.body
    );

    res.status(200).json({
      success: true,
      message: 'Notification cleanup completed successfully',
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error during notification cleanup',
      error: error.message
    });
  }
};

const broadcastNotification = async (req, res) => {
  try {
    const data = await AdminNotificationService.broadcastNotification(
      req.admin.email,
      req.body
    );

    res.status(201).json({
      success: true,
      message: 'Broadcast notification sent successfully',
      data
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Server error broadcasting notification',
      error: error.message
    });
  }
};

module.exports = {
  getAdminNotifications,
  createAnnouncement,
  getNotificationStats,
  cleanupNotifications,
  broadcastNotification,
  createAdminNotification,
  updateAdminNotification,
  deleteAdminNotification,
  getAdminNotificationAnalytics
};
