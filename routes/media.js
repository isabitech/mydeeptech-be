import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  imageUpload,
  documentUpload,
  videoUpload,
  audioUpload,
  generalUpload
} from '../config/cloudinary.js';
import mediaController from '../controller/media.controller.js';
import tryCatch from '../utils/tryCatch.js';

const router = express.Router();

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
} = mediaController;

// All media routes require authentication
router.use(authenticateToken);

// ==============================================
// IMAGE UPLOAD ROUTES
// ==============================================

router.post('/upload/image', imageUpload.single('image'), tryCatch(uploadImage));
router.post('/upload/images', imageUpload.array('images', 10), tryCatch(uploadMultipleImages));
router.post('/upload/profile-picture', imageUpload.single('profilePicture'), tryCatch(updateProfilePicture));

// ==============================================
// DOCUMENT UPLOAD ROUTES
// ==============================================

router.post('/upload/document', documentUpload.single('document'), tryCatch(uploadDocument));

// ==============================================
// VIDEO UPLOAD ROUTES
// ==============================================

router.post('/upload/video', videoUpload.single('video'), tryCatch(uploadVideo));

// ==============================================
// AUDIO UPLOAD ROUTES
// ==============================================

router.post('/upload/audio', audioUpload.single('audio'), tryCatch(uploadAudio));

// ==============================================
// GENERAL FILE UPLOAD ROUTES
// ==============================================

router.post('/upload/file', generalUpload.single('file'), tryCatch(uploadFile));

// ==============================================
// FILE MANAGEMENT ROUTES
// ==============================================

router.get('/file/:publicId', tryCatch(getFileInfo));
router.delete('/file/:publicId', tryCatch(deleteFile));

// ==============================================
// HELPER ROUTES
// ==============================================

router.get('/health', tryCatch((req, res) => {
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
}));

router.get('/info', tryCatch((req, res) => {
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
}));

export default router;
