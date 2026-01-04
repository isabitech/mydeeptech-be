import mediaService from '../services/media.service.js';
import ResponseHandler from '../utils/responseHandler.js';

class MediaController {
  /**
   * Upload single image
   * POST /api/media/upload/image
   */
  async uploadImage(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      const data = await mediaService.uploadImage(req.file, userId);
      return ResponseHandler.success(res, data, 'Image uploaded successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Upload multiple images
   * POST /api/media/upload/images
   */
  async uploadMultipleImages(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      const data = await mediaService.uploadMultipleImages(req.files, userId);
      return ResponseHandler.success(res, data, `${req.files?.length || 0} images uploaded successfully`);
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Upload document
   * POST /api/media/upload/document
   */
  async uploadDocument(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      const data = await mediaService.uploadDocument(req.file, userId);
      return ResponseHandler.success(res, data, 'Document uploaded successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Upload video
   * POST /api/media/upload/video
   */
  async uploadVideo(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      const data = await mediaService.uploadVideo(req.file, userId);
      return ResponseHandler.success(res, data, 'Video uploaded successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Upload audio
   * POST /api/media/upload/audio
   */
  async uploadAudio(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      const data = await mediaService.uploadAudio(req.file, userId);
      return ResponseHandler.success(res, data, 'Audio uploaded successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Upload general file
   * POST /api/media/upload/file
   */
  async uploadFile(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      const data = await mediaService.uploadFile(req.file, userId);
      return ResponseHandler.success(res, data, 'File uploaded successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Delete file
   * DELETE /api/media/delete/:publicId
   */
  async deleteFile(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      const data = await mediaService.deleteFile(req.params.publicId, userId);
      return ResponseHandler.success(res, data, 'File deleted successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Get file information
   * GET /api/media/info/:publicId
   */
  async getFileInfo(req, res) {
    try {
      const data = await mediaService.getFileInfo(req.params.publicId);
      return ResponseHandler.success(res, data, 'File information retrieved successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Update DTUser profile picture
   * PATCH /api/media/profile-picture
   */
  async updateProfilePicture(req, res) {
    try {
      const userId = req.user?.userId || req.dtuser?.userId;
      const email = req.user?.email || req.dtuser?.email;
      const data = await mediaService.updateProfilePicture(userId, email, req.file);
      return ResponseHandler.success(res, data, 'Profile picture updated successfully');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }
}

export default new MediaController();