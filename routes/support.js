import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authenticateAdmin } from '../middleware/adminAuth.js';
import supportTicketController from '../controller/supportTicket.controller.js';

const router = express.Router();

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
} = supportTicketController;

// ======================
// USER SUPPORT ROUTES
// ======================

router.post('/tickets', authenticateToken, createTicket);
router.get('/tickets', authenticateToken, getUserTickets);
router.get('/tickets/:ticketId', authenticateToken, getTicketById);
router.post('/tickets/:ticketId/messages', authenticateToken, addMessageToTicket);
router.post('/tickets/:ticketId/rate', authenticateToken, rateTicket);

// ======================
// ADMIN SUPPORT ROUTES
// ======================

router.get('/admin/tickets', authenticateAdmin, getAllTickets);
router.get('/admin/tickets/category/:category', authenticateAdmin, getTicketsByCategory);
router.get('/admin/tickets/priority/:priority', authenticateAdmin, getTicketsByPriority);
router.post('/admin/tickets/:ticketId/assign', authenticateAdmin, assignTicket);
router.patch('/admin/tickets/:ticketId/status', authenticateAdmin, updateTicketStatus);
router.post('/admin/tickets/:ticketId/notes', authenticateAdmin, addInternalNote);
router.get('/admin/stats', authenticateAdmin, getTicketStats);
router.put('/admin/tickets/:ticketId', authenticateAdmin, updateTicket);

export default router;
