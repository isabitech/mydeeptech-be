import supportTicketService from '../services/supportTicket.service.js';
import ResponseHandler from '../utils/responseHandler.js';
import Joi from 'joi';

class SupportTicketController {
  // USER SCHEMAS
  static createTicketSchema = Joi.object({
    subject: Joi.string().required().max(200).trim(),
    description: Joi.string().required().max(2000).trim(),
    category: Joi.string().required().valid(
      'technical_issue', 'account_problem', 'payment_inquiry', 'project_question',
      'assessment_issue', 'application_help', 'general_inquiry', 'bug_report',
      'feature_request', 'other'
    ),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
    attachments: Joi.array().items(Joi.object({
      fileName: Joi.string().required(),
      fileUrl: Joi.string().required(),
      fileType: Joi.string().optional()
    })).optional()
  });

  static addMessageSchema = Joi.object({
    message: Joi.string().required().max(1000).trim(),
    attachments: Joi.array().items(Joi.object({
      fileName: Joi.string().required(),
      fileUrl: Joi.string().required(),
      fileType: Joi.string().optional()
    })).optional()
  });

  static rateTicketSchema = Joi.object({
    rating: Joi.number().required().min(1).max(5)
  });

  // ADMIN SCHEMAS
  static updateStatusSchema = Joi.object({
    status: Joi.string().required().valid('open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'),
    resolutionSummary: Joi.string().allow('').optional(),
    resolutionCategory: Joi.string().valid('solved', 'duplicate', 'cannot_reproduce', 'not_applicable', 'escalated').optional()
  });

  static updateTicketSchema = Joi.object({
    subject: Joi.string().max(200).trim().optional(),
    description: Joi.string().max(2000).trim().optional(),
    category: Joi.string().valid(
      'technical_issue', 'account_problem', 'payment_inquiry', 'project_question',
      'assessment_issue', 'application_help', 'general_inquiry', 'bug_report',
      'feature_request', 'other'
    ).optional(),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
    tags: Joi.array().items(Joi.string()).optional()
  });

  // USER METHODS

  /**
   * Create a new support ticket
   * POST /api/support/tickets
   */
  async createTicket(req, res) {
    try {
      const { error, value } = SupportTicketController.createTicketSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, error.details[0].message, 400);

      const userId = req.user?.userId || req.dtuser?.userId;
      const userType = req.dtuser ? 'dtuser' : 'user';

      const ticket = await supportTicketService.createTicket(value, userId, userType);
      return ResponseHandler.success(res, ticket, 'Support ticket created successfully', 201);
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Get authenticated user's tickets
   * GET /api/support/tickets
   */
  async getUserTickets(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      const data = await supportTicketService.getUserTickets(userId, req.query);
      return ResponseHandler.success(res, data, 'Tickets retrieved successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Get specific ticket by ID
   * GET /api/support/tickets/:ticketId
   */
  async getTicketById(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      const userType = req.dtuser ? 'dtuser' : 'user';
      const isAdmin = !!(req.admin || req.dtuser?.role === 'ADMIN');

      const ticket = await supportTicketService.getTicketById(req.params.ticketId, userId, userType, isAdmin);
      return ResponseHandler.success(res, ticket, 'Ticket details retrieved successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Add message/reply to existing ticket
   * POST /api/support/tickets/:ticketId/messages
   */
  async addMessageToTicket(req, res) {
    try {
      const { error, value } = SupportTicketController.addMessageSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, error.details[0].message, 400);

      const userId = req.user?.userId || req.dtuser?.userId || req.admin?.userId;
      const userType = req.dtuser ? 'dtuser' : 'user';
      const isAdmin = !!(req.admin || req.dtuser?.role === 'ADMIN');

      const ticket = await supportTicketService.addMessageToTicket(req.params.ticketId, userId, userType, value, isAdmin);
      return ResponseHandler.success(res, ticket, 'Message added to ticket successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Rate a resolved ticket
   * POST /api/support/tickets/:ticketId/rate
   */
  async rateTicket(req, res) {
    try {
      const { error, value } = SupportTicketController.rateTicketSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, error.details[0].message, 400);

      const userId = req.user?.userId || req.dtuser?.userId;
      const ticket = await supportTicketService.rateTicket(req.params.ticketId, userId, value.rating);
      return ResponseHandler.success(res, ticket, 'Ticket rated successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  // ADMIN METHODS

  /**
   * Get all support tickets (admin only)
   * GET /api/support/admin/tickets
   */
  async getAllTickets(req, res) {
    try {
      const data = await supportTicketService.getAllTickets(req.query);
      return ResponseHandler.success(res, data, 'All tickets retrieved successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Assign ticket to admin
   * POST /api/support/admin/tickets/:ticketId/assign
   */
  async assignTicket(req, res) {
    try {
      const adminId = req.admin?.userId || req.dtuser?.userId;
      const targetAdminId = req.body.adminId || adminId;

      const ticket = await supportTicketService.assignTicket(req.params.ticketId, targetAdminId);
      return ResponseHandler.success(res, ticket, 'Ticket assigned successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Update ticket status
   * PATCH /api/support/admin/tickets/:ticketId/status
   */
  async updateTicketStatus(req, res) {
    try {
      const { error, value } = SupportTicketController.updateStatusSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, error.details[0].message, 400);

      const adminId = req.admin?.userId || req.dtuser?.userId;
      const { status, ...resolutionData } = value;

      const ticket = await supportTicketService.updateTicketStatus(req.params.ticketId, status, adminId, resolutionData);
      return ResponseHandler.success(res, ticket, 'Ticket status updated successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Get support ticket statistics
   * GET /api/support/admin/stats
   */
  async getTicketStats(req, res) {
    try {
      const stats = await supportTicketService.getTicketStats();
      return ResponseHandler.success(res, stats, 'Ticket statistics retrieved successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Add internal note to ticket
   * POST /api/support/admin/tickets/:ticketId/notes
   */
  async addInternalNote(req, res) {
    try {
      const adminId = req.admin?.userId || req.dtuser?.userId;
      const ticket = await supportTicketService.addInternalNote(req.params.ticketId, adminId, req.body.note);
      return ResponseHandler.success(res, ticket, 'Internal note added successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Update ticket details (admin only)
   * PUT /api/support/admin/tickets/:ticketId
   */
  async updateTicket(req, res) {
    try {
      const { error, value } = SupportTicketController.updateTicketSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, error.details[0].message, 400);

      const ticket = await supportTicketService.updateTicket(req.params.ticketId, value);
      return ResponseHandler.success(res, ticket, 'Ticket updated successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }
}

export default new SupportTicketController();