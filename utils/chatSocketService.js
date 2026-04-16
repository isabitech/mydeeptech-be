const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const SupportTicket = require("../models/supportTicket.model");
const DTUser = require("../models/dtUser.model");
const { createNotification } = require("./notificationService");
// const { sendNewTicketNotificationToAdmin, sendTicketStatusUpdateEmail, sendAdminReplyNotificationEmail } = require('./supportEmailTemplates');
// Replaced with MailService:
const MailService = require("../services/mail-service/mail-service");
const {
  canSendDailyEmail,
  markDailyEmailSent,
  getDailyEmailStatus,
} = require("./dailyEmailTracker");
const envConfig = require("../config/envConfig");

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
      origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://mydeeptech.ng",
        "https://www.mydeeptech.ng",
        "https://mydeeptech.onrender.com",
        "https://mydeeptech-frontend.onrender.com",
        // Allow PC agents from any local connection
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
        /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
        // Allow all for development (remove in production)
        true,
      ],
      credentials: true,
      methods: ["GET", "POST"],
    },
    // Fix handshake timeout issues
    pingTimeout: 60000,
    pingInterval: 25000,
    // Allow both WebSocket and polling transports
    transports: ["websocket", "polling"],
    // Allow upgrades from polling to websocket
    allowUpgrades: true,
    // Increase handshake timeout for better compatibility
    upgradeTimeout: 30000,
    // Enhanced connection validation
    allowRequest: (req, callback) => {
      // Check if this is a PC agent trying to connect
      const userAgent = req.headers["user-agent"] || "";
      const isPCAgent = userAgent.includes("PCAgent");

      if (isPCAgent) {
        console.log("🔧 PC Agent detected - WebSocket upgrade enabled");
      }
      // Always allow connections
      callback(null, true);
    },
  });

  // Enhanced connection error with more context
  io.engine.on("connection_error", (error, context) => {
    // Try to extract request info from error object
    if (error.req) {
      console.log("   Failed Request URL:", error.req.url);
    }

  });

  // Track successful connections
  io.engine.on("connection", (socket) => {
    // console.log("   URL:", socket.request.url);
  });

  // Monitor upgrade events
  io.engine.on("upgrade", (socket) => {
    // console.log("   Socket:", socket.id);
  });

  // Monitor upgrade errors
  io.engine.on("upgrade_error", (error) => {
    console.log("   Error:", error);
  });

  // DEBUG: Add packet interceptor to see raw packet data
  io.engine.on("packet", (packet, socket) => {
    const data = packet.data || packet;
    const dataStr = typeof data === "string" ? data : JSON.stringify(data);

    // Check for namespace join attempts
    if (dataStr.includes("/hvnc-device") || dataStr.includes("hvnc")) {
      console.log("🎯 HVNC NAMESPACE JOIN DETECTED!");
    }

    // Also check for any message that starts with numbers (Socket.IO protocol)
    if (dataStr.match(/^[0-9]/)) {
      console.log("🔢 SOCKET.IO PROTOCOL MESSAGE:");
    }
  });

  // DEBUG: Add message interceptor for Engine.IO
  io.engine.on("message", (data, socket) => {
    const msgStr = data ? data.toString() : "null";

    // Check for HVNC namespace messages
    if (msgStr.includes("/hvnc-device") || msgStr.includes("hvnc")) {
      console.log("🎯🎯🎯 HVNC NAMESPACE MESSAGE DETECTED! 🎯🎯🎯");
    }

    // Check for Socket.IO protocol messages
    if (msgStr.match(/^[0-9]/)) {

      // Socket.IO protocol:
      // 0 = connect, 1 = disconnect, 2 = event, 3 = ack, 4 = connect error, 5 = binary event, 6 = binary ack
      switch (msgStr.charAt(0)) {
        case "0":
          console.log("   → SOCKET.IO CONNECT ATTEMPT");
          break;
        case "4":
          if (msgStr.includes("/")) {
            // Try to manually trigger Socket.IO parsing
            try {
              // console.log("   → Socket.IO instance exists:", !!io);
            } catch (err) {
              console.log("   → Error checking namespaces:", err.message);
            }
          } else {
            console.log("   → CONNECT ERROR: ", msgStr);
          }
          break;
        default:
          console.log("   → OTHER SOCKET.IO MESSAGE: ", msgStr.charAt(0));
      }
    }
  });

  io.on("connection", (socket) => {
    try {
      // Check namespaces using different methods
      if (io.sockets && io.sockets.adapter && io.sockets.adapter.nsp) {
        // console.log("   Main namespace exists:", !!io.sockets);
      }

      // Force namespace registration check
      const deviceNs = io._nsps ? io._nsps.get("/hvnc-device") : null;
      // Try alternate namespace access
      const deviceNs2 = io.of("/hvnc-device");

      // Check if namespace has connections
      if (deviceNs2 && deviceNs2.sockets) {
        // console.log(
        //   "   Device namespace connections:",
        //   deviceNs2.sockets.size || 0,
        // );
      }
    } catch (err) {
      console.log("   Namespace check error:", err.message);
    }

    // DEBUG: Log all incoming data to see namespace join attempts
    socket.onAny((eventName, ...args) => {
      // console.log("🔍 SOCKET.IO EVENT:", eventName, args.slice(0, 2));
    });

    socket.on("error", (error) => {
      // console.log("❌ SOCKET.IO ERROR:", error);
    });

    socket.on("disconnect", (reason) => {
      // console.log("🔌 SOCKET.IO DISCONNECT:", reason);
    });

    try {
      const hvncNamespace = io.of("/hvnc-device");
      if (hvncNamespace) {
        // Try to emit a test event to the namespace
        hvncNamespace.emit("test", { message: "Manual namespace test" });
      }
    } catch (err) {
      console.log("   Manual namespace routing error:", err.message);
    }
  });

  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {

    try {
      // Get token from auth header or query parameter
      const token = socket.handshake.auth.token || 
                   socket.handshake.headers.authorization?.split(' ')[1] ||
                   socket.handshake.query.token;

      if (!token) {
        console.log("❌ No authentication token provided");
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, envConfig.jwt.JWT_SECRET);

      // Get user type from query or default to 'user'
      const userType = socket.handshake.query.userType || 'user';

      // Fetch user data based on type
      let user = null;
      let isAdmin = false;

      if (userType === 'dtuser') {
        user = await DTUser.findById(decoded.userId);
        if (!user) {
          return next(new Error('User not found'));
        }
        
        if (!user.isEmailVerified) {
          return next(new Error('Email not verified'));
        }

        // Set socket properties
        socket.userId = user._id.toString();
        socket.userType = 'dtuser';
        socket.userEmail = user.email;
        socket.userName = user.fullName || user.email;
        socket.isAdmin = false;

      } else if (userType === 'user') {
        user = await DTUser.findById(decoded.userId);
        if (!user) {
          console.log("❌ DTUser not found:", decoded.userId);
          return next(new Error('User not found'));
        }
        
        if (!user.isEmailVerified) {
          return next(new Error('Email not verified'));
        }

        // Set socket properties
        socket.userId = user._id.toString();
        socket.userType = 'user';
        socket.userEmail = user.email;
        socket.userName = user.fullName || user.email;
        
        // Check if user is admin
        isAdmin = user.role === 'admin' || user.role === 'moderator';
        socket.isAdmin = isAdmin;

      } else if (userType === 'admin') {
        user = await DTUser.findById(decoded.userId);
        if (!user) {
          console.log("❌ Admin DTUser not found:", decoded.userId);
          return next(new Error('Admin user not found'));
        }
        
        if (!user.isEmailVerified) {
          console.log("❌ Admin DTUser email not verified:", decoded.email);
          return next(new Error('Email not verified'));
        }

        // Verify admin role
        if (user.role !== 'admin' && user.role !== 'moderator') {
          console.log("❌ DTUser does not have admin privileges:", user.email);
          return next(new Error('Admin privileges required'));
        }

        // Set socket properties for admin
        socket.userId = user._id.toString();
        socket.userType = 'admin';
        socket.userEmail = user.email;
        socket.userName = user.fullName || user.email;
        socket.isAdmin = true;

      } else {
        console.log("❌ Invalid userType:", userType);
        return next(new Error('Invalid user type'));
      }
      return next();

    } catch (error) {
      console.error("❌ Authentication failed:", error.message);
      
      if (error.name === 'JsonWebTokenError') {
        return next(new Error('Invalid authentication token'));
      } else if (error.name === 'TokenExpiredError') {
        return next(new Error('Authentication token expired'));
      } else {
        return next(new Error('Authentication failed'));
      }
    }
  });

  io.on("connection", (socket) => {
    // Track connected users/admins
    if (socket.isAdmin) {
      connectedAdmins.set(socket.userId, socket.id);
      socket.join("admins"); // Join admin room for broadcasts
    } else {
      connectedUsers.set(socket.userId, socket.id);
    }

    // Join user to their personal room for targeted messages
    socket.join(`user_${socket.userId}`);

    // Auto-rejoin user to their active chat tickets on connection
    const rejoinActiveTickets = async () => {
      try {
        // Skip rejoining if userId is not a valid ObjectId (e.g., debug-user)
        if (!mongoose.Types.ObjectId.isValid(socket.userId)) {
          return;
        }

        const activeTickets = await SupportTicket.find({
          userId: socket.userId,
          status: { $in: ["open", "in_progress", "waiting_for_user"] },
          isChat: true,
        });

        for (const ticket of activeTickets) {
          socket.join(`ticket_${ticket._id}`);
        }

        if (activeTickets.length > 0) {
          socket.emit("active_tickets", {
            tickets: activeTickets.map((ticket) => ({
              ticketId: ticket._id,
              ticketNumber: ticket.ticketNumber,
              status: ticket.status,
              subject: ticket.subject,
              lastUpdated: ticket.lastUpdated,
              messages: ticket.messages,
            })),
          });
        }
      } catch (error) {
        console.error("❌ Error rejoining active tickets:", error);
      }
    };

    // Call rejoin function after connection
    rejoinActiveTickets();

    // Handle getting chat history
    socket.on("get_chat_history", async (data) => {
      try {
        const { ticketId } = data;

        // Skip if userId is not a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(socket.userId)) {
          socket.emit("error", { message: "Invalid user session" });
          return;
        }

        const ticket = await SupportTicket.findOne({
          _id: ticketId,
          userId: socket.userId,
          isChat: true,
        });

        if (!ticket) {
          socket.emit("error", {
            message: "Ticket not found or access denied",
          });
          return;
        }

        // Join the ticket room if not already joined
        socket.join(`ticket_${ticketId}`);

        socket.emit("chat_history", {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
          subject: ticket.subject,
          messages: ticket.messages,
          createdAt: ticket.createdAt,
          lastUpdated: ticket.lastUpdated,
        });
      } catch (error) {
        console.error("❌ Error getting chat history:", error);
        socket.emit("error", { message: "Failed to get chat history" });
      }
    });

    // Handle rejoining a specific ticket
    socket.on("rejoin_ticket", async (data) => {
      try {
        const { ticketId } = data;

        // Skip if userId is not a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(socket.userId)) {
          socket.emit("error", { message: "Invalid user session" });
          return;
        }

        const ticket = await SupportTicket.findOne({
          _id: ticketId,
          userId: socket.userId,
          isChat: true,
        });

        if (!ticket) {
          socket.emit("error", {
            message: "Ticket not found or access denied",
          });
          return;
        }

        // Join the ticket room
        socket.join(`ticket_${ticketId}`);

        socket.emit("ticket_rejoined", {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
          messages: ticket.messages,
          lastUpdated: ticket.lastUpdated,
        });

      } catch (error) {
        console.error("❌ Error rejoining ticket:", error);
        socket.emit("error", { message: "Failed to rejoin ticket" });
      }
    });

    // Handle starting a chat (auto-create ticket)
    socket.on("start_chat", async (data) => {
      try {
        const {
          message,
          category = "general_inquiry",
          priority = "medium",
        } = data;

        // Skip if userId is not a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(socket.userId)) {
          socket.emit("error", { message: "Invalid user session" });
          return;
        }

        // Generate unique ticket number using timestamp + userId
        const generateTicketNumber = () => {
          const timestamp = Date.now();
          const userIdShort = socket.userId.toString().slice(-8);
          return `TKT-${timestamp}-${userIdShort}`;
        };

        const ticketNumber = generateTicketNumber();

        // Use findOneAndUpdate with upsert to prevent race condition duplicates
        const ticket = await SupportTicket.findOneAndUpdate(
          {
            userId: socket.userId,
            status: { $in: ["open", "in_progress"] },
            isChat: true,
          },
          {
            $setOnInsert: {
              ticketNumber,
              userId: socket.userId,
              userModel: "DTUser",
              subject: `Chat Support - ${new Date().toLocaleDateString()}`,
              description: message,
              category,
              priority,
              isChat: true,
              status: "open",
              createdAt: new Date(),
              lastUpdated: new Date(),
              messages: [
                {
                  sender: socket.userId,
                  senderModel: "DTUser", 
                  message,
                  isAdminReply: false,
                  timestamp: new Date(),
                },
              ],
            }
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
          }
        );

        const isNewTicket = ticket.messages.length === 1;

        // Join ticket room
        socket.join(`ticket_${ticket._id}`);

        // Only send notifications for new tickets
        if (isNewTicket) {
          // Notify admins about new chat
          socket.to("admins").emit("new_chat_ticket", {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            userName: socket.userName,
            userEmail: socket.userEmail,
            message,
            priority: ticket.priority,
            category: ticket.category,
            createdAt: ticket.createdAt,
          });

          // Send email to support if no admins online
          if (connectedAdmins.size === 0) {
            const user = {
              fullName: socket.userName,
              email: socket.userEmail,
              _id: socket.userId,
            };
            await MailService.sendNewTicketNotificationToAdmin(
              "support@mydeeptech.ng",
              ticket,
              user,
            );
          }

          // Create notification for user
          await createNotification({
            userId: socket.userId,
            type: "support_chat",
            title: `Chat Support Started - ${ticket.ticketNumber}`,
            message: "Your chat session has started. Our support team will assist you shortly.",
            priority: "medium",
            data: {
              ticketId: ticket._id,
              ticketNumber: ticket.ticketNumber,
              isChat: true,
            },
          });
        } else {
        }

        socket.emit("chat_started", {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          messages: ticket.messages,
          status: ticket.status,
        });

      } catch (error) {
        console.error("❌ Error starting chat:", error);
        
        // Handle duplicate key errors gracefully
        if (error.code === 11000) {
          // Retry by finding the existing ticket
          try {
            const existingTicket = await SupportTicket.findOne({
              userId: socket.userId,
              status: { $in: ["open", "in_progress"] },
              isChat: true,
            });

            if (existingTicket) {
              socket.join(`ticket_${existingTicket._id}`);
              socket.emit("chat_started", {
                ticketId: existingTicket._id,
                ticketNumber: existingTicket.ticketNumber,
                messages: existingTicket.messages,
                status: existingTicket.status,
              });
              return;
            }
          } catch (retryError) {
            console.error("❌ Error in retry logic:", retryError);
          }
        }
        
        socket.emit("error", { message: "Failed to start chat" });
      }
    });

    // Handle sending chat messages
    socket.on("send_message", async (data) => {
      try {
        const { ticketId, message, attachments = [] } = data;

        const ticket = await SupportTicket.findById(ticketId);
        if (!ticket) {
          socket.emit("error", { message: "Ticket not found" });
          return;
        }

        // Verify user has access to this ticket
        if (
          ticket.userId.toString() !== socket.userId &&
          !connectedAdmins.has(socket.userId)
        ) {
          socket.emit("error", { message: "Access denied" });
          return;
        }

        const isAdminReply = socket.isAdmin;

        // Add message to ticket
        const newMessage = {
          sender: socket.userId,
          senderModel: socket.isAdmin
            ? "Admin"
            : "DTUser",
          message,
          isAdminReply,
          timestamp: new Date(),
          attachments,
        };

        ticket.messages.push(newMessage);

        // Update ticket status
        if (isAdminReply && ticket.status === "open") {
          ticket.status = "in_progress";
        } else if (!isAdminReply && ticket.status === "waiting_for_user") {
          ticket.status = "in_progress";
        }

        await ticket.save();

        // Get the saved message from the ticket (it now has the MongoDB _id)
        const savedMessage = ticket.messages[ticket.messages.length - 1];

        const messageWithSender = {
          ...(savedMessage.toObject ? savedMessage.toObject() : savedMessage),
          senderName: socket.userName,
          senderEmail: socket.userEmail,
          messageId: savedMessage._id,
        };

        // Broadcast to all users in ticket room
        io.to(`ticket_${ticketId}`).emit("new_message", messageWithSender);

        // If admin replied, notify user
        if (isAdminReply) {
          // Create in-app notification
          await createNotification({
            userId: ticket.userId,
            type: "support_reply",
            title: `Support Reply - ${ticket.ticketNumber}`,
            message: "Our support team has replied to your chat.",
            priority: "high",
            data: {
              ticketId: ticket._id,
              ticketNumber: ticket.ticketNumber,
              isChat: true,
            },
          });
          const canSendEmail = await canSendDailyEmail(
            ticket.userId.toString(),
            "admin_reply",
          );
          if (canSendEmail) {
            try {
              // Get user details for email
              const user = await DTUser.findById(ticket.userId).select(
                "fullName email",
              );

              if (user && user.email) {
                // Send admin reply email notification
                const emailResult =
                  await MailService.sendAdminReplyNotificationEmail(
                    user.email,
                    ticket,
                    {
                      senderName: socket.userName,
                      message: message,
                      timestamp: new Date(),
                    },
                  );

                if (emailResult.success) {
                  // Mark that we've sent the daily email
                  const markResult = await markDailyEmailSent(
                    ticket.userId.toString(),
                    "admin_reply",
                  );
                } else {
                }
              } else {
              }
            } catch (emailError) {
              console.error(
                "📧 ❌ Error in email sending process:",
                emailError,
              );
            }
          } else {
            // Log that email was skipped due to daily limit
           
            try {
              const emailStatus = await getDailyEmailStatus(
                ticket.userId.toString(),
                "admin_reply",
              );
            } catch (statusError) {
              console.error("📧 ❌ Error getting email status:", statusError);
            }
          }
        } else {
          socket.to("admins").emit("user_message", {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            userName: socket.userName,
            userEmail: socket.userEmail,
            message,
            timestamp: new Date(),
          });

          // If no admins online, send email
          if (connectedAdmins.size === 0) {
            // Email notification logic will be handled here
          } else {
          }
        }

      } catch (error) {
        console.error("❌ Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Handle admin joining ticket chat
    socket.on("join_ticket", async (data) => {
      try {
        const { ticketId } = data;

        if (!connectedAdmins.has(socket.userId)) {
          socket.emit("error", { message: "Admin access required" });
          return;
        }

        const ticket = await SupportTicket.findById(ticketId).populate(
          "userId",
          "fullName email",
        );

        if (!ticket) {
          socket.emit("error", { message: "Ticket not found" });
          return;
        }

        socket.join(`ticket_${ticketId}`);

        // Assign ticket to admin if not assigned
        if (!ticket.assignedTo) {
          ticket.assignedTo = socket.userId;
          ticket.assignedAt = new Date();
          if (ticket.status === "open") {
            ticket.status = "in_progress";
          }
          await ticket.save();
        }

        socket.emit("ticket_joined", {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          userName: ticket.userId.fullName,
          userEmail: ticket.userId.email,
          messages: ticket.messages,
          status: ticket.status,
          assignedTo: ticket.assignedTo,
        });
      } catch (error) {
        console.error("❌ Error joining ticket:", error);
        socket.emit("error", { message: "Failed to join ticket" });
      }
    });

    // Handle closing chat/ticket
    socket.on("close_chat", async (data) => {
      try {
        const { ticketId, resolutionSummary = "Chat session completed" } = data;

        if (!connectedAdmins.has(socket.userId)) {
          socket.emit("error", { message: "Admin access required" });
          return;
        }

        const ticket = await SupportTicket.findById(ticketId);
        if (!ticket) {
          socket.emit("error", { message: "Ticket not found" });
          return;
        }

        ticket.status = "resolved";
        ticket.resolution = {
          summary: resolutionSummary,
          resolvedBy: socket.userId,
          resolvedAt: new Date(),
          resolutionCategory: "solved",
        };

        await ticket.save();

        // Notify all participants
        io.to(`ticket_${ticketId}`).emit("chat_closed", {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          resolutionSummary,
          resolvedBy: socket.userName,
          resolvedAt: new Date(),
        });

        // Create notification for user
        await createNotification({
          userId: ticket.userId,
          type: "support_resolved",
          title: `Chat Session Closed - ${ticket.ticketNumber}`,
          message: "Your chat session has been resolved. Please rate your experience.",
          priority: "high",
          data: {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            resolutionSummary,
            isChat: true,
          },
        });

      } catch (error) {
        console.error("❌ Error closing chat:", error);
        socket.emit("error", { message: "Failed to close chat" });
      }
    });

    // Handle getting active tickets for admin
    socket.on("get_active_chats", async () => {
      try {
        if (!connectedAdmins.has(socket.userId)) {
          socket.emit("error", { message: "Admin access required" });
          return;
        }

        const activeChats = await SupportTicket.find({
          isChat: true,
          status: { $in: ["open", "in_progress", "waiting_for_user"] },
        })
          .populate("userId", "fullName email")
          .populate("assignedTo", "fullName")
          .sort({ lastUpdated: -1 });

        socket.emit("active_chats", activeChats);
      } catch (error) {
        console.error("❌ Error getting active chats:", error);
        socket.emit("error", { message: "Failed to get active chats" });
      }
    });

    // Handle explicit admin room join (frontend compatibility)
    socket.on("join_admin_room", () => {
      if (socket.isAdmin) {
        socket.join("admins");
      } else {
      }
    });

    // Handle admin joining specific chat room for real-time messages
    socket.on("join_chat_room", async (data) => {
      try {
        const { ticketId } = data;

        if (!socket.isAdmin) {
          socket.emit("error", { message: "Admin access required" });
          return;
        }

        // Verify ticket exists
        const ticket = await SupportTicket.findById(ticketId);
        if (!ticket) {
          socket.emit("error", { message: "Ticket not found" });
          return;
        }

        // Join the specific ticket room for real-time messages
        socket.join(`ticket_${ticketId}`);

        socket.emit("chat_room_joined", {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber
        });

      } catch (error) {
        console.error("❌ Error joining chat room:", error);
        socket.emit("error", { message: "Failed to join chat room" });
      }
    });

    // Handle admin leaving specific chat room
    socket.on("leave_chat_room", (data) => {
      try {
        const { ticketId } = data;
        
        if (socket.isAdmin) {
          socket.leave(`ticket_${ticketId}`);
        }
      } catch (error) {
        console.error("❌ Error leaving chat room:", error);
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      if (socket.isAdmin) {
        connectedAdmins.delete(socket.userId);
      } else {
        connectedUsers.delete(socket.userId);
      }
    });
  });

};

/**
 * Get Socket.IO instance
 */
const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
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
    io.to(`user_${userId}`).emit("notification", notification);
  }
};

/**
 * Broadcast to all online admins
 */
const broadcastToAdmins = (event, data) => {
  if (io) {
    io.to("admins").emit(event, data);
  }
};

module.exports = {
  initializeSocketIO,
  getIO,
  isAdminOnline,
  isUserOnline,
  getOnlineAdminsCount,
  sendNotificationToUser,
  broadcastToAdmins,
};
