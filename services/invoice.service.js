const InvoiceRepository = require("../repositories/invoice.repository");
const DTUser = require("../models/dtUser.model");
const AnnotationProject = require("../models/annotationProject.model");
const ProjectApplication = require("../models/projectApplication.model");
const MailService = require("./mail-service/mail-service");
const { convertUSDToNGN } = require("../utils/exchangeRateService");
const {
  getBankCode,
  validatePaymentInfo,
} = require("../utils/bankCodeMapping");
const mongoose = require("mongoose");
const {
  sendPaymentConfirmation,
  sendPaymentReminder,
} = require("../utils/paymentMailer");

class InvoiceService {
  toInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  buildInvoiceFilter(value) {
    const {
      projectId,
      dtUserId,
      paymentStatus,
      invoiceType,
      startDate,
      endDate,
    } = value;

    const filter = {};
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (projectId) filter.projectId = projectId;
    if (dtUserId) filter.dtUserId = dtUserId;
    if (invoiceType) filter.invoiceType = invoiceType;

    if (startDate || endDate) {
      filter.invoiceDate = {};
      if (startDate) filter.invoiceDate.$gte = new Date(startDate);
      if (endDate) filter.invoiceDate.$lte = new Date(endDate);
    }

    return filter;
  }

  buildPagination({ page, limit, total }) {
    return {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalInvoices: total,
      invoicesPerPage: limit,
    };
  }

  async createInvoice(value, adminId) {
    const { projectId, dtUserId } = value;

    const [project, dtUser] = await Promise.all([
      AnnotationProject.findById(projectId),
      DTUser.findById(dtUserId),
    ]);

    if (!project) throw { status: 404, message: "Project not found" };
    if (!dtUser) throw { status: 404, message: "DTUser not found" };

    if (dtUser.annotatorStatus !== "approved") {
      throw {
        status: 400,
        message: "Can only create invoices for approved annotators",
      };
    }

    const userWorkedOnProject = await ProjectApplication.findOne({
      projectId: projectId,
      applicantId: dtUserId,
      status: "approved",
    });

    if (!userWorkedOnProject) {
      throw {
        status: 400,
        message:
          "User has not worked on this project or application not approved",
      };
    }

    const invoiceData = {
      ...value,
      createdBy: adminId,
      status: "sent",
    };

    const invoice = await InvoiceRepository.create(invoiceData);
    await invoice.populate([
      { path: "projectId", select: "projectName projectDescription" },
      { path: "dtUserId", select: "fullName email" },
      { path: "createdBy", select: "fullName email" },
    ]);

    let emailSent = false;
    try {
      await MailService.sendDTUserInvoiceNotification(
        dtUser.email,
        dtUser.fullName,
        {
          invoiceNumber: invoice.invoiceNumber,
          projectName: project.projectName,
          amount: invoice.invoiceAmount,
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          description: invoice.description,
        },
      );

      invoice.emailSent = true;
      invoice.emailSentAt = new Date();
      await invoice.save();
      emailSent = true;
    } catch (emailError) {
      console.error("Email notification error:", emailError);
    }

    return { invoice, emailNotificationSent: emailSent };
  }

  async getAllInvoices(query) {
    const { page = 1, limit = 20 } = query;
    const filter = this.buildInvoiceFilter(query);
    const pageNumber = this.toInt(page, 1);
    const pageSize = this.toInt(limit, 20);
    const skip = (pageNumber - 1) * pageSize;

    const [invoices, totalInvoices, summary] = await Promise.all([
      InvoiceRepository.fetchAll(filter, skip, pageSize),
      InvoiceRepository.count(filter),
      InvoiceRepository.getSummaryPattern(filter),
    ]);

    return {
      invoices,
      pagination: this.buildPagination({
        page: pageNumber,
        limit: pageSize,
        total: totalInvoices,
      }),
      summary,
    };
  }

  async getInvoiceDetails(invoiceId) {
    const invoice = await InvoiceRepository.findById(invoiceId);
    if (!invoice) throw { status: 404, message: "Invoice not found" };

    return {
      invoice,
      computedFields: {
        daysOverdue: invoice.daysOverdue,
        amountDue: invoice.amountDue,
        formattedInvoiceNumber: invoice.formattedInvoiceNumber,
      },
    };
  }

  async updatePaymentStatus(invoiceId, body) {
    const {
      paymentStatus,
      paymentMethod,
      paymentReference,
      paymentNotes,
      paidAmount,
    } = body;

    const invoice = await InvoiceRepository.findById(invoiceId);
    if (!invoice) throw { status: 404, message: "Invoice not found" };

    const updateData = { paymentStatus };

    if (paymentStatus === "paid") {
      updateData.paidAt = new Date();
      updateData.paidAmount = paidAmount || invoice.invoiceAmount;
      updateData.status = "paid";
      if (paymentMethod) updateData.paymentMethod = paymentMethod;
      if (paymentReference) updateData.paymentReference = paymentReference;
      if (paymentNotes) updateData.paymentNotes = paymentNotes;
    }

    Object.assign(invoice, updateData);
    await invoice.save();

    let emailSent = false;
    if (paymentStatus === "paid") {
      try {
        await sendPaymentConfirmation(
          invoice.dtUserId.email,
          invoice.dtUserId.fullName,
          {
            invoiceNumber: invoice.invoiceNumber,
            projectName: invoice.projectId.projectName,
            amount: invoice.invoiceAmount,
            currency: invoice.currency,
            paidAt: invoice.paidAt,
          },
          {
            paymentMethod: invoice.paymentMethod,
            paymentReference: invoice.paymentReference,
          },
        );
        emailSent = true;
      } catch (emailError) {
        console.error("Payment confirmation email error:", emailError);
      }
    }
    return { invoice, emailNotificationSent: emailSent };
  }

  async sendInvoiceReminder(invoiceId) {
    const invoice = await InvoiceRepository.findById(invoiceId);
    if (!invoice) throw { status: 404, message: "Invoice not found" };
    if (invoice.paymentStatus === "paid") {
      throw { status: 400, message: "Cannot send reminder for paid invoice" };
    }

    try {
      await sendPaymentReminder(
        invoice.dtUserId.email,
        invoice.dtUserId.fullName,
        {
          invoiceNumber: invoice.invoiceNumber,
          projectName: invoice.projectId.projectName,
          amount: invoice.invoiceAmount,
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          daysOverdue: invoice.daysOverdue,
        },
      );
      invoice.lastEmailReminder = new Date();
      await invoice.save();

      return {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        sentTo: invoice.dtUserId.email,
        sentAt: invoice.lastEmailReminder,
      };
    } catch (error) {
      throw {
        status: 500,
        message: "Failed to send payment reminder",
        error: error.message,
      };
    }
  }

  async deleteInvoice(invoiceId) {
    const invoice = await InvoiceRepository.findById(invoiceId);
    if (!invoice) throw { status: 404, message: "Invoice not found" };

    const hoursAgo = (new Date() - invoice.createdAt) / (1000 * 60 * 60);
    if (invoice.paymentStatus !== "unpaid" || hoursAgo > 24) {
      throw {
        status: 400,
        message:
          "Can only delete unpaid invoices created within the last 24 hours",
      };
    }

    await InvoiceRepository.delete(invoiceId);
    return true;
  }

  async bulkAuthorizePayment(adminEmail) {
    const unpaidInvoices = await InvoiceRepository.find({
      paymentStatus: { $in: ["unpaid", "overdue"] },
    });

    if (unpaidInvoices.length === 0) {
      return {
        processedInvoices: 0,
        totalAmount: 0,
        emailsSent: 0,
        errors: [],
      };
    }

    const results = {
      processedInvoices: 0,
      totalAmount: 0,
      emailsSent: 0,
      errors: [],
    };

    for (const invoice of unpaidInvoices) {
      try {
        await invoice.markAsPaid({
          paymentMethod: "bulk_transfer",
          paymentReference: `BULK-${new Date().getTime()}`,
          paymentNotes: `Bulk payment authorization by ${adminEmail}`,
        });

        results.processedInvoices++;
        results.totalAmount += invoice.invoiceAmount;

        try {
          await sendPaymentConfirmation(
            invoice.dtUserId.email,
            invoice.dtUserId.fullName,
            {
              invoiceNumber: invoice.invoiceNumber,
              projectName: invoice.projectId.projectName,
              amount: invoice.invoiceAmount,
              currency: invoice.currency || "USD",
              paidAt: new Date(),
            },
          );
          results.emailsSent++;
        } catch (emailError) {
          results.errors.push({
            invoiceNumber: invoice.invoiceNumber,
            error: "Email sending failed",
            details: emailError.message,
          });
        }
      } catch (invoiceError) {
        results.errors.push({
          invoiceNumber: invoice.invoiceNumber,
          error: "Payment processing failed",
          details: invoiceError.message,
        });
      }
    }
    return results;
  }

  async buildUnpaidInvoiceFilter(invoiceIds) {
    let invoiceFilter = { paymentStatus: { $in: ["unpaid", "overdue"] } };

    if (invoiceIds && Array.isArray(invoiceIds) && invoiceIds.length > 0) {
      const invalidIds = [];
      const validObjectIds = [];
      for (const id of invoiceIds) {
        if (!id || typeof id !== "string") {
          invalidIds.push(id);
          continue;
        }
        try {
          if (!mongoose.Types.ObjectId.isValid(id)) {
            invalidIds.push(id);
            continue;
          }
          validObjectIds.push(new mongoose.Types.ObjectId(id));
        } catch (error) {
          invalidIds.push(id);
        }
      }
      if (invalidIds.length > 0) {
        throw {
          status: 400,
          message: "Invalid invoice ID(s) provided",
          details: {
            invalidIds,
            totalProvided: invoiceIds.length,
            validIds: validObjectIds.length,
          },
        };
      }
      if (validObjectIds.length === 0) {
        throw { status: 400, message: "No valid invoice IDs provided" };
      }
      invoiceFilter = {
        _id: { $in: validObjectIds },
        paymentStatus: { $in: ["unpaid", "overdue"] },
      };
    } else if (invoiceIds && !Array.isArray(invoiceIds)) {
      if (!mongoose.Types.ObjectId.isValid(invoiceIds)) {
        throw { status: 400, message: "Invalid invoice ID format" };
      }
      invoiceFilter = {
        _id: new mongoose.Types.ObjectId(invoiceIds),
        paymentStatus: { $in: ["unpaid", "overdue"] },
      };
    }
    return invoiceFilter;
  }

  async generatePaystackCSV(invoiceIds) {
    const invoiceFilter = await this.buildUnpaidInvoiceFilter(invoiceIds);
    const unpaidInvoices = await InvoiceRepository.find(invoiceFilter);

    if (unpaidInvoices.length === 0) {
      return {
        csvContent: "",
        summary: {
          totalInvoices: 0,
          processedInvoices: 0,
          totalAmountUSD: 0,
          totalAmountNGN: 0,
          errors: [],
          selectedInvoices: invoiceIds ? invoiceIds.length : 0,
        },
      };
    }

    try {
      await convertUSDToNGN(1);
    } catch (rateError) {
      throw {
        status: 503,
        message: "Cannot generate CSV due to exchange rate service failure",
        error: "Exchange rate service unavailable",
        details: {
          exchangeRateError: rateError.message,
          totalInvoices: unpaidInvoices.length,
        },
      };
    }

    const csvRows = [];
    const results = {
      totalInvoices: unpaidInvoices.length,
      selectedInvoices: invoiceIds ? invoiceIds.length : 0,
      processedInvoices: 0,
      totalAmountUSD: 0,
      totalAmountNGN: 0,
      errors: [],
    };
    csvRows.push([
      "Transfer Amount",
      "Transfer Note (Optional)",
      "Transfer Reference (Optional)",
      "Recipient Code (This overrides all other details if available)",
      "Bank Code or Slug",
      "Account Number",
      "Account Name (Optional)",
      "Email Address (Optional)",
    ]);

    for (const invoice of unpaidInvoices) {
      try {
        const user = invoice.dtUserId;
        const validation = validatePaymentInfo(user.payment_info);
        if (!validation.isValid) {
          results.errors.push({
            userId: user._id,
            userEmail: user.email,
            invoiceNumber: invoice.invoiceNumber,
            error: "Invalid payment info",
            details: validation.errors.join(", "),
          });
          continue;
        }
        const amountNGN = await convertUSDToNGN(invoice.invoiceAmount);
        const bankCode =
          user.payment_info.bank_code ||
          getBankCode(user.payment_info.bank_name);

        if (!bankCode) {
          results.errors.push({
            userId: user._id,
            userEmail: user.email,
            invoiceNumber: invoice.invoiceNumber,
            error: "Bank code not found",
            details: `Unable to map bank: ${user.payment_info.bank_name}`,
          });
          continue;
        }

        csvRows.push([
          amountNGN.toFixed(2),
          `${invoice.description || "Project completion payment"} for ${user.fullName}`,
          invoice.invoiceNumber,
          "",
          bankCode,
          user.payment_info.account_number,
          user.payment_info.account_name,
          user.email,
        ]);

        results.processedInvoices++;
        results.totalAmountUSD += invoice.invoiceAmount;
        results.totalAmountNGN += amountNGN;
      } catch (invoiceError) {
        results.errors.push({
          invoiceNumber: invoice.invoiceNumber,
          error: "Processing failed",
          details: invoiceError.message,
        });
      }
    }

    const csvContent = csvRows
      .map((row) =>
        row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    return { csvContent, summary: results };
  }

  async generateMPESACSV(invoiceIds) {
    const invoiceFilter = await this.buildUnpaidInvoiceFilter(invoiceIds);
    const unpaidInvoices = await InvoiceRepository.find(invoiceFilter);

    if (unpaidInvoices.length === 0) {
      return {
        csvContent: "",
        summary: {
          totalInvoices: 0,
          processedInvoices: 0,
          totalAmountUSD: 0,
          errors: [],
          selectedInvoices: invoiceIds ? invoiceIds.length : 0,
        },
      };
    }

    const csvRows = [];
    const results = {
      totalInvoices: unpaidInvoices.length,
      selectedInvoices: invoiceIds ? invoiceIds.length : 0,
      processedInvoices: 0,
      totalAmountUSD: 0,
      errors: [],
    };
    csvRows.push([
      "Transfer Amount(USD)",
      "Transfer Note (Optional)",
      "Transfer Reference (Optional)",
      "MPESA Account Number",
      "Account Name",
      "Email Address",
    ]);

    for (const invoice of unpaidInvoices) {
      try {
        const user = invoice.dtUserId;
        if (!invoice.invoiceAmount || invoice.invoiceAmount <= 0) {
          results.errors.push({
            userId: user._id,
            userEmail: user.email,
            invoiceNumber: invoice.invoiceNumber,
            error: "Invalid invoice amount",
            details: `Amount is ${invoice.invoiceAmount || "undefined"}`,
          });
          continue;
        }
        if (!user.payment_info?.account_number) {
          results.errors.push({
            userId: user._id,
            userEmail: user.email,
            invoiceNumber: invoice.invoiceNumber,
            error: "Missing MPESA account number",
            details: "payment_info.account_number is required",
          });
          continue;
        }
        if (!user.payment_info?.account_name) {
          results.errors.push({
            userId: user._id,
            userEmail: user.email,
            invoiceNumber: invoice.invoiceNumber,
            error: "Missing account name",
            details: "payment_info.account_name is required",
          });
          continue;
        }

        csvRows.push([
          invoice.invoiceAmount.toFixed(2),
          `${invoice.description || "Payment"} for ${user.fullName}`,
          invoice.invoiceNumber,
          user.payment_info.account_number,
          user.payment_info.account_name,
          user.email,
        ]);

        results.processedInvoices++;
        results.totalAmountUSD += invoice.invoiceAmount;
      } catch (invoiceError) {
        results.errors.push({
          userId: invoice.dtUserId?._id,
          userEmail: invoice.dtUserId?.email,
          invoiceNumber: invoice.invoiceNumber,
          error: "Processing failed",
          details: invoiceError.message,
        });
      }
    }

    const csvContent = csvRows
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    return { csvContent, summary: results };
  }
}

module.exports = new InvoiceService();
