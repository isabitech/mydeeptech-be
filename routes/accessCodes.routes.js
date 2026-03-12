const express = require('express');
const {
    getAllAccessCodes,
    generateAccessCode,
    validateAccessCode,
    revokeAccessCode,
    getUsageHistory,
    getAccessCodeStats,
    getExpiringCodes,
    bulkRevokeAccessCodes
} = require('../controllers/accessCode.controller');

const router = express.Router();

// Access Code Routes

/**
 * @route GET /api/codes
 * @desc List access codes
 * @access Private
 */
router.get('/', getAllAccessCodes);

/**
 * @route GET /api/codes/expiring
 * @desc Get expiring codes
 * @access Private
 */
router.get('/expiring', getExpiringCodes);

/**
 * @route GET /api/codes/stats
 * @desc Get access code statistics
 * @access Private
 */
router.get('/stats', getAccessCodeStats);

/**
 * @route POST /api/codes/generate
 * @desc Generate new access code
 * @access Private
 */
router.post('/generate', generateAccessCode);

/**
 * @route POST /api/codes/validate
 * @desc Validate access code
 * @access Public
 */
router.post('/validate', validateAccessCode);

/**
 * @route POST /api/codes/bulk-revoke
 * @desc Bulk revoke access codes
 * @access Private
 */
router.post('/bulk-revoke', bulkRevokeAccessCodes);

/**
 * @route PUT /api/codes/:code/revoke
 * @desc Revoke access code
 * @access Private
 */
router.put('/:code/revoke', revokeAccessCode);

/**
 * @route GET /api/codes/:code/usage
 * @desc Get usage history for access code
 * @access Private
 */
router.get('/:code/usage', getUsageHistory);

module.exports = router;