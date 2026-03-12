const express = require('express');
const {
    getAllShifts,
    getActiveShifts,
    getCalendarShifts,
    createShift,
    updateShift,
    deleteShift,
    getShiftsByDevice,
    getShiftsByUser
} = require('../controllers/shift.controller');

const router = express.Router();

// Shift Routes

/**
 * @route GET /api/shifts
 * @desc List shifts
 * @access Private
 */
router.get('/', getAllShifts);

/**
 * @route GET /api/shifts/active
 * @desc Get currently active shifts
 * @access Private
 */
router.get('/active', getActiveShifts);

/**
 * @route GET /api/shifts/calendar/:month
 * @desc Get calendar view for specific month
 * @access Private
 */
router.get('/calendar/:month', getCalendarShifts);

/**
 * @route POST /api/shifts
 * @desc Create shift
 * @access Private
 */
router.post('/', createShift);

/**
 * @route PUT /api/shifts/:id
 * @desc Update shift
 * @access Private
 */
router.put('/:id', updateShift);

/**
 * @route DELETE /api/shifts/:id
 * @desc Delete shift
 * @access Private
 */
router.delete('/:id', deleteShift);

/**
 * @route GET /api/shifts/device/:device_id
 * @desc Get device schedule
 * @access Private
 */
router.get('/device/:device_id', getShiftsByDevice);

/**
 * @route GET /api/shifts/user/:email
 * @desc Get user schedule
 * @access Private
 */
router.get('/user/:email', getShiftsByUser);

module.exports = router;