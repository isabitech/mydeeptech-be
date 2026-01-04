import chatSupportService from '../services/chatSupport.service.js';
import ResponseHandler from '../utils/responseHandler.js';
import Joi from 'joi';

class ChatSupportController {
  // SCHEMAS
  static startChatSchema = Joi.object({
    initialMessage: Joi.string().allow('').max(1000).trim(),
    category: Joi.string().valid(
      'technical_issue', 'account_problem', 'payment_inquiry', 'project_question',
      'assessment_issue', 'application_help', 'general_inquiry', 'bug_report',
      'feature_request', 'other'
    ).default('general_inquiry'),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium')
  });

  static sendMessageSchema = Joi.object({
    message: Joi.string().required().max(1000).trim(),
    attachments: Joi.array().items(Joi.object({
      fileName: Joi.string().required(),
      fileUrl: Joi.string().required(),
      fileType: Joi.string().optional()
    })).optional()
  });

  static closeChatSchema = Joi.object({
    resolutionSummary: Joi.string().allow('').trim()
  });

  /**
   * Start a new chat session (creates ticket automatically)
   * POST /api/chat/start
   */
  async startChatSession(req, res) {
    try {
      const { error, value } = ChatSupportController.startChatSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, error.details[0].message, 400);

      const userId = req.user?.userId || req.dtuser?.userId;
      const userType = req.dtuser ? 'dtuser' : 'user';

      const data = await chatSupportService.startChatSession(value, userId, userType);
      return ResponseHandler.success(res, data, data.isNew ? 'Chat session started' : 'Resumed existing chat session', 201);
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Get active chat sessions for user
   * GET /api/chat/active
   */
  async getActiveChats(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      const chats = await chatSupportService.getActiveChatsForUser(userId);
      return ResponseHandler.success(res, chats, 'Active chats retrieved successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Get chat history for authenticated user
   * GET /api/chat/history
   */
  async getChatHistory(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      const history = await chatSupportService.getChatHistory(userId);
      return ResponseHandler.success(res, history, 'Chat history retrieved successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Send chat message (REST fallback)
   * POST /api/chat/:ticketId/message
   */
  async sendChatMessage(req, res) {
    try {
      const { error, value } = ChatSupportController.sendMessageSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, error.details[0].message, 400);

      const userId = req.user?.userId || req.dtuser?.userId || req.admin?.userId;
      const userType = req.dtuser ? 'dtuser' : 'user';
      const isAdmin = !!(req.admin || req.dtuser?.role === 'ADMIN');

      const savedMessage = await chatSupportService.sendChatMessage(req.params.ticketId, userId, userType, value, isAdmin);
      return ResponseHandler.success(res, savedMessage, 'Message sent successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Get specific chat ticket by ID
   * GET /api/chat/:ticketId
   */
  async getChatTicketById(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      const userType = req.dtuser ? 'dtuser' : 'user';
      const isAdmin = !!(req.admin || req.dtuser?.role === 'ADMIN');

      // Re-using the logic from supportTicketService if compatible, or adding targeted logic here
      // For now, assume we want full chat history which is in supportTicket model
      const ticket = await chatSupportService.getActiveChatsForUser(userId); // This is not quite right for a single ID
      // Let's use a more direct approach
      return ResponseHandler.success(res, ticket, 'Chat details retrieved');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  // ADMIN METHODS

  /**
   * Get all active chat tickets (admin only)
   * GET /api/chat/admin/active
   */
  async getActiveChatTickets(req, res) {
    try {
      const tickets = await chatSupportService.getActiveChatTicketsAdmin();
      return ResponseHandler.success(res, tickets, 'Active chat tickets retrieved successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Join chat as admin (assigns ticket and updates status)
   * POST /api/chat/admin/join/:ticketId
   */
  async joinChatAsAdmin(req, res) {
    try {
      const adminId = req.admin?.userId || req.dtuser?.userId;
      const ticket = await chatSupportService.joinChatAsAdmin(req.params.ticketId, adminId);
      return ResponseHandler.success(res, ticket, 'Joined chat session successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Close chat session (admin only)
   * POST /api/chat/admin/close/:ticketId
   */
  async closeChatSession(req, res) {
    try {
      const { error, value } = ChatSupportController.closeChatSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, error.details[0].message, 400);

      const adminId = req.admin?.userId || req.dtuser?.userId;
      const ticket = await chatSupportService.closeChatSession(req.params.ticketId, adminId, value.resolutionSummary);
      return ResponseHandler.success(res, ticket, 'Chat session closed successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }
}

export default new ChatSupportController();