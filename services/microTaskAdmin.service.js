const path = require("path");
const mongoose = require("mongoose");
const axios = require("axios");
const JSZip = require("jszip");
const Task = require("../models/task.model");
const TaskApplication = require("../models/taskApplication.model");
const TaskImageUpload = require("../models/imageUpload.model");
const DTUser = require("../models/dtUser.model");
const microTaskQAService = require("./microTaskQA.service");

const ADMIN_VIEW_STATUSES = [
  "under_review",
  "approved",
  "rejected",
  "partially_rejected",
];

const EXPORTABLE_STATUSES = ["approved", "rejected", "partially_rejected"];
const CSV_HEADERS = [
  "Angle",
  "Task Category",
  "Image Sequence",
  "Upload Timestamp",
  "File Size",
  "Resolution",
  "File URL",
  "Full Name",
  "User ID",
  "Country of Residence",
  "Country of Origin",
  "Age",
  "Gender",
  "Recruiter Name",
  "Contact Email (internal only)",
  "Contact Phone (internal only)",
  "Submission Status",
  "Image Status",
  "Submission ID",
  "Image ID",
];

class MicroTaskAdminService {
  getAdminViewStatuses() {
    return [...ADMIN_VIEW_STATUSES];
  }

  getExportableStatuses() {
    return [...EXPORTABLE_STATUSES];
  }

  escapeRegex(value = "") {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  sanitizeSegment(value, fallback = "item") {
    return String(value || fallback)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || fallback;
  }

  buildTimestampLabel(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
  }

  getResolutionString(image) {
    const width = image?.metadata?.resolution?.width ?? null;
    const height = image?.metadata?.resolution?.height ?? null;

    if (!width && !height) {
      return "";
    }

    return `${width || ""}x${height || ""}`;
  }

  csvEscape(value) {
    if (value === null || value === undefined) {
      return "";
    }

    const normalized = String(value);
    if (/[",\r\n]/.test(normalized)) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }

    return normalized;
  }

  buildCsv(rows = []) {
    const lines = [
      CSV_HEADERS.join(","),
      ...rows.map((row) =>
        CSV_HEADERS.map((header) => this.csvEscape(row[header])).join(","),
      ),
    ];

    return `\uFEFF${lines.join("\r\n")}`;
  }

  buildStatusCounts(rawCounts = []) {
    const counts = {
      all: 0,
      under_review: 0,
      approved: 0,
      rejected: 0,
      partially_rejected: 0,
      reviewed_total: 0,
    };

    rawCounts.forEach((item) => {
      const status = item._id;
      if (Object.prototype.hasOwnProperty.call(counts, status)) {
        counts[status] = item.count;
      }
    });

    counts.all =
      counts.under_review +
      counts.approved +
      counts.rejected +
      counts.partially_rejected;
    counts.reviewed_total =
      counts.approved + counts.rejected + counts.partially_rejected;

    return counts;
  }

  getExportAuditSummary(exportAudit = []) {
    if (!Array.isArray(exportAudit) || exportAudit.length === 0) {
      return {
        totalExports: 0,
        lastExportedAt: null,
        lastExportType: null,
        lastExportFileName: null,
        lastExportedBy: null,
      };
    }

    const lastExport = exportAudit[exportAudit.length - 1];

    return {
      totalExports: exportAudit.length,
      lastExportedAt: lastExport.exportedAt || null,
      lastExportType: lastExport.exportType || null,
      lastExportFileName: lastExport.exportFileName || null,
      lastExportedBy: lastExport.exportedBy
        ? {
            _id: lastExport.exportedBy._id,
            fullName: lastExport.exportedBy.fullName || "",
            email: lastExport.exportedBy.email || "",
          }
        : null,
    };
  }

  getUserDateOfBirth(user) {
    return (
      user?.personal_info?.date_of_birth ||
      user?.date_of_birth ||
      null
    );
  }

  calculateAgeFromDateOfBirth(dateOfBirth) {
    if (!dateOfBirth) {
      return "";
    }

    const birthDate = new Date(dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) {
      return "";
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age -= 1;
    }

    return age >= 0 ? age : "";
  }

  getUserGender(user, baseMetadata = {}) {
    return (
      baseMetadata.gender ||
      user?.personal_info?.gender ||
      user?.gender ||
      ""
    );
  }

  buildUserMetadata(user) {
    if (!user) {
      return {
        fullName: "",
        userId: "",
        countryOfResidence: "",
        countryOfOrigin: "",
        age: "",
        gender: "",
        recruiterName: "",
        contactEmail: "",
        contactPhone: "",
      };
    }

    const baseMetadata =
      typeof user.getMicroTaskMetadata === "function"
        ? user.getMicroTaskMetadata()
        : {
            full_name: user.fullName || "",
            user_id: user._id ? String(user._id) : "",
            country_of_residence: user.personal_info?.country || "",
            country_of_origin: user.personal_info?.country_of_origin || "",
            age: user.personal_info?.age ?? "",
            gender: user.personal_info?.gender || "",
            recruiter_name: user.personal_info?.recruiter_name || "",
            contact_info: {
              email: user.email || "",
              phone: user.phone || "",
            },
          };

    const dateOfBirth =
      baseMetadata.date_of_birth || this.getUserDateOfBirth(user);
    const calculatedAge = this.calculateAgeFromDateOfBirth(dateOfBirth);
    const storedAge = baseMetadata.age ?? user.personal_info?.age ?? "";

    return {
      fullName: baseMetadata.full_name || user.fullName || "",
      userId: baseMetadata.user_id || (user._id ? String(user._id) : ""),
      countryOfResidence:
        baseMetadata.country_of_residence ||
        user.personal_info?.country ||
        "",
      countryOfOrigin:
        baseMetadata.country_of_origin ||
        user.personal_info?.country_of_origin ||
        "",
      age:
        calculatedAge !== ""
          ? calculatedAge
          : storedAge === null || storedAge === undefined
            ? ""
            : storedAge,
      gender: this.getUserGender(user, baseMetadata),
      recruiterName:
        baseMetadata.recruiter_name ||
        user.personal_info?.recruiter_name ||
        "",
      contactEmail:
        baseMetadata.contact_info?.email || user.email || "",
      contactPhone:
        baseMetadata.contact_info?.phone || user.phone || "",
    };
  }

  getFileExtension(image) {
    const metadata = image?.metadata || {};
    const preferredName = metadata.fileName || "";
    const nameExtension = path.extname(preferredName);

    if (nameExtension && nameExtension.length <= 10) {
      return nameExtension.toLowerCase();
    }

    try {
      const fileUrl = metadata.fileUrl || image.url;
      const urlExtension = path.extname(new URL(fileUrl).pathname);
      if (urlExtension && urlExtension.length <= 10) {
        return urlExtension.toLowerCase();
      }
    } catch (error) {
      // Ignore URL parsing issues and fall back to MIME type mapping.
    }

    const mimeType = String(metadata.fileType || "").toLowerCase();
    const mimeExtensionMap = {
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/heic": ".heic",
      "image/heif": ".heif",
    };

    return mimeExtensionMap[mimeType] || ".jpg";
  }

  buildZipImagePath(submission, image) {
    const sequence = String(image?.metadata?.imageSequence || 0).padStart(3, "0");
    const angle = this.sanitizeSegment(
      image?.metadata?.angle || image?.label || "image",
      "image",
    );
    const userSegment = this.sanitizeSegment(
      submission?.applicant?._id || "user",
      "user",
    );
    const submissionFolder = `submission-${String(submission._id)}`;
    const extension = this.getFileExtension(image);

    return `images/${submissionFolder}/${sequence}-${angle}-${userSegment}${extension}`;
  }

  buildExportFileName(task, status, timestampLabel) {
    const taskTitle = this.sanitizeSegment(task?.taskTitle || task?.title, "task");
    return `${taskTitle}-${status}-dataset-${timestampLabel}.zip`;
  }

  getSortOption(sortBy, status) {
    const normalizedSort = String(sortBy || "").trim().toLowerCase();

    if (normalizedSort === "oldest_submitted") {
      return { submittedAt: 1, createdAt: 1 };
    }

    if (normalizedSort === "newest_submitted") {
      return { submittedAt: -1, createdAt: -1 };
    }

    if (normalizedSort === "oldest_reviewed") {
      return { reviewedAt: 1, updatedAt: 1 };
    }

    if (normalizedSort === "recently_reviewed") {
      return { reviewedAt: -1, updatedAt: -1 };
    }

    return status === "under_review"
      ? { submittedAt: 1, createdAt: 1 }
      : { reviewedAt: -1, updatedAt: -1 };
  }

  async getTaskOrThrow(taskId) {
    const task = await Task.findById(taskId).populate("createdBy", "fullName email");

    if (!task) {
      throw new Error("Micro task not found");
    }

    return task;
  }

  async getMatchingApplicantIds(search = "") {
    const trimmedSearch = String(search || "").trim();
    if (!trimmedSearch) {
      return null;
    }

    const regex = new RegExp(this.escapeRegex(trimmedSearch), "i");
    const orConditions = [
      { fullName: regex },
      { email: regex },
      { phone: regex },
      { phoneNumber: regex },
    ];

    if (mongoose.Types.ObjectId.isValid(trimmedSearch)) {
      orConditions.push({ _id: trimmedSearch });
    }

    const matchingUsers = await DTUser.find({ $or: orConditions }).select("_id").lean();
    return matchingUsers.map((user) => user._id);
  }

  formatAdminSubmission(submission) {
    return {
      ...microTaskQAService.formatSubmissionSummary(submission),
      exportAudit: this.getExportAuditSummary(submission.exportAudit || []),
    };
  }

  async getReviewedSubmissionsForTask(taskId, query = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status = "all",
        search = "",
        sort = "",
      } = query;

      const pageNumber = Math.max(1, parseInt(page, 10) || 1);
      const pageSize = Math.max(1, parseInt(limit, 10) || 10);
      const skip = (pageNumber - 1) * pageSize;
      const allowedStatuses = this.getAdminViewStatuses();
      const normalizedStatus = String(status || "all").trim().toLowerCase();

      if (
        normalizedStatus !== "all" &&
        !allowedStatuses.includes(normalizedStatus)
      ) {
        throw new Error("Invalid admin review status filter");
      }

      const task = await this.getTaskOrThrow(taskId);
      const baseFilter = {
        task: task._id,
        status:
          normalizedStatus === "all"
            ? { $in: allowedStatuses }
            : normalizedStatus,
      };

      const applicantIds = await this.getMatchingApplicantIds(search);
      if (Array.isArray(applicantIds)) {
        if (applicantIds.length === 0) {
          const statusCounts = await TaskApplication.aggregate([
            {
              $match: {
                task: task._id,
                status: { $in: allowedStatuses },
              },
            },
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ]);

          return {
            task: microTaskQAService.formatTask(task),
            submissions: [],
            pagination: {
              current_page: pageNumber,
              per_page: pageSize,
              total_items: 0,
              total_pages: 0,
            },
            filters: {
              status: normalizedStatus,
              search: String(search || "").trim(),
              sort: String(sort || "").trim() || "default",
            },
            statusCounts: this.buildStatusCounts(statusCounts),
            availableStatuses: ["all", ...allowedStatuses],
          };
        }

        baseFilter.applicant = { $in: applicantIds };
      }

      const [submissions, total, statusCounts] = await Promise.all([
        TaskApplication.find(baseFilter)
          .populate("task", "taskTitle category payRate currency totalImagesRequired dueDate createdBy")
          .populate("applicant", "fullName email phone phoneNumber personal_info qaStatus date_of_birth gender")
          .populate("reviewedBy", "fullName email")
          .populate("exportAudit.exportedBy", "fullName email")
          .populate({
            path: "images",
            select:
              "url publicId label status rejectionMessage qaNotes reviewedBy reviewedAt metadata createdAt",
            populate: {
              path: "reviewedBy",
              select: "fullName email",
            },
          })
          .sort(this.getSortOption(sort, normalizedStatus))
          .skip(skip)
          .limit(pageSize),
        TaskApplication.countDocuments(baseFilter),
        TaskApplication.aggregate([
          {
            $match: {
              task: task._id,
              status: { $in: allowedStatuses },
            },
          },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      return {
        task: microTaskQAService.formatTask(task),
        submissions: submissions.map((submission) =>
          this.formatAdminSubmission(submission),
        ),
        pagination: {
          current_page: pageNumber,
          per_page: pageSize,
          total_items: total,
          total_pages: Math.ceil(total / pageSize),
        },
        filters: {
          status: normalizedStatus,
          search: String(search || "").trim(),
          sort: String(sort || "").trim() || "default",
        },
        statusCounts: this.buildStatusCounts(statusCounts),
        availableStatuses: ["all", ...allowedStatuses],
      };
    } catch (error) {
      throw new Error(
        `Error fetching task reviewed submissions: ${error.message}`,
      );
    }
  }

  async syncSubmissionImages(submission, reviewerId, status, reviewNote = "") {
    const imageIds = microTaskQAService.getImageIdsFromSubmission(submission);
    if (imageIds.length === 0) {
      return;
    }

    const now = new Date();
    const update = {
      status,
      reviewedBy: reviewerId,
      reviewedAt: now,
    };

    if (status === "approved") {
      update.rejectionMessage = "";
    }

    if (status === "rejected") {
      update.rejectionMessage = reviewNote || "Rejected via admin override";
    }

    await TaskImageUpload.updateMany(
      { _id: { $in: imageIds } },
      {
        $set: update,
      },
    );
  }

  buildAdminOverrideNote(submission, nextStatus, adminNote = "") {
    const noteParts = [
      `Admin override from ${submission.status} to ${nextStatus}`,
    ];

    if (String(adminNote || "").trim()) {
      noteParts.push(String(adminNote).trim());
    }

    if (String(submission.reviewNote || "").trim()) {
      noteParts.push(`Previous review note: ${String(submission.reviewNote).trim()}`);
    }

    return noteParts.join(" | ");
  }

  async overrideSubmissionReview(taskId, submissionId, adminId, reviewData = {}) {
    try {
      const {
        status,
        quality_score = null,
        review_notes = "",
        sync_images,
      } = reviewData;

      if (!adminId) {
        throw new Error("Admin identity is required for overrides");
      }

      if (!["approved", "rejected", "partially_rejected"].includes(status)) {
        throw new Error("Invalid admin override status");
      }

      const submission = await TaskApplication.findOne({
        _id: submissionId,
        task: taskId,
      })
        .populate("task", "taskTitle category payRate currency totalImagesRequired dueDate")
        .populate("applicant", "fullName email phone phoneNumber personal_info qaStatus date_of_birth gender")
        .populate("reviewedBy", "fullName email")
        .populate({
          path: "images",
          select:
            "url publicId label status rejectionMessage qaNotes reviewedBy reviewedAt metadata createdAt",
          populate: {
            path: "reviewedBy",
            select: "fullName email",
          },
        });

      if (!submission) {
        throw new Error("Submission not found for this task");
      }

      const shouldSyncImages =
        typeof sync_images === "boolean"
          ? sync_images
          : status !== "partially_rejected";

      if (status === "partially_rejected" && shouldSyncImages) {
        throw new Error(
          "sync_images is not supported for partially_rejected overrides",
        );
      }

      if (shouldSyncImages) {
        const imageStatus = status === "approved" ? "approved" : "rejected";
        await this.syncSubmissionImages(
          submission,
          adminId,
          imageStatus,
          review_notes,
        );
      }

      const mergedReviewNote = this.buildAdminOverrideNote(
        submission,
        status,
        review_notes,
      );

      return microTaskQAService.completeSubmissionReview(submissionId, adminId, {
        status,
        quality_score,
        review_notes: mergedReviewNote,
        allow_override: true,
      });
    } catch (error) {
      throw new Error(`Error overriding submission review: ${error.message}`);
    }
  }

  async downloadImageBuffer(url) {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
    });

    return Buffer.from(response.data);
  }

  buildCsvRow(task, submission, image) {
    const userMetadata = this.buildUserMetadata(submission.applicant);
    const uploadTimestamp =
      image?.metadata?.uploadTimestamp || image?.createdAt || null;

    return {
      Angle: image?.metadata?.angle || image?.label || "",
      "Task Category":
        image?.metadata?.taskCategory || task?.category || "",
      "Image Sequence": image?.metadata?.imageSequence || "",
      "Upload Timestamp": uploadTimestamp
        ? new Date(uploadTimestamp).toISOString()
        : "",
      "File Size": image?.metadata?.fileSize ?? "",
      Resolution: this.getResolutionString(image),
      "File URL": image?.metadata?.fileUrl || image?.url || "",
      "Full Name": userMetadata.fullName,
      "User ID": userMetadata.userId,
      "Country of Residence": userMetadata.countryOfResidence,
      "Country of Origin": userMetadata.countryOfOrigin,
      Age: userMetadata.age,
      Gender: userMetadata.gender,
      "Recruiter Name": userMetadata.recruiterName,
      "Contact Email (internal only)": userMetadata.contactEmail,
      "Contact Phone (internal only)": userMetadata.contactPhone,
      "Submission Status": submission.status || "",
      "Image Status": image?.status || "",
      "Submission ID": String(submission._id),
      "Image ID": String(image?._id || ""),
    };
  }

  async exportTaskDataset(taskId, options = {}) {
    try {
      const {
        status = "approved",
        exportedBy,
      } = options;

      if (!exportedBy) {
        throw new Error("Exported by user id is required");
      }

      const normalizedStatus = String(status || "approved").trim().toLowerCase();
      if (!this.getExportableStatuses().includes(normalizedStatus)) {
        throw new Error("Invalid export status");
      }

      const task = await this.getTaskOrThrow(taskId);
      const submissions = await TaskApplication.find({
        task: task._id,
        status: normalizedStatus,
      })
        .populate("applicant", "fullName email phone phoneNumber personal_info date_of_birth gender")
        .populate("reviewedBy", "fullName email")
        .populate({
          path: "images",
          select:
            "url publicId label status rejectionMessage qaNotes reviewedBy reviewedAt metadata createdAt",
        });

      if (!submissions.length) {
        throw new Error("No submissions found for the requested export status");
      }

      const exportTimestamp = new Date();
      const timestampLabel = this.buildTimestampLabel(exportTimestamp);
      const fileName = this.buildExportFileName(
        task,
        normalizedStatus,
        timestampLabel,
      );
      const zip = new JSZip();
      const csvRows = [];
      const downloadErrors = [];
      const submissionIds = [];
      const imagesFolder = zip.folder("images");
      let totalImages = 0;
      let downloadedImages = 0;

      for (const submission of submissions) {
        submissionIds.push(submission._id);
        const images = microTaskQAService.sortImages(submission.images || []);

        for (const image of images) {
          totalImages += 1;
          csvRows.push(this.buildCsvRow(task, submission, image));

          const zipPath = this.buildZipImagePath(submission, image);

          try {
            const imageBuffer = await this.downloadImageBuffer(
              image?.metadata?.fileUrl || image?.url,
            );
            imagesFolder.file(zipPath.replace(/^images\//, ""), imageBuffer);
            downloadedImages += 1;
          } catch (error) {
            downloadErrors.push({
              submissionId: String(submission._id),
              imageId: String(image?._id || ""),
              fileUrl: image?.metadata?.fileUrl || image?.url || "",
              error: error.message,
            });
          }
        }
      }

      zip.file("metadata.csv", this.buildCsv(csvRows));
      zip.file(
        "task-summary.json",
        JSON.stringify(
          {
            task: {
              _id: task._id,
              taskTitle: task.taskTitle || "",
              category: task.category || "",
              payRate: task.payRate || 0,
              currency: task.currency || "USD",
              totalImagesRequired: task.totalImagesRequired || 0,
            },
            export: {
              type: normalizedStatus,
              fileName,
              exportedAt: exportTimestamp.toISOString(),
              exportedBy: exportedBy || null,
              totalSubmissions: submissions.length,
              totalImages,
              downloadedImages,
              failedImages: downloadErrors.length,
            },
          },
          null,
          2,
        ),
      );

      if (downloadErrors.length > 0) {
        zip.file(
          "download-errors.json",
          JSON.stringify(downloadErrors, null, 2),
        );
      }

      const buffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: {
          level: 6,
        },
      });

      const exportAuditEntry = {
        exportedBy,
        exportedAt: exportTimestamp,
        exportType: normalizedStatus,
        exportFileName: fileName,
      };

      await TaskApplication.updateMany(
        { _id: { $in: submissionIds } },
        {
          $push: {
            exportAudit: exportAuditEntry,
          },
        },
      );

      return {
        fileName,
        buffer,
        contentType: "application/zip",
        summary: {
          taskId: String(task._id),
          taskTitle: task.taskTitle || "",
          status: normalizedStatus,
          totalSubmissions: submissions.length,
          totalImages,
          downloadedImages,
          failedImages: downloadErrors.length,
        },
      };
    } catch (error) {
      throw new Error(`Error exporting task dataset: ${error.message}`);
    }
  }
}

module.exports = new MicroTaskAdminService();
