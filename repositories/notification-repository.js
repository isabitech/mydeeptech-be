const Notification = require('../models/notification.model');
const mongoose = require('mongoose');

class NotificationRepository {
    /**
     * Get count of notifications by status (isRead)
     */
    async countByStatus(userId, isRead) {
        return await Notification.countDocuments({ userId, isRead });
    }

    /**
     * Get count of notifications by priority
     */
    async countByPriority(userId, priority) {
        return await Notification.countDocuments({ userId, priority });
    }

    /**
     * Get count of recent notifications (last 24 hours)
     */
    async countRecent(userId) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return await Notification.countDocuments({
            userId,
            createdAt: { $gte: twentyFourHoursAgo }
        });
    }

    /**
     * Get notification type breakdown for a user
     */
    async getTypeBreakdown(userId) {
        return await Notification.aggregate([
            { $match: { userId } },
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
    }

    /**
     * Get latest notifications for a user
     */
    async getLatest(userId, limit = 3) {
        return await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('title message type priority createdAt isRead');
    }

    /**
     * Find notifications with pagination and filtering
     */
    async findWithPagination({ filter, sort, skip, limit }) {
        return await Notification.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit);
    }

    /**
     * Count total notifications matching filter
     */
    async countAll(filter) {
        return await Notification.countDocuments(filter);
    }

    /**
     * Find many notifications (utility)
     */
    async findMany(filter) {
        return await Notification.find(filter);
    }

    /**
     * Find one notification by ID and user ID
     */
    async findOne(notificationId, userId) {
        return await Notification.findOne({ _id: notificationId, userId });
    }

    /**
     * Find and update a notification
     */
    async findOneAndUpdate(filter, update, options = { new: true, runValidators: true }) {
        return await Notification.findOneAndUpdate(filter, update, options);
    }

    /**
     * Update many notifications
     */
    async updateMany(filter, update) {
        return await Notification.updateMany(filter, update);
    }

    /**
     * Delete one notification
     */
    async findOneAndDelete(filter) {
        return await Notification.findOneAndDelete(filter);
    }

    /**
     * Find by ID (generic)
     */
    async findById(id) {
        return await Notification.findById(id);
    }

    /**
     * Find by ID and update (generic)
     */
    async findByIdAndUpdate(id, update, options = { new: true, runValidators: true }) {
        return await Notification.findByIdAndUpdate(id, update, options);
    }

    /**
     * Find by ID and delete (generic)
     */
    async findByIdAndDelete(id) {
        return await Notification.findByIdAndDelete(id);
    }

    /**
     * Helper to validate ObjectId
     */
    isValidObjectId(id) {
        return mongoose.Types.ObjectId.isValid(id);
    }

    /**
     * Helper to convert to ObjectId
     */
    toObjectId(id) {
        return new mongoose.Types.ObjectId(id);
    }
}

module.exports = new NotificationRepository();