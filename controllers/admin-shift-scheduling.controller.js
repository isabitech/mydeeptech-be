const HVNCShift = require('../models/hvnc-shift.model');
const DTUser = require('../models/dtUser.model');
const HVNCDevice = require('../models/hvnc-device.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');

/**
 * GET /api/hvnc/admin/shifts
 * Fetch all shifts with filtering
 */
const getAllShifts = async (req, res) => {
  try {
    const { 
      status, // active, inactive, expired
      user_id, 
      device_id, 
      start_date, 
      end_date 
    } = req.query;

    // Build query filter
    let query = {};
    
    if (status) {
      if (status === 'active') {
        query.status = 'active';
        query.$or = [
          { end_date: null },
          { end_date: { $gte: new Date() } }
        ];
      } else if (status === 'inactive') {
        query.status = 'inactive';
      } else if (status === 'expired') {
        query.end_date = { $lt: new Date() };
      }
    }

    if (user_id) {
      const user = await DTUser.findById(user_id).select('email');
      if (user) {
        query.user_email = user.email;
      }
    }

    if (device_id) {
      query.device_id = device_id;
    }

    if (start_date && end_date) {
      query.start_date = {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      };
    }

    const shifts = await HVNCShift.find(query)
      .sort({ created_at: -1 })
      .lean();

    // Transform shifts for frontend
    const shiftData = await Promise.all(shifts.map(async (shift) => {
      // Get user info
      const user = await DTUser.findOne({ email: shift.user_email }).select('fullName email');
      
      // Get device info
      const device = await HVNCDevice.findOne({ device_id: shift.device_id }).select('pc_name device_id');

      // Calculate status
      let statusText = 'Active';
      if (shift.status === 'inactive') {
        statusText = 'Inactive';
      } else if (shift.end_date && new Date(shift.end_date) < new Date()) {
        statusText = 'Expired';
      }

      // Format schedule display
      let scheduleDisplay = 'One-time';
      if (shift.is_recurring) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayNames = shift.days_of_week ? shift.days_of_week.map(day => days[day]).join(', ') : 'Daily';
        scheduleDisplay = `${dayNames} ${shift.start_time} - ${shift.end_time}`;
      } else {
        const startDate = new Date(shift.start_date).toLocaleDateString();
        scheduleDisplay = `${startDate} ${shift.start_time} - ${shift.end_time}`;
      }

      return {
        id: shift._id,
        userName: user?.fullName || 'Unknown User',
        userEmail: shift.user_email,
        deviceName: device?.pc_name || 'Unknown Device',
        deviceId: shift.device_id,
        schedule: scheduleDisplay,
        status: statusText,
        startDate: shift.start_date,
        endDate: shift.end_date,
        startTime: shift.start_time,
        endTime: shift.end_time,
        isRecurring: shift.is_recurring,
        daysOfWeek: shift.days_of_week,
        timezone: shift.timezone || 'UTC'
      };
    }));

    res.json({
      total: shiftData.length,
      shifts: shiftData
    });

  } catch (error) {
    console.error('Get shifts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shifts'
    });
  }
};

/**
 * GET /api/hvnc/admin/shifts/:shiftId
 * Get shift details for editing
 */
const getShiftDetail = async (req, res) => {
  try {
    const { shiftId } = req.params;

    const shift = await HVNCShift.findById(shiftId).lean();
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Shift not found'
      });
    }

    // Get user info
    const user = await DTUser.findOne({ email: shift.user_email }).select('_id fullName email');
    
    // Get device info
    const device = await HVNCDevice.findOne({ device_id: shift.device_id }).select('_id pc_name device_id');

    res.json({
      id: shift._id,
      userId: user?._id?.toString(),
      userName: user?.fullName || 'Unknown User',
      userEmail: shift.user_email,
      deviceId: device?._id?.toString(),
      deviceIdValue: shift.device_id,
      deviceName: device?.pc_name || 'Unknown Device',
      startDate: shift.start_date,
      endDate: shift.end_date,
      startTime: shift.start_time,
      endTime: shift.end_time,
      isRecurring: shift.is_recurring,
      daysOfWeek: shift.days_of_week || [],
      timezone: shift.timezone || 'UTC',
      status: shift.status
    });

  } catch (error) {
    console.error('Get shift detail error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shift details'
    });
  }
};

/**
 * POST /api/hvnc/admin/shifts
 * Create a new shift
 */
const createShift = async (req, res) => {
  try {
    const {
      userId,
      deviceId,
      startDate,
      endDate,
      startTime,
      endTime,
      isRecurring,
      daysOfWeek,
      timezone
    } = req.body;

    // Validate required fields
    if (!userId || !deviceId || !startDate || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Get user and device info
    const user = await DTUser.findById(userId).select('email fullName');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const device = await HVNCDevice.findById(deviceId).select('device_id pc_name');
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    // Check for conflicts
    const existingShift = await HVNCShift.findOne({
      user_email: user.email,
      device_id: device.device_id,
      status: 'active',
      $or: [
        { end_date: null },
        { end_date: { $gte: new Date(startDate) } }
      ]
    });

    if (existingShift) {
      return res.status(409).json({
        success: false,
        error: 'User already has an active shift for this device'
      });
    }

    // Create shift
    const shift = await HVNCShift.create({
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

    // Log shift creation
    await HVNCActivityLog.logUserEvent(user.email, 'shift_created', {
      device_id: device.device_id,
      device_name: device.pc_name,
      schedule: `${startTime} - ${endTime}`,
      is_recurring: isRecurring,
      created_by: req.admin?.email || 'admin'
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    // Return created shift
    res.json({
      id: shift._id,
      userName: user.fullName,
      userEmail: user.email,
      deviceName: device.pc_name,
      deviceId: device.device_id,
      schedule: isRecurring 
        ? `${startTime} - ${endTime} (recurring)`
        : `${new Date(startDate).toLocaleDateString()} ${startTime} - ${endTime}`,
      status: 'Active',
      startDate: shift.start_date,
      endDate: shift.end_date,
      startTime: shift.start_time,
      endTime: shift.end_time,
      isRecurring: shift.is_recurring,
      daysOfWeek: shift.days_of_week,
      timezone: shift.timezone
    });

  } catch (error) {
    console.error('Create shift error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create shift'
    });
  }
};

/**
 * PUT /api/hvnc/admin/shifts/:shiftId
 * Update an existing shift
 */
const updateShift = async (req, res) => {
  try {
    const { shiftId } = req.params;
    const {
      userId,
      deviceId,
      startDate,
      endDate,
      startTime,
      endTime,
      isRecurring,
      daysOfWeek,
      timezone,
      status
    } = req.body;

    const shift = await HVNCShift.findById(shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Shift not found'
      });
    }

    // Get new user and device if changed
    if (userId) {
      const user = await DTUser.findById(userId).select('email fullName');
      if (user) {
        shift.user_email = user.email;
      }
    }

    if (deviceId) {
      const device = await HVNCDevice.findById(deviceId).select('device_id pc_name');
      if (device) {
        shift.device_id = device.device_id;
      }
    }

    // Update shift properties
    if (startDate) shift.start_date = new Date(startDate);
    if (endDate !== undefined) shift.end_date = endDate ? new Date(endDate) : null;
    if (startTime) shift.start_time = startTime;
    if (endTime) shift.end_time = endTime;
    if (isRecurring !== undefined) shift.is_recurring = isRecurring;
    if (daysOfWeek) shift.days_of_week = daysOfWeek;
    if (timezone) shift.timezone = timezone;
    if (status) shift.status = status;

    await shift.save();

    // Log shift update
    await HVNCActivityLog.logUserEvent(shift.user_email, 'shift_updated', {
      shift_id: shift._id,
      updated_by: req.admin?.email || 'admin'
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    // Return updated shift detail
    const updatedShift = await getShiftDetailById(shiftId);
    res.json(updatedShift);

  } catch (error) {
    console.error('Update shift error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update shift'
    });
  }
};

/**
 * DELETE /api/hvnc/admin/shifts/:shiftId
 * Delete a shift
 */
const deleteShift = async (req, res) => {
  try {
    const { shiftId } = req.params;

    const shift = await HVNCShift.findById(shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Shift not found'
      });
    }

    // Log shift deletion
    await HVNCActivityLog.logUserEvent(shift.user_email, 'shift_deleted', {
      shift_id: shift._id,
      device_id: shift.device_id,
      deleted_by: req.admin?.email || 'admin'
    }, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    await HVNCShift.findByIdAndDelete(shiftId);

    res.json({
      success: true,
      message: 'Shift deleted successfully'
    });

  } catch (error) {
    console.error('Delete shift error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete shift'
    });
  }
};

/**
 * GET /api/hvnc/admin/shifts/calendar
 * Get shifts for calendar display
 */
const getShiftsCalendar = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    // Default to current month if not provided
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    
    // Calculate date range for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    // Get shifts for the month
    const shifts = await HVNCShift.find({
      $or: [
        // Shifts starting in this month
        {
          start_date: {
            $gte: startDate,
            $lte: endDate
          }
        },
        // Recurring shifts that are active during this month
        {
          is_recurring: true,
          start_date: { $lte: endDate },
          $or: [
            { end_date: null },
            { end_date: { $gte: startDate } }
          ]
        }
      ]
    }).lean();

    // Transform shifts into calendar events
    const calendarEvents = [];
    
    for (const shift of shifts) {
      // Get user and device info
      const user = await DTUser.findOne({ email: shift.user_email }).select('fullName');
      const device = await HVNCDevice.findOne({ device_id: shift.device_id }).select('pc_name');

      const eventTitle = `${user?.fullName || 'Unknown'} - ${device?.pc_name || 'Unknown'}`;
      
      if (shift.is_recurring) {
        // Generate events for each day of week in the month
        const daysOfWeek = shift.days_of_week || [0,1,2,3,4,5,6];
        
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
          if (daysOfWeek.includes(date.getDay())) {
            calendarEvents.push({
              id: `${shift._id}_${date.toISOString().split('T')[0]}`,
              shiftId: shift._id.toString(),
              title: eventTitle,
              date: date.toISOString().split('T')[0],
              startTime: shift.start_time,
              endTime: shift.end_time,
              user: user?.fullName || 'Unknown',
              device: device?.pc_name || 'Unknown',
              isRecurring: true,
              status: shift.status
            });
          }
        }
      } else {
        // Single event
        const eventDate = new Date(shift.start_date);
        if (eventDate >= startDate && eventDate <= endDate) {
          calendarEvents.push({
            id: shift._id.toString(),
            shiftId: shift._id.toString(),
            title: eventTitle,
            date: eventDate.toISOString().split('T')[0],
            startTime: shift.start_time,
            endTime: shift.end_time,
            user: user?.fullName || 'Unknown',
            device: device?.pc_name || 'Unknown',
            isRecurring: false,
            status: shift.status
          });
        }
      }
    }

    res.json({
      month: targetMonth,
      year: targetYear,
      events: calendarEvents
    });

  } catch (error) {
    console.error('Get calendar shifts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch calendar shifts'
    });
  }
};

/**
 * Helper function to get shift detail by ID
 */
async function getShiftDetailById(shiftId) {
  const shift = await HVNCShift.findById(shiftId).lean();
  const user = await DTUser.findOne({ email: shift.user_email }).select('fullName');
  const device = await HVNCDevice.findOne({ device_id: shift.device_id }).select('pc_name');
  
  return {
    id: shift._id,
    userName: user?.fullName || 'Unknown User',
    userEmail: shift.user_email,
    deviceName: device?.pc_name || 'Unknown Device',
    deviceId: shift.device_id,
    schedule: shift.is_recurring 
      ? `${shift.start_time} - ${shift.end_time} (recurring)`
      : `${new Date(shift.start_date).toLocaleDateString()} ${shift.start_time} - ${shift.end_time}`,
    status: shift.status,
    startDate: shift.start_date,
    endDate: shift.end_date,
    startTime: shift.start_time,
    endTime: shift.end_time,
    isRecurring: shift.is_recurring,
    daysOfWeek: shift.days_of_week,
    timezone: shift.timezone
  };
}

module.exports = {
  getAllShifts,
  getShiftDetail,
  createShift,
  updateShift,
  deleteShift,
  getShiftsCalendar
};