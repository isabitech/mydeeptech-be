const SupportTicket = require('../models/supportTicket.model');
const DTUser = require('../models/dtUser.model');
const User = require('../models/user');

class ChatSupportRepository {
  async getExistingTicket(userId) {
    return SupportTicket.findOne({
      userId,
      status: { $in: ['open', 'in_progress', 'waiting_for_user'] },
      isChat: true
    });
  }

  async getDTUserById(userId) {
    return DTUser.findById(userId);
  }

  async getUserById(userId) {
    return User.findById(userId);
  }

  async createSupportTicket(ticketData) {
    return SupportTicket.create(ticketData);
  }

  async getActiveChatsForUser(userId) {
    return SupportTicket.find({
      userId,
      isChat: true,
      status: { $in: ['open', 'in_progress', 'waiting_for_user'] }
    })
    .sort({ lastUpdated: -1 })
    .populate('assignedTo', 'fullName email');
  }

  async getChatHistoryForUser(userId, skip, limit) {
    return SupportTicket.find({ userId, isChat: true })
      .sort({ lastUpdated: -1 })
      .skip(skip)
      .limit(limit)
      .populate('assignedTo', 'fullName email');
  }

  async countChatHistoryForUser(userId) {
    return SupportTicket.countDocuments({ userId, isChat: true });
  }

  async getTicketByIdAndUser(ticketId, userId) {
    return SupportTicket.findOne({ _id: ticketId, userId, isChat: true });
  }

  async getTicketByIdAndUserPopulated(ticketId, userId) {
    return SupportTicket.findOne({ _id: ticketId, userId, isChat: true })
      .populate('assignedTo', 'fullName email')
      .populate('resolution.resolvedBy', 'fullName email');
  }

  async getTicketByIdPopulatedAdmin(ticketId) {
    return SupportTicket.findOne({ _id: ticketId, isChat: true })
      .populate('userId', 'fullName email');
  }

  async getActiveChatTicketsAdmin(statusFilter) {
    return SupportTicket.find({
      isChat: true,
      status: statusFilter
    })
    .populate('userId', 'fullName email')
    .populate('assignedTo', 'fullName')
    .sort({ lastUpdated: -1 });
  }

  async saveTicket(ticket) {
    return ticket.save();
  }
}

module.exports = new ChatSupportRepository();
