const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { 
  imageUpload, 
  documentUpload, 
  videoUpload, 
  audioUpload,
  generalUpload
} = require('../config/cloudinary');

const {
  uploadImage,
  uploadMultipleImages,
  uploadDocument,
  uploadVideo,
  uploadAudio,
  uploadFile,
  deleteFile,
  getFileInfo,
  updateProfilePicture
} = require('../controller/media.controller');

// All media routes require authentication
router.use(authenticateToken);

// ==============================================
// IMAGE UPLOAD ROUTES
// ==============================================

/**
 * @route   POST /api/media/upload/image
 * @desc    Upload single image
 * @access  Private (Authenticated users only)
 * @body    image file (multipart/form-data)
 * @returns {Object} Uploaded image data with optimized URLs
 */
router.post('/upload/image', imageUpload.single('image'), uploadImage);

/**
 * @route   POST /api/media/upload/images
 * @desc    Upload multiple images (max 10)
 * @access  Private (Authenticated users only)
 * @body    image files (multipart/form-data)
 * @returns {Object} Array of uploaded images data
 */
router.post('/upload/images', imageUpload.array('images', 10), uploadMultipleImages);

/**
 * @route   POST /api/media/upload/profile-picture
 * @desc    Upload and set user profile picture
 * @access  Private (DTUsers only)
 * @body    image file (multipart/form-data)
 * @returns {Object} Updated profile picture data
 */
router.post('/upload/profile-picture', imageUpload.single('profilePicture'), updateProfilePicture);

// ==============================================
// DOCUMENT UPLOAD ROUTES
// ==============================================

/**
 * @route   POST /api/media/upload/document
 * @desc    Upload document (PDF, DOC, DOCX, TXT, etc.)
 * @access  Private (Authenticated users only)
 * @body    document file (multipart/form-data)
 * @returns {Object} Uploaded document data
 */
router.post('/upload/document', documentUpload.single('document'), uploadDocument);

// ==============================================
// VIDEO UPLOAD ROUTES
// ==============================================

/**
 * @route   POST /api/media/upload/video
 * @desc    Upload video file
 * @access  Private (Authenticated users only)
 * @body    video file (multipart/form-data)
 * @returns {Object} Uploaded video data with streaming URL
 */
router.post('/upload/video', videoUpload.single('video'), uploadVideo);

// ==============================================
// AUDIO UPLOAD ROUTES
// ==============================================

/**
 * @route   POST /api/media/upload/audio
 * @desc    Upload audio file
 * @access  Private (Authenticated users only)
 * @body    audio file (multipart/form-data)
 * @returns {Object} Uploaded audio data with streaming URL
 */
router.post('/upload/audio', audioUpload.single('audio'), uploadAudio);

// ==============================================
// GENERAL FILE UPLOAD ROUTES
// ==============================================

/**
 * @route   POST /api/media/upload/file
 * @desc    Upload any file type
 * @access  Private (Authenticated users only)
 * @body    file (multipart/form-data)
 * @returns {Object} Uploaded file data
 */
router.post('/upload/file', generalUpload.single('file'), uploadFile);

// ==============================================
// FILE MANAGEMENT ROUTES
// ==============================================

/**
 * @route   GET /api/media/file/:publicId
 * @desc    Get file information from Cloudinary
 * @access  Private (Authenticated users only)
 * @param   {string} publicId - Cloudinary public ID
 * @returns {Object} File information and metadata
 */
router.get('/file/:publicId', getFileInfo);

/**
 * @route   DELETE /api/media/file/:publicId
 * @desc    Delete file from Cloudinary
 * @access  Private (Authenticated users only)
 * @param   {string} publicId - Cloudinary public ID
 * @returns {Object} Deletion confirmation
 */
router.delete('/file/:publicId', deleteFile);

// ==============================================
// HELPER ROUTES
// ==============================================

/**
 * @route   GET /api/media/health
 * @desc    Check media service health
 * @access  Private (Authenticated users only)
 * @returns {Object} Service status
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Media service is running',
    timestamp: new Date(),
    cloudinaryConfigured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY),
    supportedTypes: {
      images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'],
      documents: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
      videos: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'],
      audio: ['mp3', 'wav', 'aac', 'flac', 'ogg']
    },
    maxFileSizes: {
      images: '10MB',
      documents: '50MB',
      videos: '100MB',
      audio: '50MB',
      general: '100MB'
    }
  });
});

/**
 * @route   GET /api/media/info
 * @desc    Get media upload information and limits
 * @access  Private (Authenticated users only)
 * @returns {Object} Upload guidelines and limits
 */
router.get('/info', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Media upload information',
    data: {
      endpoints: {
        singleImage: 'POST /api/media/upload/image',
        multipleImages: 'POST /api/media/upload/images',
        profilePicture: 'POST /api/media/upload/profile-picture',
        document: 'POST /api/media/upload/document',
        video: 'POST /api/media/upload/video',
        audio: 'POST /api/media/upload/audio',
        generalFile: 'POST /api/media/upload/file'
      },
      fileTypes: {
        images: {
          allowed: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'],
          maxSize: '10MB',
          maxFiles: 10,
          optimizations: ['thumbnail generation', 'automatic compression', 'format conversion']
        },
        documents: {
          allowed: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
          maxSize: '50MB',
          features: ['page count detection', 'text extraction ready']
        },
        videos: {
          allowed: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'],
          maxSize: '100MB',
          features: ['thumbnail generation', 'streaming optimization', 'format conversion']
        },
        audio: {
          allowed: ['.mp3', '.wav', '.aac', '.flac', '.ogg'],
          maxSize: '50MB',
          features: ['streaming optimization', 'format conversion']
        }
      },
      security: {
        authentication: 'Bearer token required',
        virusScanning: 'Enabled',
        contentFiltering: 'Enabled'
      },
      storage: {
        provider: 'Cloudinary',
        cdn: 'Global CDN distribution',
        backup: 'Automatic backup and versioning'
      }
    }
  });
});

module.exports = router;