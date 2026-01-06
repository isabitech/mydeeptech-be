import videoReelRepository from '../repositories/videoReel.repository.js';
import { extractYouTubeVideoData, convertToEmbedUrl, validateYouTubeUrl } from '../utils/youTubeService.js';
import { ValidationError, ConflictError, NotFoundError } from '../utils/responseHandler.js';
import MultimediaAssessmentConfig from '../models/multimediaAssessmentConfig.model.js';

class VideoReelService {
    async addVideoReel(data, adminId) {
        let { youtubeUrl, niche, tags = [], contentWarnings = [], title, description } = data;

        // Convert and validate URL
        const embedUrl = convertToEmbedUrl(youtubeUrl);
        if (!embedUrl || !validateYouTubeUrl(embedUrl)) {
            throw new ValidationError('Invalid YouTube URL format');
        }
        youtubeUrl = embedUrl;

        // Check existence
        const existing = await videoReelRepository.findOne({ youtubeUrl });
        if (existing) {
            throw new ConflictError('Video with this YouTube URL already exists');
        }

        // Extract YouTube data
        const youtubeData = await extractYouTubeVideoData(youtubeUrl);
        if (!youtubeData) {
            throw new ValidationError('Failed to extract video data from YouTube');
        }

        // Create record
        return await videoReelRepository.create({
            title: title || youtubeData.title || 'Untitled Video',
            description: description || youtubeData.description || '',
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
            uploadedBy: adminId,
            tags: tags,
            contentWarnings: contentWarnings.length > 0 ? contentWarnings : ['none']
        });
    }

    async getAllVideoReels(queryParams) {
        const {
            page = 1,
            limit = 20,
            niche,
            isActive,
            isApproved,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = queryParams;

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

        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [videoReels, totalCount] = await Promise.all([
            videoReelRepository.find(matchConditions, sort, skip, parseInt(limit), ['uploadedBy', 'approvedBy']),
            videoReelRepository.count(matchConditions)
        ]);

        const nicheStats = await videoReelRepository.aggregate([
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

        return {
            videoReels,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalCount,
                limit: parseInt(limit)
            },
            statistics: {
                nicheBreakdown: nicheStats,
                totalActiveReels: await videoReelRepository.count({ isActive: true }),
                totalApprovedReels: await videoReelRepository.count({ isApproved: true }),
                totalReels: totalCount
            }
        };
    }

    async getVideoReelById(id) {
        const videoReel = await videoReelRepository.findByIdWithPopulate(id, ['uploadedBy', 'approvedBy', 'assessmentProjects']);
        if (!videoReel) throw new NotFoundError('Video reel not found');
        return videoReel;
    }

    async updateVideoReel(id, updateData, adminId) {
        const videoReel = await videoReelRepository.findById(id);
        if (!videoReel) throw new NotFoundError('Video reel not found');

        if (updateData.isApproved === true && !videoReel.approvedBy) {
            updateData.approvedBy = adminId;
        }

        return await videoReelRepository.update(id, updateData);
    }

    async deleteVideoReel(id) {
        const videoReel = await videoReelRepository.findById(id);
        if (!videoReel) throw new NotFoundError('Video reel not found');

        const assessmentCount = await MultimediaAssessmentConfig.countDocuments({
            'videoReels.reelsPerNiche': { $gt: 0 },
            isActive: true
        });

        if (assessmentCount > 0 && videoReel.usageCount > 0) {
            throw new ValidationError('Cannot delete video reel that is currently being used in active assessments');
        }

        videoReel.isActive = false;
        return await videoReel.save();
    }

    async bulkAddVideoReels(data, adminId) {
        const { youtubeUrls, defaultNiche = 'other', defaultTags = [] } = data;
        if (!youtubeUrls || !Array.isArray(youtubeUrls) || youtubeUrls.length === 0) {
            throw new ValidationError('Array of YouTube URLs is required');
        }

        const results = [];
        const errors = [];

        for (const rawUrl of youtubeUrls.slice(0, 20)) {
            try {
                const cleanedUrl = rawUrl.trim().replace(/[,;.\s]+$/, '');
                if (!cleanedUrl) continue;

                const embedUrl = convertToEmbedUrl(cleanedUrl);
                if (!embedUrl || !validateYouTubeUrl(embedUrl)) {
                    errors.push({ url: rawUrl, error: 'Invalid YouTube URL format' });
                    continue;
                }

                const existing = await videoReelRepository.findOne({ youtubeUrl: embedUrl });
                if (existing) {
                    errors.push({ url: rawUrl, error: 'Video already exists' });
                    continue;
                }

                const youtubeData = await extractYouTubeVideoData(embedUrl);
                if (!youtubeData) {
                    errors.push({ url: rawUrl, error: 'Failed to extract video data' });
                    continue;
                }

                const videoReel = await videoReelRepository.create({
                    title: youtubeData.title || 'Bulk Uploaded Video',
                    description: youtubeData.description || '',
                    youtubeUrl: embedUrl,
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
                    uploadedBy: adminId,
                    tags: Array.isArray(defaultTags) ? defaultTags : defaultTags.split(',').map(tag => tag.trim()),
                    contentWarnings: ['none']
                });

                results.push(videoReel);
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (err) {
                errors.push({ url: rawUrl, error: err.message });
            }
        }

        return {
            successful: results,
            failed: errors,
            summary: {
                total: youtubeUrls.length,
                successful: results.length,
                failed: errors.length
            }
        };
    }

    async getVideoReelAnalytics(queryParams) {
        const { startDate, endDate, niche } = queryParams;
        const matchFilter = {};
        if (startDate || endDate) {
            matchFilter.createdAt = {};
            if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
            if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
        }
        if (niche) matchFilter.niche = niche;

        const [totalStats, nicheStats, usageStats, uploadTrends, topPerformers] = await Promise.all([
            videoReelRepository.aggregate([
                { $match: matchFilter },
                {
                    $group: {
                        _id: null,
                        totalReels: { $sum: 1 },
                        activeReels: { $sum: { $cond: ['$isActive', 1, 0] } },
                        approvedReels: { $sum: { $cond: ['$isApproved', 1, 0] } },
                        totalDuration: { $sum: '$duration' },
                        totalUsage: { $sum: '$usageCount' }
                    }
                }
            ]),
            videoReelRepository.aggregate([
                { $match: matchFilter },
                {
                    $group: {
                        _id: '$niche',
                        count: { $sum: 1 },
                        activeCount: { $sum: { $cond: ['$isActive', 1, 0] } },
                        totalDuration: { $sum: '$duration' },
                        totalUsage: { $sum: '$usageCount' }
                    }
                },
                { $sort: { count: -1 } }
            ]),
            videoReelRepository.aggregate([
                { $match: { ...matchFilter, usageCount: { $gt: 0 } } },
                {
                    $group: {
                        _id: null,
                        totalUsedReels: { $sum: 1 },
                        totalUsageCount: { $sum: '$usageCount' },
                        averageUsagePerReel: { $avg: '$usageCount' }
                    }
                }
            ]),
            videoReelRepository.aggregate([
                { $match: matchFilter },
                {
                    $group: {
                        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
                { $limit: 12 }
            ]),
            videoReelRepository.find(matchFilter, { usageCount: -1 }, 0, 10)
        ]);

        return {
            overview: totalStats[0] || {},
            nicheBreakdown: nicheStats,
            usageStatistics: usageStats[0] || {},
            uploadTrends,
            topPerformers
        };
    }
}

export default new VideoReelService();
