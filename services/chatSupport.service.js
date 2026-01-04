import SupportTicket from '../models/supportTicket.model.js';
import DTUser from '../models/dtUser.model.js';
import User from '../models/user.js';
import { createNotification } from '../utils/notificationService.js';
import { sendNewTicketNotificationToAdmin, sendOfflineAgentNotification } from '../utils/supportEmailTemplates.js';
import { getOnlineAdminsCount, broadcastToAdmins } from '../utils/chatSocketService.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';

class ChatSupportService {
    async startChatSession(data, userId, userType) {
        const { initialMessage, category = 'general_inquiry', priority = 'medium' } = data;

        // Check for existing active session
        const existingTicket = await SupportTicket.findOne({
            userId,
            status: { $in: ['open', 'in_progress', 'waiting_for_user'] },
            isChat: true
        });

        if (existingTicket) {
            return { ticketId: existingTicket._id, ticketNumber: existingTicket.ticketNumber, isNew: false };
        }

        // Generate ticket number
        const timestamp = Date.now();
        const userIdShort = userId.toString().slice(-8);
        const ticketNumber = `TKT-${timestamp}-${userIdShort}`;

        const ticket = await SupportTicket.create({
            ticketNumber,
            userId,
            userModel: userType === 'dtuser' ? 'DTUser' : 'User',
            subject: `Chat Support - ${new Date().toLocaleDateString()}`,
            description: initialMessage || 'Live chat session started',
            category,
            priority,
            isChat: true,
            messages: initialMessage ? [{
                sender: userId,
                senderModel: userType === 'dtuser' ? 'DTUser' : 'User',
                message: initialMessage,
                isAdminReply: false,
                timestamp: new Date()
            }] : []
        });

        // Notify admins via Socket.IO
        broadcastToAdmins('new_chat_ticket', {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            userId,
            priority: ticket.priority,
            category: ticket.category,
            createdAt: ticket.createdAt
        });

        // If no admins online, send email notification
        const onlineAdmins = getOnlineAdminsCount();
        if (onlineAdmins === 0) {
            const user = await (userType === 'dtuser' ? DTUser : User).findById(userId);
            if (user) {
                await sendNewTicketNotificationToAdmin('support@mydeeptech.ng', ticket, user);
                await sendOfflineAgentNotification('support@mydeeptech.ng', ticket, user);
            }
        }

        return { ticketId: ticket._id, ticketNumber: ticket.ticketNumber, isNew: true };
    }

    async getActiveChatsForUser(userId) {
        return await SupportTicket.find({
            userId,
            status: { $in: ['open', 'in_progress', 'waiting_for_user'] },
            isChat: true
        }).sort({ lastUpdated: -1 });
    }

    async getChatHistory(userId) {
        return await SupportTicket.find({
            userId,
            isChat: true
        }).sort({ lastUpdated: -1 });
    }

    async sendChatMessage(ticketId, userId, userType, messageData, isAdmin = false) {
        const { message, attachments = [] } = messageData;
        const ticket = await SupportTicket.findById(ticketId);

        if (!ticket) throw new NotFoundError('Chat session not found');

        // Authorization
        if (!isAdmin && ticket.userId.toString() !== userId.toString()) {
            throw new ForbiddenError('Not authorized to access this chat');
        }

        const newMessage = {
            sender: userId,
            senderModel: isAdmin ? 'DTUser' : (userType === 'dtuser' ? 'DTUser' : 'User'),
            message,
            isAdminReply: isAdmin,
            timestamp: new Date(),
            attachments
        };

        ticket.messages.push(newMessage);

        // Update status
        if (isAdmin && ticket.status === 'open') {
            ticket.status = 'in_progress';
            if (!ticket.assignedTo) {
                ticket.assignedTo = userId;
                ticket.assignedAt = new Date();
            }
        } else if (!isAdmin && ticket.status === 'waiting_for_user') {
            ticket.status = 'in_progress';
        }

        await ticket.save();

        // Notifications (Handled primarily via Socket.IO, but REST fallback might need them)
        // We assume the Socket.IO service handles the actual broadcast if this is called from REST

        return ticket.messages[ticket.messages.length - 1];
    }

    async getActiveChatTicketsAdmin() {
        return await SupportTicket.find({
            isChat: true,
            status: { $in: ['open', 'in_progress', 'waiting_for_user'] }
        })
            .populate('userId', 'fullName email username profilePicture')
            .populate('assignedTo', 'fullName email')
            .sort({ lastUpdated: -1 });
    }

    async joinChatAsAdmin(ticketId, adminId) {
        const ticket = await SupportTicket.findById(ticketId);
        if (!ticket) throw new NotFoundError('Chat session not found');
        if (!ticket.isChat) throw new ValidationError('This ticket is not a chat session');

        ticket.assignedTo = adminId;
        ticket.assignedAt = new Date();
        if (ticket.status === 'open') {
            ticket.status = 'in_progress';
        }

        await ticket.save();
        return ticket;
    }

    async closeChatSession(ticketId, adminId, resolutionSummary = 'Chat session ended') {
        const ticket = await SupportTicket.findById(ticketId);
        if (!ticket) throw new NotFoundError('Chat session not found');

        ticket.status = 'resolved';
        ticket.resolution = {
            summary: resolutionSummary,
            resolvedBy: adminId,
            resolvedAt: new Date(),
            resolutionCategory: 'solved'
        };

        await ticket.save();

        // Notify user
        await createNotification({
            userId: ticket.userId,
            type: 'support_resolved',
            title: `Chat Resolved - ${ticket.ticketNumber}`,
            message: 'Your chat session has been resolved. Feel free to provide feedback.',
            priority: 'high',
            data: { ticketId: ticket._id, ticketNumber: ticket.ticketNumber }
        });

        return ticket;
    }
}

export default new ChatSupportService();
