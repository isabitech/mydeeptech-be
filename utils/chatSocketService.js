const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const SupportTicket = require("../models/supportTicket.model");
const DTUser = require("../models/dtUser.model");
const User = require("../models/user");
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
        console.log("🎯 Ensure PC agent sends proper WebSocket headers:");
        console.log("   - Connection: Upgrade");
        console.log("   - Upgrade: websocket");
        console.log("   - Sec-WebSocket-Version: 13");
      }

      // Always allow connections
      callback(null, true);
    },
  });

  // Add comprehensive Socket.IO debugging
  console.log("🚀 Adding enhanced Socket.IO debugging...");

  // Capture ALL engine events for debugging
  io.engine.on("initial_headers", (headers, req) => {
    console.log("📋 ========== ENGINE: INITIAL HEADERS ==========");
    console.log("   URL:", req.url);
    console.log("   Method:", req.method);
    console.log("   Headers:", JSON.stringify(req.headers, null, 2));
  });

  // Enhanced connection error with more context
  io.engine.on("connection_error", (error, context) => {
    console.log("❌ ========== ENGINE: DETAILED CONNECTION ERROR ==========");
    console.log("   Error message:", error.message || error);
    console.log("   Error code:", error.code);
    console.log("   Error type:", error.type);
    console.log("   Error context:", error.context);
    console.log("   Additional context:", context);

    // Try to extract request info from error object
    if (error.req) {
      console.log("   Failed Request URL:", error.req.url);
      console.log("   Failed Request Method:", error.req.method);
      console.log(
        "   Failed Request Headers:",
        JSON.stringify(error.req.headers, null, 2),
      );
    }

    console.log("🎯 ANALYSIS: Client URL/headers causing handshake rejection");
  });

  // Track successful connections
  io.engine.on("connection", (socket) => {
    console.log("🔌 ========== ENGINE: RAW CONNECTION SUCCESS ==========");
    console.log("   Engine Socket ID:", socket.id);
    console.log("   Transport:", socket.transport.name);
    console.log("   Remote address:", socket.request.connection.remoteAddress);
    console.log("   User agent:", socket.request.headers["user-agent"]);
    console.log("   URL:", socket.request.url);
    console.log("   Query params:", socket.request.url.split("?")[1] || "none");
  });

  // Monitor upgrade events
  io.engine.on("upgrade", (socket) => {
    console.log("⬆️ ========== ENGINE: TRANSPORT UPGRADE ==========");
    console.log("   Socket:", socket.id);
    console.log("   From:", socket.transport.name);
  });

  // Monitor upgrade errors
  io.engine.on("upgrade_error", (error) => {
    console.log("❌ ========== ENGINE: UPGRADE ERROR ==========");
    console.log("   Error:", error);
  });

  // DEBUG: Add packet interceptor to see raw packet data
  io.engine.on("packet", (packet, socket) => {
    console.log("📦 ========== ENGINE: RAW PACKET ==========");
    console.log("   Socket ID:", socket.id);
    console.log("   Packet type:", packet.type);
    const data = packet.data || packet;
    const dataStr = typeof data === "string" ? data : JSON.stringify(data);
    console.log("   Packet data:", dataStr.substring(0, 200));

    // Check for namespace join attempts
    if (dataStr.includes("/hvnc-device") || dataStr.includes("hvnc")) {
      console.log("🎯 HVNC NAMESPACE JOIN DETECTED!");
      console.log("   Full packet data:", dataStr);
      console.log("   Packet type details:", packet.type);
      console.log("   Socket transport:", socket.transport?.name);
    }

    // Also check for any message that starts with numbers (Socket.IO protocol)
    if (dataStr.match(/^[0-9]/)) {
      console.log("🔢 SOCKET.IO PROTOCOL MESSAGE:");
      console.log("   Message:", dataStr);
      console.log("   Potential namespace join?", dataStr.includes("/"));
    }
  });

  // DEBUG: Add message interceptor for Engine.IO
  io.engine.on("message", (data, socket) => {
    console.log("📨 ========== ENGINE: MESSAGE ==========");
    console.log("   Socket ID:", socket.id);
    const msgStr = data ? data.toString() : "null";
    console.log("   Message:", msgStr.substring(0, 200));

    // Check for HVNC namespace messages
    if (msgStr.includes("/hvnc-device") || msgStr.includes("hvnc")) {
      console.log("🎯🎯🎯 HVNC NAMESPACE MESSAGE DETECTED! 🎯🎯🎯");
      console.log("   Full message:", msgStr);
      console.log("   Message length:", msgStr.length);
      console.log("   Socket transport:", socket.transport?.name);
      console.log("   Socket readyState:", socket.readyState);
    }

    // Check for Socket.IO protocol messages
    if (msgStr.match(/^[0-9]/)) {
      console.log("🎯 SOCKET.IO PROTOCOL MESSAGE:");
      console.log("   Message type: ", msgStr.charAt(0));
      console.log("   Full message: ", msgStr);

      // Socket.IO protocol:
      // 0 = connect, 1 = disconnect, 2 = event, 3 = ack, 4 = connect error, 5 = binary event, 6 = binary ack
      switch (msgStr.charAt(0)) {
        case "0":
          console.log("   → SOCKET.IO CONNECT ATTEMPT");
          break;
        case "4":
          if (msgStr.includes("/")) {
            console.log("   → 🚨 NAMESPACE JOIN ATTEMPT DETECTED: ", msgStr);
            console.log("   → Attempting to process namespace join...");

            // Try to manually trigger Socket.IO parsing
            try {
              console.log("   → Socket.IO instance exists:", !!io);
              console.log(
                "   → Engine socket transport:",
                socket.transport?.name,
              );
              console.log(
                "   → Available namespaces:",
                io._nsps ? Array.from(io._nsps.keys()) : "none",
              );
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
    console.log("✅ ========== SOCKET.IO: HIGH-LEVEL CONNECTION ==========");
    console.log("   Socket ID:", socket.id);
    console.log("   Namespace:", socket.nsp.name);
    console.log("   Connected:", socket.connected);
    console.log("   Transport:", socket.conn?.transport?.name || "unknown");
    console.log("   🎉 PC AGENT SOCKET.IO CONNECTION ACHIEVED!");
    // DEBUG: Try to access all namespaces through Socket.IO API
    console.log("🔍 NAMESPACE DEBUGGING:");
    try {
      // Check namespaces using different methods
      if (io.sockets && io.sockets.adapter && io.sockets.adapter.nsp) {
        console.log("   Main namespace exists:", !!io.sockets);
      }

      // Force namespace registration check
      const deviceNs = io._nsps ? io._nsps.get("/hvnc-device") : null;
      console.log(
        "   Device namespace from _nsps:",
        deviceNs ? "FOUND" : "NOT_FOUND",
      );

      // Try alternate namespace access
      const deviceNs2 = io.of("/hvnc-device");
      console.log(
        "   Device namespace from io.of():",
        deviceNs2 ? "EXISTS" : "MISSING",
      );

      // Check if namespace has connections
      if (deviceNs2 && deviceNs2.sockets) {
        console.log(
          "   Device namespace connections:",
          deviceNs2.sockets.size || 0,
        );
      }
    } catch (err) {
      console.log("   Namespace check error:", err.message);
    }

    // DEBUG: Log all incoming data to see namespace join attempts
    socket.onAny((eventName, ...args) => {
      console.log("🔍 SOCKET.IO EVENT:", eventName, args.slice(0, 2));
    });

    socket.on("error", (error) => {
      console.log("❌ SOCKET.IO ERROR:", error);
    });

    socket.on("disconnect", (reason) => {
      console.log("🔌 SOCKET.IO DISCONNECT:", reason);
    });

    // DEBUG: Force attempt to route socket to HVNC namespace
    console.log("🔧 ATTEMPTING MANUAL NAMESPACE ROUTING TEST...");
    try {
      const hvncNamespace = io.of("/hvnc-device");
      if (hvncNamespace) {
        console.log("   HVNC namespace exists for manual routing");
        // Try to emit a test event to the namespace
        hvncNamespace.emit("test", { message: "Manual namespace test" });
        console.log("   Manual test event sent to HVNC namespace");
      }
    } catch (err) {
      console.log("   Manual namespace routing error:", err.message);
    }
  });

  console.log("✅ Engine debugging listeners added");

  // Authentication middleware for Socket.IO - TEMPORARILY DISABLED FOR DEBUGGING
  io.use(async (socket, next) => {
    console.log(
      "🌐 ========== SOCKET.IO AUTH MIDDLEWARE (DEBUGGING MODE) ==========",
    );
    console.log("📋 Connection Details:");
    console.log("   Socket ID:", socket.id);
    console.log("   Namespace:", socket.nsp.name);
    console.log("   Transport:", socket.conn?.transport?.name || "unknown");
    console.log("   Remote address:", socket.handshake.address);
    console.log(
      "   Query params:",
      JSON.stringify(socket.handshake.query, null, 2),
    );
    console.log(
      "   Headers:",
      JSON.stringify(socket.handshake.headers, null, 2),
    );

    // TEMPORARILY ALLOW ALL CONNECTIONS TO DEBUG HANDSHAKE ISSUE
    console.log(
      "🚨 DEBUGGING: Allowing all connections without authentication",
    );

    // Set dummy values to prevent errors
    socket.userId = "debug-user";
    socket.userType = "debug";
    socket.isAdmin = false;
    socket.userEmail = "debug@test.com";
    socket.userName = "Debug User";

    return next();
  });

  io.on("connection", (socket) => {
    console.log(`🔗 User connected: ${socket.userName} (${socket.userId})`);

    // Track connected users/admins
    if (socket.isAdmin) {
      connectedAdmins.set(socket.userId, socket.id);
      socket.join("admins"); // Join admin room for broadcasts
      console.log(
        `👨‍💼 Admin connected: ${socket.userName} (${socket.userEmail})`,
      );
    } else {
      connectedUsers.set(socket.userId, socket.id);
      console.log(
        `👤 User connected: ${socket.userName} (${socket.userEmail})`,
      );
    }

    // Join user to their personal room for targeted messages
    socket.join(`user_${socket.userId}`);

    // Auto-rejoin user to their active chat tickets on connection
    const rejoinActiveTickets = async () => {
      try {
        // Skip rejoining if userId is not a valid ObjectId (e.g., debug-user)
        if (!mongoose.Types.ObjectId.isValid(socket.userId)) {
          console.log(`⚠️ Skipping ticket rejoin for invalid userId: ${socket.userId}`);
          return;
        }

        const activeTickets = await SupportTicket.find({
          userId: socket.userId,
          status: { $in: ["open", "in_progress", "waiting_for_user"] },
          isChat: true,
        });

        for (const ticket of activeTickets) {
          socket.join(`ticket_${ticket._id}`);
          console.log(
            `🔄 User ${socket.userName} rejoined ticket: ${ticket.ticketNumber}`,
          );
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
          console.log(`⚠️ Skipping chat history for invalid userId: ${socket.userId}`);
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

        console.log(
          `📋 Chat history sent for ticket ${ticket.ticketNumber} to ${socket.userName}`,
        );
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
          console.log(`⚠️ Skipping ticket rejoin for invalid userId: ${socket.userId}`);
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

        console.log(
          `🔄 User ${socket.userName} manually rejoined ticket: ${ticket.ticketNumber}`,
        );
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
          console.log(`⚠️ Skipping chat start for invalid userId: ${socket.userId}`);
          socket.emit("error", { message: "Invalid user session" });
          return;
        }

        // Check if user already has an open chat ticket
        let existingTicket = await SupportTicket.findOne({
          userId: socket.userId,
          status: { $in: ["open", "in_progress"] },
          isChat: true,
        });

        if (existingTicket) {
          // Join existing chat ticket room
          socket.join(`ticket_${existingTicket._id}`);

          socket.emit("chat_started", {
            ticketId: existingTicket._id,
            ticketNumber: existingTicket.ticketNumber,
            messages: existingTicket.messages,
            status: existingTicket.status,
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
          userModel: socket.userType === "dtuser" ? "DTUser" : "User",
          subject: `Chat Support - ${new Date().toLocaleDateString()}`,
          description: message,
          category,
          priority,
          isChat: true,
          messages: [
            {
              sender: socket.userId,
              senderModel: socket.userType === "dtuser" ? "DTUser" : "User",
              message,
              isAdminReply: false,
              timestamp: new Date(),
            },
          ],
        });

        // Join ticket room
        socket.join(`ticket_${ticket._id}`);

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
          await mailService.sendNewTicketNotificationToAdmin(
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
          message:
            "Your chat session has started. Our support team will assist you shortly.",
          priority: "medium",
          data: {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            isChat: true,
          },
        });

        socket.emit("chat_started", {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          messages: ticket.messages,
          status: ticket.status,
        });

        console.log(
          `💬 New chat ticket created: ${ticket.ticketNumber} by ${socket.userName}`,
        );
      } catch (error) {
        console.error("❌ Error starting chat:", error);
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
            : socket.userType === "dtuser"
              ? "DTUser"
              : "User",
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
          console.log(
            `🔔 Admin ${socket.userName} replied to ticket ${ticket.ticketNumber} for user ${ticket.userId}`,
          );

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

          // Check if we can send daily email notification
          console.log(
            `📧 Checking daily email eligibility for user ${ticket.userId}...`,
          );
          const canSendEmail = await canSendDailyEmail(
            ticket.userId.toString(),
            "admin_reply",
          );
          console.log(`📧 Can send email today: ${canSendEmail}`);

          if (canSendEmail) {
            try {
              console.log(
                `👤 Fetching user details for userId: ${ticket.userId}, userModel: ${ticket.userModel}`,
              );

              // Get user details for email
              let user;
              if (ticket.userModel === "DTUser") {
                user = await DTUser.findById(ticket.userId).select(
                  "fullName email",
                );
              } else {
                user = await User.findById(ticket.userId).select(
                  "fullName email username",
                );
              }

              console.log(
                `👤 User found: ${!!user}, Email: ${user?.email ? "Yes" : "No"}`,
              );

              if (user && user.email) {
                console.log(
                  `📧 Attempting to send admin reply email to ${user.email}...`,
                );

                // Send admin reply email notification
                const emailResult =
                  await mailService.sendAdminReplyNotificationEmail(
                    user.email,
                    ticket,
                    {
                      senderName: socket.userName,
                      message: message,
                      timestamp: new Date(),
                    },
                  );

                console.log(`📧 Email service result:`, emailResult);

                if (emailResult.success) {
                  // Mark that we've sent the daily email
                  console.log(
                    `📧 Marking daily email as sent for user ${ticket.userId.toString()}...`,
                  );
                  const markResult = await markDailyEmailSent(
                    ticket.userId.toString(),
                    "admin_reply",
                  );
                  console.log(`📧 Daily email marked as sent: ${markResult}`);
                  console.log(
                    `📧 ✅ Daily admin reply email sent to ${user.email} for ticket ${ticket.ticketNumber}`,
                  );
                } else {
                  console.error(
                    `📧 ❌ Failed to send admin reply email: ${emailResult.error}`,
                  );
                }
              } else {
                console.log(
                  `📧 ⚠️ User email not found for userId: ${ticket.userId} - User: ${JSON.stringify(user)}`,
                );
              }
            } catch (emailError) {
              console.error(
                "📧 ❌ Error in email sending process:",
                emailError,
              );
              console.error("📧 ❌ Stack trace:", emailError.stack);
            }
          } else {
            // Log that email was skipped due to daily limit
            console.log(
              `📧 ⏭️ Daily email limit reached for user ${ticket.userId}, checking status...`,
            );
            try {
              const emailStatus = await getDailyEmailStatus(
                ticket.userId.toString(),
                "admin_reply",
              );
              console.log(`📧 Email status:`, emailStatus);
              console.log(
                `📧 Daily email limit reached for user ${ticket.userId}. Last sent: ${emailStatus.lastSent}, expires in: ${emailStatus.expiresIn}s`,
              );
            } catch (statusError) {
              console.error("📧 ❌ Error getting email status:", statusError);
            }
          }
        } else {
          // User message - notify online admins
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
            console.log("📧 No admins online, should send email notification");
          }
        }

        console.log(
          `💬 Message sent in ticket ${ticket.ticketNumber} by ${socket.userName}`,
        );
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

        console.log(
          `👨‍💼 Admin ${socket.userName} joined ticket ${ticket.ticketNumber}`,
        );
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
          message:
            "Your chat session has been resolved. Please rate your experience.",
          priority: "high",
          data: {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            resolutionSummary,
            isChat: true,
          },
        });

        console.log(
          `✅ Chat ticket ${ticket.ticketNumber} closed by ${socket.userName}`,
        );
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

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`🔌 User disconnected: ${socket.userName}`);

      if (socket.isAdmin) {
        connectedAdmins.delete(socket.userId);
      } else {
        connectedUsers.delete(socket.userId);
      }
    });
  });

  console.log("🚀 Socket.IO chat server initialized");
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
