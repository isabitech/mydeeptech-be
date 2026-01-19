import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authenticateAdmin } from '../middleware/adminAuth.js';
import supportTicketController from '../controller/supportTicket.controller.js';
import tryCatch from '../utils/tryCatch.js';

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

router.post('/tickets', authenticateToken, tryCatch(createTicket));
router.get('/tickets', authenticateToken, tryCatch(getUserTickets));
router.get('/tickets/:ticketId', authenticateToken, tryCatch(getTicketById));
router.post('/tickets/:ticketId/messages', authenticateToken, tryCatch(addMessageToTicket));
router.post('/tickets/:ticketId/rate', authenticateToken, tryCatch(rateTicket));
// ======================
// ADMIN SUPPORT ROUTES
// ======================

router.get('/admin/tickets', authenticateAdmin, tryCatch(getAllTickets));
router.get('/admin/tickets/category/:category', authenticateAdmin, tryCatch(getTicketsByCategory));
router.get('/admin/tickets/priority/:priority', authenticateAdmin, tryCatch(getTicketsByPriority));
router.post('/admin/tickets/:ticketId/assign', authenticateAdmin, tryCatch(assignTicket));
router.patch('/admin/tickets/:ticketId/status', authenticateAdmin, tryCatch(updateTicketStatus));
router.post('/admin/tickets/:ticketId/notes', authenticateAdmin, tryCatch(addInternalNote));
router.get('/admin/stats', authenticateAdmin, tryCatch(getTicketStats));
router.put('/admin/tickets/:ticketId', authenticateAdmin, tryCatch(updateTicket));

export default router;
