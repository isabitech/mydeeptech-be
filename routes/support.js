const express = require('express');
const { authenticateToken } = require('../middleware/auth.js');
const { authenticateAdmin } = require('../middleware/adminAuth.js');
const { 
  createTicket, 
  getUserTickets, 
  getTicketById, 
  updateTicket,
  addMessageToTicket,
  rateTicket,
  getAllTickets,
  assignTicket,
  updateTicketStatus,
  getTicketStats,
  addInternalNote,
  getTicketsByCategory,
  getTicketsByPriority
} = require('../controller/supportTicket.controller.js');

const router = express.Router();

// ======================
// USER SUPPORT ROUTES
// ======================

/**
 * Create a new support ticket
 * POST /api/support/tickets
 */
router.post('/tickets', authenticateToken, createTicket);

/**
 * Get user's support tickets
 * GET /api/support/tickets
 */
router.get('/tickets', authenticateToken, getUserTickets);

/**
 * Get specific ticket by ID (user can only access their own tickets)
 * GET /api/support/tickets/:ticketId
 */
router.get('/tickets/:ticketId', authenticateToken, getTicketById);

/**
 * Add message/reply to existing ticket
 * POST /api/support/tickets/:ticketId/messages
 */
router.post('/tickets/:ticketId/messages', authenticateToken, addMessageToTicket);

/**
 * Rate a resolved ticket
 * POST /api/support/tickets/:ticketId/rate
 */
router.post('/tickets/:ticketId/rate', authenticateToken, rateTicket);

// ======================
// ADMIN SUPPORT ROUTES
// ======================

/**
 * Get all support tickets (admin only)
 * GET /api/support/admin/tickets
 */
router.get('/admin/tickets', authenticateAdmin, getAllTickets);

/**
 * Get tickets by category (admin only)
 * GET /api/support/admin/tickets/category/:category
 */
router.get('/admin/tickets/category/:category', authenticateAdmin, getTicketsByCategory);

/**
 * Get tickets by priority (admin only)
 * GET /api/support/admin/tickets/priority/:priority
 */
router.get('/admin/tickets/priority/:priority', authenticateAdmin, getTicketsByPriority);

/**
 * Assign ticket to admin (admin only)
 * POST /api/support/admin/tickets/:ticketId/assign
 */
router.post('/admin/tickets/:ticketId/assign', authenticateAdmin, assignTicket);

/**
 * Update ticket status (admin only)
 * PATCH /api/support/admin/tickets/:ticketId/status
 */
router.patch('/admin/tickets/:ticketId/status', authenticateAdmin, updateTicketStatus);

/**
 * Add internal note to ticket (admin only)
 * POST /api/support/admin/tickets/:ticketId/notes
 */
router.post('/admin/tickets/:ticketId/notes', authenticateAdmin, addInternalNote);

/**
 * Get support ticket statistics (admin only)
 * GET /api/support/admin/stats
 */
router.get('/admin/stats', authenticateAdmin, getTicketStats);

/**
 * Update ticket details (admin only)
 * PUT /api/support/admin/tickets/:ticketId
 */
router.put('/admin/tickets/:ticketId', authenticateAdmin, updateTicket);

module.exports = router;