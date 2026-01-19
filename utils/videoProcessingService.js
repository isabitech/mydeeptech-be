import axios from 'axios';
import { extractYouTubeVideoData, validateYouTubeUrl, extractVideoId } from './youTubeService.js';

/**
 * Process YouTube Shorts video for assessment system
 * @param {string} youtubeUrl - YouTube Shorts URL
 * @returns {Object} Processed video data
 */
export const processYouTubeVideo = async (youtubeUrl) => {
    try {
        console.log('🎬 Processing YouTube video:', youtubeUrl);

        // Validate URL
        if (!validateYouTubeUrl(youtubeUrl)) {
            throw new Error('Invalid YouTube URL format');
        }

        // Extract video data
        const videoData = await extractYouTubeVideoData(youtubeUrl);
        if (!videoData) {
            throw new Error('Failed to extract video data from YouTube');
        }

        // Validate it's suitable for assessment (duration check)
        if (videoData.duration > 60) {
            console.warn('⚠️ Video duration exceeds 60 seconds, may not be optimal for assessment');
        }

        return {
            success: true,
            data: {
                videoId: videoData.videoId,
                title: videoData.title,
                description: videoData.description,
                duration: videoData.duration,
                thumbnailUrl: videoData.thumbnailUrl,
                highResThumbnailUrl: videoData.highResThumbnailUrl,
                aspectRatio: videoData.aspectRatio,
                metadata: {
                    viewCount: videoData.viewCount,
                    likeCount: videoData.likeCount,
                    publishedAt: videoData.publishedAt,
                    channelTitle: videoData.channelTitle,
                    tags: videoData.tags
                }
            }
        };
    } catch (error) {
        console.error('❌ Error processing YouTube video:', error.message);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
};

/**
 * Generate thumbnail URL for YouTube video
 * @param {string} videoId - YouTube video ID
 * @param {string} quality - Thumbnail quality (default, mqdefault, hqdefault, maxresdefault)
 * @returns {string} Thumbnail URL
 */
export const generateYouTubeThumbnail = (videoId, quality = 'hqdefault') => {
    return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
};

/**
 * Validate video content for assessment suitability
 * @param {Object} videoData - Video data from YouTube API
 * @returns {Object} Validation result
 */
export const validateVideoForAssessment = (videoData) => {
    const issues = [];
    const recommendations = [];

    // Check duration
    if (videoData.duration > 60) {
        issues.push('Video exceeds 60 seconds maximum for Shorts');
    } else if (videoData.duration < 10) {
        recommendations.push('Very short video may not provide enough context for assessment');
    }

    // Check aspect ratio
    if (videoData.aspectRatio !== 'portrait') {
        recommendations.push('Portrait aspect ratio (9:16) is recommended for mobile viewing');
    }

    // Check engagement metrics (if available)
    if (videoData.viewCount < 100) {
        recommendations.push('Low view count may indicate poor quality content');
    }

    return {
        isValid: issues.length === 0,
        issues,
        recommendations,
        score: Math.max(0, 100 - (issues.length * 20) - (recommendations.length * 5))
    };
};

/**
 * Extract video ID from various YouTube URL formats
 * @param {string} url - YouTube URL
 * @returns {string|null} Video ID or null if invalid
 */
export const extractYouTubeVideoId = (url) => {
    return extractVideoId(url);
};

/**
 * Batch process multiple YouTube videos
 * @param {Array<string>} urls - Array of YouTube URLs
 * @returns {Array<Object>} Processing results for each URL
 */
export const batchProcessYouTubeVideos = async (urls) => {
    const results = [];

    for (const url of urls) {
        try {
            const result = await processYouTubeVideo(url);
            results.push({
                url,
                ...result
            });

            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            results.push({
                url,
                success: false,
                error: error.message,
                data: null
            });
        }
    }

    return results;
};

/**
 * Generate YouTube thumbnail URLs
 */
const generateYouTubeThumbnails = (videoId, options = {}) => {
    try {
        const {
            quality = 'maxresdefault' // maxresdefault, hqdefault, mqdefault, sddefault, default
        } = options;

        const thumbnails = {
            default: `https://img.youtube.com/vi/${videoId}/default.jpg`, // 120x90
            medium: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, // 320x180
            high: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, // 480x360
            standard: `https://img.youtube.com/vi/${videoId}/sddefault.jpg`, // 640x480
            maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` // 1280x720
        };

        console.log(`✅ Generated YouTube thumbnails for video: ${videoId}`);
        return {
            success: true,
            thumbnails,
            primaryThumbnail: thumbnails[quality] || thumbnails.maxres,
            metadata: {
                videoId,
                quality,
                source: 'youtube'
            }
        };
    } catch (error) {
        console.error(`❌ Failed to generate YouTube thumbnails:`, error);
        throw new Error(`YouTube thumbnail generation failed: ${error.message}`);
    }
};







module.exports = {
    processYouTubeVideo,
    generateYouTubeThumbnail,
    validateVideoForAssessment,
    extractYouTubeVideoId,
    batchProcessYouTubeVideos
};