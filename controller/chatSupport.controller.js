const SupportTicket = require('../models/supportTicket.model');
const DTUser = require('../models/dtUser.model');
const User = require('../models/user');
const { createNotification } = require('../utils/notificationService');
const { getOnlineAdminsCount, broadcastToAdmins } = require('../utils/chatSocketService');
const { sendNewTicketNotificationToAdmin, sendOfflineAgentNotification } = require('../utils/supportEmailTemplates');

/**
 * Start a new chat session (creates ticket automatically)
 * POST /api/chat/start
 */
const startChatSession = async (req, res) => {
  try {
    const { message, category = 'general_inquiry', priority = 'medium' } = req.body;
    const userId = req.userId || req.user?.userId;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Initial message is required to start chat'
      });
    }

    // Validate category (map common variations)
    const validCategories = [
      'technical_issue',
      'account_problem', 
      'payment_inquiry',
      'project_question',
      'assessment_issue',
      'application_help',
      'general_inquiry',
      'bug_report',
      'feature_request',
      'other'
    ];
    
    let validatedCategory = category;
    
    // Map common category variations
    if (category === 'account_support') {
      validatedCategory = 'account_problem';
    }
    
    if (!validCategories.includes(validatedCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`
      });
    }

    console.log(`🚀 Starting chat session for user: ${userId} with category: ${validatedCategory}`);

    // Check if user already has an active chat ticket
    const existingTicket = await SupportTicket.findOne({
      userId,
      status: { $in: ['open', 'in_progress', 'waiting_for_user'] },
      isChat: true
    });

    if (existingTicket) {
      return res.status(200).json({
        success: true,
        message: 'Chat session already exists',
        data: {
          ticketId: existingTicket._id,
          ticketNumber: existingTicket.ticketNumber,
          status: existingTicket.status,
          messages: existingTicket.messages,
          isExisting: true
        }
      });
    }

    // Determine user model type
    let userModel = 'DTUser';
    let user = await DTUser.findById(userId);
    if (!user) {
      user = await User.findById(userId);
      userModel = 'User';
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`👤 Creating ticket for user: ${user.fullName || user.username} (${userModel})`);

    // Generate ticket number using timestamp + userId for uniqueness
    const generateTicketNumber = () => {
      try {
        const timestamp = Date.now();
        const userIdShort = userId.toString().slice(-8); // Last 8 chars of userId
        const ticketNumber = `TKT-${timestamp}-${userIdShort}`;
        
        console.log(`🎫 Generated unique ticket number: ${ticketNumber}`);
        return ticketNumber;
      } catch (error) {
        console.error('❌ Error generating ticket number:', error);
        // Ultimate fallback
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `TKT-${timestamp}-${random}`;
      }
    };

    const ticketNumber = generateTicketNumber();

    // Create new chat ticket with first message
    const ticketData = {
      ticketNumber, // Add the generated ticket number
      userId,
      userModel,
      subject: `Chat Support - ${new Date().toLocaleDateString()}`,
      description: message,
      category: validatedCategory,
      priority,
      isChat: true,
      messages: [{
        sender: userId,
        senderModel: userModel,
        message,
        isAdminReply: false,
        timestamp: new Date()
      }]
    };

    console.log('🎫 Creating ticket with data:', JSON.stringify({...ticketData, messages: '[messages]'}, null, 2));

    const ticket = await SupportTicket.create(ticketData);

    // Notify admins if online, otherwise send email
    if (getOnlineAdminsCount() > 0) {
      broadcastToAdmins('new_chat_ticket', {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        userName: user.fullName || user.username,
        userEmail: user.email,
        message,
        priority: ticket.priority,
        category: ticket.category,
        createdAt: ticket.createdAt
      });
    } else {
      // Send urgent email to support team for offline agents
      await sendOfflineAgentNotification('support@mydeeptech.ng', ticket, user);
    }

    // Create notification for user
    await createNotification({
      userId,
      type: 'support_chat',
      title: `Chat Support Started - ${ticket.ticketNumber}`,
      message: 'Your chat session has started. Our support team will assist you shortly.',
      priority: 'medium',
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        isChat: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Chat session started successfully',
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        messages: ticket.messages,
        isExisting: false
      }
    });

    console.log(`💬 New chat session started: ${ticket.ticketNumber} by ${user.fullName || user.username}`);

  } catch (error) {
    console.error('❌ Error starting chat session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error starting chat session',
      error: error.message
    });
  }
};

/**
 * Get active chat sessions for user
 * GET /api/chat/active
 */
const getActiveChats = async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;

    const activeChats = await SupportTicket.find({
      userId,
      isChat: true,
      status: { $in: ['open', 'in_progress', 'waiting_for_user'] }
    })
    .sort({ lastUpdated: -1 })
    .populate('assignedTo', 'fullName email');

    res.status(200).json({
      success: true,
      message: 'Active chats retrieved successfully',
      data: {
        activeChats,
        count: activeChats.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching active chats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching active chats',
      error: error.message
    });
  }
};

/**
 * Get chat history for authenticated user
 * GET /api/chat/history
 */
const getChatHistory = async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [chatTickets, totalChats] = await Promise.all([
      SupportTicket.find({ userId, isChat: true })
        .sort({ lastUpdated: -1 })
        .skip(skip)
        .limit(limit)
        .populate('assignedTo', 'fullName email'),
      SupportTicket.countDocuments({ userId, isChat: true })
    ]);

    res.status(200).json({
      success: true,
      message: 'Chat history retrieved successfully',
      data: {
        chats: chatTickets,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalChats / limit),
          totalChats,
          hasNextPage: page * limit < totalChats,
          hasPrevPage: page > 1,
          limit
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching chat history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching chat history',
      error: error.message
    });
  }
};

/**
 * Send chat message (REST fallback)
 * POST /api/chat/:ticketId/message
 */
const sendChatMessage = async (req, res) => {
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

    const ticket = await SupportTicket.findOne({ _id: ticketId, userId, isChat: true });
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Chat ticket not found or access denied'
      });
    }

    // Determine user model
    let userModel = 'DTUser';
    const user = await DTUser.findById(userId);
    if (!user) {
      const regularUser = await User.findById(userId);
      if (regularUser) userModel = 'User';
    }

    // Add message
    const newMessage = {
      sender: userId,
      senderModel: userModel,
      message,
      isAdminReply: false,
      timestamp: new Date(),
      attachments
    };

    ticket.messages.push(newMessage);

    // Update status if needed
    if (ticket.status === 'waiting_for_user') {
      ticket.status = 'in_progress';
    }

    await ticket.save();

    // Notify online admins
    if (getOnlineAdminsCount() > 0) {
      broadcastToAdmins('user_message', {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        userName: user?.fullName || 'User',
        userEmail: user?.email || '',
        message,
        timestamp: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        messageId: newMessage._id,
        timestamp: newMessage.timestamp,
        ticketStatus: ticket.status
      }
    });

  } catch (error) {
    console.error('❌ Error sending chat message:', error);
    res.status(500).json({
      success: false,
      message: 'Server error sending message',
      error: error.message
    });
  }
};

/**
 * Get specific chat ticket by ID
 * GET /api/chat/:ticketId
 */
const getChatTicketById = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.userId || req.user?.userId;

    const ticket = await SupportTicket.findOne({ 
      _id: ticketId, 
      userId, 
      isChat: true 
    })
    .populate('assignedTo', 'fullName email')
    .populate('resolution.resolvedBy', 'fullName email');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Chat ticket not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Chat ticket retrieved successfully',
      data: { ticket }
    });

  } catch (error) {
    console.error('❌ Error fetching chat ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching chat ticket',
      error: error.message
    });
  }
};

/**
 * Get all active chat tickets (admin only)
 * GET /api/chat/admin/active
 */
const getActiveChatTickets = async (req, res) => {
  try {
    const status = req.query.status || 'active';
    
    let statusFilter;
    if (status === 'active') {
      statusFilter = { $in: ['open', 'in_progress', 'waiting_for_user'] };
    } else {
      statusFilter = status;
    }

    const activeChats = await SupportTicket.find({
      isChat: true,
      status: statusFilter
    })
    .populate('userId', 'fullName email')
    .populate('assignedTo', 'fullName')
    .sort({ lastUpdated: -1 });

    res.status(200).json({
      success: true,
      message: 'Active chat tickets retrieved successfully',
      data: {
        chats: activeChats,
        count: activeChats.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching active chat tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching active chats',
      error: error.message
    });
  }
};

/**
 * Join chat as admin (assigns ticket and updates status)
 * POST /api/chat/admin/join/:ticketId
 */
const joinChatAsAdmin = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const adminId = req.admin._id;

    const ticket = await SupportTicket.findOne({ _id: ticketId, isChat: true })
      .populate('userId', 'fullName email');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Chat ticket not found'
      });
    }

    // Assign ticket if not already assigned
    if (!ticket.assignedTo) {
      ticket.assignedTo = adminId;
      ticket.assignedAt = new Date();
      if (ticket.status === 'open') {
        ticket.status = 'in_progress';
      }
      await ticket.save();
    }

    // Create notification for user
    await createNotification({
      userId: ticket.userId._id,
      type: 'support_agent_joined',
      title: `Support Agent Joined - ${ticket.ticketNumber}`,
      message: 'A support agent has joined your chat and will assist you shortly.',
      priority: 'high',
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        agentName: req.admin.fullName,
        isChat: true
      }
    });

    res.status(200).json({
      success: true,
      message: 'Successfully joined chat as admin',
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        assignedTo: adminId,
        status: ticket.status,
        userName: ticket.userId.fullName,
        userEmail: ticket.userId.email,
        messages: ticket.messages
      }
    });

    console.log(`👨‍💼 Admin ${req.admin.fullName} joined chat ticket ${ticket.ticketNumber}`);

  } catch (error) {
    console.error('❌ Error joining chat as admin:', error);
    res.status(500).json({
      success: false,
      message: 'Server error joining chat',
      error: error.message
    });
  }
};

/**
 * Close chat session (admin only)
 * POST /api/chat/admin/close/:ticketId
 */
const closeChatSession = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { resolutionSummary = 'Chat session completed successfully' } = req.body;
    const adminId = req.admin._id;

    const ticket = await SupportTicket.findOne({ _id: ticketId, isChat: true })
      .populate('userId', 'fullName email');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Chat ticket not found'
      });
    }

    // Update ticket to resolved status
    ticket.status = 'resolved';
    ticket.resolution = {
      summary: resolutionSummary,
      resolvedBy: adminId,
      resolvedAt: new Date(),
      resolutionCategory: 'solved'
    };

    await ticket.save();

    // Create notification for user
    await createNotification({
      userId: ticket.userId._id,
      type: 'support_resolved',
      title: `Chat Session Closed - ${ticket.ticketNumber}`,
      message: 'Your chat session has been resolved. Please rate your experience.',
      priority: 'high',
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        resolutionSummary,
        resolvedBy: req.admin.fullName,
        isChat: true
      }
    });

    res.status(200).json({
      success: true,
      message: 'Chat session closed successfully',
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        resolvedAt: ticket.resolution.resolvedAt,
        resolutionSummary
      }
    });

    console.log(`✅ Chat ticket ${ticket.ticketNumber} closed by ${req.admin.fullName}`);

  } catch (error) {
    console.error('❌ Error closing chat session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error closing chat session',
      error: error.message
    });
  }
};

module.exports = {
  startChatSession,
  getActiveChats,
  getChatHistory,
  sendChatMessage,
  getChatTicketById,
  getActiveChatTickets,
  joinChatAsAdmin,
  closeChatSession
};