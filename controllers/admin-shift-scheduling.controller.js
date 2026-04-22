const adminShiftSchedulingService = require("../services/admin-shift-scheduling.service");

/**
 * GET /api/hvnc/admin/shifts
 * Fetch all shifts with filtering
 */
const getAllShifts = async (req, res) => {
  try {
    const { status, user_id, device_id, start_date, end_date } = req.query;
    const data = await adminShiftSchedulingService.getAllShifts({
      status,
      user_id,
      device_id,
      start_date,
      end_date,
    });
    res.json({
      total: data.shifts ? data.shifts.length : data.total,
      shifts: data.shifts,
    });
  } catch (error) {
    console.error("Get shifts error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch shifts",
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
    const data = await adminShiftSchedulingService.getShiftDetail(shiftId);
    res.json(data);
  } catch (error) {
    console.error("Get shift detail error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to fetch shift details",
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
      timezone,
    } = req.body;
    // Validate required fields - EXACT match to original
    if (!userId || !deviceId || !startDate || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const data = await adminShiftSchedulingService.createShift({
      userId,
      deviceId,
      startDate,
      endDate,
      startTime,
      endTime,
      isRecurring,
      daysOfWeek,
      timezone,
    }, req);
    res.json(data);
  } catch (error) {
    console.error("Create shift error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to create shift",
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
      status,
    } = req.body;
    const data = await adminShiftSchedulingService.updateShift(shiftId, {
      userId,
      deviceId,
      startDate,
      endDate,
      startTime,
      endTime,
      isRecurring,
      daysOfWeek,
      timezone,
      status,
    }, req);
    res.json(data);
  } catch (error) {
    console.error("Update shift error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to update shift",
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
    await adminShiftSchedulingService.deleteShift(shiftId);
    res.json({
      success: true,
      message: "Shift deleted successfully",
    });
  } catch (error) {
    console.error("Delete shift error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to delete shift",
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
    const data = await adminShiftSchedulingService.getShiftsCalendar({
      month,
      year,
    });
    res.json(data);
  } catch (error) {
    console.error("Get calendar shifts error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to fetch calendar shifts",
    });
  }
};

module.exports = {
  getAllShifts,
  getShiftDetail,
  createShift,
  updateShift,
  deleteShift,
  getShiftsCalendar,
};
