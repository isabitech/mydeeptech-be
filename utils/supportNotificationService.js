const { createNotification } = require('./notificationService');
const SupportTicket = require('../models/supportTicket.model');
const DTUser = require('../models/dtUser.model');

/**
 * Notify admins about new support tickets
 * @param {Object} ticket - The support ticket
 */
const notifyAdminsOfNewTicket = async (ticket) => {
  try {
    // Get all admins (assuming admins are DTUsers with admin role or specific criteria)
    // For now, we'll notify all DTUsers with admin role
    const admins = await DTUser.find({ /* Add admin filter criteria here if you have admin role field */ });
    
    if (admins.length > 0) {
      // Create notifications for all admins
      const adminNotifications = admins.map(admin => 
        createNotification({
          userId: admin._id,
          type: 'support_ticket_admin',
          title: `New Support Ticket - ${ticket.ticketNumber}`,
          message: `A new ${ticket.priority} priority support ticket has been created in the ${ticket.category} category.`,
          priority: ticket.priority,
          data: {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            category: ticket.category,
            priority: ticket.priority,
            userEmail: ticket.userId // Could populate user details if needed
          }
        })
      );

      await Promise.all(adminNotifications);
      console.log(`✅ Notified ${admins.length} admins about new ticket ${ticket.ticketNumber}`);
    }
  } catch (error) {
    console.error('❌ Error notifying admins of new ticket:', error);
  }
};

/**
 * Notify user about ticket status updates
 * @param {Object} ticket - The support ticket
 * @param {String} oldStatus - Previous status
 * @param {String} newStatus - New status
 */
const notifyUserOfStatusUpdate = async (ticket, oldStatus, newStatus) => {
  try {
    let title, message, priority = 'medium';

    switch (newStatus) {
      case 'in_progress':
        title = `Ticket In Progress - ${ticket.ticketNumber}`;
        message = `Your support ticket "${ticket.subject}" is now being worked on by our team.`;
        break;
      case 'waiting_for_user':
        title = `Response Needed - ${ticket.ticketNumber}`;
        message = `Your support ticket "${ticket.subject}" requires your response to proceed.`;
        priority = 'high';
        break;
      case 'resolved':
        title = `Ticket Resolved - ${ticket.ticketNumber}`;
        message = `Your support ticket "${ticket.subject}" has been resolved. Please rate your experience.`;
        priority = 'high';
        break;
      case 'closed':
        title = `Ticket Closed - ${ticket.ticketNumber}`;
        message = `Your support ticket "${ticket.subject}" has been closed.`;
        break;
      default:
        title = `Ticket Status Updated - ${ticket.ticketNumber}`;
        message = `Your support ticket "${ticket.subject}" status has been updated to ${newStatus}.`;
    }

    await createNotification({
      userId: ticket.userId,
      type: 'support_ticket',
      title,
      message,
      priority,
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        oldStatus,
        newStatus,
        category: ticket.category
      }
    });

    console.log(`✅ Notified user about ticket ${ticket.ticketNumber} status change: ${oldStatus} → ${newStatus}`);
  } catch (error) {
    console.error('❌ Error notifying user of status update:', error);
  }
};

/**
 * Notify assigned admin about new ticket assignment
 * @param {Object} ticket - The support ticket
 * @param {String} adminId - ID of assigned admin
 */
const notifyAdminOfAssignment = async (ticket, adminId) => {
  try {
    await createNotification({
      userId: adminId,
      type: 'support_assignment',
      title: `Ticket Assigned - ${ticket.ticketNumber}`,
      message: `You have been assigned to support ticket "${ticket.subject}" (${ticket.priority} priority).`,
      priority: ticket.priority,
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        category: ticket.category,
        priority: ticket.priority,
        assignedAt: new Date()
      }
    });

    console.log(`✅ Notified admin ${adminId} about ticket assignment ${ticket.ticketNumber}`);
  } catch (error) {
    console.error('❌ Error notifying admin of assignment:', error);
  }
};

/**
 * Notify assigned admin about new message in ticket
 * @param {Object} ticket - The support ticket
 * @param {Object} message - The new message
 */
const notifyAdminOfNewMessage = async (ticket, message) => {
  try {
    if (ticket.assignedTo && !message.isAdminReply) {
      await createNotification({
        userId: ticket.assignedTo,
        type: 'support_message',
        title: `New Message - ${ticket.ticketNumber}`,
        message: `User replied to support ticket "${ticket.subject}".`,
        priority: 'medium',
        data: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          messageId: message._id,
          category: ticket.category
        }
      });

      console.log(`✅ Notified admin ${ticket.assignedTo} about new message in ticket ${ticket.ticketNumber}`);
    }
  } catch (error) {
    console.error('❌ Error notifying admin of new message:', error);
  }
};

/**
 * Notify user about admin reply to their ticket
 * @param {Object} ticket - The support ticket
 * @param {Object} message - The admin's message
 */
const notifyUserOfAdminReply = async (ticket, message) => {
  try {
    if (message.isAdminReply) {
      await createNotification({
        userId: ticket.userId,
        type: 'support_reply',
        title: `Support Team Reply - ${ticket.ticketNumber}`,
        message: `Our support team has replied to your ticket "${ticket.subject}".`,
        priority: 'high',
        data: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          messageId: message._id,
          category: ticket.category
        }
      });

      console.log(`✅ Notified user about admin reply in ticket ${ticket.ticketNumber}`);
    }
  } catch (error) {
    console.error('❌ Error notifying user of admin reply:', error);
  }
};

/**
 * Send escalation notifications for urgent tickets
 * @param {Object} ticket - The support ticket
 */
const sendEscalationNotification = async (ticket) => {
  try {
    if (ticket.priority === 'urgent') {
      // Get senior admins or escalation contacts
      const admins = await DTUser.find({ /* Add senior admin criteria */ });
      
      const escalationNotifications = admins.map(admin =>
        createNotification({
          userId: admin._id,
          type: 'support_escalation',
          title: `URGENT: Ticket Escalation - ${ticket.ticketNumber}`,
          message: `Urgent support ticket "${ticket.subject}" requires immediate attention.`,
          priority: 'urgent',
          data: {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            category: ticket.category,
            priority: ticket.priority,
            escalatedAt: new Date()
          }
        })
      );

      await Promise.all(escalationNotifications);
      console.log(`🚨 Sent escalation notifications for urgent ticket ${ticket.ticketNumber}`);
    }
  } catch (error) {
    console.error('❌ Error sending escalation notification:', error);
  }
};

/**
 * Notify about tickets requiring attention (auto-reminders)
 */
const sendTicketReminders = async () => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Find open tickets older than 24 hours
    const staleTickets = await SupportTicket.find({
      status: 'open',
      createdAt: { $lt: twentyFourHoursAgo }
    }).populate('userId', 'fullName email');

    for (const ticket of staleTickets) {
      // Notify admins about stale tickets
      await notifyAdminsOfNewTicket(ticket);
    }

    if (staleTickets.length > 0) {
      console.log(`⏰ Sent reminders for ${staleTickets.length} stale tickets`);
    }
  } catch (error) {
    console.error('❌ Error sending ticket reminders:', error);
  }
};

module.exports = {
  notifyAdminsOfNewTicket,
  notifyUserOfStatusUpdate,
  notifyAdminOfAssignment,
  notifyAdminOfNewMessage,
  notifyUserOfAdminReply,
  sendEscalationNotification,
  sendTicketReminders
};