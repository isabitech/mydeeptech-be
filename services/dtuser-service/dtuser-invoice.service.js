const Invoice = require("../../models/invoice.model");
const mongoose = require("mongoose");
class DtuserInvoiceService {
  toInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  getUserInvoiceFilter({
    userId,
    paymentStatus,
    projectId,
    startDate,
    endDate,
  }) {
    const filter = { dtUserId: userId };

    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (projectId) filter.projectId = projectId;
    if (startDate || endDate) {
      filter.invoiceDate = {};
      if (startDate) filter.invoiceDate.$gte = new Date(startDate);
      if (endDate) filter.invoiceDate.$lte = new Date(endDate);
    }

    return filter;
  }

  getInvoiceTotalsMatch(userId, paymentStatus) {
    return {
      dtUserId: new mongoose.Types.ObjectId(userId),
      paymentStatus,
    };
  }

  buildPagination({ page, limit, total, totalKey }) {
    return {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      [totalKey]: total,
      invoicesPerPage: limit,
    };
  }

  buildUserInvoiceStatistics(stats = {}) {
    return {
      totalInvoices: stats.totalInvoices,
      totalEarnings: stats.totalAmount,
      paidAmount: stats.paidAmount,
      unpaidAmount: stats.unpaidAmount,
      overdueAmount: stats.overdueAmount,
      unpaidCount: stats.unpaidCount,
      paidCount: stats.paidCount,
      overdueCount: stats.overdueCount,
    };
  }

  buildAmountSummary(totalAmountDue) {
    return (
      totalAmountDue[0] || {
        totalDue: 0,
        overdueAmount: 0,
      }
    );
  }

  /**
   * Invoices: list for user with filters.
   */
  async getUserInvoices({ userId, query }) {
    const {
      page = 1,
      limit = 20,
      paymentStatus,
      projectId,
      startDate,
      endDate,
    } = query;
    const filter = this.getUserInvoiceFilter({
      userId,
      paymentStatus,
      projectId,
      startDate,
      endDate,
    });

    const pageNumber = this.toInt(page, 1);
    const pageSize = this.toInt(limit, 20);
    const skip = (pageNumber - 1) * pageSize;

    const [invoices, totalInvoices, stats] = await Promise.all([
      Invoice.find(filter)
        .populate("projectId", "projectName projectCategory payRate")
        .populate("createdBy", "fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      Invoice.countDocuments(filter),
      Invoice.getInvoiceStats(userId),
    ]);

    return {
      status: 200,
      data: {
        invoices,
        pagination: this.buildPagination({
          page: pageNumber,
          limit: pageSize,
          total: totalInvoices,
          totalKey: "totalInvoices",
        }),
        statistics: this.buildUserInvoiceStatistics(stats),
      },
    };
  }

  async getUnpaidInvoices({ userId, query }) {
    const pageNumber = this.toInt(query.page, 1);
    const pageSize = this.toInt(query.limit, 10);
    const skip = (pageNumber - 1) * pageSize;

    const filter = this.getUserInvoiceFilter({
      userId,
      paymentStatus: { $in: ["unpaid", "overdue"] },
    });

    const [unpaidInvoices, totalUnpaid, totalAmountDue] = await Promise.all([
      Invoice.find(filter)
        .populate("projectId", "projectName projectCategory")
        .populate("createdBy", "fullName email")
        .sort({ dueDate: 1 })
        .skip(skip)
        .limit(pageSize),
      Invoice.countDocuments(filter),
      Invoice.aggregate([
        {
          $match: this.getInvoiceTotalsMatch(userId, {
            $in: ["unpaid", "overdue"],
          }),
        },
        {
          $group: {
            _id: null,
            totalDue: { $sum: "$invoiceAmount" },
            overdueAmount: {
              $sum: {
                $cond: [
                  { $eq: ["$paymentStatus", "overdue"] },
                  "$invoiceAmount",
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const amountSummary = this.buildAmountSummary(totalAmountDue);

    return {
      status: 200,
      data: {
        unpaidInvoices,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(totalUnpaid / pageSize),
          totalUnpaidInvoices: totalUnpaid,
          invoicesPerPage: pageSize,
        },
        summary: {
          totalAmountDue: amountSummary.totalDue,
          overdueAmount: amountSummary.overdueAmount,
          unpaidCount: totalUnpaid,
        },
      },
    };
  }

  async getPaidInvoices({ userId, query }) {
    const pageNumber = this.toInt(query.page, 1);
    const pageSize = this.toInt(query.limit, 20);
    const skip = (pageNumber - 1) * pageSize;

    const filter = this.getUserInvoiceFilter({
      userId,
      paymentStatus: "paid",
    });

    const [paidInvoices, totalPaid, totalEarnings] = await Promise.all([
      Invoice.find(filter)
        .populate("projectId", "projectName projectCategory")
        .populate("createdBy", "fullName email")
        .sort({ paidAt: -1 })
        .skip(skip)
        .limit(pageSize),
      Invoice.countDocuments(filter),
      Invoice.aggregate([
        {
          $match: this.getInvoiceTotalsMatch(userId, "paid"),
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: "$invoiceAmount" },
          },
        },
      ]),
    ]);

    const earnings = totalEarnings[0]?.totalEarnings || 0;

    return {
      status: 200,
      data: {
        paidInvoices,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(totalPaid / pageSize),
          totalPaidInvoices: totalPaid,
          invoicesPerPage: pageSize,
        },
        summary: {
          totalEarnings: earnings,
          paidCount: totalPaid,
        },
      },
    };
  }

  async getInvoiceDetails({ userId, invoiceId }) {
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return { status: 400, reason: "invalid_id" };
    }

    const invoice = await Invoice.findOne({ _id: invoiceId, dtUserId: userId })
      .populate("projectId", "projectName projectDescription projectCategory")
      .populate("createdBy", "fullName email")
      .populate("approvedBy", "fullName email");

    if (!invoice) {
      return { status: 404, reason: "not_found" };
    }

    if (!invoice.emailViewedAt) {
      invoice.emailViewedAt = new Date();
      await invoice.save();
    }

    return {
      status: 200,
      data: {
        invoice,
        computedFields: {
          daysOverdue: invoice.daysOverdue,
          amountDue: invoice.amountDue,
          formattedInvoiceNumber: invoice.formattedInvoiceNumber,
        },
      },
    };
  }

  async getInvoiceDashboard({ userId }) {
    const objectId = new mongoose.Types.ObjectId(userId);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [
      totalInvoices,
      stats,
      recentInvoices,
      overdueInvoices,
      monthlyEarnings,
    ] = await Promise.all([
      Invoice.countDocuments({ dtUserId: objectId }),
      Invoice.getInvoiceStats(objectId),
      Invoice.find({ dtUserId: objectId })
        .populate("projectId", "projectName")
        .sort({ createdAt: -1 })
        .limit(5),
      Invoice.find({
        dtUserId: objectId,
        paymentStatus: "overdue",
      })
        .populate("projectId", "projectName")
        .sort({ dueDate: 1 }),
      Invoice.aggregate([
        {
          $match: {
            dtUserId: objectId,
            paymentStatus: "paid",
            paidAt: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } },
            totalEarnings: { $sum: "$invoiceAmount" },
            invoiceCount: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    return {
      status: 200,
      data: {
        statistics: stats,
        recentInvoices,
        overdueInvoices,
        monthlyEarnings,
        summary: {
          totalEarned: stats.paidAmount,
          pendingPayments: stats.unpaidAmount,
          overduePayments: stats.overdueAmount,
          totalInvoices: stats.totalInvoices,
          unpaidCount: stats.unpaidCount,
          overdueCount: stats.overdueCount,
        },
        debug: {
          totalInvoicesInDb: totalInvoices,
        },
      },
    };
  }
}

module.exports = new DtuserInvoiceService();
