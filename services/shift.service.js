const ShiftRepository = require('../repositories/shift.repository');
const DeviceRepository = require('../repositories/device.repository');
const LogRepository = require('../repositories/log.repository');

class ShiftService {

    /**
     * Get all shifts with filtering and pagination
     */
    static async getAllShifts(queryParams) {
        try {
            const result = await ShiftRepository.getShifts(queryParams);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'shift',
                action: 'list_shifts',
                message: `Retrieved ${result.shifts.length} shifts`,
                source: 'api',
                user: {
                    id: queryParams.userId,
                    ipAddress: queryParams.ipAddress
                }
            });

            return result;
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'shift',
                action: 'list_shifts_failed',
                message: `Failed to retrieve shifts: ${error.message}`,
                source: 'api',
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to retrieve shifts: ${error.message}`);
        }
    }

    /**
     * Get active shifts
     */
    static async getActiveShifts(requestContext = {}) {
        try {
            const shifts = await ShiftRepository.getActiveShifts();
            
            await LogRepository.createLog({
                level: 'info',
                category: 'shift',
                action: 'get_active_shifts',
                message: `Retrieved ${shifts.length} active shifts`,
                source: 'api',
                user: requestContext.user
            });

            return shifts;
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'shift',
                action: 'get_active_shifts_failed',
                message: `Failed to get active shifts: ${error.message}`,
                source: 'api',
                user: requestContext.user,
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to get active shifts: ${error.message}`);
        }
    }

    /**
     * Get calendar view of shifts
     */
    static async getCalendarShifts(year, month, requestContext = {}) {
        try {
            const shifts = await ShiftRepository.getCalendarShifts(year, month);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'shift',
                action: 'get_calendar_shifts',
                message: `Retrieved calendar shifts for ${year}-${month}`,
                source: 'api',
                user: requestContext.user
            });

            return {
                year,
                month,
                shifts
            };
        } catch (error) {
            throw new Error(`Failed to get calendar shifts: ${error.message}`);
        }
    }

    /**
     * Create new shift
     */
    static async createShift(shiftData, requestContext = {}) {
        try {
            // Validate required fields
            if (!shiftData.title) {
                throw new Error('Shift title is required');
            }

            if (!shiftData.device || !shiftData.user) {
                throw new Error('Device and user are required for shift');
            }

            if (!shiftData.startTime || !shiftData.endTime) {
                throw new Error('Start time and end time are required');
            }

            // Check for conflicts
            const conflicts = await ShiftRepository.getConflictingShifts(
                shiftData.device,
                shiftData.startTime,
                shiftData.endTime
            );

            if (conflicts.length > 0) {
                throw new Error(`Shift conflicts with existing shift(s)`);
            }

            const shift = await ShiftRepository.createShift(shiftData);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'shift',
                action: 'create_shift',
                message: `Created shift: ${shift.title}`,
                source: 'api',
                user: requestContext.user,
                resource: {
                    type: 'shift',
                    id: shift._id,
                    name: shift.title
                }
            });

            return shift;
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'shift',
                action: 'create_shift_failed',
                message: `Failed to create shift: ${error.message}`,
                source: 'api',
                user: requestContext.user,
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to create shift: ${error.message}`);
        }
    }

    /**
     * Check in/out operations
     */
    static async checkIn(shiftId, requestContext = {}) {
        try {
            const shift = await ShiftRepository.checkIn(shiftId);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'shift',
                action: 'check_in',
                message: `User checked in for shift: ${shift.title}`,
                source: 'api',
                user: requestContext.user,
                resource: {
                    type: 'shift',
                    id: shift._id,
                    name: shift.title
                }
            });

            return shift;
        } catch (error) {
            throw new Error(`Failed to check in: ${error.message}`);
        }
    }

    static async checkOut(shiftId, requestContext = {}) {
        try {
            const shift = await ShiftRepository.checkOut(shiftId);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'shift',
                action: 'check_out',
                message: `User checked out from shift: ${shift.title}`,
                source: 'api',
                user: requestContext.user,
                resource: {
                    type: 'shift',
                    id: shift._id,
                    name: shift.title
                }
            });

            return shift;
        } catch (error) {
            throw new Error(`Failed to check out: ${error.message}`);
        }
    }

    /**
     * Get shifts by device
     */
    static async getShiftsByDevice(deviceId, startDate, endDate, requestContext = {}) {
        try {
            const shifts = await ShiftRepository.getShiftsByDevice(deviceId, startDate, endDate);
            return shifts;
        } catch (error) {
            throw new Error(`Failed to get device shifts: ${error.message}`);
        }
    }

    /**
     * Get shifts by user
     */
    static async getShiftsByUser(userEmail, startDate, endDate, requestContext = {}) {
        try {
            const shifts = await ShiftRepository.getShiftsByUser(userEmail, startDate, endDate);
            return shifts;
        } catch (error) {
            throw new Error(`Failed to get user shifts: ${error.message}`);
        }
    }

    /**
     * Update shift
     */
    static async updateShift(shiftId, updateData, requestContext = {}) {
        try {
            const shift = await ShiftRepository.updateShift(shiftId, updateData);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'shift',
                action: 'update_shift',
                message: `Updated shift: ${shift.title}`,
                source: 'api',
                user: requestContext.user,
                resource: {
                    type: 'shift',
                    id: shift._id,
                    name: shift.title
                }
            });

            return shift;
        } catch (error) {
            throw new Error(`Failed to update shift: ${error.message}`);
        }
    }

    /**
     * Delete shift
     */
    static async deleteShift(shiftId, requestContext = {}) {
        try {
            const shift = await ShiftRepository.getShiftById(shiftId);
            await ShiftRepository.deleteShift(shiftId);
            
            await LogRepository.createLog({
                level: 'warn',
                category: 'shift',
                action: 'delete_shift',
                message: `Deleted shift: ${shift.title}`,
                source: 'api',
                user: requestContext.user,
                resource: {
                    type: 'shift',
                    id: shift._id,
                    name: shift.title
                }
            });

            return { message: 'Shift deleted successfully', shift };
        } catch (error) {
            throw new Error(`Failed to delete shift: ${error.message}`);
        }
    }

    /**
     * Generate recurring shifts
     */
    static async generateRecurringShifts(shiftId, endDate, requestContext = {}) {
        try {
            const count = await ShiftRepository.generateRecurringShifts(shiftId, endDate);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'shift',
                action: 'generate_recurring_shifts',
                message: `Generated ${count} recurring shifts`,
                source: 'api',
                user: requestContext.user
            });

            return { count, message: `Generated ${count} recurring shifts` };
        } catch (error) {
            throw new Error(`Failed to generate recurring shifts: ${error.message}`);
        }
    }
}

module.exports = ShiftService;