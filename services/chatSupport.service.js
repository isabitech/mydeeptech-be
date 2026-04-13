const ChatSupportRepository = require('../repositories/chatSupport.repository');
const { createNotification } = require('../utils/notificationService');
const { getOnlineAdminsCount, broadcastToAdmins } = require('../utils/chatSocketService');
const MailService = require('../services/mail-service/mail-service');

const buildError = (status, message) => {
    const error = new Error(message);
    error.status = status;
    return error;
};

class ChatSupportService {
  async startChatSession(data) {
    const { userId, message, category, priority } = data;
    
    // Check if user already has an active chat ticket
    const existingTicket = await ChatSupportRepository.getExistingTicket(userId);
    if (existingTicket) {
      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'Chat session already exists',
          data: {
            ticketId: existingTicket._id,
            ticketNumber: existingTicket.ticketNumber,
            status: existingTicket.status,
            messages: existingTicket.messages,
            isExisting: true
          }
        }
      };
    }

    let userModel = 'DTUser';
    let user = await ChatSupportRepository.getDTUserById(userId);
    if (!user) {
      user = await ChatSupportRepository.getUserById(userId);
      userModel = 'User';
    }

    if (!user) throw buildError(404, 'User not found');

    const generateTicketNumber = () => {
      try {
        const timestamp = Date.now();
        const userIdShort = userId.toString().slice(-8);
        return `TKT-${timestamp}-${userIdShort}`;
      } catch (error) {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `TKT-${timestamp}-${random}`;
      }
    };

    const ticketNumber = generateTicketNumber();

    const ticketData = {
      ticketNumber,
      userId,
      userModel,
      subject: `Chat Support - ${new Date().toLocaleDateString()}`,
      description: message,
      category,
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

    const ticket = await ChatSupportRepository.createSupportTicket(ticketData);

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
      await MailService.sendadminSupportTicketNotification('support@mydeeptech.ng', 'Support Team', ticket, user);
    }

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

    return {
      statusCode: 201,
      body: {
        success: true,
        message: 'Chat session started successfully',
        data: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
          messages: ticket.messages,
          isExisting: false
        }
      }
    };
  }

  async getActiveChats(userId) {
    const activeChats = await ChatSupportRepository.getActiveChatsForUser(userId);
    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Active chats retrieved successfully',
        data: {
          activeChats,
          count: activeChats.length
        }
      }
    };
  }

  async getChatHistory(userId, page, limit) {
    const skip = (page - 1) * limit;
    const [chatTickets, totalChats] = await Promise.all([
      ChatSupportRepository.getChatHistoryForUser(userId, skip, limit),
      ChatSupportRepository.countChatHistoryForUser(userId)
    ]);

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Chat history retrieved successfully',
        data: {
          chats: chatTickets,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalChats / limit),
            totalChats,
            hasNext: page * limit < totalChats,
            hasPrev: page > 1,
            limit
          }
        }
      }
    };
  }

  async sendChatMessage(ticketId, userId, message, attachments) {
    const ticket = await ChatSupportRepository.getTicketByIdAndUser(ticketId, userId);
    if (!ticket) throw buildError(404, 'Chat ticket not found or access denied');

    let userModel = 'DTUser';
    let user = await ChatSupportRepository.getDTUserById(userId);
    if (!user) {
      user = await ChatSupportRepository.getUserById(userId);
      if (user) userModel = 'User';
    }

    const newMessage = {
      sender: userId,
      senderModel: userModel,
      message,
      isAdminReply: false,
      timestamp: new Date(),
      attachments
    };

    ticket.messages.push(newMessage);
    if (ticket.status === 'waiting_for_user') {
      ticket.status = 'in_progress';
    }
    await ChatSupportRepository.saveTicket(ticket);

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

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Message sent successfully',
        data: {
          messageId: newMessage._id,
          timestamp: newMessage.timestamp,
          ticketStatus: ticket.status
        }
      }
    };
  }

  async getChatTicketById(ticketId, userId) {
    const ticket = await ChatSupportRepository.getTicketByIdAndUserPopulated(ticketId, userId);
    if (!ticket) throw buildError(404, 'Chat ticket not found or access denied');
    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Chat ticket retrieved successfully',
        data: { ticket }
      }
    };
  }

  async getActiveChatTickets(status) {
    let statusFilter;
    if (status === 'active') {
      statusFilter = { $in: ['open', 'in_progress', 'waiting_for_user'] };
    } else {
      statusFilter = status;
    }
    
    const activeChats = await ChatSupportRepository.getActiveChatTicketsAdmin(statusFilter);
    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Active chat tickets retrieved successfully',
        data: {
          chats: activeChats,
          count: activeChats.length
        }
      }
    };
  }

  async joinChatAsAdmin(ticketId, adminId, adminName) {
    const ticket = await ChatSupportRepository.getTicketByIdPopulatedAdmin(ticketId);
    if (!ticket) throw buildError(404, 'Chat ticket not found');

    if (!ticket.assignedTo) {
      ticket.assignedTo = adminId;
      ticket.assignedAt = new Date();
      if (ticket.status === 'open') {
        ticket.status = 'in_progress';
      }
      await ChatSupportRepository.saveTicket(ticket);
    }

    await createNotification({
      userId: ticket.userId._id,
      type: 'support_agent_joined',
      title: `Support Agent Joined - ${ticket.ticketNumber}`,
      message: 'A support agent has joined your chat and will assist you shortly.',
      priority: 'high',
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        agentName: adminName,
        isChat: true
      }
    });

    return {
      statusCode: 200,
      body: {
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
      }
    };
  }

  async closeChatSession(ticketId, resolutionSummary, adminId, adminName) {
    const ticket = await ChatSupportRepository.getTicketByIdPopulatedAdmin(ticketId);
    if (!ticket) throw buildError(404, 'Chat ticket not found');

    ticket.status = 'resolved';
    ticket.resolution = {
      summary: resolutionSummary,
      resolvedBy: adminId,
      resolvedAt: new Date(),
      resolutionCategory: 'solved'
    };

    await ChatSupportRepository.saveTicket(ticket);

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
        resolvedBy: adminName,
        isChat: true
      }
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Chat session closed successfully',
        data: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          resolvedAt: ticket.resolution.resolvedAt,
          resolutionSummary
        }
      }
    };
  }
}

module.exports = new ChatSupportService();
