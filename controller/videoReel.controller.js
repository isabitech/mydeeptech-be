const VideoReel = require('../models/videoReel.model');
const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');
const { extractYouTubeVideoData, validateYouTubeUrl, convertToEmbedUrl } = require('../utils/youTubeService');
const Joi = require('joi');

// Validation schemas
const videoReelCreateSchema = Joi.object({
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

const videoReelUpdateSchema = Joi.object({
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
 * POST /api/admin/multimedia-assessments/reels/add
 */
const addVideoReel = async (req, res) => {
  try {
    console.log(`🎬 Admin ${req.admin.email} adding video reel from YouTube Shorts`);
    
    // Validate request body
    const { error, value } = videoReelCreateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }
    
    let { youtubeUrl, niche, tags = [], contentWarnings = [] } = value;
    let { title, description } = value;
    
    // Convert to embed URL if not already in embed format
    const embedUrl = convertToEmbedUrl(youtubeUrl);
    if (!embedUrl) {
      return res.status(400).json({
        success: false,
        message: 'Invalid YouTube URL format. Please provide a valid YouTube URL.'
      });
    }
    youtubeUrl = embedUrl;
    
    // Check if video already exists
    const existingVideo = await VideoReel.findOne({ youtubeUrl });
    if (existingVideo) {
      return res.status(409).json({
        success: false,
        message: 'Video with this YouTube URL already exists',
        videoReel: existingVideo
      });
    }
    
    // Extract video data from YouTube
    console.log('📺 Extracting YouTube video data...');
    const youtubeData = await extractYouTubeVideoData(youtubeUrl);
    
    if (!youtubeData) {
      return res.status(400).json({
        success: false,
        message: 'Failed to extract video data from YouTube URL'
      });
    }
    
    // Use YouTube data if title/description not provided
    if (!title && youtubeData.title) {
      title = youtubeData.title.substring(0, 200);
    }
    if (!description && youtubeData.description) {
      description = youtubeData.description.substring(0, 1000);
    }
    
    // Create video reel record
    const videoReel = new VideoReel({
      title: title || 'Untitled Video',
      description: description || '',
      youtubeUrl,
      youtubeVideoId: youtubeData.videoId,
      thumbnailUrl: youtubeData.thumbnailUrl,
      highResThumbnailUrl: youtubeData.highResThumbnailUrl,
      niche,
      duration: youtubeData.duration || 30,
      aspectRatio: youtubeData.aspectRatio || 'portrait',
      metadata: {
        viewCount: youtubeData.viewCount || 0,
        likeCount: youtubeData.likeCount || 0,
        publishedAt: youtubeData.publishedAt,
        channelTitle: youtubeData.channelTitle || '',
        tags: youtubeData.tags || []
      },
      uploadedBy: req.admin.userId,
      tags: tags || [],
      contentWarnings: contentWarnings.length > 0 ? contentWarnings : ['none']
    });
    
    await videoReel.save();
    
    console.log(`✅ Video reel added: ${videoReel.title} (${videoReel._id})`);
    
    res.status(201).json({
      success: true,
      message: 'Video reel uploaded successfully',
      data: {
        videoReel: {
          id: videoReel._id,
          title: videoReel.title,
          description: videoReel.description,
          videoUrl: videoReel.videoUrl,
          thumbnailUrl: videoReel.thumbnailUrl,
          niche: videoReel.niche,
          duration: videoReel.duration,
          formattedDuration: videoReel.formattedDuration,
          aspectRatio: videoReel.aspectRatio,
          metadata: videoReel.metadata,
          tags: videoReel.tags,
          isActive: videoReel.isActive,
          createdAt: videoReel.createdAt
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error uploading video reel:', error);
    res.status(500).json({
      success: false,
      message: 'Server error uploading video reel',
      error: error.message
    });
  }
};

/**
 * Get all video reels with filtering and pagination
 * GET /api/admin/multimedia-assessments/reels
 */
const getAllVideoReels = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      niche,
      isActive,
      isApproved,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Build match conditions
    const matchConditions = {};
    
    if (niche) matchConditions.niche = niche;
    if (isActive !== undefined) matchConditions.isActive = isActive === 'true';
    if (isApproved !== undefined) matchConditions.isApproved = isApproved === 'true';
    
    if (search) {
      matchConditions.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute queries
    const [videoReels, totalCount] = await Promise.all([
      VideoReel.find(matchConditions)
        .populate('uploadedBy', 'fullName email')
        .populate('approvedBy', 'fullName email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      VideoReel.countDocuments(matchConditions)
    ]);
    
    // Get niche statistics
    const nicheStats = await VideoReel.aggregate([
      { $match: { isActive: true, isApproved: true } },
      {
        $group: {
          _id: '$niche',
          count: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          averageDuration: { $avg: '$duration' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    
    console.log(`📊 Retrieved ${videoReels.length} video reels (page ${page}/${totalPages})`);
    
    res.status(200).json({
      success: true,
      message: 'Video reels retrieved successfully',
      data: {
        videoReels: videoReels.map(reel => ({
          id: reel._id,
          title: reel.title,
          description: reel.description,
          videoUrl: reel.videoUrl,
          thumbnailUrl: reel.thumbnailUrl,
          niche: reel.niche,
          duration: reel.duration,
          formattedDuration: reel.formattedDuration,
          fileSizeMB: reel.fileSizeMB,
          aspectRatio: reel.aspectRatio,
          tags: reel.tags,
          usageCount: reel.usageCount,
          lastUsedAt: reel.lastUsedAt,
          isActive: reel.isActive,
          isApproved: reel.isApproved,
          uploadedBy: reel.uploadedBy,
          approvedBy: reel.approvedBy,
          createdAt: reel.createdAt,
          updatedAt: reel.updatedAt
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          limit: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        statistics: {
          nicheBreakdown: nicheStats,
          totalActiveReels: await VideoReel.countDocuments({ isActive: true }),
          totalApprovedReels: await VideoReel.countDocuments({ isApproved: true }),
          totalReels: totalCount
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error retrieving video reels:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving video reels',
      error: error.message
    });
  }
};

/**
 * Get single video reel details
 * GET /api/admin/multimedia-assessments/reels/:id
 */
const getVideoReelById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const videoReel = await VideoReel.findById(id)
      .populate('uploadedBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .populate('assessmentProjects');
    
    if (!videoReel) {
      return res.status(404).json({
        success: false,
        message: 'Video reel not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Video reel retrieved successfully',
      data: {
        videoReel: {
          id: videoReel._id,
          title: videoReel.title,
          description: videoReel.description,
          videoUrl: videoReel.videoUrl,
          thumbnailUrl: videoReel.thumbnailUrl,
          niche: videoReel.niche,
          duration: videoReel.duration,
          formattedDuration: videoReel.formattedDuration,
          fileSizeMB: videoReel.fileSizeMB,
          aspectRatio: videoReel.aspectRatio,
          metadata: videoReel.metadata,
          cloudinaryData: videoReel.cloudinaryData,
          tags: videoReel.tags,
          contentWarnings: videoReel.contentWarnings,
          usageCount: videoReel.usageCount,
          lastUsedAt: videoReel.lastUsedAt,
          isActive: videoReel.isActive,
          isApproved: videoReel.isApproved,
          uploadedBy: videoReel.uploadedBy,
          approvedBy: videoReel.approvedBy,
          assessmentProjects: videoReel.assessmentProjects,
          createdAt: videoReel.createdAt,
          updatedAt: videoReel.updatedAt
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error retrieving video reel:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving video reel',
      error: error.message
    });
  }
};

/**
 * Update video reel
 * PUT /api/admin/multimedia-assessments/reels/:id
 */
const updateVideoReel = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = videoReelUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => detail.message)
      });
    }
    
    const videoReel = await VideoReel.findById(id);
    if (!videoReel) {
      return res.status(404).json({
        success: false,
        message: 'Video reel not found'
      });
    }
    
    // Update fields
    Object.keys(value).forEach(key => {
      videoReel[key] = value[key];
    });
    
    // If approving the video, set approvedBy
    if (value.isApproved === true && !videoReel.approvedBy) {
      videoReel.approvedBy = req.admin.userId;
    }
    
    await videoReel.save();
    
    console.log(`✅ Video reel updated: ${videoReel.title} by ${req.admin.email}`);
    
    res.status(200).json({
      success: true,
      message: 'Video reel updated successfully',
      data: {
        videoReel: {
          id: videoReel._id,
          title: videoReel.title,
          description: videoReel.description,
          niche: videoReel.niche,
          tags: videoReel.tags,
          contentWarnings: videoReel.contentWarnings,
          isActive: videoReel.isActive,
          isApproved: videoReel.isApproved,
          approvedBy: videoReel.approvedBy,
          updatedAt: videoReel.updatedAt
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating video reel:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating video reel',
      error: error.message
    });
  }
};

/**
 * Delete video reel (soft delete)
 * DELETE /api/admin/multimedia-assessments/reels/:id
 */
const deleteVideoReel = async (req, res) => {
  try {
    const { id } = req.params;
    
    const videoReel = await VideoReel.findById(id);
    if (!videoReel) {
      return res.status(404).json({
        success: false,
        message: 'Video reel not found'
      });
    }
    
    // Check if video is being used in any assessments
    const assessmentCount = await MultimediaAssessmentConfig.countDocuments({
      'videoReels.reelsPerNiche': { $gt: 0 },
      isActive: true
    });
    
    if (assessmentCount > 0 && videoReel.usageCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete video reel that is currently being used in active assessments',
        usageCount: videoReel.usageCount
      });
    }
    
    // Soft delete - just mark as inactive
    videoReel.isActive = false;
    await videoReel.save();
    
    console.log(`🗑️ Video reel soft deleted: ${videoReel.title} by ${req.admin.email}`);
    
    res.status(200).json({
      success: true,
      message: 'Video reel deleted successfully',
      data: {
        deletedId: videoReel._id,
        title: videoReel.title,
        deletedAt: new Date()
      }
    });
    
  } catch (error) {
    console.error('❌ Error deleting video reel:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting video reel',
      error: error.message
    });
  }
};

/**
 * Bulk add video reels from YouTube Shorts URLs
 * POST /api/admin/multimedia-assessments/reels/bulk-add
 */
const bulkAddVideoReels = async (req, res) => {
  try {
    console.log(`🎬📦 Admin ${req.admin.email} bulk adding video reels from YouTube URLs`);
    
    const { youtubeUrls, defaultNiche = 'other', defaultTags = [] } = req.body;
    
    if (!youtubeUrls || !Array.isArray(youtubeUrls) || youtubeUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array of YouTube URLs is required'
      });
    }
    
    if (youtubeUrls.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 20 videos can be processed at once'
      });
    }
    
    const results = [];
    const errors = [];
    
    for (let i = 0; i < youtubeUrls.length; i++) {
      try {
        const youtubeUrl = youtubeUrls[i];
        
        // Validate URL
        if (!validateYouTubeUrl(youtubeUrl)) {
          errors.push({
            url: youtubeUrl,
            error: 'Invalid YouTube URL format'
          });
          continue;
        }
        
        // Check if video already exists
        const existingVideo = await VideoReel.findOne({ youtubeUrl });
        if (existingVideo) {
          errors.push({
            url: youtubeUrl,
            error: 'Video already exists in database'
          });
          continue;
        }
        
        // Extract video data
        const youtubeData = await extractYouTubeVideoData(youtubeUrl);
        if (!youtubeData) {
          errors.push({
            url: youtubeUrl,
            error: 'Failed to extract video data from YouTube'
          });
          continue;
        }
        
        // Create video reel record
        const videoReel = new VideoReel({
          title: youtubeData.title || `Video Reel ${i + 1}`,
          description: youtubeData.description || '',
          youtubeUrl,
          youtubeVideoId: youtubeData.videoId,
          thumbnailUrl: youtubeData.thumbnailUrl,
          highResThumbnailUrl: youtubeData.highResThumbnailUrl,
          niche: defaultNiche,
          duration: youtubeData.duration,
          aspectRatio: youtubeData.aspectRatio,
          metadata: {
            viewCount: youtubeData.viewCount,
            likeCount: youtubeData.likeCount,
            publishedAt: youtubeData.publishedAt,
            channelTitle: youtubeData.channelTitle,
            tags: youtubeData.tags
          },
          uploadedBy: req.admin.userId,
          tags: Array.isArray(defaultTags) ? defaultTags : defaultTags.split(',').map(tag => tag.trim()),
          contentWarnings: ['none']
        });
        
        await videoReel.save();
        results.push({
          id: videoReel._id,
          title: videoReel.title,
          niche: videoReel.niche,
          duration: videoReel.duration,
          youtubeUrl: videoReel.youtubeUrl
        });
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (urlError) {
        console.error(`❌ Error processing URL ${i + 1}:`, urlError);
        errors.push({
          url: youtubeUrls[i],
          error: urlError.message
        });
      }
    }
    
    console.log(`✅ Bulk add completed: ${results.length} success, ${errors.length} errors`);
    
    res.status(results.length > 0 ? 201 : 400).json({
      success: results.length > 0,
      message: `Bulk add completed: ${results.length} added, ${errors.length} failed`,
      data: {
        successful: results,
        failed: errors,
        summary: {
          totalFiles: req.files.length,
          successful: results.length,
          failed: errors.length
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error in bulk upload:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk upload',
      error: error.message
    });
  }
};

/**
 * Get video reel analytics
 * GET /api/admin/multimedia-assessments/reels/analytics
 */
const getVideoReelAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, niche } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }
    
    // Add niche filter if provided
    const matchFilter = { ...dateFilter };
    if (niche) matchFilter.niche = niche;
    
    // Get comprehensive analytics
    const [
      totalStats,
      nicheStats,
      usageStats,
      uploadTrends,
      topPerformers
    ] = await Promise.all([
      // Total statistics
      VideoReel.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalReels: { $sum: 1 },
            activeReels: { $sum: { $cond: ['$isActive', 1, 0] } },
            approvedReels: { $sum: { $cond: ['$isApproved', 1, 0] } },
            totalDuration: { $sum: '$duration' },
            totalSize: { $sum: '$metadata.fileSize' },
            averageDuration: { $avg: '$duration' },
            totalUsage: { $sum: '$usageCount' }
          }
        }
      ]),
      
      // Niche breakdown
      VideoReel.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$niche',
            count: { $sum: 1 },
            activeCount: { $sum: { $cond: ['$isActive', 1, 0] } },
            totalDuration: { $sum: '$duration' },
            totalUsage: { $sum: '$usageCount' },
            averageDuration: { $avg: '$duration' }
          }
        },
        { $sort: { count: -1 } }
      ]),
      
      // Usage statistics
      VideoReel.aggregate([
        { $match: { ...matchFilter, usageCount: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalUsedReels: { $sum: 1 },
            totalUsageCount: { $sum: '$usageCount' },
            averageUsagePerReel: { $avg: '$usageCount' },
            maxUsage: { $max: '$usageCount' },
            minUsage: { $min: '$usageCount' }
          }
        }
      ]),
      
      // Upload trends (by month)
      VideoReel.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 },
            totalDuration: { $sum: '$duration' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 } // Last 12 months
      ]),
      
      // Top performing reels
      VideoReel.find(matchFilter)
        .sort({ usageCount: -1 })
        .limit(10)
        .select('title niche usageCount duration lastUsedAt')
    ]);
    
    res.status(200).json({
      success: true,
      message: 'Video reel analytics retrieved successfully',
      data: {
        overview: totalStats[0] || {
          totalReels: 0,
          activeReels: 0,
          approvedReels: 0,
          totalDuration: 0,
          totalSize: 0,
          averageDuration: 0,
          totalUsage: 0
        },
        nicheBreakdown: nicheStats,
        usageStatistics: usageStats[0] || {
          totalUsedReels: 0,
          totalUsageCount: 0,
          averageUsagePerReel: 0,
          maxUsage: 0,
          minUsage: 0
        },
        uploadTrends: uploadTrends,
        topPerformers: topPerformers.map(reel => ({
          id: reel._id,
          title: reel.title,
          niche: reel.niche,
          usageCount: reel.usageCount,
          formattedDuration: `${Math.floor(reel.duration / 60)}:${(reel.duration % 60).toString().padStart(2, '0')}`,
          lastUsedAt: reel.lastUsedAt
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Error retrieving video reel analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving analytics',
      error: error.message
    });
  }
};

module.exports = {
  addVideoReel,
  getAllVideoReels,
  getVideoReelById,
  updateVideoReel,
  deleteVideoReel,
  bulkAddVideoReels,
  getVideoReelAnalytics
};