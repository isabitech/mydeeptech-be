const {
  deleteCloudinaryFile,
  getCloudinaryFileInfo,
  generateOptimizedUrl,
  generateThumbnail,
} = require("../config/cloudinary");
const DTUser = require("../models/dtUser.model");

class MediaService {
  buildBaseFileData(file) {
    return {
      publicId: file.filename,
      url: file.path,
      originalName: file.originalname,
      size: file.size,
      format: file.format,
      resourceType: file.resource_type,
      mimeType: file.mimetype,
    };
  }

  isImage(file, options) {
    return options.isImage || file.mimetype?.startsWith("image/");
  }

  isVideo(file, options) {
    return options.isVideo || file.mimetype?.startsWith("video/");
  }

  isAudio(file, options) {
    return options.isAudio || file.mimetype?.startsWith("audio/");
  }

  formatFileData(file, options = {}) {
    const fileData = this.buildBaseFileData(file);

    if (this.isImage(file, options)) {
      fileData.thumbnail = generateThumbnail(file.filename);
      fileData.optimizedUrl = generateOptimizedUrl(
        file.filename,
        options.optimizeImage || { width: 800, height: 600 },
      );
    }

    if (this.isVideo(file, options)) {
      fileData.duration = file.duration || null;
      fileData.thumbnail = generateThumbnail(file.filename);
      fileData.streamingUrl = generateOptimizedUrl(file.filename, {
        resource_type: "video",
        format: "mp4",
        quality: "auto",
      });
    }

    if (this.isAudio(file, options)) {
      fileData.duration = file.duration || null;
      fileData.streamingUrl = generateOptimizedUrl(file.filename, {
        resource_type: "video",
        format: "mp3",
        quality: "auto",
      });
    }

    if (options.isDocument && file.pages) {
      fileData.pages = file.pages;
    }

    return fileData;
  }

  async uploadSingle(file, user, type) {
    if (!file) throw { status: 400, message: `No ${type} file provided` };

    const options = {
      isImage: type === "image",
      isVideo: type === "video",
      isAudio: type === "audio",
      isDocument: type === "document",
    };

    const fileData = this.formatFileData(file, options);

    return {
      file: fileData,
      uploadedAt: new Date(),
      uploadedBy: user?.userId || null,
    };
  }

  async uploadMultiple(files, user) {
    if (!files || files.length === 0)
      throw { status: 400, message: "No image files provided" };

    const filesData = files.map((file) =>
      this.formatFileData(file, { isImage: true }),
    );

    return {
      files: filesData,
      uploadedAt: new Date(),
      uploadedBy: user?.userId || null,
      totalFiles: files.length,
    };
  }

  async deleteFile(publicId, user) {
    if (!publicId)
      throw { status: 400, message: "Public ID is required for file deletion" };

    const result = await deleteCloudinaryFile(publicId);
    if (result.result === "ok") {
      return {
        publicId,
        deletedAt: new Date(),
        deletedBy: user?.userId || null,
      };
    } else {
      throw { status: 400, message: "Failed to delete file", error: result };
    }
  }

  async getFileInfo(publicId) {
    if (!publicId) throw { status: 400, message: "Public ID is required" };

    const fileInfo = await getCloudinaryFileInfo(publicId);

    const responseData = {
      publicId: fileInfo.public_id,
      url: fileInfo.secure_url,
      format: fileInfo.format,
      resourceType: fileInfo.resource_type,
      size: fileInfo.bytes,
      width: fileInfo.width,
      height: fileInfo.height,
      createdAt: fileInfo.created_at,
      version: fileInfo.version,
      etag: fileInfo.etag,
    };

    if (fileInfo.resource_type === "video") {
      responseData.duration = fileInfo.duration;
      responseData.bitRate = fileInfo.bit_rate;
      responseData.frameRate = fileInfo.frame_rate;
    }

    if (fileInfo.pages) {
      responseData.pages = fileInfo.pages;
    }

    return responseData;
  }

  async updateProfilePicture(file, userId) {
    if (!file) throw { status: 400, message: "No image file provided" };

    const user = await DTUser.findById(userId);
    if (user && user.profilePicture && user.profilePicture.publicId) {
      try {
        await deleteCloudinaryFile(user.profilePicture.publicId);
      } catch (deleteError) {
        console.log(
          `⚠️ Could not delete old profile picture: ${deleteError.message}`,
        );
      }
    }

    const profilePictureData = this.formatFileData(file, {
      isImage: true,
      optimizeImage: { width: 300, height: 300 },
    });

    await DTUser.findByIdAndUpdate(userId, {
      profilePicture: profilePictureData,
      updatedAt: new Date(),
    });

    return {
      profilePicture: profilePictureData,
      updatedAt: new Date(),
    };
  }
}

module.exports = new MediaService();
