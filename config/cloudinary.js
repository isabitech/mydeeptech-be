import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Verify Cloudinary configuration
export const verifyCloudinaryConfig = () => {
  const requiredEnvVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.log(`⚠️ Missing Cloudinary environment variables: ${missingVars.join(', ')}`);
    return false;
  }

  console.log('✅ Cloudinary configuration loaded');
  return true;
};

// Storage configuration for different file types
export const createCloudinaryStorage = (folder, allowedFormats = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'mp4', 'mov'], resourceType = 'auto') => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `mydeeptech/${folder}`,
      allowed_formats: allowedFormats,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true,
      transformation: resourceType === 'raw' ? undefined : [{ quality: 'auto' }]
    }
  });
};

// Image storage (for profile pictures, project images, etc.)
export const imageStorage = createCloudinaryStorage('images', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 'image');

// Document storage (for PDFs, docs, etc.) - using raw resource type
export const documentStorage = createCloudinaryStorage('documents', ['pdf', 'doc', 'docx', 'txt'], 'raw');

// Video storage (for video annotations, tutorials, etc.)
export const videoStorage = createCloudinaryStorage('videos', ['mp4', 'avi', 'mov', 'wmv', 'flv'], 'video');

// Audio storage (for audio annotations, recordings, etc.)
export const audioStorage = createCloudinaryStorage('audio', ['mp3', 'wav', 'aac', 'ogg'], 'video');

// General file storage - using raw for mixed file types
export const generalStorage = createCloudinaryStorage('files', ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'mp4', 'mp3', 'wav'], 'auto');

// Specialized storage for user documents (ID and Resume)
export const idDocumentStorage = createCloudinaryStorage('user_documents/id_documents', ['pdf', 'jpg', 'jpeg', 'png'], 'raw');
export const resumeStorage = createCloudinaryStorage('user_documents/resumes', ['pdf', 'doc', 'docx'], 'raw');

// Multer configurations
export const imageUpload = multer({
  storage: imageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for images
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for image upload'), false);
    }
  }
});

export const documentUpload = multer({
  storage: documentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for documents
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed for document upload'), false);
    }
  }
});

export const videoUpload = multer({
  storage: videoStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed for video upload'), false);
    }
  }
});

export const audioUpload = multer({
  storage: audioStorage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit for audio
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed for audio upload'), false);
    }
  }
});

export const generalUpload = multer({
  storage: generalStorage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit for general files
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'text/csv', 'application/json',
      'video/mp4', 'video/avi', 'video/mov', 'audio/mp3', 'audio/wav', 'audio/aac'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Supported formats: Images (jpg, png, gif), Documents (pdf, doc, docx, txt, csv), Videos (mp4, avi, mov), Audio (mp3, wav, aac)'), false);
    }
  }
});

// ID Document Upload - for identification documents
export const idDocumentUpload = multer({
  storage: idDocumentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for ID documents
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, JPEG, and PNG files are allowed for ID document upload'), false);
    }
  }
});

// Resume Upload - for CV/Resume documents
export const resumeUpload = multer({
  storage: resumeStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for resumes
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed for resume upload'), false);
    }
  }
});

// Specific upload configuration for result files - more flexible field names
export const resultFileUpload = multer({
  storage: generalStorage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit for result files
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'text/csv', 'application/json', 'application/octet-stream',
      'video/mp4', 'video/avi', 'video/mov', 'video/quicktime',
      'audio/mp3', 'audio/wav', 'audio/aac', 'audio/mpeg'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}. Supported formats: Images, Documents, Videos, Audio files`), false);
    }
  }
});

// Helper functions for file operations
export const deleteCloudinaryFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`🗑️ Deleted file from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    console.error(`❌ Error deleting file from Cloudinary: ${publicId}`, error);
    throw error;
  }
};

export const getCloudinaryFileInfo = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    return result;
  } catch (error) {
    console.error(`❌ Error getting file info from Cloudinary: ${publicId}`, error);
    throw error;
  }
};

// Generate optimized URLs for different use cases
export const generateOptimizedUrl = (publicId, options = {}) => {
  const {
    width = null,
    height = null,
    quality = 'auto',
    format = 'auto',
    crop = 'fill',
    gravity = 'auto'
  } = options;

  return cloudinary.url(publicId, {
    width,
    height,
    quality,
    format,
    crop,
    gravity,
    fetch_format: 'auto',
    dpr: 'auto',
    secure: true
  });
};

// Generate thumbnail URLs
export const generateThumbnail = (publicId, size = 150) => {
  return generateOptimizedUrl(publicId, {
    width: size,
    height: size,
    crop: 'thumb',
    gravity: 'face'
  });
};

export { cloudinary };

export default {
  cloudinary,
  verifyCloudinaryConfig,
  imageUpload,
  documentUpload,
  videoUpload,
  audioUpload,
  generalUpload,
  resultFileUpload,
  idDocumentUpload,
  resumeUpload,
  deleteCloudinaryFile,
  getCloudinaryFileInfo,
  generateOptimizedUrl,
  generateThumbnail,
  imageStorage,
  documentStorage,
  videoStorage,
  audioStorage,
  generalStorage,
  idDocumentStorage,
  resumeStorage
};