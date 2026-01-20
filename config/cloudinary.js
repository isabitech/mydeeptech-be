const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const { default: envConfig } = require('./envConfig');

// Configure Cloudinary
cloudinary.config({
  cloud_name: envConfig.cloudinary.CLOUDINARY_CLOUD_NAME,
  api_key: envConfig.cloudinary.CLOUDINARY_API_KEY,
  api_secret: envConfig.cloudinary.CLOUDINARY_API_SECRET
});

// Verify Cloudinary configuration
const verifyCloudinaryConfig = () => {

    const requiredCloudinaryVars = {
    CLOUDINARY_CLOUD_NAME: envConfig.cloudinary.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: envConfig.cloudinary.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: envConfig.cloudinary.CLOUDINARY_API_SECRET,
  };


const missingVars = Object.entries(requiredCloudinaryVars)
  .filter(([, value]) => !value)
  .map(([key]) => key);

  
  if (missingVars.length > 0) {
    console.log(`⚠️ Missing Cloudinary environment variables: ${missingVars.join(', ')}`);
    return false;
  }
  
  console.log('✅ Cloudinary configuration loaded');
  return true;
};

// Storage configuration for different file types
const createCloudinaryStorage = (folder, allowedFormats = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'mp4', 'mov'], resourceType = 'auto') => {
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
const imageStorage = createCloudinaryStorage('images', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 'image');

// Document storage (for PDFs, docs, etc.) - using raw resource type
const documentStorage = createCloudinaryStorage('documents', ['pdf', 'doc', 'docx', 'txt'], 'raw');

// Video storage (for video annotations, tutorials, etc.)
const videoStorage = createCloudinaryStorage('videos', ['mp4', 'avi', 'mov', 'wmv', 'flv'], 'video');

// Audio storage (for audio annotations, recordings, etc.)
const audioStorage = createCloudinaryStorage('audio', ['mp3', 'wav', 'aac', 'ogg'], 'video');

// General file storage - using raw for mixed file types
const generalStorage = createCloudinaryStorage('files', ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'mp4', 'mp3', 'wav'], 'auto');

// Specialized storage for user documents (ID and Resume)
const idDocumentStorage = createCloudinaryStorage('user_documents/id_documents', ['pdf', 'jpg', 'jpeg', 'png'], 'raw');
const resumeStorage = createCloudinaryStorage('user_documents/resumes', ['pdf', 'doc', 'docx'], 'raw');

// Multer configurations
const imageUpload = multer({
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

const documentUpload = multer({
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

const videoUpload = multer({
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

const audioUpload = multer({
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

const generalUpload = multer({
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
const idDocumentUpload = multer({
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
const resumeUpload = multer({
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
const resultFileUpload = multer({
  storage: generalStorage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit for result files
  },
  fileFilter: (req, file, cb) => {
    // Log the incoming file for debugging
    console.log('📁 Incoming file details:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

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
      console.log(`❌ File type rejected: ${file.mimetype}`);
      cb(new Error(`File type not allowed: ${file.mimetype}. Supported formats: Images, Documents, Videos, Audio files`), false);
    }
  }
});

// Helper functions for file operations
const deleteCloudinaryFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`🗑️ Deleted file from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    console.error(`❌ Error deleting file from Cloudinary: ${publicId}`, error);
    throw error;
  }
};

const getCloudinaryFileInfo = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    return result;
  } catch (error) {
    console.error(`❌ Error getting file info from Cloudinary: ${publicId}`, error);
    throw error;
  }
};

// Generate optimized URLs for different use cases
const generateOptimizedUrl = (publicId, options = {}) => {
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
    dpr: 'auto'
  });
};

// Generate thumbnail URLs
const generateThumbnail = (publicId, size = 150) => {
  return generateOptimizedUrl(publicId, {
    width: size,
    height: size,
    crop: 'thumb',
    gravity: 'face'
  });
};

module.exports = {
  cloudinary,
  verifyCloudinaryConfig,
  
  // Upload middleware
  imageUpload,
  documentUpload,
  videoUpload,
  audioUpload,
  generalUpload,
  resultFileUpload,
  idDocumentUpload,
  resumeUpload,
  
  // Helper functions
  deleteCloudinaryFile,
  getCloudinaryFileInfo,
  generateOptimizedUrl,
  generateThumbnail,
  
  // Storage instances (for custom configurations)
  imageStorage,
  documentStorage,
  videoStorage,
  audioStorage,
  generalStorage,
  idDocumentStorage,
  resumeStorage
};