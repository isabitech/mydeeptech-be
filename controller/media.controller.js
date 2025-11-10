const { 
  deleteCloudinaryFile, 
  getCloudinaryFileInfo, 
  generateOptimizedUrl, 
  generateThumbnail 
} = require('../config/cloudinary');
const DTUser = require('../models/dtUser.model');
const AnnotationProject = require('../models/annotationProject.model');

// Upload single image
const uploadImage = async (req, res) => {
  try {
    console.log(`📷 User uploading image: ${req.user?.email || 'Unknown'}`);
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const fileData = {
      publicId: req.file.filename,
      url: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      format: req.file.format,
      resourceType: req.file.resource_type,
      thumbnail: generateThumbnail(req.file.filename),
      optimizedUrl: generateOptimizedUrl(req.file.filename, { width: 800, height: 600 })
    };

    console.log(`✅ Image uploaded successfully: ${req.file.filename}`);

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        file: fileData,
        uploadedAt: new Date(),
        uploadedBy: req.user?.userId || null
      }
    });

  } catch (error) {
    console.error('❌ Error uploading image:', error);
    res.status(500).json({
      success: false,
      message: 'Server error uploading image',
      error: error.message
    });
  }
};

// Upload multiple images
const uploadMultipleImages = async (req, res) => {
  try {
    console.log(`📷 User uploading ${req.files?.length || 0} images: ${req.user?.email || 'Unknown'}`);
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image files provided'
      });
    }

    const filesData = req.files.map(file => ({
      publicId: file.filename,
      url: file.path,
      originalName: file.originalname,
      size: file.size,
      format: file.format,
      resourceType: file.resource_type,
      thumbnail: generateThumbnail(file.filename),
      optimizedUrl: generateOptimizedUrl(file.filename, { width: 800, height: 600 })
    }));

    console.log(`✅ ${req.files.length} images uploaded successfully`);

    res.status(200).json({
      success: true,
      message: `${req.files.length} images uploaded successfully`,
      data: {
        files: filesData,
        uploadedAt: new Date(),
        uploadedBy: req.user?.userId || null,
        totalFiles: req.files.length
      }
    });

  } catch (error) {
    console.error('❌ Error uploading multiple images:', error);
    res.status(500).json({
      success: false,
      message: 'Server error uploading images',
      error: error.message
    });
  }
};

// Upload document
const uploadDocument = async (req, res) => {
  try {
    console.log(`📄 User uploading document: ${req.user?.email || 'Unknown'}`);
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document file provided'
      });
    }

    const fileData = {
      publicId: req.file.filename,
      url: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      format: req.file.format,
      resourceType: req.file.resource_type,
      pages: req.file.pages || null // For PDFs
    };

    console.log(`✅ Document uploaded successfully: ${req.file.filename}`);

    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        file: fileData,
        uploadedAt: new Date(),
        uploadedBy: req.user?.userId || null
      }
    });

  } catch (error) {
    console.error('❌ Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: 'Server error uploading document',
      error: error.message
    });
  }
};

// Upload video
const uploadVideo = async (req, res) => {
  try {
    console.log(`🎥 User uploading video: ${req.user?.email || 'Unknown'}`);
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file provided'
      });
    }

    const fileData = {
      publicId: req.file.filename,
      url: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      format: req.file.format,
      resourceType: req.file.resource_type,
      duration: req.file.duration || null,
      thumbnail: generateThumbnail(req.file.filename), // Video thumbnail
      streamingUrl: generateOptimizedUrl(req.file.filename, { 
        resource_type: 'video',
        format: 'mp4',
        quality: 'auto'
      })
    };

    console.log(`✅ Video uploaded successfully: ${req.file.filename}`);

    res.status(200).json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        file: fileData,
        uploadedAt: new Date(),
        uploadedBy: req.user?.userId || null
      }
    });

  } catch (error) {
    console.error('❌ Error uploading video:', error);
    res.status(500).json({
      success: false,
      message: 'Server error uploading video',
      error: error.message
    });
  }
};

// Upload audio
const uploadAudio = async (req, res) => {
  try {
    console.log(`🎵 User uploading audio: ${req.user?.email || 'Unknown'}`);
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No audio file provided'
      });
    }

    const fileData = {
      publicId: req.file.filename,
      url: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      format: req.file.format,
      resourceType: req.file.resource_type,
      duration: req.file.duration || null,
      streamingUrl: generateOptimizedUrl(req.file.filename, { 
        resource_type: 'video', // Audio files use video resource type in Cloudinary
        format: 'mp3',
        quality: 'auto'
      })
    };

    console.log(`✅ Audio uploaded successfully: ${req.file.filename}`);

    res.status(200).json({
      success: true,
      message: 'Audio uploaded successfully',
      data: {
        file: fileData,
        uploadedAt: new Date(),
        uploadedBy: req.user?.userId || null
      }
    });

  } catch (error) {
    console.error('❌ Error uploading audio:', error);
    res.status(500).json({
      success: false,
      message: 'Server error uploading audio',
      error: error.message
    });
  }
};

// Upload general file
const uploadFile = async (req, res) => {
  try {
    console.log(`📁 User uploading file: ${req.user?.email || 'Unknown'}`);
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const fileData = {
      publicId: req.file.filename,
      url: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      format: req.file.format,
      resourceType: req.file.resource_type,
      mimeType: req.file.mimetype
    };

    // Add specific properties based on file type
    if (req.file.mimetype.startsWith('image/')) {
      fileData.thumbnail = generateThumbnail(req.file.filename);
      fileData.optimizedUrl = generateOptimizedUrl(req.file.filename);
    }

    if (req.file.mimetype.startsWith('video/') || req.file.mimetype.startsWith('audio/')) {
      fileData.duration = req.file.duration || null;
      fileData.streamingUrl = generateOptimizedUrl(req.file.filename, { 
        resource_type: 'video',
        quality: 'auto'
      });
    }

    console.log(`✅ File uploaded successfully: ${req.file.filename}`);

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        file: fileData,
        uploadedAt: new Date(),
        uploadedBy: req.user?.userId || null
      }
    });

  } catch (error) {
    console.error('❌ Error uploading file:', error);
    res.status(500).json({
      success: false,
      message: 'Server error uploading file',
      error: error.message
    });
  }
};

// Delete file
const deleteFile = async (req, res) => {
  try {
    const { publicId } = req.params;
    
    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required for file deletion'
      });
    }

    console.log(`🗑️ User ${req.user?.email || 'Unknown'} deleting file: ${publicId}`);

    // Delete from Cloudinary
    const result = await deleteCloudinaryFile(publicId);

    if (result.result === 'ok') {
      console.log(`✅ File deleted successfully: ${publicId}`);
      
      res.status(200).json({
        success: true,
        message: 'File deleted successfully',
        data: {
          publicId: publicId,
          deletedAt: new Date(),
          deletedBy: req.user?.userId || null
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to delete file',
        error: result
      });
    }

  } catch (error) {
    console.error('❌ Error deleting file:', error);
    
    if (error.http_code === 404) {
      return res.status(404).json({
        success: false,
        message: 'File not found on Cloudinary'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error deleting file',
      error: error.message
    });
  }
};

// Get file information
const getFileInfo = async (req, res) => {
  try {
    const { publicId } = req.params;
    
    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }

    console.log(`ℹ️ Getting file info: ${publicId}`);

    const fileInfo = await getCloudinaryFileInfo(publicId);
    
    const responseData = {
      publicId: fileInfo.public_id,
      url: fileInfo.secure_url,
      format: fileInfo.format,
      resourceType: fileInfo.resource_type,
      size: fileInfo.bytes,
      width: fileInfo.width,
      height: fileInfo.height,
      createdAt: fileInfo.created_at,
      version: fileInfo.version,
      etag: fileInfo.etag
    };

    // Add type-specific data
    if (fileInfo.resource_type === 'video') {
      responseData.duration = fileInfo.duration;
      responseData.bitRate = fileInfo.bit_rate;
      responseData.frameRate = fileInfo.frame_rate;
    }

    if (fileInfo.pages) {
      responseData.pages = fileInfo.pages;
    }

    res.status(200).json({
      success: true,
      message: 'File information retrieved successfully',
      data: responseData
    });

  } catch (error) {
    console.error('❌ Error getting file info:', error);
    
    if (error.http_code === 404) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error getting file information',
      error: error.message
    });
  }
};

// Update DTUser profile picture
const updateProfilePicture = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    console.log(`👤 User ${req.user.email} updating profile picture`);

    // Get user and delete old profile picture if it exists
    const user = await DTUser.findById(userId);
    if (user && user.profilePicture && user.profilePicture.publicId) {
      try {
        await deleteCloudinaryFile(user.profilePicture.publicId);
        console.log(`🗑️ Deleted old profile picture: ${user.profilePicture.publicId}`);
      } catch (deleteError) {
        console.log(`⚠️ Could not delete old profile picture: ${deleteError.message}`);
      }
    }

    // Update user with new profile picture
    const profilePictureData = {
      publicId: req.file.filename,
      url: req.file.path,
      thumbnail: generateThumbnail(req.file.filename),
      optimizedUrl: generateOptimizedUrl(req.file.filename, { width: 300, height: 300 })
    };

    await DTUser.findByIdAndUpdate(userId, {
      profilePicture: profilePictureData,
      updatedAt: new Date()
    });

    console.log(`✅ Profile picture updated successfully for user: ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      data: {
        profilePicture: profilePictureData,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error updating profile picture:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating profile picture',
      error: error.message
    });
  }
};

module.exports = {
  uploadImage,
  uploadMultipleImages,
  uploadDocument,
  uploadVideo,
  uploadAudio,
  uploadFile,
  deleteFile,
  getFileInfo,
  updateProfilePicture
};