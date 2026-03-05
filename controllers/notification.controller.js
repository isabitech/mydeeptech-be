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
    const data = await AdminNotificationService.updateAdminNotification(
      req.params.notificationId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: 'Notification updated successfully',
      data
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Server error updating notification',
      error: error.message
    });
  }
};

const deleteAdminNotification = async (req, res) => {
  try {
    const data = await AdminNotificationService.deleteAdminNotification(req.params.notificationId);

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully by admin',
      data
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Server error deleting notification',
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

  const { 
    page = 1, 
    limit = 10, 
    type, 
    priority, 
    recipientType, 
    recipientId, 
    isRead, 
    startDate, 
    endDate 
  } = req.query;
  
  const skip = (page - 1) * limit;

  const payloads = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    skip,
    type,
    priority,
    recipientType,
    recipientId,
    isRead: isRead !== undefined ? isRead === 'true' : undefined,
    startDate,
    endDate
  };

  try {

    const notificationsService = await AdminNotificationService.getAdminNotifications(payloads);

    res.status(200).json({
      success: true,
      message: 'Admin notifications retrieved successfully',
      data: {
        notifications: notificationsService.notifications,
        pagination: {
          currentPage: payloads.page,
          totalPages: Math.ceil(notificationsService.totalNotifications / payloads.limit),
          totalCount: notificationsService.totalNotifications,
          hasNext: payloads.page * payloads.limit < notificationsService.totalNotifications,
          hasPrev: payloads.page > 1,
          limit: payloads.limit
        },
        summary: {
          totalNotifications: notificationsService.totalNotifications,
          unreadNotifications: notificationsService.unreadNotifications,
          recentNotifications: notificationsService.recentNotifications
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
