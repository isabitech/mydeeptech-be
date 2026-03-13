const Device = require('../models/device.model');
const mongoose = require('mongoose');

class DeviceRepository {
    constructor() {}

    /**
     * Get all devices with filtering, sorting, and pagination
     */
    static async getDevices(payloads) {
        const { 
            limit = 10, 
            skip = 0, 
            search, 
            status, 
            type, 
            location, 
            assignedUser,
            isActive,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = payloads;

        // Build filter query
        const filterQuery = {};
        
        if (search) {
            filterQuery.$or = [
                { name: { $regex: search, $options: 'i' } },
                { deviceId: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } },
                { manufacturer: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (status) {
            filterQuery.status = status;
        }
        
        if (type) {
            filterQuery.type = type;
        }
        
        if (location) {
            if (location.building) filterQuery['location.building'] = location.building;
            if (location.floor) filterQuery['location.floor'] = location.floor;
            if (location.room) filterQuery['location.room'] = location.room;
        }
        
        if (assignedUser) {
            filterQuery['assignedUsers.user'] = assignedUser;
        }
        
        if (isActive !== undefined) {
            filterQuery.isActive = isActive;
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const [totalDevices, devices] = await Promise.all([
            Device.countDocuments(filterQuery),
            Device.find(filterQuery)
                .populate('currentUser', 'firstname lastname email')
                .populate('assignedUsers.user', 'firstname lastname email')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        return {
            devices,
            pagination: {
                total: totalDevices,
                page: Math.floor(skip / limit) + 1,
                pages: Math.ceil(totalDevices / limit),
                limit,
                hasNext: (skip + limit) < totalDevices,
                hasPrev: skip > 0
            }
        };
    }

    /**
     * Get device by ID with full population
     */
    static async getDeviceById(deviceId) {
        if (!mongoose.isValidObjectId(deviceId)) {
            throw new Error('Invalid device ID format');
        }

        const device = await Device.findById(deviceId)
            .populate('currentUser', 'firstname lastname email role')
            .populate('assignedUsers.user', 'firstname lastname email role')
            .lean();

        if (!device) {
            throw new Error('Device not found');
        }

        return device;
    }

    /**
     * Get device by deviceId (unique identifier)
     */
    static async getDeviceByDeviceId(deviceId) {
        const device = await Device.findOne({ deviceId })
            .populate('currentUser', 'firstname lastname email role')
            .populate('assignedUsers.user', 'firstname lastname email role')
            .lean();

        if (!device) {
            throw new Error('Device not found');
        }

        return device;
    }

    /**
     * Create new device
     */
    static async createDevice(deviceData) {
        const device = new Device(deviceData);
        await device.save();
        
        return await this.getDeviceById(device._id);
    }

    /**
     * Update device
     */
    static async updateDevice(deviceId, updateData) {
        if (!mongoose.isValidObjectId(deviceId)) {
            throw new Error('Invalid device ID format');
        }

        const device = await Device.findByIdAndUpdate(
            deviceId,
            { 
                ...updateData, 
                lastSeen: updateData.status === 'online' ? new Date() : updateData.lastSeen 
            },
            { new: true, runValidators: true }
        );

        if (!device) {
            throw new Error('Device not found or update failed');
        }

        return await this.getDeviceById(device._id);
    }

    /**
     * Delete device
     */
    static async deleteDevice(deviceId) {
        if (!mongoose.isValidObjectId(deviceId)) {
            throw new Error('Invalid device ID format');
        }

        const device = await Device.findByIdAndDelete(deviceId);
        
        if (!device) {
            throw new Error('Device not found');
        }

        return device;
    }

    /**
     * Get devices with availability status
     */
    static async getAvailableDevices(filters = {}) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        return await Device.find({
            ...filters,
            status: 'online',
            isActive: true,
            lastSeen: { $gte: fiveMinutesAgo }
        })
        .populate('currentUser', 'firstname lastname email')
        .populate('assignedUsers.user', 'firstname lastname email')
        .sort({ name: 1 })
        .lean();
    }

    /**
     * Assign user to device
     */
    static async assignUser(deviceId, userId, permissions = ['read']) {
        if (!mongoose.isValidObjectId(deviceId) || !mongoose.isValidObjectId(userId)) {
            throw new Error('Invalid device or user ID format');
        }

        const device = await Device.findById(deviceId);
        if (!device) {
            throw new Error('Device not found');
        }

        // Check if user is already assigned
        const existingAssignment = device.assignedUsers.find(
            assignment => assignment.user.toString() === userId.toString()
        );

        if (existingAssignment) {
            // Update permissions
            existingAssignment.permissions = permissions;
        } else {
            // Add new assignment
            device.assignedUsers.push({
                user: userId,
                permissions,
                assignedAt: new Date()
            });
        }

        await device.save();
        return await this.getDeviceById(deviceId);
    }

    /**
     * Remove user assignment from device
     */
    static async removeUserAssignment(deviceId, userId) {
        if (!mongoose.isValidObjectId(deviceId) || !mongoose.isValidObjectId(userId)) {
            throw new Error('Invalid device or user ID format');
        }

        const device = await Device.findByIdAndUpdate(
            deviceId,
            { 
                $pull: { 
                    assignedUsers: { user: userId } 
                },
                $unset: { 
                    currentUser: userId 
                }
            },
            { new: true }
        );

        if (!device) {
            throw new Error('Device not found');
        }

        return await this.getDeviceById(deviceId);
    }

    /**
     * Set current user for device
     */
    static async setCurrentUser(deviceId, userId) {
        if (!mongoose.isValidObjectId(deviceId) || !mongoose.isValidObjectId(userId)) {
            throw new Error('Invalid device or user ID format');
        }

        const device = await Device.findByIdAndUpdate(
            deviceId,
            { 
                currentUser: userId,
                lastSeen: new Date(),
                status: 'online'
            },
            { new: true, runValidators: true }
        );

        if (!device) {
            throw new Error('Device not found');
        }

        return await this.getDeviceById(deviceId);
    }

    /**
     * Update device status and last seen
     */
    static async updateStatus(deviceId, status, lastSeen = new Date()) {
        if (!mongoose.isValidObjectId(deviceId)) {
            throw new Error('Invalid device ID format');
        }

        const device = await Device.findByIdAndUpdate(
            deviceId,
            { 
                status,
                lastSeen,
                ...(status === 'offline' && { currentUser: null })
            },
            { new: true, runValidators: true }
        );

        if (!device) {
            throw new Error('Device not found');
        }

        return device;
    }

    /**
     * Get devices by location
     */
    static async getDevicesByLocation(building, floor = null, room = null) {
        const locationFilter = { 'location.building': building };
        
        if (floor) locationFilter['location.floor'] = floor;
        if (room) locationFilter['location.room'] = room;

        return await Device.find(locationFilter)
            .populate('currentUser', 'firstname lastname email')
            .populate('assignedUsers.user', 'firstname lastname email')
            .sort({ name: 1 })
            .lean();
    }

    /**
     * Get device statistics
     */
    static async getDeviceStats() {
        const stats = await Device.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    online: { $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] } },
                    offline: { $sum: { $cond: [{ $eq: ['$status', 'offline'] }, 1, 0] } },
                    maintenance: { $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] } },
                    inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
                    active: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } }
                }
            }
        ]);

        const typeStats = await Device.aggregate([
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);

        const locationStats = await Device.aggregate([
            {
                $group: {
                    _id: {
                        building: '$location.building',
                        floor: '$location.floor'
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        return {
            overview: stats[0] || {
                total: 0,
                online: 0,
                offline: 0,
                maintenance: 0,
                inactive: 0,
                active: 0
            },
            byType: typeStats,
            byLocation: locationStats
        };
    }

    /**
     * Bulk update device statuses
     */
    static async bulkUpdateStatus(deviceIds, status) {
        if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
            throw new Error('Invalid device IDs array');
        }

        const validDeviceIds = deviceIds.filter(id => mongoose.isValidObjectId(id));
        
        if (validDeviceIds.length === 0) {
            throw new Error('No valid device IDs provided');
        }

        const result = await Device.updateMany(
            { _id: { $in: validDeviceIds } },
            { 
                status,
                lastSeen: new Date(),
                ...(status === 'offline' && { currentUser: null })
            }
        );

        return {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount
        };
    }

    /**
     * Find devices needing maintenance
     */
    static async getMaintenanceAlerts() {
        const now = new Date();
        
        return await Device.find({
            $or: [
                { 'maintenance.nextMaintenance': { $lte: now } },
                { lastSeen: { $lt: new Date(now - 24 * 60 * 60 * 1000) } }, // offline > 24hrs
                { status: 'maintenance' }
            ],
            isActive: true
        })
        .populate('currentUser', 'firstname lastname email')
        .sort({ 'maintenance.nextMaintenance': 1 })
        .lean();
    }
}

module.exports = DeviceRepository;