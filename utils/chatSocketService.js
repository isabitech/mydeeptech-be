const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const SupportTicket = require('../models/supportTicket.model');
const DTUser = require('../models/dtUser.model');
const User = require('../models/user');
const { createNotification } = require('./notificationService');
const { sendNewTicketNotificationToAdmin, sendTicketStatusUpdateEmail } = require('./supportEmailTemplates');

let io;
const connectedUsers = new Map(); // Track online users: { userId: socketId }
const connectedAdmins = new Map(); // Track online admins: { adminId: socketId }

/**
 * Initialize Socket.IO server
 * @param {Object} server - HTTP server instance
 */
const initializeSocketIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://mydeeptech.ng', 'https://www.mydeeptech.ng'],
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if it's a user or admin
      let user = await DTUser.findById(decoded.userId);
      let userType = 'dtuser';
      let isAdmin = false;
      
      if (!user) {
        user = await User.findById(decoded.userId);
        userType = 'user';
      }

      if (!user) {
        return next(new Error('User not found'));
      }

      // Check if user is admin by email domain
      isAdmin = user.email && user.email.includes('@mydeeptech.ng');

      socket.userId = decoded.userId;
      socket.userType = userType;
      socket.isAdmin = isAdmin;
      socket.userEmail = user.email;
      socket.userName = user.fullName || user.username;
      
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔗 User connected: ${socket.userName} (${socket.userId})`);
    
    // Track connected users/admins
    if (socket.isAdmin) {
      connectedAdmins.set(socket.userId, socket.id);
      socket.join('admins'); // Join admin room for broadcasts
      console.log(`👨‍💼 Admin connected: ${socket.userName} (${socket.userEmail})`);
    } else {
      connectedUsers.set(socket.userId, socket.id);
      console.log(`👤 User connected: ${socket.userName} (${socket.userEmail})`);
    }

    // Join user to their personal room for targeted messages
    socket.join(`user_${socket.userId}`);

    // Auto-rejoin user to their active chat tickets on connection
    const rejoinActiveTickets = async () => {
      try {
        const activeTickets = await SupportTicket.find({
          userId: socket.userId,
          status: { $in: ['open', 'in_progress', 'waiting_for_user'] },
          isChat: true
        });

        for (const ticket of activeTickets) {
          socket.join(`ticket_${ticket._id}`);
          console.log(`🔄 User ${socket.userName} rejoined ticket: ${ticket.ticketNumber}`);
        }

        if (activeTickets.length > 0) {
          socket.emit('active_tickets', {
            tickets: activeTickets.map(ticket => ({
              ticketId: ticket._id,
              ticketNumber: ticket.ticketNumber,
              status: ticket.status,
              subject: ticket.subject,
              lastUpdated: ticket.lastUpdated,
              messages: ticket.messages
            }))
          });
        }
      } catch (error) {
        console.error('❌ Error rejoining active tickets:', error);
      }
    };

    // Call rejoin function after connection
    rejoinActiveTickets();

    // Handle getting chat history
    socket.on('get_chat_history', async (data) => {
      try {
        const { ticketId } = data;
        
        const ticket = await SupportTicket.findOne({
          _id: ticketId,
          userId: socket.userId,
          isChat: true
        });

        if (!ticket) {
          socket.emit('error', { message: 'Ticket not found or access denied' });
          return;
        }

        // Join the ticket room if not already joined
        socket.join(`ticket_${ticketId}`);

        socket.emit('chat_history', {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
          subject: ticket.subject,
          messages: ticket.messages,
          createdAt: ticket.createdAt,
          lastUpdated: ticket.lastUpdated
        });

        console.log(`📋 Chat history sent for ticket ${ticket.ticketNumber} to ${socket.userName}`);
      } catch (error) {
        console.error('❌ Error getting chat history:', error);
        socket.emit('error', { message: 'Failed to get chat history' });
      }
    });

    // Handle rejoining a specific ticket
    socket.on('rejoin_ticket', async (data) => {
      try {
        const { ticketId } = data;
        
        const ticket = await SupportTicket.findOne({
          _id: ticketId,
          userId: socket.userId,
          isChat: true
        });

        if (!ticket) {
          socket.emit('error', { message: 'Ticket not found or access denied' });
          return;
        }

        // Join the ticket room
        socket.join(`ticket_${ticketId}`);

        socket.emit('ticket_rejoined', {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
          messages: ticket.messages,
          lastUpdated: ticket.lastUpdated
        });

        console.log(`🔄 User ${socket.userName} manually rejoined ticket: ${ticket.ticketNumber}`);
      } catch (error) {
        console.error('❌ Error rejoining ticket:', error);
        socket.emit('error', { message: 'Failed to rejoin ticket' });
      }
    });

    // Handle starting a chat (auto-create ticket)
    socket.on('start_chat', async (data) => {
      try {
        const { message, category = 'general_inquiry', priority = 'medium' } = data;

        // Check if user already has an open chat ticket
        let existingTicket = await SupportTicket.findOne({
          userId: socket.userId,
          status: { $in: ['open', 'in_progress'] },
          isChat: true
        });

        if (existingTicket) {
          // Join existing chat ticket room
          socket.join(`ticket_${existingTicket._id}`);
          
          socket.emit('chat_started', {
            ticketId: existingTicket._id,
            ticketNumber: existingTicket.ticketNumber,
            messages: existingTicket.messages,
            status: existingTicket.status
          });
          
          return;
        }

        // Generate ticket number using timestamp + userId
        const generateTicketNumber = () => {
          const timestamp = Date.now();
          const userIdShort = socket.userId.toString().slice(-8);
          return `TKT-${timestamp}-${userIdShort}`;
        };

        const ticketNumber = generateTicketNumber();
        console.log(`🎫 Socket.IO - Generated ticket number: ${ticketNumber}`);

        // Create new chat ticket
        const ticket = await SupportTicket.create({
          ticketNumber,
          userId: socket.userId,
          userModel: socket.userType === 'dtuser' ? 'DTUser' : 'User',
          subject: `Chat Support - ${new Date().toLocaleDateString()}`,
          description: message,
          category,
          priority,
          isChat: true,
          messages: [{
            sender: socket.userId,
            senderModel: socket.userType === 'dtuser' ? 'DTUser' : 'User',
            message,
            isAdminReply: false,
            timestamp: new Date()
          }]
        });

        // Join ticket room
        socket.join(`ticket_${ticket._id}`);

        // Notify admins about new chat
        socket.to('admins').emit('new_chat_ticket', {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          userName: socket.userName,
          userEmail: socket.userEmail,
          message,
          priority: ticket.priority,
          category: ticket.category,
          createdAt: ticket.createdAt
        });

        // Send email to support if no admins online
        if (connectedAdmins.size === 0) {
          const user = { fullName: socket.userName, email: socket.userEmail, _id: socket.userId };
          await sendNewTicketNotificationToAdmin('support@mydeeptech.ng', ticket, user);
        }

        // Create notification for user
        await createNotification({
          userId: socket.userId,
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

        socket.emit('chat_started', {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          messages: ticket.messages,
          status: ticket.status
        });

        console.log(`💬 New chat ticket created: ${ticket.ticketNumber} by ${socket.userName}`);

      } catch (error) {
        console.error('❌ Error starting chat:', error);
        socket.emit('error', { message: 'Failed to start chat' });
      }
    });

    // Handle sending chat messages
    socket.on('send_message', async (data) => {
      try {
        const { ticketId, message, attachments = [] } = data;

        const ticket = await SupportTicket.findById(ticketId);
        if (!ticket) {
          socket.emit('error', { message: 'Ticket not found' });
          return;
        }

        // Verify user has access to this ticket
        if (ticket.userId.toString() !== socket.userId && !connectedAdmins.has(socket.userId)) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        const isAdminReply = socket.isAdmin;

        // Add message to ticket
        const newMessage = {
          sender: socket.userId,
          senderModel: socket.isAdmin ? 'Admin' : (socket.userType === 'dtuser' ? 'DTUser' : 'User'),
          message,
          isAdminReply,
          timestamp: new Date(),
          attachments
        };

        ticket.messages.push(newMessage);

        // Update ticket status
        if (isAdminReply && ticket.status === 'open') {
          ticket.status = 'in_progress';
        } else if (!isAdminReply && ticket.status === 'waiting_for_user') {
          ticket.status = 'in_progress';
        }

        await ticket.save();

        // Get the saved message from the ticket (it now has the MongoDB _id)
        const savedMessage = ticket.messages[ticket.messages.length - 1];

        const messageWithSender = {
          ...(savedMessage.toObject ? savedMessage.toObject() : savedMessage),
          senderName: socket.userName,
          senderEmail: socket.userEmail,
          messageId: savedMessage._id
        };

        // Broadcast to all users in ticket room
        io.to(`ticket_${ticketId}`).emit('new_message', messageWithSender);

        // If admin replied, notify user
        if (isAdminReply) {
          await createNotification({
            userId: ticket.userId,
            type: 'support_reply',
            title: `Support Reply - ${ticket.ticketNumber}`,
            message: 'Our support team has replied to your chat.',
            priority: 'high',
            data: {
              ticketId: ticket._id,
              ticketNumber: ticket.ticketNumber,
              isChat: true
            }
          });
        } else {
          // User message - notify online admins
          socket.to('admins').emit('user_message', {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            userName: socket.userName,
            userEmail: socket.userEmail,
            message,
            timestamp: new Date()
          });

          // If no admins online, send email
          if (connectedAdmins.size === 0) {
            // Email notification logic will be handled here
            console.log('📧 No admins online, should send email notification');
          }
        }

        console.log(`💬 Message sent in ticket ${ticket.ticketNumber} by ${socket.userName}`);

      } catch (error) {
        console.error('❌ Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle admin joining ticket chat
    socket.on('join_ticket', async (data) => {
      try {
        const { ticketId } = data;
        
        if (!connectedAdmins.has(socket.userId)) {
          socket.emit('error', { message: 'Admin access required' });
          return;
        }

        const ticket = await SupportTicket.findById(ticketId)
          .populate('userId', 'fullName email');

        if (!ticket) {
          socket.emit('error', { message: 'Ticket not found' });
          return;
        }

        socket.join(`ticket_${ticketId}`);

        // Assign ticket to admin if not assigned
        if (!ticket.assignedTo) {
          ticket.assignedTo = socket.userId;
          ticket.assignedAt = new Date();
          if (ticket.status === 'open') {
            ticket.status = 'in_progress';
          }
          await ticket.save();
        }

        socket.emit('ticket_joined', {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          userName: ticket.userId.fullName,
          userEmail: ticket.userId.email,
          messages: ticket.messages,
          status: ticket.status,
          assignedTo: ticket.assignedTo
        });

        console.log(`👨‍💼 Admin ${socket.userName} joined ticket ${ticket.ticketNumber}`);

      } catch (error) {
        console.error('❌ Error joining ticket:', error);
        socket.emit('error', { message: 'Failed to join ticket' });
      }
    });

    // Handle closing chat/ticket
    socket.on('close_chat', async (data) => {
      try {
        const { ticketId, resolutionSummary = 'Chat session completed' } = data;

        if (!connectedAdmins.has(socket.userId)) {
          socket.emit('error', { message: 'Admin access required' });
          return;
        }

        const ticket = await SupportTicket.findById(ticketId);
        if (!ticket) {
          socket.emit('error', { message: 'Ticket not found' });
          return;
        }

        ticket.status = 'resolved';
        ticket.resolution = {
          summary: resolutionSummary,
          resolvedBy: socket.userId,
          resolvedAt: new Date(),
          resolutionCategory: 'solved'
        };

        await ticket.save();

        // Notify all participants
        io.to(`ticket_${ticketId}`).emit('chat_closed', {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          resolutionSummary,
          resolvedBy: socket.userName,
          resolvedAt: new Date()
        });

        // Create notification for user
        await createNotification({
          userId: ticket.userId,
          type: 'support_resolved',
          title: `Chat Session Closed - ${ticket.ticketNumber}`,
          message: 'Your chat session has been resolved. Please rate your experience.',
          priority: 'high',
          data: {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            resolutionSummary,
            isChat: true
          }
        });

        console.log(`✅ Chat ticket ${ticket.ticketNumber} closed by ${socket.userName}`);

      } catch (error) {
        console.error('❌ Error closing chat:', error);
        socket.emit('error', { message: 'Failed to close chat' });
      }
    });

    // Handle getting active tickets for admin
    socket.on('get_active_chats', async () => {
      try {
        if (!connectedAdmins.has(socket.userId)) {
          socket.emit('error', { message: 'Admin access required' });
          return;
        }

        const activeChats = await SupportTicket.find({
          isChat: true,
          status: { $in: ['open', 'in_progress', 'waiting_for_user'] }
        })
        .populate('userId', 'fullName email')
        .populate('assignedTo', 'fullName')
        .sort({ lastUpdated: -1 });

        socket.emit('active_chats', activeChats);

      } catch (error) {
        console.error('❌ Error getting active chats:', error);
        socket.emit('error', { message: 'Failed to get active chats' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${socket.userName}`);
      
      if (socket.isAdmin) {
        connectedAdmins.delete(socket.userId);
      } else {
        connectedUsers.delete(socket.userId);
      }
    });
  });

  console.log('🚀 Socket.IO chat server initialized');
};

/**
 * Get Socket.IO instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

/**
 * Check if admin is online
 */
const isAdminOnline = (adminId) => {
  return connectedAdmins.has(adminId);
};

/**
 * Check if user is online
 */
const isUserOnline = (userId) => {
  return connectedUsers.has(userId);
};

/**
 * Get online admins count
 */
const getOnlineAdminsCount = () => {
  return connectedAdmins.size;
};

/**
 * Send notification to specific user if online
 */
const sendNotificationToUser = (userId, notification) => {
  if (io && connectedUsers.has(userId)) {
    io.to(`user_${userId}`).emit('notification', notification);
  }
};

/**
 * Broadcast to all online admins
 */
const broadcastToAdmins = (event, data) => {
  if (io) {
    io.to('admins').emit(event, data);
  }
};

module.exports = {
  initializeSocketIO,
  getIO,
  isAdminOnline,
  isUserOnline,
  getOnlineAdminsCount,
  sendNotificationToUser,
  broadcastToAdmins
};