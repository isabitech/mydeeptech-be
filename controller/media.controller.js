import mediaService from '../services/media.service.js';
import { ResponseHandler, ValidationError, NotFoundError } from '../utils/responseHandler.js';

class MediaController {
  /**
   * Upload single image
   * POST /api/media/upload/image
   */
  async uploadImage(req, res) {
    const userId = req.user?.userId || req.dtuser?.userId;
    const data = await mediaService.uploadImage(req.file, userId);
    ResponseHandler.success(res, data, 'Image uploaded successfully');
  }

  /**
   * Upload multiple images
   * POST /api/media/upload/images
   */
  async uploadMultipleImages(req, res) {
    const userId = req.user?.userId || req.dtuser?.userId;
    const data = await mediaService.uploadMultipleImages(req.files, userId);
    ResponseHandler.success(res, data, `${req.files?.length || 0} images uploaded successfully`);
  }

  /**
   * Upload document
   * POST /api/media/upload/document
   */
  async uploadDocument(req, res) {
    const userId = req.user?.userId || req.dtuser?.userId;
    const data = await mediaService.uploadDocument(req.file, userId);
    ResponseHandler.success(res, data, 'Document uploaded successfully');
  }

  /**
   * Upload video
   * POST /api/media/upload/video
   */
  async uploadVideo(req, res) {
    const userId = req.user?.userId || req.dtuser?.userId;
    const data = await mediaService.uploadVideo(req.file, userId);
    ResponseHandler.success(res, data, 'Video uploaded successfully');
  }

  /**
   * Upload audio
   * POST /api/media/upload/audio
   */
  async uploadAudio(req, res) {
    const userId = req.user?.userId || req.dtuser?.userId;
    const data = await mediaService.uploadAudio(req.file, userId);
    ResponseHandler.success(res, data, 'Audio uploaded successfully');
  }

  /**
   * Upload general file
   * POST /api/media/upload/file
   */
  async uploadFile(req, res) {
    const userId = req.user?.userId || req.dtuser?.userId;
    const data = await mediaService.uploadFile(req.file, userId);
    ResponseHandler.success(res, data, 'File uploaded successfully');
  }

  /**
   * Delete file
   * DELETE /api/media/delete/:publicId
   */
  async deleteFile(req, res) {
    const userId = req.user?.userId || req.dtuser?.userId;
    const data = await mediaService.deleteFile(req.params.publicId, userId);
    ResponseHandler.success(res, data, 'File deleted successfully');
  }

  /**
   * Get file information
   * GET /api/media/info/:publicId
   */
  async getFileInfo(req, res) {
    const data = await mediaService.getFileInfo(req.params.publicId);
    ResponseHandler.success(res, data, 'File information retrieved successfully');
  }

  /**
   * Update DTUser profile picture
   * PATCH /api/media/profile-picture
   */
  async updateProfilePicture(req, res) {
    const userId = req.user?.userId || req.dtuser?.userId;
    const email = req.user?.email || req.dtuser?.email;
    const data = await mediaService.updateProfilePicture(userId, email, req.file);
    ResponseHandler.success(res, data, 'Profile picture updated successfully');
  }
}

export default new MediaController();