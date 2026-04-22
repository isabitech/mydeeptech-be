const MediaService = require('../services/media.service');

const uploadImage = async (req, res) => {
  try {
    console.log(`📷 User uploading image: ${req.user?.email || 'Unknown'}`);
    const data = await MediaService.uploadSingle(req.file, req.user, 'image');
    console.log(`✅ Image uploaded successfully: ${req.file.filename}`);
    res.status(200).json({ success: true, message: 'Image uploaded successfully', data });
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Server error uploading image', error: error.message });
  }
};

const uploadMultipleImages = async (req, res) => {
  try {
    console.log(`📷 User uploading ${req.files?.length || 0} images: ${req.user?.email || 'Unknown'}`);
    const data = await MediaService.uploadMultiple(req.files, req.user);
    console.log(`✅ ${req.files.length} images uploaded successfully`);
    res.status(200).json({ success: true, message: `${req.files.length} images uploaded successfully`, data });
  } catch (error) {
    console.error('❌ Error uploading multiple images:', error);
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Server error uploading images', error: error.message });
  }
};

const uploadDocument = async (req, res) => {
  try {
    console.log(`📄 User uploading document: ${req.user?.email || 'Unknown'}`);
    const data = await MediaService.uploadSingle(req.file, req.user, 'document');
    console.log(`✅ Document uploaded successfully: ${req.file.filename}`);
    res.status(200).json({ success: true, message: 'Document uploaded successfully', data });
  } catch (error) {
    console.error('❌ Error uploading document:', error);
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Server error uploading document', error: error.message });
  }
};

const uploadVideo = async (req, res) => {
  try {
    console.log(`🎥 User uploading video: ${req.user?.email || 'Unknown'}`);
    const data = await MediaService.uploadSingle(req.file, req.user, 'video');
    console.log(`✅ Video uploaded successfully: ${req.file.filename}`);
    res.status(200).json({ success: true, message: 'Video uploaded successfully', data });
  } catch (error) {
    console.error('❌ Error uploading video:', error);
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Server error uploading video', error: error.message });
  }
};

const uploadAudio = async (req, res) => {
  try {
    console.log(`🎵 User uploading audio: ${req.user?.email || 'Unknown'}`);
    const data = await MediaService.uploadSingle(req.file, req.user, 'audio');
    console.log(`✅ Audio uploaded successfully: ${req.file.filename}`);
    res.status(200).json({ success: true, message: 'Audio uploaded successfully', data });
  } catch (error) {
    console.error('❌ Error uploading audio:', error);
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Server error uploading audio', error: error.message });
  }
};

const uploadFile = async (req, res) => {
  try {
    console.log(`📁 User uploading file: ${req.user?.email || 'Unknown'}`);
    const data = await MediaService.uploadSingle(req.file, req.user, 'file');
    console.log(`✅ File uploaded successfully: ${req.file.filename}`);
    res.status(200).json({ success: true, message: 'File uploaded successfully', data });
  } catch (error) {
    console.error('❌ Error uploading file:', error);
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Server error uploading file', error: error.message });
  }
};

const deleteFile = async (req, res) => {
  try {
    console.log(`🗑️ User ${req.user?.email || 'Unknown'} deleting file: ${req.params.publicId}`);
    const data = await MediaService.deleteFile(req.params.publicId, req.user);
    console.log(`✅ File deleted successfully: ${req.params.publicId}`);
    res.status(200).json({ success: true, message: 'File deleted successfully', data });
  } catch (error) {
    console.error('❌ Error deleting file:', error);
    if (error.http_code === 404) return res.status(404).json({ success: false, message: 'File not found on Cloudinary' });
    if (error.status) return res.status(error.status).json({ success: false, message: error.message, error: error.error });
    res.status(500).json({ success: false, message: 'Server error deleting file', error: error.message });
  }
};

const getFileInfo = async (req, res) => {
  try {
    console.log(`ℹ️ Getting file info: ${req.params.publicId}`);
    const data = await MediaService.getFileInfo(req.params.publicId);
    res.status(200).json({ success: true, message: 'File information retrieved successfully', data });
  } catch (error) {
    console.error('❌ Error getting file info:', error);
    if (error.http_code === 404) return res.status(404).json({ success: false, message: 'File not found' });
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Server error getting file information', error: error.message });
  }
};

const updateProfilePicture = async (req, res) => {
  try {
    console.log(`👤 User ${req.user.email} updating profile picture`);
    const data = await MediaService.updateProfilePicture(req.file, req.user.userId);
    console.log(`✅ Profile picture updated successfully for user: ${req.user.email}`);
    res.status(200).json({ success: true, message: 'Profile picture updated successfully', data });
  } catch (error) {
    console.error('❌ Error updating profile picture:', error);
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Server error updating profile picture', error: error.message });
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