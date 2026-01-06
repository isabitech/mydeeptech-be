import SupportTicket from '../models/supportTicket.model.js';
import DTUser from '../models/dtUser.model.js';
import User from '../models/user.js';
import { createNotification } from '../utils/notificationService.js';
import {
    sendTicketCreationEmail,
    sendTicketStatusUpdateEmail,
    sendNewTicketNotificationToAdmin,
    sendTicketAssignmentEmail
} from '../utils/supportEmailTemplates.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/responseHandler.js';
class SupportTicketService {
    async createTicket(data, userId, userType) {
        const { subject, description, category, priority, attachments } = data;

        // Fetch user details for email notification
        let userDetail;
        if (userType === 'dtuser') {
            userDetail = await DTUser.findById(userId);
        } else {
            userDetail = await User.findById(userId);
        }

        if (!userDetail) {
            throw new NotFoundError('User not found');
        }

        // Generate unique ticket number
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const ticketNumber = `TKT-${timestamp}-${random}`;

        const ticket = await SupportTicket.create({
            ticketNumber,
            userId,
            userModel: userType === 'dtuser' ? 'DTUser' : 'User',
            subject,
            description,
            category,
            priority: priority || 'medium',
            attachments: attachments || [],
            messages: [{
                sender: userId,
                senderModel: userType === 'dtuser' ? 'DTUser' : 'User',
                message: description,
                isAdminReply: false,
                timestamp: new Date(),
                attachments: attachments || []
            }]
        });

        // Send confirmation email to user
        try {
            await sendTicketCreationEmail(userDetail.email, ticket);
        } catch (emailError) {
            console.error('Failed to send ticket creation email:', emailError);
        }

        // Notify support admins
        try {
            await sendNewTicketNotificationToAdmin('support@mydeeptech.ng', ticket, userDetail);
        } catch (emailError) {
            console.error('Failed to notify admins of new ticket:', emailError);
        }

        return ticket;
    }

    async getUserTickets(userId, queryParams) {
        const { status, category, page = 1, limit = 10 } = queryParams;
        const filter = { userId };

        if (status) filter.status = status;
        if (category) filter.category = category;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [tickets, totalCount] = await Promise.all([
            SupportTicket.find(filter)
                .sort({ lastUpdated: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            SupportTicket.countDocuments(filter)
        ]);

        return {
            tickets,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                pages: Math.ceil(totalCount / parseInt(limit))
            }
        };
    }

    async getTicketById(ticketId, userId, userType, isAdmin = false) {
        const ticket = await SupportTicket.findById(ticketId)
            .populate('assignedTo', 'fullName email')
            .populate({
                path: 'messages.sender',
                select: 'fullName username email profilePicture'
            });

        if (!ticket) {
            throw new NotFoundError('Support ticket not found');
        }

        // Check authorization: only the creator or an admin can view
        if (!isAdmin && ticket.userId.toString() !== userId.toString()) {
            throw new ForbiddenError('You are not authorized to view this ticket');
        }

        return ticket;
    }

    async addMessageToTicket(ticketId, userId, userType, data, isAdmin = false) {
        const { message, attachments } = data;
        const ticket = await SupportTicket.findById(ticketId);

        if (!ticket) {
            throw new NotFoundError('Support ticket not found');
        }

        // Check authorization
        if (!isAdmin && ticket.userId.toString() !== userId.toString()) {
            throw new ForbiddenError('You are not authorized to reply to this ticket');
        }

        // Add message
        const newMessage = {
            sender: userId,
            senderModel: isAdmin ? 'DTUser' : (userType === 'dtuser' ? 'DTUser' : 'User'),
            message,
            isAdminReply: isAdmin,
            attachments: attachments || [],
            timestamp: new Date()
        };

        ticket.messages.push(newMessage);

        // Update status based on sender
        if (isAdmin) {
            ticket.status = 'waiting_for_user';
        } else {
            ticket.status = 'in_progress';
            // If it was already in progress or open, keep it as in_progress
        }

        await ticket.save();

        // Notify the other party
        if (isAdmin) {
            // Notify user of admin reply
            await createNotification({
                userId: ticket.userId,
                type: 'support_update',
                title: `Reply to Ticket #${ticket.ticketNumber}`,
                message: `Admin has replied to your support ticket: ${ticket.subject}`,
                priority: 'high',
                data: { ticketId: ticket._id, ticketNumber: ticket.ticketNumber }
            });
        } else if (ticket.assignedTo) {
            // Notify assigned admin
            await createNotification({
                userId: ticket.assignedTo,
                type: 'support_update',
                title: `User Reply - #${ticket.ticketNumber}`,
                message: `User has replied to the ticket: ${ticket.subject}`,
                priority: 'medium',
                data: { ticketId: ticket._id, ticketNumber: ticket.ticketNumber }
            });
        }

        return ticket;
    }

    async rateTicket(ticketId, userId, rating) {
        const ticket = await SupportTicket.findOne({ _id: ticketId, userId });

        if (!ticket) {
            throw new NotFoundError('Ticket not found or not owned by user');
        }

        if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
            throw new ValidationError('Can only rate resolved or closed tickets');
        }

        ticket.userSatisfactionRating = rating;
        await ticket.save();
        return ticket;
    }

    // ADMIN METHODS
    async getAllTickets(queryParams) {
        const page = parseInt(queryParams.page) || 1;
        const limit = parseInt(queryParams.limit) || 20;
        const status = queryParams.status;
        const category = queryParams.category;
        const priority = queryParams.priority;
        const assignedTo = queryParams.assignedTo;
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

        return {
            tickets,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalTickets / limit),
                totalTickets,
                hasNextPage: page * limit < totalTickets,
                hasPrevPage: page > 1,
                limit
            }
        };
    }

    /**
     * Get tickets by category (admin only)
     */
    async getTicketsByCategory(category, page = 1, limit = 20) {
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
        return {
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
        };
    }

    /**
     * Get tickets by priority (admin only)
     */
    async getTicketsByPriority(priority, page = 1, limit = 20) {
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
        return {
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
        };
    }

    async assignTicket(ticketId, adminId) {
        const ticket = await SupportTicket.findById(ticketId);
        if (!ticket) throw new NotFoundError('Ticket not found');

        const admin = await DTUser.findById(adminId);
        if (!admin) throw new NotFoundError('Admin user not found');

        ticket.assignedTo = adminId;
        ticket.assignedAt = new Date();
        if (ticket.status === 'open') {
            ticket.status = 'in_progress';
        }

        await ticket.save();

        // Notify admin
        try {
            await sendTicketAssignmentEmail(admin.email, ticket);
        } catch (err) {
            console.error('Failed to send assignment email:', err);
        }

        return ticket;
    }

    async updateTicketStatus(ticketId, newStatus, adminId, resolutionData = {}) {
        const ticket = await SupportTicket.findById(ticketId).populate('userId', 'email');
        if (!ticket) throw new NotFoundError('Ticket not found');

        const oldStatus = ticket.status;
        ticket.status = newStatus;

        if (newStatus === 'resolved') {
            ticket.resolution = {
                summary: resolutionData.summary || 'Ticket resolved by admin',
                resolvedBy: adminId,
                resolvedAt: new Date(),
                resolutionCategory: resolutionData.category || 'solved'
            };
        }

        await ticket.save();

        // Send email to user
        try {
            // Get user email - might need to check which model if not populated correctly
            let userEmail = ticket.userId.email;
            if (!userEmail) {
                const user = await (ticket.userModel === 'DTUser' ? DTUser : User).findById(ticket.userId);
                userEmail = user?.email;
            }

            if (userEmail) {
                await sendTicketStatusUpdateEmail(userEmail, ticket, oldStatus, newStatus);
            }
        } catch (err) {
            console.error('Failed to send status update email:', err);
        }

        return ticket;
    }

    async getTicketStats() {
        return await SupportTicket.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
    }

    async addInternalNote(ticketId, adminId, note) {
        const ticket = await SupportTicket.findById(ticketId);
        if (!ticket) throw new NotFoundError('Ticket not found');

        ticket.internalNotes.push({
            note,
            addedBy: adminId,
            addedAt: new Date()
        });

        await ticket.save();
        return ticket;
    }

    async updateTicket(ticketId, updateData) {
        const ticket = await SupportTicket.findByIdAndUpdate(ticketId, updateData, { new: true });
        if (!ticket) throw new NotFoundError('Ticket not found');
        return ticket;
    }
}

export default new SupportTicketService();
