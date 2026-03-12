const Shift = require('../models/shift.model');
const mongoose = require('mongoose');

class ShiftRepository {
    constructor() {}

    /**
     * Get shifts with filtering, sorting, and pagination
     */
    static async getShifts(payloads) {
        const { 
            limit = 10, 
            skip = 0, 
            search, 
            status, 
            type,
            priority,
            device,
            user,
            department,
            project,
            startDate,
            endDate,
            isActive,
            sortBy = 'startTime',
            sortOrder = 'asc'
        } = payloads;

        // Build filter query
        const filterQuery = {};
        
        if (search) {
            filterQuery.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (status) {
            filterQuery.status = status;
        }
        
        if (type) {
            filterQuery.type = type;
        }
        
        if (priority) {
            filterQuery.priority = priority;
        }
        
        if (device) {
            filterQuery.device = device;
        }
        
        if (user) {
            filterQuery.user = user;
        }
        
        if (department) {
            filterQuery.department = department;
        }
        
        if (project) {
            filterQuery.project = project;
        }
        
        if (startDate || endDate) {
            filterQuery.$or = [];
            
            if (startDate && endDate) {
                filterQuery.$or.push(
                    { startTime: { $gte: new Date(startDate), $lte: new Date(endDate) } },
                    { endTime: { $gte: new Date(startDate), $lte: new Date(endDate) } },
                    { 
                        startTime: { $lte: new Date(startDate) },
                        endTime: { $gte: new Date(endDate) }
                    }
                );
            } else if (startDate) {
                filterQuery.endTime = { $gte: new Date(startDate) };
            } else if (endDate) {
                filterQuery.startTime = { $lte: new Date(endDate) };
            }
        }
        
        if (isActive !== undefined) {
            filterQuery.isActive = isActive;
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const [totalShifts, shifts] = await Promise.all([
            Shift.countDocuments(filterQuery),
            Shift.find(filterQuery)
                .populate('device', 'name deviceId type status')
                .populate('user', 'firstname lastname email')
                .populate('project', 'name description')
                .populate('cover.coverUser', 'firstname lastname email')
                .populate('approval.approvedBy', 'firstname lastname email')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        return {
            shifts,
            pagination: {
                total: totalShifts,
                page: Math.floor(skip / limit) + 1,
                pages: Math.ceil(totalShifts / limit),
                limit,
                hasNext: (skip + limit) < totalShifts,
                hasPrev: skip > 0
            }
        };
    }

    /**
     * Get shift by ID
     */
    static async getShiftById(shiftId) {
        if (!mongoose.isValidObjectId(shiftId)) {
            throw new Error('Invalid shift ID format');
        }

        const shift = await Shift.findById(shiftId)
            .populate('device', 'name deviceId type status location')
            .populate('user', 'firstname lastname email role')
            .populate('project', 'name description')
            .populate('cover.coverUser', 'firstname lastname email')
            .populate('approval.approvedBy', 'firstname lastname email')
            .populate('notes.createdBy', 'firstname lastname email')
            .lean();

        if (!shift) {
            throw new Error('Shift not found');
        }

        return shift;
    }

    /**
     * Get active shifts
     */
    static async getActiveShifts() {
        const now = new Date();
        
        return await Shift.find({
            status: 'active',
            startTime: { $lte: now },
            endTime: { $gte: now },
            isActive: true
        })
        .populate('device', 'name deviceId type status')
        .populate('user', 'firstname lastname email')
        .sort({ startTime: 1 })
        .lean();
    }

    /**
     * Get shifts for calendar view by month
     */
    static async getCalendarShifts(year, month) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        return await Shift.find({
            $or: [
                { startTime: { $gte: startDate, $lte: endDate } },
                { endTime: { $gte: startDate, $lte: endDate } },
                { 
                    startTime: { $lte: startDate },
                    endTime: { $gte: endDate }
                }
            ],
            isActive: true
        })
        .populate('device', 'name deviceId type')
        .populate('user', 'firstname lastname email')
        .sort({ startTime: 1 })
        .lean();
    }

    /**
     * Get shifts by device
     */
    static async getShiftsByDevice(deviceId, startDate = null, endDate = null) {
        if (!mongoose.isValidObjectId(deviceId)) {
            throw new Error('Invalid device ID format');
        }

        const filterQuery = { device: deviceId, isActive: true };

        if (startDate && endDate) {
            filterQuery.$or = [
                { startTime: { $gte: new Date(startDate), $lte: new Date(endDate) } },
                { endTime: { $gte: new Date(startDate), $lte: new Date(endDate) } },
                { 
                    startTime: { $lte: new Date(startDate) },
                    endTime: { $gte: new Date(endDate) }
                }
            ];
        }

        return await Shift.find(filterQuery)
            .populate('user', 'firstname lastname email')
            .populate('project', 'name')
            .sort({ startTime: 1 })
            .lean();
    }

    /**
     * Get shifts by user
     */
    static async getShiftsByUser(userEmail, startDate = null, endDate = null) {
        // First find user by email to get ObjectId
        const User = mongoose.model('User');
        const user = await User.findOne({ email: userEmail }).select('_id');
        
        if (!user) {
            throw new Error('User not found');
        }

        const filterQuery = { user: user._id, isActive: true };

        if (startDate && endDate) {
            filterQuery.$or = [
                { startTime: { $gte: new Date(startDate), $lte: new Date(endDate) } },
                { endTime: { $gte: new Date(startDate), $lte: new Date(endDate) } },
                { 
                    startTime: { $lte: new Date(startDate) },
                    endTime: { $gte: new Date(endDate) }
                }
            ];
        }

        return await Shift.find(filterQuery)
            .populate('device', 'name deviceId type status')
            .populate('project', 'name')
            .sort({ startTime: 1 })
            .lean();
    }

    /**
     * Create new shift
     */
    static async createShift(shiftData) {
        const shift = new Shift(shiftData);
        await shift.save();
        
        return await this.getShiftById(shift._id);
    }

    /**
     * Update shift
     */
    static async updateShift(shiftId, updateData) {
        if (!mongoose.isValidObjectId(shiftId)) {
            throw new Error('Invalid shift ID format');
        }

        const shift = await Shift.findByIdAndUpdate(
            shiftId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!shift) {
            throw new Error('Shift not found or update failed');
        }

        return await this.getShiftById(shift._id);
    }

    /**
     * Delete shift
     */
    static async deleteShift(shiftId) {
        if (!mongoose.isValidObjectId(shiftId)) {
            throw new Error('Invalid shift ID format');
        }

        const shift = await Shift.findByIdAndDelete(shiftId);
        
        if (!shift) {
            throw new Error('Shift not found');
        }

        return shift;
    }

    /**
     * Check for shift conflicts
     */
    static async getConflictingShifts(deviceId, startTime, endTime, excludeShiftId = null) {
        if (!mongoose.isValidObjectId(deviceId)) {
            throw new Error('Invalid device ID format');
        }

        const filterQuery = {
            device: deviceId,
            status: { $in: ['scheduled', 'active'] },
            $or: [
                {
                    startTime: { $lt: new Date(endTime) },
                    endTime: { $gt: new Date(startTime) }
                }
            ]
        };

        if (excludeShiftId && mongoose.isValidObjectId(excludeShiftId)) {
            filterQuery._id = { $ne: excludeShiftId };
        }

        return await Shift.find(filterQuery)
            .populate('user', 'firstname lastname email')
            .sort({ startTime: 1 })
            .lean();
    }

    /**
     * Check in/out for shift
     */
    static async checkIn(shiftId, checkInTime = new Date()) {
        if (!mongoose.isValidObjectId(shiftId)) {
            throw new Error('Invalid shift ID format');
        }

        const shift = await Shift.findByIdAndUpdate(
            shiftId,
            { 
                checkInTime,
                actualStartTime: checkInTime,
                status: 'active'
            },
            { new: true }
        );

        if (!shift) {
            throw new Error('Shift not found');
        }

        return await this.getShiftById(shiftId);
    }

    /**
     * Check out from shift
     */
    static async checkOut(shiftId, checkOutTime = new Date()) {
        if (!mongoose.isValidObjectId(shiftId)) {
            throw new Error('Invalid shift ID format');
        }

        const shift = await Shift.findByIdAndUpdate(
            shiftId,
            { 
                checkOutTime,
                actualEndTime: checkOutTime,
                status: 'completed'
            },
            { new: true }
        );

        if (!shift) {
            throw new Error('Shift not found');
        }

        // Calculate overtime if applicable
        if (shift.actualEndTime && shift.endTime) {
            const overtimeMs = Math.max(0, shift.actualEndTime - shift.endTime);
            const overtimeMinutes = Math.round(overtimeMs / (1000 * 60));
            
            if (overtimeMinutes > 0) {
                shift['overtime.actualMinutes'] = overtimeMinutes;
                await shift.save();
            }
        }

        return await this.getShiftById(shiftId);
    }

    /**
     * Add break to shift
     */
    static async addBreak(shiftId, breakData) {
        if (!mongoose.isValidObjectId(shiftId)) {
            throw new Error('Invalid shift ID format');
        }

        const shift = await Shift.findByIdAndUpdate(
            shiftId,
            { 
                $push: { 'breakTime.breaks': breakData },
                $inc: { 'breakTime.total': breakData.duration || 0 }
            },
            { new: true }
        );

        if (!shift) {
            throw new Error('Shift not found');
        }

        return await this.getShiftById(shiftId);
    }

    /**
     * Get shift statistics
     */
    static async getShiftStats(filters = {}) {
        const matchStage = { 
            isActive: true,
            ...filters
        };

        const stats = await Shift.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    scheduled: { $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] } },
                    active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                    completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                    cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
                    noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
                    avgDuration: { 
                        $avg: {
                            $divide: [
                                { $subtract: ['$endTime', '$startTime'] },
                                60000 // Convert to minutes
                            ]
                        }
                    },
                    totalOvertimeMinutes: { $sum: '$overtime.actualMinutes' }
                }
            }
        ]);

        const departmentStats = await Shift.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$department',
                    count: { $sum: 1 },
                    totalHours: { 
                        $sum: {
                            $divide: [
                                { $subtract: ['$endTime', '$startTime'] },
                                3600000 // Convert to hours
                            ]
                        }
                    }
                }
            }
        ]);

        return {
            overview: stats[0] || {
                total: 0,
                scheduled: 0,
                active: 0,
                completed: 0,
                cancelled: 0,
                noShow: 0,
                avgDuration: 0,
                totalOvertimeMinutes: 0
            },
            byDepartment: departmentStats
        };
    }

    /**
     * Get upcoming shifts (next 7 days)
     */
    static async getUpcomingShifts(days = 7) {
        const now = new Date();
        const future = new Date();
        future.setDate(now.getDate() + days);

        return await Shift.find({
            startTime: { $gte: now, $lte: future },
            status: 'scheduled',
            isActive: true
        })
        .populate('device', 'name deviceId type')
        .populate('user', 'firstname lastname email')
        .sort({ startTime: 1 })
        .lean();
    }

    /**
     * Generate recurring shifts
     */
    static async generateRecurringShifts(parentShiftId, endDate) {
        if (!mongoose.isValidObjectId(parentShiftId)) {
            throw new Error('Invalid parent shift ID format');
        }

        const parentShift = await Shift.findById(parentShiftId);
        if (!parentShift || parentShift.recurrence.type === 'none') {
            throw new Error('Invalid parent shift or no recurrence pattern');
        }

        const shifts = [];
        const { type, interval, daysOfWeek, maxOccurrences } = parentShift.recurrence;
        
        let currentDate = new Date(parentShift.startTime);
        let occurrenceCount = 0;
        const maxDate = new Date(endDate);
        const duration = parentShift.endTime - parentShift.startTime;

        while (currentDate <= maxDate && (!maxOccurrences || occurrenceCount < maxOccurrences)) {
            let nextDate = new Date(currentDate);
            
            switch (type) {
                case 'daily':
                    nextDate.setDate(currentDate.getDate() + interval);
                    break;
                case 'weekly':
                    if (daysOfWeek && daysOfWeek.length > 0) {
                        // Find next occurrence based on days of week
                        let found = false;
                        for (let i = 1; i <= 7 && !found; i++) {
                            const testDate = new Date(currentDate);
                            testDate.setDate(currentDate.getDate() + i);
                            if (daysOfWeek.includes(testDate.getDay())) {
                                nextDate = testDate;
                                found = true;
                            }
                        }
                        if (!found) {
                            nextDate.setDate(currentDate.getDate() + 7 * interval);
                        }
                    } else {
                        nextDate.setDate(currentDate.getDate() + 7 * interval);
                    }
                    break;
                case 'monthly':
                    nextDate.setMonth(currentDate.getMonth() + interval);
                    break;
            }

            if (nextDate > maxDate) break;

            const shiftData = {
                ...parentShift.toObject(),
                _id: undefined,
                startTime: nextDate,
                endTime: new Date(nextDate.getTime() + duration),
                parentShift: parentShiftId,
                status: 'scheduled',
                actualStartTime: null,
                actualEndTime: null,
                checkInTime: null,
                checkOutTime: null
            };

            shifts.push(shiftData);
            currentDate = nextDate;
            occurrenceCount++;
        }

        if (shifts.length > 0) {
            await Shift.insertMany(shifts);
        }

        return shifts.length;
    }
}

module.exports = ShiftRepository;