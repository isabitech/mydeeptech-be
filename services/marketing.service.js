const DTUser = require("../models/dtUser.model");
const MarketingCampaign = require("../models/marketingCampaign.model");
const BaseMailService = require("./mail-service/base.service");
const envConfig = require("../config/envConfig");
const AppError = require("../utils/app-error");

class MarketingService {
  constructor() {
    this.activeCampaignIds = new Set();
  }

  clampNumber(value, { min, max, fallback }) {
    const parsedValue = Number.parseInt(value, 10);

    if (Number.isNaN(parsedValue)) {
      return fallback;
    }

    return Math.min(Math.max(parsedValue, min), max);
  }

  delay(durationMs = 0) {
    return new Promise((resolve) => {
      setTimeout(resolve, durationMs);
    });
  }

  countRecipientsByStatus(recipients = [], status = "") {
    return recipients.filter((recipient) => recipient?.status === status).length;
  }

  updateCampaignDeliveryCounts(campaign) {
    campaign.sentCount = this.countRecipientsByStatus(campaign.recipients, "sent");
    campaign.failedCount = this.countRecipientsByStatus(
      campaign.recipients,
      "failed",
    );
  }

  queueCampaignProcessing(campaignId) {
    setImmediate(() => {
      this.processCampaign(campaignId).catch((error) => {
        console.error("Error processing marketing campaign:", error);
      });
    });
  }

  normalizeEmail(email = "") {
    return String(email || "").trim().toLowerCase();
  }

  normalizeRecipientEmailList(recipientEmails = []) {
    if (!Array.isArray(recipientEmails)) {
      return [];
    }

    return Array.from(
      new Set(
        recipientEmails
          .map((email) => this.normalizeEmail(email))
          .filter(Boolean),
      ),
    );
  }

  normalizeFilterValue(value = "") {
    const normalizedValue = String(value || "").trim();

    if (!normalizedValue || normalizedValue.toLowerCase() === "all") {
      return "";
    }

    return normalizedValue;
  }

  parseBooleanFlag(value, fallback = true) {
    if (typeof value === "boolean") {
      return value;
    }

    const normalizedValue = String(value || "")
      .trim()
      .toLowerCase();

    if (!normalizedValue) {
      return fallback;
    }

    if (["true", "1", "yes"].includes(normalizedValue)) {
      return true;
    }

    if (["false", "0", "no"].includes(normalizedValue)) {
      return false;
    }

    return fallback;
  }

  escapeRegExp(value = "") {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  extractFirstName(fullName = "", email = "") {
    const normalizedFullName = String(fullName || "").trim();
    if (normalizedFullName) {
      return normalizedFullName.split(/\s+/)[0];
    }

    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      return "there";
    }

    return normalizedEmail.split("@")[0];
  }

  escapeHtml(value = "") {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  stripHtml(html = "") {
    return String(html || "")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  buildHtmlFromText(text = "", subject = "") {
    const safeSubject = this.escapeHtml(subject || "Marketing Email");
    const safeText = this.escapeHtml(text || "").replace(/\r?\n/g, "<br />");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background:#f6f8fb;font-family:Arial,sans-serif;color:#1f2937;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border-radius:12px;padding:32px 24px;box-shadow:0 12px 30px rgba(15,23,42,0.08);">
      <h1 style="margin:0 0 20px;color:#111827;font-size:24px;">${safeSubject}</h1>
      <div style="font-size:16px;line-height:1.7;color:#374151;">${safeText}</div>
    </div>
  </div>
</body>
</html>`;
  }

  applyPersonalization(content = "", recipient = {}) {
    let personalizedContent = String(content || "");

    if (!personalizedContent) {
      return "";
    }

    const fullName = String(recipient.fullName || "").trim();
    const email = this.normalizeEmail(recipient.email);
    const firstName =
      String(recipient.firstName || "").trim() ||
      this.extractFirstName(fullName, email);

    const replacementRules = [
      { pattern: /{{\s*firstName\s*}}/gi, value: firstName },
      { pattern: /{{\s*first_name\s*}}/gi, value: firstName },
      { pattern: /\bFIRST_NAME\b/g, value: firstName },
      { pattern: /{{\s*fullName\s*}}/gi, value: fullName || firstName },
      { pattern: /{{\s*full_name\s*}}/gi, value: fullName || firstName },
      { pattern: /\bFULL_NAME\b/g, value: fullName || firstName },
      { pattern: /{{\s*email\s*}}/gi, value: email },
      { pattern: /\bEMAIL\b/g, value: email },
    ];

    replacementRules.forEach(({ pattern, value }) => {
      personalizedContent = personalizedContent.replace(pattern, value);
    });

    return personalizedContent;
  }

  resolveSender(sender = {}) {
    const defaults = {
      email:
        envConfig.email.mailjet.MAILJET_SENDER_EMAIL ||
        envConfig.email.senders.projects.email ||
        "no-reply@mydeeptech.ng",
      name:
        envConfig.email.mailjet.MAILJET_SENDER_NAME ||
        envConfig.email.senders.projects.name ||
        "MyDeepTech Marketing",
    };

    return {
      email: this.normalizeEmail(sender.email) || defaults.email,
      name: String(sender.name || "").trim() || defaults.name,
    };
  }

  normalizeCustomRecipient(recipient) {
    if (typeof recipient === "string") {
      const email = this.normalizeEmail(recipient);
      return {
        dtUserId: null,
        email,
        fullName: "",
        firstName: this.extractFirstName("", email),
      };
    }

    const email = this.normalizeEmail(recipient?.email);
    const fullName = String(recipient?.fullName || "").trim();

    return {
      dtUserId: recipient?.dtUserId || null,
      email,
      fullName,
      firstName: this.extractFirstName(fullName, email),
    };
  }

  dedupeRecipients(recipients = []) {
    const recipientMap = new Map();

    recipients.forEach((recipient) => {
      const email = this.normalizeEmail(recipient?.email);
      if (!email) {
        return;
      }

      if (!recipientMap.has(email)) {
        recipientMap.set(email, {
          dtUserId: recipient?.dtUserId || null,
          email,
          fullName: String(recipient?.fullName || "").trim(),
          firstName:
            String(recipient?.firstName || "").trim() ||
            this.extractFirstName(recipient?.fullName, email),
        });
      }
    });

    return Array.from(recipientMap.values());
  }

  getUnknownCountryConditions() {
    return [
      { "personal_info.country": { $exists: false } },
      { "personal_info.country": null },
      { "personal_info.country": "" },
      { "personal_info.country": /^\s*$/ },
    ];
  }

  buildUnknownCountryFilter(baseFilter = {}) {
    const unknownCountryFilter = { $or: this.getUnknownCountryConditions() };

    if (!baseFilter || Object.keys(baseFilter).length === 0) {
      return unknownCountryFilter;
    }

    return {
      $and: [baseFilter, unknownCountryFilter],
    };
  }

  buildDtUserFilter(audience = {}) {
    const filter = {};

    if (audience.verifiedOnly !== false) {
      filter.isEmailVerified = true;
    }

    if (Array.isArray(audience.dtUserIds) && audience.dtUserIds.length > 0) {
      filter._id = { $in: audience.dtUserIds };
    }

    const audienceFilters = audience.filters || {};
    const normalizedAnnotatorStatus = this.normalizeFilterValue(
      audienceFilters.annotatorStatus,
    );
    const normalizedMicroTaskerStatus = this.normalizeFilterValue(
      audienceFilters.microTaskerStatus,
    );
    const normalizedQaStatus = this.normalizeFilterValue(audienceFilters.qaStatus);

    if (normalizedAnnotatorStatus) {
      filter.annotatorStatus = normalizedAnnotatorStatus;
    }

    if (normalizedMicroTaskerStatus) {
      filter.microTaskerStatus = normalizedMicroTaskerStatus;
    }

    if (normalizedQaStatus) {
      filter.qaStatus = normalizedQaStatus;
    }

    const normalizedCountry = String(audienceFilters.country || "").trim();

    if (normalizedCountry && normalizedCountry.toLowerCase() !== "all") {
      if (normalizedCountry.toLowerCase() === "unknown") {
        filter.$or = this.getUnknownCountryConditions();
      } else {
        filter["personal_info.country"] = new RegExp(
          `^${this.escapeRegExp(normalizedCountry)}$`,
          "i",
        );
      }
    }

    return filter;
  }

  buildCountryOptionsAudience(filters = {}) {
    return {
      type: "dtusers",
      verifiedOnly: this.parseBooleanFlag(filters.verifiedOnly, true),
      filters: {
        annotatorStatus: this.normalizeFilterValue(filters.annotatorStatus),
        microTaskerStatus: this.normalizeFilterValue(filters.microTaskerStatus),
        qaStatus: this.normalizeFilterValue(filters.qaStatus),
      },
    };
  }

  async resolveRecipients(audience = {}) {
    const audienceType = String(audience?.type || "dtusers")
      .trim()
      .toLowerCase();

    if (audienceType === "custom_emails") {
      const customRecipients = Array.isArray(audience.customRecipients)
        ? audience.customRecipients
        : [];

      return this.dedupeRecipients(
        customRecipients.map((recipient) =>
          this.normalizeCustomRecipient(recipient),
        ),
      );
    }

    if (audienceType !== "dtusers") {
      throw new Error("Unsupported audience type");
    }

    const dtUserFilter = this.buildDtUserFilter(audience);
    const users = await DTUser.find(dtUserFilter)
      .select("_id fullName email")
      .sort({ createdAt: -1 })
      .lean();

    return this.dedupeRecipients(
      users.map((user) => ({
        dtUserId: user._id,
        email: user.email,
        fullName: user.fullName || "",
        firstName: this.extractFirstName(user.fullName, user.email),
      })),
    );
  }

  async getAudienceCountryOptions(filters = {}) {
    const audience = this.buildCountryOptionsAudience(filters);
    const baseFilter = this.buildDtUserFilter(audience);

    const [totalRecipients, unknownCount, countryRows] = await Promise.all([
      DTUser.countDocuments(baseFilter),
      DTUser.countDocuments(this.buildUnknownCountryFilter(baseFilter)),
      DTUser.aggregate([
        { $match: baseFilter },
        {
          $project: {
            country: {
              $trim: {
                input: {
                  $ifNull: ["$personal_info.country", ""],
                },
              },
            },
          },
        },
        {
          $match: {
            country: { $ne: "" },
          },
        },
        {
          $sort: {
            country: 1,
          },
        },
        {
          $group: {
            _id: { $toLower: "$country" },
            value: { $first: "$country" },
            count: { $sum: 1 },
          },
        },
        {
          $sort: {
            value: 1,
          },
        },
      ]),
    ]);

    const options = [
      {
        value: "all",
        label: "All Countries",
        count: totalRecipients,
      },
      {
        value: "unknown",
        label: "No Country On Profile",
        count: unknownCount,
      },
      ...countryRows.map((countryRow) => ({
        value: countryRow.value,
        label: countryRow.value,
        count: countryRow.count,
      })),
    ];

    return {
      options,
      appliedFilters: {
        verifiedOnly: audience.verifiedOnly,
        annotatorStatus: audience.filters.annotatorStatus || "",
        microTaskerStatus: audience.filters.microTaskerStatus || "",
        qaStatus: audience.filters.qaStatus || "",
      },
    };
  }

  createRecipientRecords(recipients = [], provider = "mailjet") {
    return recipients.map((recipient) => ({
      dtUserId: recipient.dtUserId || null,
      email: recipient.email,
      fullName: recipient.fullName || "",
      firstName: recipient.firstName || this.extractFirstName(recipient.fullName, recipient.email),
      status: "pending",
      providerMessageId: "",
      deliveryProvider: provider,
      errorMessage: "",
      lastAttemptAt: null,
      sentAt: null,
    }));
  }

  sanitizeAudienceForStorage(audience = {}, recipientCount = 0) {
    const audienceType = String(audience?.type || "dtusers")
      .trim()
      .toLowerCase();

    return {
      type: audienceType,
      verifiedOnly: audienceType === "dtusers" ? audience?.verifiedOnly !== false : true,
      dtUserIds:
        audienceType === "dtusers" && Array.isArray(audience?.dtUserIds)
          ? audience.dtUserIds
          : [],
      filters:
        audienceType === "dtusers"
          ? {
              annotatorStatus: audience?.filters?.annotatorStatus || "",
              microTaskerStatus: audience?.filters?.microTaskerStatus || "",
              qaStatus: audience?.filters?.qaStatus || "",
              country: audience?.filters?.country || "",
            }
          : {
              annotatorStatus: "",
              microTaskerStatus: "",
              qaStatus: "",
              country: "",
            },
      requestedRecipientCount:
        audienceType === "custom_emails" && Array.isArray(audience?.customRecipients)
          ? audience.customRecipients.length
          : recipientCount,
    };
  }

  buildCampaignContentForRecipient(campaign, recipient) {
    const subject = this.applyPersonalization(campaign.subject, recipient);
    const htmlContent = this.applyPersonalization(campaign.htmlContent, recipient);
    const textContent = this.applyPersonalization(campaign.textContent, recipient);
    const resolvedTextContent =
      textContent || this.stripHtml(htmlContent) || subject;
    const resolvedHtmlContent =
      htmlContent || this.buildHtmlFromText(resolvedTextContent, subject);

    return {
      subject,
      htmlContent: resolvedHtmlContent,
      textContent: resolvedTextContent,
    };
  }

  extractDeliveryResult(result) {
    const payload = result?.body || result;
    const messageInfo = payload?.Messages?.[0]?.To?.[0];

    return {
      provider: "mailjet",
      messageId: messageInfo?.MessageID || messageInfo?.MessageUUID || "",
    };
  }

  buildMailjetCampaignMetadata(campaign, recipient = {}) {
    const campaignId = campaign?._id?.toString?.() || "";
    const normalizedRecipientEmail = this.normalizeEmail(recipient?.email);

    return {
      CustomCampaign: campaignId ? `marketing-${campaignId}` : "marketing",
      DeduplicateCampaign: true,
      CustomID: ["marketing", campaignId, normalizedRecipientEmail]
        .filter(Boolean)
        .join(":")
        .slice(0, 255),
    };
  }

  async sendEmailToRecipient(campaign, recipient) {
    const sender = this.resolveSender(campaign?.sender);
    const content = this.buildCampaignContentForRecipient(campaign, recipient);

    const mailOptions = {
      recipientEmail: recipient.email,
      recipientName: recipient.fullName || recipient.email,
      subject: content.subject,
      message: content.textContent,
      htmlTemplate: content.htmlContent,
      senderEmail: sender.email,
      senderName: sender.name,
      mailjetMessageOptions: this.buildMailjetCampaignMetadata(
        campaign,
        recipient,
      ),
    };

    const result = await BaseMailService.sendMailWithMailJet(mailOptions);

    return this.extractDeliveryResult(result);
  }

  formatCreatedBy(createdBy) {
    if (!createdBy) {
      return null;
    }

    if (typeof createdBy === "string") {
      return {
        id: createdBy,
      };
    }

    return {
      id: createdBy._id?.toString?.() || createdBy.id || "",
      fullName: createdBy.fullName || "",
      email: createdBy.email || "",
    };
  }

  formatRecipient(recipient = {}) {
    return {
      dtUserId: recipient.dtUserId?.toString?.() || recipient.dtUserId || null,
      email: recipient.email || "",
      fullName: recipient.fullName || "",
      firstName: recipient.firstName || "",
      status: recipient.status || "pending",
      deliveryProvider: recipient.deliveryProvider || "mailjet",
      providerMessageId: recipient.providerMessageId || "",
      errorMessage: recipient.errorMessage || "",
      lastAttemptAt: recipient.lastAttemptAt || null,
      sentAt: recipient.sentAt || null,
    };
  }

  formatCampaignSummary(campaign = {}, { includeSampleRecipients = false } = {}) {
    const recipients = Array.isArray(campaign.recipients) ? campaign.recipients : [];

    return {
      id: campaign._id?.toString?.() || campaign.id || "",
      name: campaign.name || "",
      subject: campaign.subject || "",
      sender: campaign.sender || null,
      audience: campaign.audience || null,
      delivery: campaign.delivery || null,
      status: campaign.status || "draft",
      totalRecipients: campaign.totalRecipients || 0,
      sentCount: campaign.sentCount || 0,
      failedCount: campaign.failedCount || 0,
      createdBy: this.formatCreatedBy(campaign.createdBy),
      createdAt: campaign.createdAt || null,
      updatedAt: campaign.updatedAt || null,
      startedAt: campaign.startedAt || null,
      completedAt: campaign.completedAt || null,
      lastError: campaign.lastError || "",
      sampleRecipients: includeSampleRecipients
        ? recipients.slice(0, 10).map((recipient) => this.formatRecipient(recipient))
        : undefined,
    };
  }

  formatCampaignDetail(campaign = {}) {
    return {
      ...this.formatCampaignSummary(campaign),
      htmlContent: campaign.htmlContent || "",
      textContent: campaign.textContent || "",
      recipients: Array.isArray(campaign.recipients)
        ? campaign.recipients.map((recipient) => this.formatRecipient(recipient))
        : [],
    };
  }

  async previewAudience(audience = {}) {
    const recipients = await this.resolveRecipients(audience);

    return {
      totalRecipients: recipients.length,
      sampleRecipients: recipients.slice(0, 10).map((recipient) => ({
        dtUserId: recipient.dtUserId?.toString?.() || recipient.dtUserId || null,
        email: recipient.email,
        fullName: recipient.fullName || "",
        firstName: recipient.firstName || "",
      })),
    };
  }

  async createAndQueueCampaign(payload = {}, admin = {}) {
    const recipients = await this.resolveRecipients(payload.audience);

    if (!recipients.length) {
      throw new Error("No recipients matched the selected audience");
    }

    const provider = "mailjet";
    const batchSize = this.clampNumber(payload?.delivery?.batchSize, {
      min: 1,
      max: 200,
      fallback: 50,
    });
    const delayBetweenBatchesMs = this.clampNumber(
      payload?.delivery?.delayBetweenBatchesMs,
      {
        min: 0,
        max: 60000,
        fallback: 1000,
      },
    );
    const sender = this.resolveSender(payload.sender);

    const campaign = await MarketingCampaign.create({
      name: String(payload.name || payload.subject || "").trim(),
      subject: String(payload.subject || "").trim(),
      htmlContent: String(payload.htmlContent || ""),
      textContent: String(payload.textContent || ""),
      sender,
      audience: this.sanitizeAudienceForStorage(payload.audience, recipients.length),
      delivery: {
        provider,
        batchSize,
        delayBetweenBatchesMs,
      },
      status: "queued",
      totalRecipients: recipients.length,
      sentCount: 0,
      failedCount: 0,
      recipients: this.createRecipientRecords(recipients, provider),
      createdBy: admin?.userId || admin?._id || admin?.id,
      startedAt: null,
      completedAt: null,
      lastError: "",
    });

    this.queueCampaignProcessing(campaign._id.toString());

    return this.formatCampaignSummary(campaign.toObject(), {
      includeSampleRecipients: true,
    });
  }

  async retryCampaign(campaignId, payload = {}) {
    const normalizedCampaignId = String(campaignId || "").trim();
    const campaign = await MarketingCampaign.findById(normalizedCampaignId);

    if (!campaign) {
      throw new AppError({
        message: "Marketing campaign not found",
        statusCode: 404,
      });
    }

    if (
      campaign.status === "sending" ||
      this.activeCampaignIds.has(normalizedCampaignId)
    ) {
      throw new AppError({
        message: "Marketing campaign is currently sending and cannot be retried",
        statusCode: 409,
      });
    }

    const recipientEmails = this.normalizeRecipientEmailList(
      payload?.recipientEmails,
    );
    const recipientEmailSet = recipientEmails.length
      ? new Set(recipientEmails)
      : null;

    let retriedRecipientCount = 0;

    campaign.recipients.forEach((recipient) => {
      if (!recipient || recipient.status !== "failed") {
        return;
      }

      const normalizedRecipientEmail = this.normalizeEmail(recipient.email);

      if (
        recipientEmailSet &&
        !recipientEmailSet.has(normalizedRecipientEmail)
      ) {
        return;
      }

      recipient.status = "pending";
      recipient.providerMessageId = "";
      recipient.errorMessage = "";
      recipient.sentAt = null;
      retriedRecipientCount += 1;
    });

    if (retriedRecipientCount === 0) {
      throw new AppError({
        message: recipientEmailSet
          ? "No failed recipients matched the requested recipientEmails"
          : "No failed recipients are available to retry",
        statusCode: 400,
      });
    }

    this.updateCampaignDeliveryCounts(campaign);
    campaign.status = "queued";
    campaign.completedAt = null;
    campaign.lastError = "";
    campaign.markModified("recipients");
    await campaign.save();

    this.queueCampaignProcessing(normalizedCampaignId);

    return {
      retriedRecipientCount,
      campaign: this.formatCampaignSummary(campaign.toObject(), {
        includeSampleRecipients: true,
      }),
    };
  }

  async processCampaign(campaignId) {
    const normalizedCampaignId = String(campaignId || "").trim();

    if (!normalizedCampaignId || this.activeCampaignIds.has(normalizedCampaignId)) {
      return;
    }

    this.activeCampaignIds.add(normalizedCampaignId);

    try {
      const campaign = await MarketingCampaign.findById(normalizedCampaignId);

      if (!campaign) {
        throw new Error("Marketing campaign not found");
      }

      if (!["queued", "failed", "completed_with_errors"].includes(campaign.status)) {
        return;
      }

      campaign.status = "sending";
      campaign.startedAt = campaign.startedAt || new Date();
      campaign.completedAt = null;
      campaign.lastError = "";
      await campaign.save();

      const batchSize = this.clampNumber(campaign?.delivery?.batchSize, {
        min: 1,
        max: 200,
        fallback: 50,
      });
      const delayBetweenBatchesMs = this.clampNumber(
        campaign?.delivery?.delayBetweenBatchesMs,
        {
          min: 0,
          max: 60000,
          fallback: 1000,
        },
      );

      for (
        let batchStartIndex = 0;
        batchStartIndex < campaign.recipients.length;
        batchStartIndex += batchSize
      ) {
        const batchEndIndex = Math.min(
          batchStartIndex + batchSize,
          campaign.recipients.length,
        );

        for (let recipientIndex = batchStartIndex; recipientIndex < batchEndIndex; recipientIndex += 1) {
          const recipient = campaign.recipients[recipientIndex];

          if (!recipient || recipient.status !== "pending") {
            continue;
          }

          recipient.lastAttemptAt = new Date();
          recipient.errorMessage = "";

          try {
            const deliveryResult = await this.sendEmailToRecipient(campaign, recipient);
            recipient.status = "sent";
            recipient.sentAt = new Date();
            recipient.providerMessageId = deliveryResult.messageId || "";
            recipient.deliveryProvider = deliveryResult.provider || campaign.delivery.provider;
          } catch (error) {
            recipient.status = "failed";
            recipient.sentAt = null;
            recipient.providerMessageId = "";
            recipient.errorMessage = String(error.message || "Email delivery failed").slice(
              0,
              500,
            );
            recipient.deliveryProvider = campaign.delivery.provider;

            if (!campaign.lastError) {
              campaign.lastError = recipient.errorMessage;
            }
          }
        }

        this.updateCampaignDeliveryCounts(campaign);
        campaign.markModified("recipients");
        await campaign.save();

        if (
          batchEndIndex < campaign.recipients.length &&
          delayBetweenBatchesMs > 0
        ) {
          await this.delay(delayBetweenBatchesMs);
        }
      }

      this.updateCampaignDeliveryCounts(campaign);
      campaign.completedAt = new Date();
      campaign.status =
        campaign.failedCount > 0
          ? campaign.sentCount > 0
            ? "completed_with_errors"
            : "failed"
          : "completed";

      if (!campaign.lastError && campaign.failedCount > 0) {
        campaign.lastError = "Some recipients could not be reached";
      }

      campaign.markModified("recipients");
      await campaign.save();
    } catch (error) {
      console.error("Marketing campaign processing failed:", error);
      await MarketingCampaign.findByIdAndUpdate(normalizedCampaignId, {
        status: "failed",
        completedAt: new Date(),
        lastError: String(error.message || "Marketing campaign processing failed").slice(
          0,
          500,
        ),
      });
    } finally {
      this.activeCampaignIds.delete(normalizedCampaignId);
    }
  }

  async getCampaigns(query = {}) {
    const page = this.clampNumber(query?.page, {
      min: 1,
      max: 100000,
      fallback: 1,
    });
    const limit = this.clampNumber(query?.limit, {
      min: 1,
      max: 100,
      fallback: 20,
    });
    const status = String(query?.status || "").trim();
    const filter = {};

    if (status) {
      filter.status = status;
    }

    const [campaigns, total] = await Promise.all([
      MarketingCampaign.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("createdBy", "fullName email")
        .lean(),
      MarketingCampaign.countDocuments(filter),
    ]);

    return {
      campaigns: campaigns.map((campaign) => this.formatCampaignSummary(campaign)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 1,
      },
    };
  }

  async getCampaignById(campaignId) {
    const campaign = await MarketingCampaign.findById(campaignId)
      .populate("createdBy", "fullName email")
      .lean();

    if (!campaign) {
      throw new Error("Marketing campaign not found");
    }

    return this.formatCampaignDetail(campaign);
  }
}

module.exports = new MarketingService();
