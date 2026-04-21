const ChatSupportService = require('../services/chatSupport.service');

const startChatSession = async (req, res) => {
  try {
    const data = {
      ...req.body,
      userId: req.userId || req.user?.userId
    };
    
    if (!data.message) {
      return res.status(400).json({ success: false, message: 'Initial message is required to start chat' });
    }

    const { category = 'general_inquiry', priority = 'medium' } = data;
    const validCategories = ['technical_issue', 'account_problem', 'payment_inquiry', 'project_question', 'assessment_issue', 'application_help', 'general_inquiry', 'bug_report', 'feature_request', 'other'];
    const validatedCategory = category === 'account_support' ? 'account_problem' : category;
    
    if (!validCategories.includes(validatedCategory)) {
      return res.status(400).json({ success: false, message: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ success: false, message: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` });
    }

    data.category = validatedCategory;
    const result = await ChatSupportService.startChatSession(data);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('❌ Error starting chat session:', error);
    res.status(error.status || 500).json({ success: false, message: 'Server error starting chat session', error: error.message });
  }
};

const getActiveChats = async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;
    const result = await ChatSupportService.getActiveChats(userId);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('❌ Error fetching active chats:', error);
    res.status(error.status || 500).json({ success: false, message: 'Server error fetching active chats', error: error.message });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await ChatSupportService.getChatHistory(userId, page, limit);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('❌ Error fetching chat history:', error);
    res.status(error.status || 500).json({ success: false, message: 'Server error fetching chat history', error: error.message });
  }
};

const sendChatMessage = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message, attachments = [] } = req.body;
    const userId = req.userId || req.user?.userId;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const result = await ChatSupportService.sendChatMessage(ticketId, userId, message, attachments);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('❌ Error sending chat message:', error);
    res.status(error.status || 500).json({ success: false, message: 'Server error sending message', error: error.message });
  }
};

const getChatTicketById = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.userId || req.user?.userId;
    const result = await ChatSupportService.getChatTicketById(ticketId, userId);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('❌ Error fetching chat ticket:', error);
    res.status(error.status || 500).json({ success: false, message: 'Server error fetching chat ticket', error: error.message });
  }
};

const getActiveChatTickets = async (req, res) => {
  try {
    const status = req.query.status || 'active';
    const result = await ChatSupportService.getActiveChatTickets(status);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('❌ Error fetching active chat tickets:', error);
    res.status(error.status || 500).json({ success: false, message: 'Server error fetching active chats', error: error.message });
  }
};

const joinChatAsAdmin = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const adminId = req.admin._id;
    const adminName = req.admin.fullName;
    const result = await ChatSupportService.joinChatAsAdmin(ticketId, adminId, adminName);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('❌ Error joining chat as admin:', error);
    res.status(error.status || 500).json({ success: false, message: 'Server error joining chat', error: error.message });
  }
};

const closeChatSession = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { resolutionSummary = 'Chat session completed successfully' } = req.body;
    const adminId = req.admin._id;
    const adminName = req.admin.fullName;
    const result = await ChatSupportService.closeChatSession(ticketId, resolutionSummary, adminId, adminName);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('❌ Error closing chat session:', error);
    res.status(error.status || 500).json({ success: false, message: 'Server error closing chat session', error: error.message });
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