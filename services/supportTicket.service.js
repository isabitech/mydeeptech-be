// Layer: Service
const supportTicketRepository = require("../repositories/supportTicket.repository");
const { createNotification } = require("../utils/notificationService");

class SupportTicketService {
  toInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  buildPagination({ page, limit, total }) {
    return {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalTickets: total,
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
      limit,
    };
  }

  buildTicketFilter(query) {
    const { status, category, priority, assignedTo } = query;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    return filter;
  }

  /**
   * Determine user model type
   * @private
   */
  async _getUserModel(userId) {
    try {
      const [dtUser, user] = await Promise.all([
        supportTicketRepository.findDTUserById(userId),
        supportTicketRepository.findUserById(userId),
      ]);

      if (dtUser) return "DTUser";
      if (user) return "User";
    } catch (error) {
      console.log("User lookup error:", error);
    }
    return "DTUser"; // Default assumption
  }

  async getUserModel(userId) {
    return this._getUserModel(userId);
  }

  /**
   * Create a new support ticket
   */
  async createTicket(userId, payload) {
    const {
      subject,
      description,
      category,
      priority = "medium",
      attachments = [],
    } = payload;

    if (!subject || !description || !category) {
      throw {
        statusCode: 400,
        message: "Subject, description, and category are required",
      };
    }
    const userModel = await this.getUserModel(userId);

    const ticket = await supportTicketRepository.create({
      userId,
      userModel,
      subject,
      description,
      category,
      priority,
      attachments,
    });

    // Create notification for user confirmation
    await createNotification({
      userId,
      type: "support_ticket",
      title: `Support Ticket Created - ${ticket.ticketNumber}`,
      message: `Your support ticket "${subject}" has been created and is being reviewed by our team.`,
      priority: "medium",
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        category,
        status: "open",
      },
    });

    return {
      ticket: {
        _id: ticket._id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    };
  }

  /**
   * Get user's support tickets with pagination
   */
  async getUserTickets(userId, query) {
    const page = this.toInt(query.page, 1);
    const limit = this.toInt(query.limit, 10);
    const skip = (page - 1) * limit;
    const { status, category } = query;

    const filter = { userId };
    if (status) filter.status = status;
    if (category) filter.category = category;

    const [tickets, totalTickets] = await Promise.all([
      supportTicketRepository.findWithPagination({
        filter,
        sort: { lastUpdated: -1 },
        skip,
        limit,
        select: "-internalNotes -messages.attachments",
      }),
      supportTicketRepository.countAll(filter),
    ]);

    return {
      tickets,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalTickets / limit),
        totalTickets,
        hasNextPage: page * limit < totalTickets,
        hasPrevPage: page > 1,
        limit,
      },
    };
  }

  /**
   * Get specific ticket by ID for a user
   */
  async getTicketById(ticketId, userId) {
    const populate = [
      { path: "assignedTo", select: "fullName email" },
      { path: "resolution.resolvedBy", select: "fullName email" },
    ];

    const ticket = await supportTicketRepository.findOne(
      { _id: ticketId, userId },
      populate,
      "-internalNotes",
    );

    if (!ticket) {
      throw { statusCode: 404, message: "Ticket not found or access denied" };
    }

    return { ticket };
  }

  /**
   * Add message/reply to existing ticket
   */
  async addMessageToTicket(ticketId, userId, payload) {
    const { message, attachments = [] } = payload;

    if (!message) {
      throw { statusCode: 400, message: "Message is required" };
    }

    const ticket = await supportTicketRepository.findOne({
      _id: ticketId,
      userId,
    });
    if (!ticket) {
      throw { statusCode: 404, message: "Ticket not found or access denied" };
    }

    const userModel = await this._getUserModel(userId);

    ticket.messages.push({
      sender: userId,
      senderModel: userModel,
      message,
      isAdminReply: false,
      attachments,
    });

    if (ticket.status === "waiting_for_user") {
      ticket.status = "in_progress";
    }

    await ticket.save();

    return {
      messageId: ticket.messages[ticket.messages.length - 1]._id,
      ticketStatus: ticket.status,
    };
  }

  /**
   * Rate a resolved ticket
   */
  async rateTicket(ticketId, userId, rating) {
    if (!rating || rating < 1 || rating > 5) {
      throw { statusCode: 400, message: "Rating must be between 1 and 5" };
    }

    const ticket = await supportTicketRepository.findOneAndUpdate(
      {
        _id: ticketId,
        userId,
        status: { $in: ["resolved", "closed"] },
      },
      { $set: { userSatisfactionRating: rating } },
    );

    if (!ticket) {
      throw {
        statusCode: 404,
        message: "Ticket not found, access denied, or ticket not resolved",
      };
    }

    return { rating };
  }

  /**
   * Get all support tickets (admin only)
   */
  async getAllTickets(query) {
    const page = this.toInt(query.page, 1);
    const limit = this.toInt(query.limit, 20);
    const skip = (page - 1) * limit;
    const filter = this.buildTicketFilter(query);

    const populate = [
      { path: "userId", select: "fullName email" },
      { path: "assignedTo", select: "fullName email" },
    ];

    const [tickets, totalTickets] = await Promise.all([
      supportTicketRepository.findWithPagination({
        filter,
        sort: { priority: 1, createdAt: -1 },
        skip,
        limit,
        populate,
      }),
      supportTicketRepository.countAll(filter),
    ]);

    return {
      tickets,
      pagination: this.buildPagination({ page, limit, total: totalTickets }),
    };
  }

  /**
   * Assign ticket to admin
   */
  async assignTicket(ticketId, adminId, requesterId) {
    const assignedAdminId = adminId || requesterId;

    const admin = await supportTicketRepository.findDTUserById(assignedAdminId);
    if (!admin) {
      throw { statusCode: 404, message: "Admin not found" };
    }

    const updateData = {
      assignedTo: assignedAdminId,
      assignedAt: new Date(),
    };

    const ticket = await supportTicketRepository.findById(ticketId);
    if (!ticket) {
      throw { statusCode: 404, message: "Ticket not found" };
    }

    if (ticket.status === "open") {
      updateData.status = "in_progress";
    }

    const updatedTicket = await supportTicketRepository.findByIdAndUpdate(
      ticketId,
      { $set: updateData },
    );

    return {
      ticketId: updatedTicket._id,
      assignedTo: admin.fullName,
      assignedAt: updatedTicket.assignedAt,
    };
  }

  /**
   * Update ticket status (admin only)
   */
  async updateTicketStatus(ticketId, adminId, payload) {
    const { status, resolutionSummary, resolutionCategory } = payload;

    const ticket = await supportTicketRepository.findById(ticketId);
    if (!ticket) {
      throw { statusCode: 404, message: "Ticket not found" };
    }

    const oldStatus = ticket.status;
    const updateData = { status };

    if (status === "resolved" || status === "closed") {
      updateData.resolution = {
        summary: resolutionSummary,
        resolvedBy: adminId,
        resolvedAt: new Date(),
        resolutionCategory: resolutionCategory || "solved",
      };
    }

    const updatedTicket = await supportTicketRepository.findByIdAndUpdate(
      ticketId,
      { $set: updateData },
    );

    // Create notification for user
    await createNotification({
      userId: updatedTicket.userId,
      type: "support_ticket",
      title: `Ticket Status Updated - ${updatedTicket.ticketNumber}`,
      message: `Your support ticket "${updatedTicket.subject}" status has been updated to ${status}.`,
      priority: status === "resolved" ? "high" : "medium",
      data: {
        ticketId: updatedTicket._id,
        ticketNumber: updatedTicket.ticketNumber,
        oldStatus,
        newStatus: status,
        resolutionSummary,
      },
    });

    return {
      ticketId: updatedTicket._id,
      oldStatus,
      newStatus: status,
      updatedAt: updatedTicket.lastUpdated,
    };
  }

  /**
   * Get support ticket statistics
   */
  async getTicketStats() {
    const stats = await supportTicketRepository.getStats();
    return {
      ...stats,
      performance: {
        ...stats.performance,
        resolutionRate:
          stats.overview.totalTickets > 0
            ? (
                ((stats.overview.resolvedTickets +
                  stats.overview.closedTickets) /
                  stats.overview.totalTickets) *
                100
              ).toFixed(2)
            : 0,
      },
      generatedAt: new Date(),
    };
  }

  /**
   * Add internal note to ticket
   */
  async addInternalNote(ticketId, adminId, note) {
    if (!note) {
      throw { statusCode: 400, message: "Note is required" };
    }

    const ticket = await supportTicketRepository.findById(ticketId);
    if (!ticket) {
      throw { statusCode: 404, message: "Ticket not found" };
    }

    ticket.internalNotes.push({
      note,
      addedBy: adminId,
      addedAt: new Date(),
    });

    await ticket.save();

    return {
      noteId: ticket.internalNotes[ticket.internalNotes.length - 1]._id,
    };
  }

  /**
   * Get tickets by category
   */
  async getTicketsByCategory(category, query) {
    const result = await this.getAllTickets({ ...query, category });
    return {
      category,
      ...result,
    };
  }

  /**
   * Get tickets by priority
   */
  async getTicketsByPriority(priority, query) {
    const result = await this.getAllTickets({ ...query, priority });
    return {
      priority,
      ...result,
    };
  }

  /**
   * Update ticket details
   */
  async updateTicket(ticketId, payload) {
    const { subject, description, category, priority, tags } = payload;

    const updateData = {};
    if (subject) updateData.subject = subject;
    if (description) updateData.description = description;
    if (category) updateData.category = category;
    if (priority) updateData.priority = priority;
    if (tags) updateData.tags = tags;

    const updatedTicket = await supportTicketRepository.findByIdAndUpdate(
      ticketId,
      { $set: updateData },
    );

    if (!updatedTicket) {
      throw { statusCode: 404, message: "Ticket not found" };
    }

    return {
      ticketId: updatedTicket._id,
      ticketNumber: updatedTicket.ticketNumber,
      updatedAt: updatedTicket.lastUpdated,
    };
  }
}

module.exports = new SupportTicketService();
