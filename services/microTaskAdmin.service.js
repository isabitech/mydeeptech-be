const fs = require("fs");
const fsPromises = require("fs/promises");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");
const axios = require("axios");
const archiver = require("archiver");
const { finished, pipeline } = require("stream/promises");
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
    return (
      String(value || fallback)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || fallback
    );
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

  buildCsvLine(row = {}) {
    return CSV_HEADERS.map((header) => this.csvEscape(row[header])).join(",");
  }

  buildCsvContent(lines = []) {
    return `\uFEFF${lines.join("\r\n")}`;
  }

  buildTaskSummaryFile(task, exportDetails = {}) {
    return JSON.stringify(
      {
        task: {
          _id: task._id,
          taskTitle: task.taskTitle || "",
          category: task.category || "",
          payRate: task.payRate || 0,
          currency: task.currency || "USD",
          totalImagesRequired: task.totalImagesRequired || 0,
        },
        export: exportDetails,
      },
      null,
      2,
    );
  }

  assertWritableExportStream(outputStream) {
    const streamClosedEarly =
      !outputStream ||
      outputStream.destroyed === true ||
      outputStream.writableEnded === true ||
      (outputStream.closed === true && outputStream.writableFinished !== true);

    if (streamClosedEarly) {
      const error = new Error(
        "Export stream was interrupted before completion",
      );
      error.code = "EXPORT_STREAM_INTERRUPTED";
      throw error;
    }
  }

  createZipArchive(options = {}) {
    if (typeof archiver === "function") {
      return archiver("zip", options);
    }

    if (typeof archiver?.ZipArchive === "function") {
      return new archiver.ZipArchive(options);
    }

    if (typeof archiver?.default === "function") {
      return archiver.default("zip", options);
    }

    throw new Error("Unsupported archiver module export shape");
  }

  async createExportTempDirectory() {
    return fsPromises.mkdtemp(
      path.join(os.tmpdir(), "mydeeptech-microtask-export-"),
    );
  }

  buildTempImagePath(tempDirectory, submission, image) {
    const sequence = String(image?.metadata?.imageSequence || 0).padStart(
      3,
      "0",
    );
    const imageSegment = this.sanitizeSegment(image?._id || "image", "image");
    const submissionSegment = this.sanitizeSegment(
      submission?._id || "submission",
      "submission",
    );
    const extension = this.getFileExtension(image);

    return path.join(
      tempDirectory,
      `${submissionSegment}-${sequence}-${imageSegment}${extension}`,
    );
  }

  async removeTempFile(filePath) {
    if (!filePath) {
      return;
    }

    try {
      await fsPromises.unlink(filePath);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn(`Failed to remove temp export file ${filePath}:`, error);
      }
    }
  }

  async removeTempDirectory(directoryPath) {
    if (!directoryPath) {
      return;
    }

    try {
      await fsPromises.rm(directoryPath, { recursive: true, force: true });
    } catch (error) {
      console.warn(
        `Failed to remove temp export directory ${directoryPath}:`,
        error,
      );
    }
  }

  buildCsv(rows = []) {
    const lines = [
      CSV_HEADERS.join(","),
      ...rows.map((row) => this.buildCsvLine(row)),
    ];

    return this.buildCsvContent(lines);
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
    return user?.personal_info?.date_of_birth || user?.date_of_birth || null;
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
      baseMetadata.gender || user?.personal_info?.gender || user?.gender || ""
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
        baseMetadata.country_of_residence || user.personal_info?.country || "",
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
        baseMetadata.recruiter_name || user.personal_info?.recruiter_name || "",
      contactEmail: baseMetadata.contact_info?.email || user.email || "",
      contactPhone: baseMetadata.contact_info?.phone || user.phone || "",
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
    const sequence = String(image?.metadata?.imageSequence || 0).padStart(
      3,
      "0",
    );
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
    const taskTitle = this.sanitizeSegment(
      task?.taskTitle || task?.title,
      "task",
    );
    return `${taskTitle}-${status}-dataset-${timestampLabel}.zip`;
  }

  buildSingleSubmissionExportFileName(task, submission, timestampLabel) {
    const taskTitle = this.sanitizeSegment(
      task?.taskTitle || task?.title,
      "task",
    );
    const status = this.sanitizeSegment(
      submission?.status || "submission",
      "submission",
    );
    const submissionSegment = this.sanitizeSegment(
      submission?._id ? String(submission._id) : "submission",
      "submission",
    );

    return `${taskTitle}-${status}-submission-${submissionSegment}-dataset-${timestampLabel}.zip`;
  }

  getTaskDatasetExportPopulate() {
    return [
      {
        path: "applicant",
        select:
          "fullName email phone phoneNumber personal_info date_of_birth gender",
      },
      {
        path: "reviewedBy",
        select: "fullName email",
      },
      {
        path: "images",
        select:
          "url publicId label status rejectionMessage qaNotes reviewedBy reviewedAt metadata createdAt",
      },
    ];
  }

  buildPreparedTaskDatasetExportContext({
    task,
    submissions,
    normalizedStatus,
    fileName,
    exportTimestamp,
    exportedBy,
    summaryOverrides = {},
  }) {
    const submissionIds = submissions.map((submission) => submission._id);
    const totalImages = submissions.reduce((count, submission) => {
      return count + (submission.images?.length || 0);
    }, 0);

    const exportAuditEntry = {
      exportedBy,
      exportedAt: exportTimestamp,
      exportType: normalizedStatus,
      exportFileName: fileName,
    };

    return {
      fileName,
      contentType: "application/zip",
      summary: {
        taskId: String(task._id),
        taskTitle: task.taskTitle || "",
        status: normalizedStatus,
        totalSubmissions: submissions.length,
        totalImages,
        downloadedImages: 0,
        failedImages: 0,
        ...summaryOverrides,
      },
      task,
      submissions,
      normalizedStatus,
      exportTimestamp,
      submissionIds,
      exportAuditEntry,
    };
  }

  getSortOption(sortBy, status) {
    const normalizedSort = String(sortBy || "")
      .trim()
      .toLowerCase();

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
    const task = await Task.findById(taskId).populate(
      "createdBy",
      "fullName email",
    );

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

    const matchingUsers = await DTUser.find({ $or: orConditions })
      .select("_id")
      .lean();
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
      const normalizedStatus = String(status || "all")
        .trim()
        .toLowerCase();

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
          .populate(
            "task",
            "taskTitle category payRate currency totalImagesRequired dueDate createdBy illustrationImages",
          )
          .populate(
            "applicant",
            "fullName email phone phoneNumber personal_info qaStatus date_of_birth gender",
          )
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
      noteParts.push(
        `Previous review note: ${String(submission.reviewNote).trim()}`,
      );
    }

    return noteParts.join(" | ");
  }

  async overrideSubmissionReview(
    taskId,
    submissionId,
    adminId,
    reviewData = {},
  ) {
    try {
      const {
        status,
        quality_score = null,
        review_notes = "",
        sync_images,
        actor_name = "",
        actor_role = "admin",
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
        .populate(
          "task",
          "taskTitle category payRate currency totalImagesRequired dueDate illustrationImages",
        )
        .populate(
          "applicant",
          "fullName email phone phoneNumber personal_info qaStatus date_of_birth gender",
        )
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

      return microTaskQAService.completeSubmissionReview(
        submissionId,
        adminId,
        {
          status,
          quality_score,
          review_notes: mergedReviewNote,
          allow_override: true,
          actor_name,
          actor_role,
        },
      );
    } catch (error) {
      throw new Error(`Error overriding submission review: ${error.message}`);
    }
  }

  async downloadImageToFile(url, filePath) {
    const response = await axios.get(url, {
      responseType: "stream",
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    try {
      await pipeline(response.data, fs.createWriteStream(filePath));
    } catch (error) {
      if (typeof response.data?.destroy === "function") {
        response.data.destroy(error);
      }

      throw error;
    }
  }

  async appendTempFileToArchive(archive, filePath, zipPath, outputStream) {
    this.assertWritableExportStream(outputStream);
    const fileStream = fs.createReadStream(filePath);
    archive.append(fileStream, { name: zipPath });
    await finished(fileStream);
  }

  async downloadImageStream(imageUrl, timeout = 30000) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: "stream",
        timeout,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
      return { stream: response.data, error: null };
    } catch (error) {
      return { stream: null, error };
    }
  }

  async appendImagesToArchiveWithConcurrency(
    childArchive,
    images,
    task,
    submission,
    submissionFolder,
    tempDirectory,
    csvLines,
    downloadErrors,
    outputStream,
    maxConcurrency = 5,
  ) {
    let downloadedCount = 0;
    const imageQueue = images.map((image, index) => ({ image, index }));

    for (let i = 0; i < imageQueue.length; i += maxConcurrency) {
      this.assertWritableExportStream(outputStream);
      const batch = imageQueue.slice(i, i + maxConcurrency);
      const batchNum = i / maxConcurrency + 1;
      const totalBatches = Math.ceil(imageQueue.length / maxConcurrency);

      const downloadedBatch = await Promise.all(
        batch.map(async ({ image, index }) => {
          this.assertWritableExportStream(outputStream);
          const sequence = String(image?.metadata?.imageSequence || 0).padStart(
            3,
            "0",
          );
          const angle = this.sanitizeSegment(
            image?.metadata?.angle || image?.label || "image",
            "image",
          );
          const extension = this.getFileExtension(image);
          const imageFileName = `${sequence}-${angle}${extension}`;
          const sourceUrl = image?.metadata?.fileUrl || image?.url;
          const tempFilePath = this.buildTempImagePath(
            tempDirectory,
            submission,
            image,
          );

          csvLines.push(
            this.buildCsvLine(this.buildCsvRow(task, submission, image)),
          );

          try {
            await this.downloadImageToFile(sourceUrl, tempFilePath);
            return { success: true, tempFilePath, imageFileName, image, index };
          } catch (error) {
            await this.removeTempFile(tempFilePath);
            return {
              success: false,
              error,
              sourceUrl,
              image,
              index,
            };
          }
        }),
      );

      const orderedBatch = downloadedBatch.sort((a, b) => a.index - b.index);
      let successCount = 0;

      for (const item of orderedBatch) {
        this.assertWritableExportStream(outputStream);
        if (!item.success) {
          downloadErrors.push({
            submissionId: String(submission._id),
            imageId: String(item.image?._id || ""),
            fileUrl: item.sourceUrl || "",
            error: item.error?.message || "Unknown download error",
          });
          continue;
        }

        try {
          const fileStream = fs.createReadStream(item.tempFilePath);
          childArchive.append(fileStream, {
            name: `${submissionFolder}/images/${item.imageFileName}`,
          });
          await finished(fileStream);
          successCount += 1;
          downloadedCount += 1;
        } finally {
          await this.removeTempFile(item.tempFilePath);
        }
      }
    }

    return downloadedCount;
  }

  buildCsvRow(task, submission, image) {
    const userMetadata = this.buildUserMetadata(submission.applicant);
    const uploadTimestamp =
      image?.metadata?.uploadTimestamp || image?.createdAt || null;

    return {
      Angle: image?.metadata?.angle || image?.label || "",
      "Task Category": image?.metadata?.taskCategory || task?.category || "",
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

  async prepareTaskDatasetExport(taskId, options = {}) {
    try {
      const { status = "approved", exportedBy } = options;

      if (!exportedBy) {
        throw new Error("Exported by user id is required");
      }

      const normalizedStatus = String(status || "approved")
        .trim()
        .toLowerCase();
      if (!this.getExportableStatuses().includes(normalizedStatus)) {
        throw new Error("Invalid export status");
      }

      const task = await this.getTaskOrThrow(taskId);
      const submissions = await TaskApplication.find({
        task: task._id,
        status: normalizedStatus,
      })
        .populate(
          "applicant",
          "fullName email phone phoneNumber personal_info date_of_birth gender",
        )
        .populate("reviewedBy", "fullName email")
        .populate({
          path: "images",
          select:
            "url publicId label status rejectionMessage qaNotes reviewedBy reviewedAt metadata createdAt",
        })
        .lean();

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
      return this.buildPreparedTaskDatasetExportContext({
        task,
        submissions,
        normalizedStatus,
        fileName,
        exportTimestamp,
        exportedBy,
      });
    } catch (error) {
      throw new Error(`Error preparing task dataset export: ${error.message}`);
    }
  }

  async prepareSingleTaskSubmissionDatasetExport(
    taskId,
    submissionId,
    options = {},
  ) {
    try {
      const { exportedBy } = options;

      if (!exportedBy) {
        throw new Error("Exported by user id is required");
      }

      const task = await this.getTaskOrThrow(taskId);
      const submission = await TaskApplication.findOne({
        _id: submissionId,
        task: task._id,
      })
        .populate(this.getTaskDatasetExportPopulate())
        .lean();

      if (!submission) {
        throw new Error("Submission not found for this task");
      }

      const normalizedStatus = String(submission.status || "")
        .trim()
        .toLowerCase();
      if (!this.getExportableStatuses().includes(normalizedStatus)) {
        throw new Error("Submission status is not exportable");
      }

      const exportTimestamp = new Date();
      const timestampLabel = this.buildTimestampLabel(exportTimestamp);
      const fileName = this.buildSingleSubmissionExportFileName(
        task,
        submission,
        timestampLabel,
      );

      return this.buildPreparedTaskDatasetExportContext({
        task,
        submissions: [submission],
        normalizedStatus,
        fileName,
        exportTimestamp,
        exportedBy,
        summaryOverrides: {
          submissionId: String(submission._id),
        },
      });
    } catch (error) {
      throw new Error(
        `Error preparing single task dataset export: ${error.message}`,
      );
    }
  }

  async streamPreparedTaskDatasetExport(exportContext, outputStream) {
    const {
      task,
      submissions,
      normalizedStatus,
      fileName,
      exportTimestamp,
      submissionIds,
      exportAuditEntry,
      summary,
    } = exportContext;

    const archive = this.createZipArchive({ zlib: { level: 6 } });
    const downloadErrors = [];
    const tempDirectory = await this.createExportTempDirectory();
    let downloadedImages = 0;
    let archiveError = null;
    let clientClosedEarly = false;

    outputStream.on("close", () => {
      if (outputStream.writableFinished !== true) {
        clientClosedEarly = true;
        console.warn(
          "⚠️  Export client connection closed before stream finished.",
        );
      }
    });

    outputStream.on("finish", () => {
      console.log("✅ Output stream finished sending response.");
    });

    archive.on("warning", (error) => {
      if (error?.code === "ENOENT") {
        console.warn("Archive warning:", error.message);
        return;
      }
      archive.emit("error", error);
    });

    archive.on("error", (error) => {
      archiveError = error;
      if (
        typeof outputStream.destroy === "function" &&
        outputStream.destroyed !== true
      ) {
        outputStream.destroy(error);
      }
    });

    this.assertWritableExportStream(outputStream);
    archive.pipe(outputStream);

    let submissionCount = 0;

    try {
      // Stream each submission directly into the parent ZIP, one submission at a time.
      for (const submission of submissions) {
        this.assertWritableExportStream(outputStream);
        submissionCount += 1;
        const images = microTaskQAService.sortImages(submission.images || []);
        const submissionFolder = `submission-${String(submission._id)}`;
        const csvLines = [CSV_HEADERS.join(",")];
        // Download images with parallel concurrency (5 at a time) for faster processing
        const downloadStartTime = Date.now();
        const downloadedInSubmission =
          await this.appendImagesToArchiveWithConcurrency(
            archive,
            images,
            task,
            submission,
            submissionFolder,
            tempDirectory,
            csvLines,
            downloadErrors,
            outputStream,
            3,
          );
        const downloadDuration = (
          (Date.now() - downloadStartTime) /
          1000
        ).toFixed(2);
        downloadedImages += downloadedInSubmission;
        archive.append(this.buildCsvContent(csvLines), {
          name: `${submissionFolder}/metadata.csv`,
        });
        archive.append(
          JSON.stringify(
            {
              submissionId: String(submission._id),
              applicant: submission.applicant || null,
              status: submission.status || null,
            },
            null,
            2,
          ),
          { name: `${submissionFolder}/submission-summary.json` },
        );
      }
      this.assertWritableExportStream(outputStream);
      archive.append(
        this.buildTaskSummaryFile(task, {
          type: normalizedStatus,
          fileName,
          exportedAt: exportTimestamp.toISOString(),
          exportedBy: exportAuditEntry.exportedBy || null,
          totalSubmissions: submissions.length,
          totalImages: summary.totalImages,
          downloadedImages,
          failedImages: downloadErrors.length,
        }),
        { name: "task-summary.json" },
      );

      if (downloadErrors.length > 0) {
        archive.append(JSON.stringify(downloadErrors, null, 2), {
          name: "download-errors.json",
        });
      }

      await archive.finalize();

      try {
        await finished(outputStream);
      } catch (error) {
        if (archiveError) throw archiveError;
        const streamError = new Error(
          error?.code === "ERR_STREAM_PREMATURE_CLOSE"
            ? "Export stream was interrupted before completion"
            : `Export stream failed: ${error.message}`,
        );
        streamError.code = error?.code || "EXPORT_STREAM_FAILED";
        throw streamError;
      }

      if (archiveError) throw archiveError;
      if (clientClosedEarly) {
        throw new Error("Client disconnected before export completed");
      }
      if (downloadErrors.length > 0) {
        console.log(`   ⚠️  Failed Images: ${downloadErrors.length}`);
      }
      console.log(`   Output: ${fileName}\n`);
    } catch (error) {
      if (typeof archive.destroy === "function" && archive.destroyed !== true)
        archive.destroy(error);
      throw error;
    } finally {
      await this.removeTempDirectory(tempDirectory);
    }

    try {
      await TaskApplication.updateMany(
        { _id: { $in: submissionIds } },
        { $push: { exportAudit: exportAuditEntry } },
      );
    } catch (error) {
      console.error(
        `Error recording export audit for task ${summary.taskId}:`,
        error,
      );
    }

    return {
      ...summary,
      downloadedImages,
      failedImages: downloadErrors.length,
    };
  }

  async exportTaskDataset(taskId, outputStream, options = {}) {
    const exportContext = await this.prepareTaskDatasetExport(taskId, options);
    const finalSummary = await this.streamPreparedTaskDatasetExport(
      exportContext,
      outputStream,
    );

    return {
      fileName: exportContext.fileName,
      contentType: exportContext.contentType,
      summary: finalSummary,
    };
  }
}

module.exports = new MicroTaskAdminService();
