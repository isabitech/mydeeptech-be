// Layer: Route
const express = require("express");
const { authenticateToken } = require("../middleware/auth.js");
const { authenticateAdmin } = require("../middleware/adminAuth.js");
const supportTicketController = require("../controllers/supportTicket.controller.js");

const router = express.Router();

// ======================
// USER SUPPORT ROUTES
// ======================

/**
 * Create a new support ticket
 * POST /api/support/tickets
 */
router.post(
  "/tickets",
  authenticateToken,
  supportTicketController.createTicket,
);

/**
 * Get user's support tickets
 * GET /api/support/tickets
 */
router.get(
  "/tickets",
  authenticateToken,
  supportTicketController.getUserTickets,
);

/**
 * Get specific ticket by ID (user can only access their own tickets)
 * GET /api/support/tickets/:ticketId
 */
router.get(
  "/tickets/:ticketId",
  authenticateToken,
  supportTicketController.getTicketById,
);

/**
 * Add message/reply to existing ticket
 * POST /api/support/tickets/:ticketId/messages
 */
router.post(
  "/tickets/:ticketId/messages",
  authenticateToken,
  supportTicketController.addMessageToTicket,
);

/**
 * Rate a resolved ticket
 * POST /api/support/tickets/:ticketId/rate
 */
router.post(
  "/tickets/:ticketId/rate",
  authenticateToken,
  supportTicketController.rateTicket,
);

// ======================
// ADMIN SUPPORT ROUTES
// ======================

/**
 * Get all support tickets (admin only)
 * GET /api/support/admin/tickets
 */
router.get(
  "/admin/tickets",
  authenticateAdmin,
  supportTicketController.getAllTickets,
);

/**
 * Get tickets by category (admin only)
 * GET /api/support/admin/tickets/category/:category
 */
router.get(
  "/admin/tickets/category/:category",
  authenticateAdmin,
  supportTicketController.getTicketsByCategory,
);

/**
 * Get tickets by priority (admin only)
 * GET /api/support/admin/tickets/priority/:priority
 */
router.get(
  "/admin/tickets/priority/:priority",
  authenticateAdmin,
  supportTicketController.getTicketsByPriority,
);

/**
 * Assign ticket to admin (admin only)
 * POST /api/support/admin/tickets/:ticketId/assign
 */
router.post(
  "/admin/tickets/:ticketId/assign",
  authenticateAdmin,
  supportTicketController.assignTicket,
);

/**
 * Update ticket status (admin only)
 * PATCH /api/support/admin/tickets/:ticketId/status
 */
router.patch(
  "/admin/tickets/:ticketId/status",
  authenticateAdmin,
  supportTicketController.updateTicketStatus,
);

/**
 * Add internal note to ticket (admin only)
 * POST /api/support/admin/tickets/:ticketId/notes
 */
router.post(
  "/admin/tickets/:ticketId/notes",
  authenticateAdmin,
  supportTicketController.addInternalNote,
);

/**
 * Get support ticket statistics (admin only)
 * GET /api/support/admin/stats
 */
router.get(
  "/admin/stats",
  authenticateAdmin,
  supportTicketController.getTicketStats,
);

/**
 * Update ticket details (admin only)
 * PUT /api/support/admin/tickets/:ticketId
 */
router.put(
  "/admin/tickets/:ticketId",
  authenticateAdmin,
  supportTicketController.updateTicket,
);

module.exports = router;
