const {
  generateOptimizedUrl,
  generateThumbnail,
} = require("../../config/cloudinary");
const DtuserRepository = require("../../repositories/dtUser.repository");
class DtuserUploadService {
  constructor() {
    this.repository = new DtuserRepository();
  }

  getCloudinaryFormat(file) {
    return file.format || file.filename.split(".").pop();
  }

  buildCloudinaryData(file, optimizedUrl, thumbnailUrl) {
    return {
      publicId: file.filename,
      url: file.path,
      optimizedUrl,
      thumbnailUrl,
      originalName: file.originalname,
      size: file.size,
      format: this.getCloudinaryFormat(file),
    };
  }

  buildFileResponse(file) {
    return {
      url: file.path,
      publicId: file.filename,
      originalName: file.originalname,
      fileSize: file.size,
      format: file.format || file.mimetype,
    };
  }

  async findUserForAttachmentUpdate(user) {
    return this.repository.findWithLean({
      email: user.email,
      _id: user.userId,
    });
  }

  async updateAttachmentPath({ user, file, fieldPath, responseKey }) {
    const dtUser = await this.findUserForAttachmentUpdate(user);

    if (!dtUser) {
      return { status: 404, reason: "not_found" };
    }

    const updated = await this.repository.findByIdAndUpdate(
      user.userId,
      { $set: { [fieldPath]: file.path } },
      { new: true },
    );

    return {
      status: 200,
      data: {
        [responseKey]: updated.attachments[responseKey],
        cloudinaryData: this.buildFileResponse(file),
      },
    };
  }

  async submitResultWithCloudinary({ userId, file, body }) {
    if (!file) {
      return { status: 400, reason: "file_required" };
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    const { projectId, notes } = body || {};

    let optimizedUrl = file.path;
    let thumbnailUrl = null;
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      optimizedUrl = generateOptimizedUrl(file.filename, {
        width: 1200,
        height: 800,
        crop: "limit",
        quality: "auto",
      });
      thumbnailUrl = generateThumbnail(file.filename, 300);
    }

    const cloudinaryResultData = this.buildCloudinaryData(
      file,
      optimizedUrl,
      thumbnailUrl,
    );

    const resultSubmission = {
      originalResultLink: "",
      cloudinaryResultData,
      submissionDate: new Date(),
      projectId: projectId || null,
      status: "stored",
      notes: notes || "",
      uploadMethod: "direct_upload",
    };

    if (!user.resultSubmissions) user.resultSubmissions = [];
    user.resultSubmissions.push(resultSubmission);
    user.resultLink = file.path;

    if (
      user.annotatorStatus === "pending" ||
      user.annotatorStatus === "verified"
    ) {
      user.annotatorStatus = "submitted";
    }

    await this.repository.saveUser(user);

    const submissionResponse = {
      id: user.resultSubmissions[user.resultSubmissions.length - 1]._id,
      originalFileName: file.originalname,
      cloudinaryUrl: file.path,
      optimizedUrl,
      thumbnailUrl,
      submissionDate: resultSubmission.submissionDate,
      status: "stored",
      fileSize: file.size,
      fileFormat: cloudinaryResultData.format,
    };

    return {
      status: 200,
      data: {
        resultSubmission: submissionResponse,
        totalResultSubmissions: user.resultSubmissions.length,
        updatedResultLink: user.resultLink,
        updatedAnnotatorStatus: user.annotatorStatus,
      },
    };
  }

  async uploadIdDocument({ user, file }) {
    if (!file) {
      return { status: 400, reason: "file_required" };
    }

    return this.updateAttachmentPath({
      user,
      file,
      fieldPath: "attachments.id_document_url",
      responseKey: "id_document_url",
    });
  }

  async uploadResume({ user, file }) {
    if (!file) {
      return { status: 400, reason: "file_required" };
    }

    return this.updateAttachmentPath({
      user,
      file,
      fieldPath: "attachments.resume_url",
      responseKey: "resume_url",
    });
  }
  async updateDTUserProfilePicture({ userId, file }) {
    if (!file) {
      return { status: 400, reason: "file_required" };
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    // Delete old image if it exists in Cloudinary
    if (user.profilePicture && user.profilePicture.publicId) {
      try {
        await deleteCloudinaryFile(user.profilePicture.publicId);
      } catch (cloudinaryErr) {
        console.error("Cloudinary error during replacement:", cloudinaryErr);
        // Continue anyway to update with the new picture
      }
    }

    // Update user with new picture data
    user.profilePicture = {
      url: file.path,
      publicId: file.filename,
    };
    user.updatedAt = new Date();

    await this.repository.saveUser(user);

    return {
      status: 200,
      data: {
        message: "Profile picture updated successfully",
        profilePicture: user.profilePicture,
      },
    };
  }
}
module.exports = new DtuserUploadService();
