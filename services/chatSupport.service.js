const ChatSupportRepository = require("../repositories/chatSupport.repository");
const { createNotification } = require("../utils/notificationService");
const {
  getOnlineAdminsCount,
  broadcastToAdmins,
} = require("../utils/chatSocketService");
const MailService = require("../services/mail-service/mail-service");

const buildError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const buildChatResponse = (statusCode, message, data) => ({
  statusCode,
  body: {
    success: true,
    message,
    data,
  },
});

const buildUserMessage = (user) => ({
  userName: user?.fullName || user?.username || "User",
  userEmail: user?.email || "",
});

const buildTicketMessage = (userId, userModel, message, attachments = []) => ({
  sender: userId,
  senderModel: userModel,
  message,
  isAdminReply: false,
  timestamp: new Date(),
  attachments,
});

const getUserWithModel = async (userId) => {
  const [dtUser, user] = await Promise.all([
    ChatSupportRepository.getDTUserById(userId),
    ChatSupportRepository.getUserById(userId),
  ]);

  if (dtUser) {
    return { user: dtUser, userModel: "DTUser" };
  }

  if (user) {
    return { user, userModel: "User" };
  }

  return { user: null, userModel: "DTUser" };
};

const generateTicketNumber = (userId) => {
  try {
    const timestamp = Date.now();
    const userIdShort = userId.toString().slice(-8);
    return `TKT-${timestamp}-${userIdShort}`;
  } catch (error) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    return `TKT-${timestamp}-${random}`;
  }
};

const resolveActiveStatusFilter = (status) => {
  if (status === "active") {
    return { $in: ["open", "in_progress", "waiting_for_user"] };
  }

  return status;
};

class ChatSupportService {
  async startChatSession(data) {
    const { userId, message, category, priority } = data;

    // Check if user already has an active chat ticket
    const existingTicket =
      await ChatSupportRepository.getExistingTicket(userId);
    if (existingTicket) {
      return buildChatResponse(200, "Chat session already exists", {
        ticketId: existingTicket._id,
        ticketNumber: existingTicket.ticketNumber,
        status: existingTicket.status,
        messages: existingTicket.messages,
        isExisting: true,
      });
    }

    const { user, userModel } = await getUserWithModel(userId);

    if (!user) throw buildError(404, "User not found");

    const ticketNumber = generateTicketNumber(userId);

    const ticketData = {
      ticketNumber,
      userId,
      userModel,
      subject: `Chat Support - ${new Date().toLocaleDateString()}`,
      description: message,
      category,
      priority,
      isChat: true,
      messages: [buildTicketMessage(userId, userModel, message)],
    };

    const ticket = await ChatSupportRepository.createSupportTicket(ticketData);

    if (getOnlineAdminsCount() > 0) {
      broadcastToAdmins("new_chat_ticket", {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        ...buildUserMessage(user),
        message,
        priority: ticket.priority,
        category: ticket.category,
        createdAt: ticket.createdAt,
      });
    } else {
      await MailService.sendadminSupportTicketNotification(
        "support@mydeeptech.ng",
        "Support Team",
        ticket,
        user,
      );
    }

    await createNotification({
      userId,
      type: "support_chat",
      title: `Chat Support Started - ${ticket.ticketNumber}`,
      message:
        "Your chat session has started. Our support team will assist you shortly.",
      priority: "medium",
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        isChat: true,
      },
    });

    return buildChatResponse(201, "Chat session started successfully", {
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      messages: ticket.messages,
      isExisting: false,
    });
  }

  async getActiveChats(userId) {
    const activeChats =
      await ChatSupportRepository.getActiveChatsForUser(userId);
    return buildChatResponse(200, "Active chats retrieved successfully", {
      activeChats,
      count: activeChats.length,
    });
  }

  async getChatHistory(userId, page, limit) {
    const skip = (page - 1) * limit;
    const [chatTickets, totalChats] = await Promise.all([
      ChatSupportRepository.getChatHistoryForUser(userId, skip, limit),
      ChatSupportRepository.countChatHistoryForUser(userId),
    ]);

    return buildChatResponse(200, "Chat history retrieved successfully", {
      chats: chatTickets,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalChats / limit),
        totalChats,
        hasNext: page * limit < totalChats,
        hasPrev: page > 1,
        limit,
      },
    });
  }

  async sendChatMessage(ticketId, userId, message, attachments) {
    const ticket = await ChatSupportRepository.getTicketByIdAndUser(
      ticketId,
      userId,
    );
    if (!ticket)
      throw buildError(404, "Chat ticket not found or access denied");

    const { user, userModel } = await getUserWithModel(userId);

    const newMessage = buildTicketMessage(
      userId,
      userModel,
      message,
      attachments,
    );

    ticket.messages.push(newMessage);
    if (ticket.status === "waiting_for_user") {
      ticket.status = "in_progress";
    }
    await ChatSupportRepository.saveTicket(ticket);

    if (getOnlineAdminsCount() > 0) {
      broadcastToAdmins("user_message", {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        ...buildUserMessage(user),
        message,
        timestamp: new Date(),
      });
    }

    return buildChatResponse(200, "Message sent successfully", {
      messageId: newMessage._id,
      timestamp: newMessage.timestamp,
      ticketStatus: ticket.status,
    });
  }

  async getChatTicketById(ticketId, userId) {
    const ticket = await ChatSupportRepository.getTicketByIdAndUserPopulated(
      ticketId,
      userId,
    );
    if (!ticket)
      throw buildError(404, "Chat ticket not found or access denied");
    return buildChatResponse(200, "Chat ticket retrieved successfully", {
      ticket,
    });
  }

  async getActiveChatTickets(status) {
    const statusFilter = resolveActiveStatusFilter(status);

    const activeChats =
      await ChatSupportRepository.getActiveChatTicketsAdmin(statusFilter);
    return buildChatResponse(
      200,
      "Active chat tickets retrieved successfully",
      {
        chats: activeChats,
        count: activeChats.length,
      },
    );
  }

  async joinChatAsAdmin(ticketId, adminId, adminName) {
    const ticket =
      await ChatSupportRepository.getTicketByIdPopulatedAdmin(ticketId);
    if (!ticket) throw buildError(404, "Chat ticket not found");

    if (!ticket.assignedTo) {
      ticket.assignedTo = adminId;
      ticket.assignedAt = new Date();
      if (ticket.status === "open") {
        ticket.status = "in_progress";
      }
      await ChatSupportRepository.saveTicket(ticket);
    }

    await createNotification({
      userId: ticket.userId._id,
      type: "support_agent_joined",
      title: `Support Agent Joined - ${ticket.ticketNumber}`,
      message:
        "A support agent has joined your chat and will assist you shortly.",
      priority: "high",
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        agentName: adminName,
        isChat: true,
      },
    });

    return buildChatResponse(200, "Successfully joined chat as admin", {
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
      assignedTo: adminId,
      status: ticket.status,
      userName: ticket.userId.fullName,
      userEmail: ticket.userId.email,
      messages: ticket.messages,
    });
  }

  async closeChatSession(ticketId, resolutionSummary, adminId, adminName) {
    const ticket =
      await ChatSupportRepository.getTicketByIdPopulatedAdmin(ticketId);
    if (!ticket) throw buildError(404, "Chat ticket not found");

    ticket.status = "resolved";
    ticket.resolution = {
      summary: resolutionSummary,
      resolvedBy: adminId,
      resolvedAt: new Date(),
      resolutionCategory: "solved",
    };

    await ChatSupportRepository.saveTicket(ticket);

    await createNotification({
      userId: ticket.userId._id,
      type: "support_resolved",
      title: `Chat Session Closed - ${ticket.ticketNumber}`,
      message:
        "Your chat session has been resolved. Please rate your experience.",
      priority: "high",
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        resolutionSummary,
        resolvedBy: adminName,
        isChat: true,
      },
    });

    return buildChatResponse(200, "Chat session closed successfully", {
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
      resolvedAt: ticket.resolution.resolvedAt,
      resolutionSummary,
    });
  }
}

module.exports = new ChatSupportService();
