const axios = require('axios');

// YouTube API configuration
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * Validate YouTube embed URL format
 * @param {string} url - YouTube embed URL to validate
 * @returns {boolean} - True if valid YouTube embed URL
 */
const validateYouTubeUrl = (url) => {
  const embedRegex = /^https:\/\/www\.youtube\.com\/embed\/[a-zA-Z0-9_-]{11}(\?.*)?$/;
  return embedRegex.test(url);
};

/**
 * Extract video ID from YouTube embed URL
 * @param {string} url - YouTube embed URL
 * @returns {string|null} - Video ID or null if invalid
 */
const extractVideoId = (url) => {
  const embedPattern = /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(embedPattern);
  return match ? match[1] : null;
};

/**
 * Get YouTube video data using YouTube Data API v3
 * @param {string} videoId - YouTube video ID
 * @returns {Object|null} - Video data or null if error
 */
const getYouTubeVideoData = async (videoId) => {
  try {
    if (!YOUTUBE_API_KEY) {
      console.error('❌ YouTube API key not configured');
      return null;
    }
    
    const response = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
      params: {
        part: 'snippet,contentDetails,statistics',
        id: videoId,
        key: YOUTUBE_API_KEY
      }
    });
    
    if (!response.data.items || response.data.items.length === 0) {
      console.error('❌ Video not found on YouTube');
      return null;
    }
    
    const video = response.data.items[0];
    const snippet = video.snippet;
    const contentDetails = video.contentDetails;
    const statistics = video.statistics;
    
    // Parse duration from ISO 8601 format (PT1M30S -> 90 seconds)
    const duration = parseDuration(contentDetails.duration);
    
    // Determine aspect ratio based on video dimensions (if available)
    let aspectRatio = 'portrait'; // Default for Shorts
    
    // Check if it's actually a Short (under 60 seconds and likely vertical)
    const isShort = duration <= 60;
    
    return {
      videoId,
      title: snippet.title,
      description: snippet.description,
      thumbnailUrl: snippet.thumbnails.medium?.url || snippet.thumbnails.default?.url,
      highResThumbnailUrl: snippet.thumbnails.high?.url || snippet.thumbnails.maxres?.url,
      duration,
      aspectRatio: isShort ? 'portrait' : 'landscape',
      publishedAt: new Date(snippet.publishedAt),
      channelTitle: snippet.channelTitle,
      viewCount: parseInt(statistics.viewCount) || 0,
      likeCount: parseInt(statistics.likeCount) || 0,
      tags: snippet.tags || [],
      isShort
    };
  } catch (error) {
    console.error('❌ Error fetching YouTube video data:', error.message);
    return null;
  }
};

/**
 * Parse ISO 8601 duration to seconds
 * @param {string} duration - ISO 8601 duration (e.g., "PT1M30S")
 * @returns {number} - Duration in seconds
 */
const parseDuration = (duration) => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;
  
  return hours * 3600 + minutes * 60 + seconds;
};

/**
 * Extract comprehensive YouTube video data from embed URL
 * @param {string} url - YouTube embed URL
 * @returns {Object|null} - Video data with metadata
 */
const extractYouTubeVideoData = async (url) => {
  try {
    // Validate embed URL
    if (!validateYouTubeUrl(url)) {
      console.error('❌ Invalid YouTube embed URL format');
      return null;
    }
    
    // Extract video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
      console.error('❌ Could not extract video ID from URL');
      return null;
    }
    
    // Get video data from API
    const videoData = await getYouTubeVideoData(videoId);
    if (!videoData) {
      return null;
    }
    
    // Validate it's actually a Short (60 seconds or less)
    if (videoData.duration > 60) {
      console.warn('⚠️ Video is longer than 60 seconds, may not be a proper Short');
    }
    
    return videoData;
  } catch (error) {
    console.error('❌ Error extracting YouTube video data:', error.message);
    return null;
  }
};

/**
 * Generate YouTube embed URL for video
 * @param {string} videoId - YouTube video ID
 * @returns {string} - Embed URL
 */
const getEmbedUrl = (videoId) => {
  return `https://www.youtube.com/embed/${videoId}`;
};

/**
 * Generate YouTube watch URL for video
 * @param {string} videoId - YouTube video ID
 * @returns {string} - Watch URL
 */
const getWatchUrl = (videoId) => {
  return `https://www.youtube.com/watch?v=${videoId}`;
};

/**
 * Generate YouTube Shorts URL for video
 * @param {string} videoId - YouTube video ID
 * @returns {string} - Shorts URL
 */
const getShortsUrl = (videoId) => {
  return `https://www.youtube.com/shorts/${videoId}`;
};

/**
 * Convert various YouTube URLs to embed format
 * @param {string} url - Any YouTube URL format
 * @returns {string|null} - Embed URL or null if invalid
 */
const convertToEmbedUrl = (url) => {
  // If already embed URL, return as is
  if (url.includes('/embed/')) {
    return url;
  }
  
  // Extract video ID from various formats
  const patterns = [
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return getEmbedUrl(match[1]);
    }
  }
  
  return null;
};

/**
 * Batch process multiple YouTube URLs
 * @param {Array<string>} urls - Array of YouTube URLs
 * @returns {Array<Object>} - Array of video data objects
 */
const batchExtractYouTubeData = async (urls) => {
  const results = [];
  
  for (const url of urls) {
    try {
      const data = await extractYouTubeVideoData(url);
      results.push({
        url,
        success: !!data,
        data: data || null,
        error: data ? null : 'Failed to extract video data'
      });
      
      // Add small delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      results.push({
        url,
        success: false,
        data: null,
        error: error.message
      });
    }
  }
  
  return results;
};

module.exports = {
  validateYouTubeUrl,
  extractVideoId,
  getYouTubeVideoData,
  extractYouTubeVideoData,
  getEmbedUrl,
  getWatchUrl,
  getShortsUrl,
  convertToEmbedUrl,
  batchExtractYouTubeData,
  parseDuration
};