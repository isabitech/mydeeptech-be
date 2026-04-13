// Layer: Controller
const supportTicketService = require("../services/supportTicket.service");

// ======================
// USER SUPPORT FUNCTIONS
// ======================

/**
 * Create a new support ticket
 * POST /api/support/tickets
 */
const createTicket = async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;

    const data = await supportTicketService.createTicket(userId, req.body);

    res.status(201).json({
      success: true,
      message: "Support ticket created successfully",
      data,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("❌ Error creating support ticket:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating support ticket",
      error: error.message,
    });
  }
};

/**
 * Get user's support tickets
 * GET /api/support/tickets
 */
const getUserTickets = async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;
    const data = await supportTicketService.getUserTickets(userId, req.query);

    res.status(200).json({
      success: true,
      message: "Support tickets retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching user tickets:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching tickets",
      error: error.message,
    });
  }
};

/**
 * Get specific ticket by ID
 * GET /api/support/tickets/:ticketId
 */
const getTicketById = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.userId || req.user?.userId;

    const data = await supportTicketService.getTicketById(ticketId, userId);

    res.status(200).json({
      success: true,
      message: "Ticket retrieved successfully",
      data,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("❌ Error fetching ticket:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching ticket",
      error: error.message,
    });
  }
};

/**
 * Add message/reply to existing ticket
 * POST /api/support/tickets/:ticketId/messages
 */
const addMessageToTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.userId || req.user?.userId;

    const data = await supportTicketService.addMessageToTicket(
      ticketId,
      userId,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Message added successfully",
      data,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("❌ Error adding message to ticket:", error);
    res.status(500).json({
      success: false,
      message: "Server error adding message",
      error: error.message,
    });
  }
};

/**
 * Rate a resolved ticket
 * POST /api/support/tickets/:ticketId/rate
 */
const rateTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { rating } = req.body;
    const userId = req.userId || req.user?.userId;

    const data = await supportTicketService.rateTicket(
      ticketId,
      userId,
      rating,
    );

    res.status(200).json({
      success: true,
      message: "Ticket rated successfully",
      data,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("❌ Error rating ticket:", error);
    res.status(500).json({
      success: false,
      message: "Server error rating ticket",
      error: error.message,
    });
  }
};

// ======================
// ADMIN SUPPORT FUNCTIONS
// ======================

/**
 * Get all support tickets (admin only)
 * GET /api/support/admin/tickets
 */
const getAllTickets = async (req, res) => {
  try {
    const data = await supportTicketService.getAllTickets(req.query);

    res.status(200).json({
      success: true,
      message: "Support tickets retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching admin tickets:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching tickets",
      error: error.message,
    });
  }
};

/**
 * Assign ticket to admin
 * POST /api/support/admin/tickets/:ticketId/assign
 */
const assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { adminId } = req.body;
    const currentAdminId = req.admin._id;

    const data = await supportTicketService.assignTicket(
      ticketId,
      adminId,
      currentAdminId,
    );

    res.status(200).json({
      success: true,
      message: "Ticket assigned successfully",
      data,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("❌ Error assigning ticket:", error);
    res.status(500).json({
      success: false,
      message: "Server error assigning ticket",
      error: error.message,
    });
  }
};

/**
 * Update ticket status
 * PATCH /api/support/admin/tickets/:ticketId/status
 */
const updateTicketStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const adminId = req.admin._id;

    const data = await supportTicketService.updateTicketStatus(
      ticketId,
      adminId,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Ticket status updated successfully",
      data,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("❌ Error updating ticket status:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating ticket status",
      error: error.message,
    });
  }
};

/**
 * Get support ticket statistics
 * GET /api/support/admin/stats
 */
const getTicketStats = async (req, res) => {
  try {
    const data = await supportTicketService.getTicketStats();

    res.status(200).json({
      success: true,
      message: "Support statistics retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching ticket stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching statistics",
      error: error.message,
    });
  }
};

/**
 * Add internal note to ticket
 * POST /api/support/admin/tickets/:ticketId/notes
 */
const addInternalNote = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { note } = req.body;
    const adminId = req.admin._id;

    const data = await supportTicketService.addInternalNote(
      ticketId,
      adminId,
      note,
    );

    res.status(200).json({
      success: true,
      message: "Internal note added successfully",
      data,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("❌ Error adding internal note:", error);
    res.status(500).json({
      success: false,
      message: "Server error adding note",
      error: error.message,
    });
  }
};

/**
 * Get tickets by category
 * GET /api/support/admin/tickets/category/:category
 */
const getTicketsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const data = await supportTicketService.getTicketsByCategory(
      category,
      req.query,
    );

    res.status(200).json({
      success: true,
      message: `Tickets in category "${category}" retrieved successfully`,
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching tickets by category:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching tickets",
      error: error.message,
    });
  }
};

/**
 * Get tickets by priority
 * GET /api/support/admin/tickets/priority/:priority
 */
const getTicketsByPriority = async (req, res) => {
  try {
    const { priority } = req.params;
    const data = await supportTicketService.getTicketsByPriority(
      priority,
      req.query,
    );

    res.status(200).json({
      success: true,
      message: `Tickets with priority "${priority}" retrieved successfully`,
      data,
    });
  } catch (error) {
    console.error("❌ Error fetching tickets by priority:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching tickets",
      error: error.message,
    });
  }
};

/**
 * Update ticket details (admin only)
 * PUT /api/support/admin/tickets/:ticketId
 */
const updateTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const data = await supportTicketService.updateTicket(ticketId, req.body);

    res.status(200).json({
      success: true,
      message: "Ticket updated successfully",
      data,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("❌ Error updating ticket:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating ticket",
      error: error.message,
    });
  }
};

module.exports = {
  createTicket,
  getUserTickets,
  getTicketById,
  addMessageToTicket,
  rateTicket,
  getAllTickets,
  assignTicket,
  updateTicketStatus,
  getTicketStats,
  addInternalNote,
  getTicketsByCategory,
  getTicketsByPriority,
  updateTicket,
};
