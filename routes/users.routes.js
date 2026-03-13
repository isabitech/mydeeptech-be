const express = require('express');
const {
    getAllUsers,
    getUserByEmail,
    createUser,
    updateUser,
    deactivateUser,
    getUserSessions,
    getUserStats
} = require('../controllers/user.controller.extension');

const router = express.Router();

// User Routes

/**
 * @route GET /api/users
 * @desc List all users
 * @access Private
 */
router.get('/', getAllUsers);

/**
 * @route GET /api/users/:email
 * @desc Get user details by email
 * @access Private
 */
router.get('/:email', getUserByEmail);

/**
 * @route POST /api/users
 * @desc Create user
 * @access Private
 */
router.post('/', createUser);

/**
 * @route PUT /api/users/:email
 * @desc Update user
 * @access Private
 */
router.put('/:email', updateUser);

/**
 * @route DELETE /api/users/:email
 * @desc Deactivate user
 * @access Private
 */
router.delete('/:email', deactivateUser);

/**
 * @route GET /api/users/:email/sessions
 * @desc Get user sessions
 * @access Private
 */
router.get('/:email/sessions', getUserSessions);

/**
 * @route GET /api/users/:email/stats
 * @desc Get user statistics
 * @access Private
 */
router.get('/:email/stats', getUserStats);

module.exports = router;