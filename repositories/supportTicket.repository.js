// Layer: Repository
const SupportTicket = require("../models/supportTicket.model");
const DTUser = require("../models/dtUser.model");
const User = require("../models/user");
const mongoose = require("mongoose");

class SupportTicketRepository {
  /**
   * Create a new support ticket
   */
  async create(data) {
    return await SupportTicket.create(data);
  }

  /**
   * Find tickets with pagination and filtering
   */
  async findWithPagination({ filter, sort, skip, limit, populate = [] }) {
    let query = SupportTicket.find(filter).sort(sort).skip(skip).limit(limit);

    if (arguments[0].select) {
      query = query.select(arguments[0].select);
    }

    if (populate.length > 0) {
      populate.forEach((p) => {
        query = query.populate(p.path, p.select);
      });
    }

    return await query;
  }

  /**
   * Find ticket by ID
   */
  async findById(id) {
    return await SupportTicket.findById(id);
  }

  /**
   * Count total tickets matching filter
   */
  async countAll(filter) {
    return await SupportTicket.countDocuments(filter);
  }

  /**
   * Find one ticket by ID and optional criteria
   */
  async findOne(filter, populate = [], select = "") {
    let query = SupportTicket.findOne(filter);

    if (populate.length > 0) {
      populate.forEach((p) => {
        query = query.populate(p.path, p.select);
      });
    }

    if (select) {
      query = query.select(select);
    }

    return await query;
  }

  /**
   * Find by ID and update
   */
  async findByIdAndUpdate(
    id,
    update,
    options = { new: true, runValidators: true },
  ) {
    return await SupportTicket.findByIdAndUpdate(id, update, options);
  }

  /**
   * Find one and update
   */
  async findOneAndUpdate(
    filter,
    update,
    options = { new: true, runValidators: true },
  ) {
    return await SupportTicket.findOneAndUpdate(filter, update, options);
  }

  /**
   * Delete a ticket
   */
  async findByIdAndDelete(id) {
    return await SupportTicket.findByIdAndDelete(id);
  }

  /**
   * Find DTUser by ID (for polymorphic sender checks)
   */
  async findDTUserById(id) {
    return await DTUser.findById(id);
  }

  /**
   * Find User by ID (for polymorphic sender checks)
   */
  async findUserById(id) {
    return await User.findById(id);
  }

  /**
   * Get aggregate statistics for tickets
   */
  async getStats() {
    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      ticketsByCategory,
      ticketsByPriority,
      avgSatisfactionRating,
    ] = await Promise.all([
      SupportTicket.countDocuments(),
      SupportTicket.countDocuments({ status: "open" }),
      SupportTicket.countDocuments({ status: "in_progress" }),
      SupportTicket.countDocuments({ status: "resolved" }),
      SupportTicket.countDocuments({ status: "closed" }),
      SupportTicket.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      SupportTicket.aggregate([
        { $group: { _id: "$priority", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      SupportTicket.aggregate([
        { $match: { userSatisfactionRating: { $exists: true, $ne: null } } },
        {
          $group: { _id: null, avgRating: { $avg: "$userSatisfactionRating" } },
        },
      ]),
    ]);

    return {
      overview: {
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        closedTickets,
        pendingTickets: openTickets + inProgressTickets,
      },
      breakdown: {
        byCategory: ticketsByCategory,
        byPriority: ticketsByPriority,
      },
      performance: {
        averageSatisfactionRating: avgSatisfactionRating[0]?.avgRating || 0,
        resolutionRate:
          totalTickets > 0
            ? ((resolvedTickets + closedTickets) / totalTickets) * 100
            : 0,
      },
    };
  }

  /**
   * Helper to validate ObjectId
   */
  isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  }
}

module.exports = new SupportTicketRepository();
