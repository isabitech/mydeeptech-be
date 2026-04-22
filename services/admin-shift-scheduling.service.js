// Layer: Service
/**
 * Admin Shift Scheduling Service
 * Contains all business logic for shift management
 */

const DTUserRepository = require('../repositories/dtUser.repository');
const HVNCDeviceRepository = require('../repositories/hvnc-device.repository');
const HVNCShiftRepository = require('../repositories/hvnc-shift.repository');
const HVNCActivityLogRepository = require('../repositories/hvnc-activity-log.repository');

class AdminShiftSchedulingService {
  /**
   * Get all shifts with filtering
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Shifts data
   */
  async getAllShifts(filters = {}) {
    const query = {};
    
    if (filters.status) {
      if (filters.status === 'active') {
        query.status = 'active';
        query.$or = [{ end_date: null }, { end_date: { $gte: new Date() } }];
      } else if (filters.status === 'inactive') {
        query.status = 'inactive';
      } else if (filters.status === 'expired') {
        query.end_date = { $lt: new Date() };
      }
    }

    if (filters.user_id) {
      try {
        const user = await DTUserRepository.findById(filters.user_id);
        if (user) {
          query.user_email = user.email;
        }
      } catch (err) {
        // User not found
      }
    }

    if (filters.device_id) {
      query.device_id = filters.device_id;
    }

    if (filters.start_date && filters.end_date) {
      query.start_date = {
        $gte: new Date(filters.start_date),
        $lte: new Date(filters.end_date)
      };
    }

    const shifts = await HVNCShiftRepository.find(query);
    
    const shiftData = await Promise.all(
      shifts.map(async (shift) => this._enrichShiftData(shift))
    );

    return {
      total: shiftData.length,
      shifts: shiftData
    };
  }

  /**
   * Get shift detail
   * @param {string} shiftId - Shift ID
   * @returns {Promise<Object>} Shift detail
   */
  async getShiftDetail(shiftId) {
    const shift = await HVNCShiftRepository.findById(shiftId);
    if (!shift) {
      throw { status: 404, message: 'Shift not found' };
    }

    return this._enrichShiftData(shift, true);
  }

  /**
   * Create a new shift
   * @param {Object} data - Shift data
   * @returns {Promise<Object>} Created shift
   */
  async createShift(data, req) {
    const { userId, deviceId, startDate, endDate, startTime, endTime, isRecurring, daysOfWeek, timezone } = data;

    if (!userId || !deviceId || !startDate || !startTime || !endTime) {
      throw { status: 400, message: 'Required fields missing' };
    }

    const user = await DTUserRepository.findById(userId);
    if (!user) {
      throw { status: 404, message: 'User not found' };
    }

    const device = await HVNCDeviceRepository.findById(deviceId);
    if (!device) {
      throw { status: 404, message: 'Device not found' };
    }

    // Check for conflicts
    const existingShift = await HVNCShiftRepository.findOne({
      user_email: user.email,
      device_id: device.device_id,
      status: 'active',
      $or: [
        { end_date: null },
        { end_date: { $gte: new Date(startDate) } }
      ]
    });

    if (existingShift) {
      throw { status: 409, message: 'User already has an active shift on this device' };
    }

    const shift = await HVNCShiftRepository.create({
      user_email: user.email,
      device_id: device.device_id,
      start_date: new Date(startDate),
      end_date: endDate ? new Date(endDate) : null,
      start_time: startTime,
      end_time: endTime,
      is_recurring: isRecurring || false,
      days_of_week: isRecurring ? daysOfWeek || [0,1,2,3,4,5,6] : [],
      timezone: timezone || 'UTC',
      status: 'active'
    });

    // Log creation
    try {
      const ip = req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown';
      const userAgent = req?.headers?.['user-agent'] || 'unknown';

      await HVNCActivityLogRepository.create({
        user_email: user.email,
        event_type: 'shift_created',
        description: `Shift created for user on device ${device.pc_name}`,
        context: {
          device_id: device.device_id,
          device_name: device.pc_name,
          schedule: `${startTime} - ${endTime}`,
          is_recurring: isRecurring,
          ip_address: ip,
          user_agent: userAgent
        }
      });
    } catch (err) {
      // Logging error
    }

    return this._enrichShiftData(shift);
  }

  /**
   * Update a shift
   * @param {string} shiftId - Shift ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated shift
   */
  async updateShift(shiftId, data, req) {
    const shift = await HVNCShiftRepository.findById(shiftId);
    if (!shift) {
      throw { status: 404, message: 'Shift not found' };
    }

    const { userId, deviceId, startDate, endDate, startTime, endTime, isRecurring, daysOfWeek, timezone, status } = data;

    if (userId) {
      const user = await DTUserRepository.findById(userId);
      if (user) shift.user_email = user.email;
    }

    if (deviceId) {
      const device = await HVNCDeviceRepository.findById(deviceId);
      if (device) shift.device_id = device.device_id;
    }

    if (startDate) shift.start_date = new Date(startDate);
    if (endDate !== undefined) shift.end_date = endDate ? new Date(endDate) : null;
    if (startTime) shift.start_time = startTime;
    if (endTime) shift.end_time = endTime;
    if (isRecurring !== undefined) shift.is_recurring = isRecurring;
    if (daysOfWeek) shift.days_of_week = daysOfWeek;
    if (timezone) shift.timezone = timezone;
    if (status) shift.status = status;

    await shift.save();

    // Log update
    try {
      const ip = req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown';
      const userAgent = req?.headers?.['user-agent'] || 'unknown';

      await HVNCActivityLogRepository.create({
        user_email: shift.user_email,
        event_type: 'shift_updated',
        description: `Shift updated`,
        context: { 
          shift_id: shift._id,
          ip_address: ip,
          user_agent: userAgent
        }
      });
    } catch (err) {
      // Logging error
    }

    return this._enrichShiftData(shift);
  }

  /**
   * Delete shift
   * @param {string} shiftId - Shift ID
   * @returns {Promise<Object>} Success response
   */
  async deleteShift(shiftId) {
    const shift = await HVNCShiftRepository.findById(shiftId);
    if (!shift) {
      throw { status: 404, message: 'Shift not found' };
    }

    // Log deletion
    try {
      await HVNCActivityLogRepository.create({
        user_email: shift.user_email,
        event_type: 'shift_deleted',
        description: `Shift deleted`,
        context: {
          shift_id: shift._id,
          device_id: shift.device_id
        }
      });
    } catch (err) {
      // Logging error
    }

    await HVNCShiftRepository.deleteById(shiftId);

    return { success: true, message: 'Shift deleted successfully' };
  }

  /**
   * Get shifts for calendar display
   * @param {Object} params - Month and year
   * @returns {Promise<Object>} Calendar events
   */
  async getShiftsCalendar(params = {}) {
    const targetMonth = params.month ? parseInt(params.month) : new Date().getMonth() + 1;
    const targetYear = params.year ? parseInt(params.year) : new Date().getFullYear();
    
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const shifts = await HVNCShiftRepository.find({
      $or: [
        {
          start_date: {
            $gte: startDate,
            $lte: endDate
          }
        },
        {
          is_recurring: true,
          start_date: { $lte: endDate },
          $or: [
            { end_date: null },
            { end_date: { $gte: startDate } }
          ]
        }
      ]
    });

    const calendarEvents = [];
    
    for (const shift of shifts) {
      if (shift.is_recurring) {
        // Add events for each day in the month
        for (let day = 1; day <= new Date(targetYear, targetMonth, 0).getDate(); day++) {
          const eventDate = new Date(targetYear, targetMonth - 1, day);
          const dayOfWeek = eventDate.getDay();
          
          if (shift.days_of_week.includes(dayOfWeek)) {
            const enriched = await this._enrichShiftData(shift);
            calendarEvents.push({
              id: `${shift._id}_${eventDate.toISOString().split('T')[0]}`,
              shiftId: shift._id,
              date: eventDate.toISOString().split('T')[0],
              startTime: shift.start_time,
              endTime: shift.end_time,
              title: `${enriched.userName} - ${enriched.deviceName}`,
              user: enriched.userName,
              device: enriched.deviceName,
              isRecurring: true,
              status: shift.status
            });
          }
        }
      } else {
        // Single event
        const enriched = await this._enrichShiftData(shift);
        calendarEvents.push({
          id: shift._id.toString(),
          shiftId: shift._id,
          date: shift.start_date.toISOString().split('T')[0],
          startTime: shift.start_time,
          endTime: shift.end_time,
          title: `${enriched.userName} - ${enriched.deviceName}`,
          user: enriched.userName,
          device: enriched.deviceName,
          isRecurring: false,
          status: shift.status
        });
      }
    }

    return {
      month: targetMonth,
      year: targetYear,
      events: calendarEvents
    };
  }

  // ===== Helper Methods =====

  async _enrichShiftData(shift, detailed = false) {
    try {
      const user = await DTUserRepository.findOne({ email: shift.user_email });
      const device = await HVNCDeviceRepository.findOne({ device_id: shift.device_id });

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      let daysString = 'One-time';
      
      if (shift.is_recurring) {
        daysString = shift.days_of_week && shift.days_of_week.length > 0 
          ? shift.days_of_week.map(day => days[day]).join(', ') 
          : 'Daily';
      }

      const scheduleBase = `${daysString} ${shift.start_time} - ${shift.end_time}`;
      const scheduleString = shift.is_recurring ? `${scheduleBase} (recurring)` : scheduleBase;

      const STATUS_LABELS = {
        active: "Active",
        inactive: "Inactive",
        expired: "Expired",
      };

      const base = {
        id: shift._id,
        userName: user?.fullName || 'Unknown User',
        userEmail: shift.user_email,
        deviceName: device?.pc_name || 'Unknown Device',
        deviceId: shift.device_id,
        status: STATUS_LABELS[shift.status] || shift.status,
        schedule: scheduleString,
        startDate: shift.start_date,
        startTime: shift.start_time,
        endTime: shift.end_time,
        isRecurring: shift.is_recurring,
        daysOfWeek: shift.days_of_week || [],
        assignedDevice: shift.device_id || null,
        assignedUser: shift.user_email || null,
      };

      if (detailed) {
        return {
          ...base,
          userId: user?._id?.toString() || null,
          deviceId: device?._id?.toString() || null,
          deviceIdValue: shift.device_id,
          timezone: shift.timezone || 'UTC',
          endDate: shift.end_date
        };
      }

      return base;
    } catch (err) {
      return { id: shift._id, error: 'Failed to enrich shift data' };
    }
  }
}

module.exports = new AdminShiftSchedulingService();
