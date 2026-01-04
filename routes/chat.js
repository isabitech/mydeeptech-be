import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authenticateAdmin } from '../middleware/adminAuth.js';
import chatSupportController from '../controller/chatSupport.controller.js';

const router = express.Router();

const {
  startChatSession,
  getActiveChats,
  getChatHistory,
  sendChatMessage,
  getActiveChatTickets,
  joinChatAsAdmin,
  closeChatSession,
  getChatTicketById
} = chatSupportController;

// ======================
// USER CHAT ROUTES
// ======================

/**
 * Start a new chat session (creates ticket if none exists)
 * POST /api/chat/start
 */
router.post('/start', authenticateToken, startChatSession);

/**
 * Get active chat sessions for user
 * GET /api/chat/active
 */
router.get('/active', authenticateToken, getActiveChats);

/**
 * Get chat history for user
 * GET /api/chat/history
 */
router.get('/history', authenticateToken, getChatHistory);

/**
 * Send chat message (REST fallback for non-WebSocket clients)
 * POST /api/chat/:ticketId/message
 */
router.post('/:ticketId/message', authenticateToken, sendChatMessage);

/**
 * Get specific chat ticket details
 * GET /api/chat/:ticketId
 */
router.get('/:ticketId', authenticateToken, getChatTicketById);

// ======================
// ADMIN CHAT ROUTES
// ======================

/**
 * Get all active chat tickets (admin only)
 * GET /api/chat/admin/active
 */
router.get('/admin/active', authenticateAdmin, getActiveChatTickets);

/**
 * Join chat as admin (REST endpoint)
 * POST /api/chat/admin/join/:ticketId
 */
router.post('/admin/join/:ticketId', authenticateAdmin, joinChatAsAdmin);

/**
 * Close chat session (admin only)
 * POST /api/chat/admin/close/:ticketId
 */
router.post('/admin/close/:ticketId', authenticateAdmin, closeChatSession);

export default router;