const SupportTicket = require('../models/supportTicket.model');
const { createNotification } = require('../utils/notificationService');
const DTUser = require('../models/dtUser.model');
const User = require('../models/user');
const mongoose = require('mongoose');

// ======================
// USER SUPPORT FUNCTIONS
// ======================

/**
 * Create a new support ticket
 * POST /api/support/tickets
 */
const createTicket = async (req, res) => {
  try {
    const { subject, description, category, priority = 'medium', attachments = [] } = req.body;
    const userId = req.userId || req.user?.userId;

    // Validate required fields
    if (!subject || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Subject, description, and category are required'
      });
    }

    // Determine user model type
    let userModel = 'DTUser'; // Default assumption
    try {
      const dtUser = await DTUser.findById(userId);
      if (!dtUser) {
        const user = await User.findById(userId);
        if (user) userModel = 'User';
      }
    } catch (error) {
      console.log('User lookup error:', error);
    }

    // Create the support ticket
    const ticket = await SupportTicket.create({
      userId,
      userModel,
      subject,
      description,
      category,
      priority,
      attachments
    });

    // Create notification for user confirmation
    await createNotification({
      userId,
      type: 'support_ticket',
      title: `Support Ticket Created - ${ticket.ticketNumber}`,
      message: `Your support ticket "${subject}" has been created and is being reviewed by our team.`,
      priority: 'medium',
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        category,
        status: 'open'
      }
    });

    // TODO: Send email confirmation (will be implemented in email templates task)
    // TODO: Notify admins about new ticket (will be implemented in notification system task)

    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      data: {
        ticket: {
          _id: ticket._id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          category: ticket.category,
          priority: ticket.priority,
          status: ticket.status,
          createdAt: ticket.createdAt
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creating support ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating support ticket',
      error: error.message
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const category = req.query.category;
    const skip = (page - 1) * limit;

    // Build query
    const query = { userId };
    if (status) query.status = status;
    if (category) query.category = category;

    const [tickets, totalTickets] = await Promise.all([
      SupportTicket.find(query)
        .sort({ lastUpdated: -1 })
        .skip(skip)
        .limit(limit)
        .select('-internalNotes -messages.attachments'),
      SupportTicket.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      message: 'Support tickets retrieved successfully',
      data: {
        tickets,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalTickets / limit),
          totalTickets,
          hasNextPage: page * limit < totalTickets,
          hasPrevPage: page > 1,
          limit
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching tickets',
      error: error.message
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

    const ticket = await SupportTicket.findOne({ _id: ticketId, userId })
      .populate('assignedTo', 'fullName email')
      .populate('resolution.resolvedBy', 'fullName email')
      .select('-internalNotes');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Ticket retrieved successfully',
      data: { ticket }
    });

  } catch (error) {
    console.error('❌ Error fetching ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching ticket',
      error: error.message
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
    const { message, attachments = [] } = req.body;
    const userId = req.userId || req.user?.userId;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Find ticket and verify ownership
    const ticket = await SupportTicket.findOne({ _id: ticketId, userId });
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found or access denied'
      });
    }

    // Determine user model
    let userModel = 'DTUser';
    try {
      const dtUser = await DTUser.findById(userId);
      if (!dtUser) {
        const user = await User.findById(userId);
        if (user) userModel = 'User';
      }
    } catch (error) {
      console.log('User lookup error:', error);
    }

    // Add message
    ticket.messages.push({
      sender: userId,
      senderModel: userModel,
      message,
      isAdminReply: false,
      attachments
    });

    // Update ticket status if it was waiting for user
    if (ticket.status === 'waiting_for_user') {
      ticket.status = 'in_progress';
    }

    await ticket.save();

    // TODO: Notify assigned admin about new message

    res.status(200).json({
      success: true,
      message: 'Message added successfully',
      data: {
        messageId: ticket.messages[ticket.messages.length - 1]._id,
        ticketStatus: ticket.status
      }
    });

  } catch (error) {
    console.error('❌ Error adding message to ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding message',
      error: error.message
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

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const ticket = await SupportTicket.findOne({ 
      _id: ticketId, 
      userId,
      status: { $in: ['resolved', 'closed'] }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found, access denied, or ticket not resolved'
      });
    }

    ticket.userSatisfactionRating = rating;
    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Ticket rated successfully',
      data: { rating }
    });

  } catch (error) {
    console.error('❌ Error rating ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Server error rating ticket',
      error: error.message
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const category = req.query.category;
    const priority = req.query.priority;
    const assignedTo = req.query.assignedTo;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;

    const [tickets, totalTickets] = await Promise.all([
      SupportTicket.find(query)
        .populate('userId', 'fullName email')
        .populate('assignedTo', 'fullName email')
        .sort({ priority: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SupportTicket.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      message: 'Support tickets retrieved successfully',
      data: {
        tickets,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalTickets / limit),
          totalTickets,
          hasNextPage: page * limit < totalTickets,
          hasPrevPage: page > 1,
          limit
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching admin tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching tickets',
      error: error.message
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

    // If no adminId provided, assign to current admin
    const assignedAdminId = adminId || currentAdminId;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Verify the admin exists
    const admin = await DTUser.findById(assignedAdminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    ticket.assignedTo = assignedAdminId;
    ticket.assignedAt = new Date();
    if (ticket.status === 'open') {
      ticket.status = 'in_progress';
    }
    await ticket.save();

    // TODO: Notify user about assignment
    // TODO: Notify assigned admin

    res.status(200).json({
      success: true,
      message: 'Ticket assigned successfully',
      data: {
        ticketId: ticket._id,
        assignedTo: admin.fullName,
        assignedAt: ticket.assignedAt
      }
    });

  } catch (error) {
    console.error('❌ Error assigning ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Server error assigning ticket',
      error: error.message
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
    const { status, resolutionSummary, resolutionCategory } = req.body;
    const adminId = req.admin._id;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const oldStatus = ticket.status;
    ticket.status = status;

    // Handle resolution
    if (status === 'resolved' || status === 'closed') {
      ticket.resolution = {
        summary: resolutionSummary,
        resolvedBy: adminId,
        resolvedAt: new Date(),
        resolutionCategory: resolutionCategory || 'solved'
      };
    }

    await ticket.save();

    // Create notification for user
    await createNotification({
      userId: ticket.userId,
      type: 'support_ticket',
      title: `Ticket Status Updated - ${ticket.ticketNumber}`,
      message: `Your support ticket "${ticket.subject}" status has been updated to ${status}.`,
      priority: status === 'resolved' ? 'high' : 'medium',
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        oldStatus,
        newStatus: status,
        resolutionSummary
      }
    });

    res.status(200).json({
      success: true,
      message: 'Ticket status updated successfully',
      data: {
        ticketId: ticket._id,
        oldStatus,
        newStatus: status,
        updatedAt: ticket.lastUpdated
      }
    });

  } catch (error) {
    console.error('❌ Error updating ticket status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating ticket status',
      error: error.message
    });
  }
};

/**
 * Get support ticket statistics
 * GET /api/support/admin/stats
 */
const getTicketStats = async (req, res) => {
  try {
    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      ticketsByCategory,
      ticketsByPriority,
      avgSatisfactionRating
    ] = await Promise.all([
      SupportTicket.countDocuments(),
      SupportTicket.countDocuments({ status: 'open' }),
      SupportTicket.countDocuments({ status: 'in_progress' }),
      SupportTicket.countDocuments({ status: 'resolved' }),
      SupportTicket.countDocuments({ status: 'closed' }),
      SupportTicket.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      SupportTicket.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      SupportTicket.aggregate([
        { $match: { userSatisfactionRating: { $exists: true, $ne: null } } },
        { $group: { _id: null, avgRating: { $avg: '$userSatisfactionRating' } } }
      ])
    ]);

    const stats = {
      overview: {
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        closedTickets,
        pendingTickets: openTickets + inProgressTickets
      },
      breakdown: {
        byCategory: ticketsByCategory,
        byPriority: ticketsByPriority
      },
      performance: {
        averageSatisfactionRating: avgSatisfactionRating[0]?.avgRating || 0,
        resolutionRate: totalTickets > 0 ? ((resolvedTickets + closedTickets) / totalTickets * 100).toFixed(2) : 0
      },
      generatedAt: new Date()
    };

    res.status(200).json({
      success: true,
      message: 'Support statistics retrieved successfully',
      data: stats
    });

  } catch (error) {
    console.error('❌ Error fetching ticket stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching statistics',
      error: error.message
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

    if (!note) {
      return res.status(400).json({
        success: false,
        message: 'Note is required'
      });
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    ticket.internalNotes.push({
      note,
      addedBy: adminId,
      addedAt: new Date()
    });

    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Internal note added successfully',
      data: {
        noteId: ticket.internalNotes[ticket.internalNotes.length - 1]._id
      }
    });

  } catch (error) {
    console.error('❌ Error adding internal note:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding note',
      error: error.message
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [tickets, totalTickets] = await Promise.all([
      SupportTicket.find({ category })
        .populate('userId', 'fullName email')
        .populate('assignedTo', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SupportTicket.countDocuments({ category })
    ]);

    res.status(200).json({
      success: true,
      message: `Tickets in category "${category}" retrieved successfully`,
      data: {
        category,
        tickets,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalTickets / limit),
          totalTickets,
          hasNextPage: page * limit < totalTickets,
          hasPrevPage: page > 1,
          limit
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching tickets by category:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching tickets',
      error: error.message
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [tickets, totalTickets] = await Promise.all([
      SupportTicket.find({ priority })
        .populate('userId', 'fullName email')
        .populate('assignedTo', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SupportTicket.countDocuments({ priority })
    ]);

    res.status(200).json({
      success: true,
      message: `Tickets with priority "${priority}" retrieved successfully`,
      data: {
        priority,
        tickets,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalTickets / limit),
          totalTickets,
          hasNextPage: page * limit < totalTickets,
          hasPrevPage: page > 1,
          limit
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching tickets by priority:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching tickets',
      error: error.message
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
    const { subject, description, category, priority, tags } = req.body;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Update allowed fields
    if (subject) ticket.subject = subject;
    if (description) ticket.description = description;
    if (category) ticket.category = category;
    if (priority) ticket.priority = priority;
    if (tags) ticket.tags = tags;

    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Ticket updated successfully',
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        updatedAt: ticket.lastUpdated
      }
    });

  } catch (error) {
    console.error('❌ Error updating ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating ticket',
      error: error.message
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
  updateTicket
};