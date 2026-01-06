import videoReelService from '../services/videoReel.service.js';
import { ResponseHandler, ValidationError } from '../utils/responseHandler.js';
import Joi from 'joi';
import { validateYouTubeUrl } from '../utils/youTubeService.js';

/**
 * VIDEO REEL CONTROLLER
 * REST API for managing video reels for assessments
 */
class VideoReelController {
  // Validation schemas
  static videoReelCreateSchema = Joi.object({
    title: Joi.string().allow('').trim().max(200),
    description: Joi.string().allow('').trim().max(1000),
    youtubeUrl: Joi.string().required().custom((value, helpers) => {
      if (!validateYouTubeUrl(value)) {
        return helpers.message('Invalid YouTube embed URL format');
      }
      return value;
    }),
    niche: Joi.string().required().valid(
      'lifestyle', 'fashion', 'food', 'travel', 'fitness', 'beauty', 'comedy',
      'education', 'technology', 'music', 'dance', 'art', 'pets', 'nature',
      'business', 'motivation', 'diy', 'gaming', 'sports', 'other'
    ),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(10).optional(),
    contentWarnings: Joi.array().items(
      Joi.string().valid('none', 'flashing_lights', 'loud_audio', 'fast_motion', 'explicit_content')
    ).optional()
  });

  static videoReelUpdateSchema = Joi.object({
    title: Joi.string().allow('').trim().max(200).optional(),
    description: Joi.string().allow('').trim().max(1000).optional(),
    niche: Joi.string().valid(
      'lifestyle', 'fashion', 'food', 'travel', 'fitness', 'beauty', 'comedy',
      'education', 'technology', 'music', 'dance', 'art', 'pets', 'nature',
      'business', 'motivation', 'diy', 'gaming', 'sports', 'other'
    ).optional(),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(10).optional(),
    contentWarnings: Joi.array().items(
      Joi.string().valid('none', 'flashing_lights', 'loud_audio', 'fast_motion', 'explicit_content')
    ).optional(),
    isActive: Joi.boolean().optional(),
    isApproved: Joi.boolean().optional()
  });

  /**
   * Add single video reel from YouTube Shorts URL
   * POST /api/admin/video-reels
   */
  async addVideoReel(req, res) {
    const { error, value } = VideoReelController.videoReelCreateSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const videoReel = await videoReelService.addVideoReel(value, req.admin.userId);
    ResponseHandler.success(res, videoReel, 'Video reel uploaded successfully', 201);
  }

  /**
   * Get all video reels with filtering and pagination
   * GET /api/admin/video-reels
   */
  async getAllVideoReels(req, res) {
    const data = await videoReelService.getAllVideoReels(req.query);
    ResponseHandler.success(res, data, 'Video reels retrieved successfully');
  }

  /**
   * Get single video reel details
   * GET /api/admin/video-reels/:id
   */
  async getVideoReelById(req, res) {
    const videoReel = await videoReelService.getVideoReelById(req.params.id);
    ResponseHandler.success(res, { videoReel }, 'Video reel retrieved successfully');
  }

  /**
   * Update video reel
   * PUT /api/admin/video-reels/:id
   */
  async updateVideoReel(req, res) {
    const { error, value } = VideoReelController.videoReelUpdateSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }
    const videoReel = await videoReelService.updateVideoReel(req.params.id, value, req.admin.userId);
    ResponseHandler.success(res, { videoReel }, 'Video reel updated successfully');
  }

  /**
   * Delete video reel (soft delete)
   * DELETE /api/admin/video-reels/:id
   */
  async deleteVideoReel(req, res) {
    const videoReel = await videoReelService.deleteVideoReel(req.params.id);
    ResponseHandler.success(res, {
      deletedId: videoReel._id,
      title: videoReel.title,
      deletedAt: new Date()
    }, 'Video reel deleted successfully');
  }

  /**
   * Bulk add video reels from YouTube Shorts URLs
   * POST /api/admin/video-reels/bulk
   */
  async bulkAddVideoReels(req, res) {
    const data = await videoReelService.bulkAddVideoReels(req.body, req.admin.userId);
    ResponseHandler.success(res, data, `Bulk add completed: ${data.summary.successful} added, ${data.summary.failed} failed`);
  }

  /**
   * Get video reel analytics
   * GET /api/admin/video-reels/analytics
   */
  async getVideoReelAnalytics(req, res) {
    const data = await videoReelService.getVideoReelAnalytics(req.query);
    ResponseHandler.success(res, data, 'Video reel analytics retrieved successfully');
  }
}

export default new VideoReelController();