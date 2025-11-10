require('dotenv').config();
const { cloudinary, deleteCloudinaryFile, getCloudinaryFileInfo } = require('./config/cloudinary');

// Test Cloudinary connection and configuration
const testCloudinaryConnection = async () => {
  console.log('🔧 Testing Cloudinary Configuration...\n');

  try {
    // Test 1: Basic configuration check
    console.log('1. Configuration Check:');
    console.log(`   Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME || '❌ Missing'}`);
    console.log(`   API Key: ${process.env.CLOUDINARY_API_KEY ? '✅ Present' : '❌ Missing'}`);
    console.log(`   API Secret: ${process.env.CLOUDINARY_API_SECRET ? '✅ Present' : '❌ Missing'}\n`);

    // Test 2: API connectivity
    console.log('2. API Connectivity Test:');
    const usage = await cloudinary.api.usage();
    console.log('   ✅ Successfully connected to Cloudinary API');
    console.log(`   📊 Current Usage:`);
    console.log(`      Storage: ${(usage.storage.used_bytes / 1024 / 1024).toFixed(2)} MB used`);
    console.log(`      Bandwidth: ${(usage.bandwidth.used_bytes / 1024 / 1024).toFixed(2)} MB used`);
    console.log(`      Resources: ${usage.resources} files stored\n`);

    // Test 3: Upload capabilities test (using a simple text file)
    console.log('3. Upload Test:');
    const testUpload = await cloudinary.uploader.upload('data:text/plain;base64,SGVsbG8gRGVlcCBUZWNoIFRlc3Q=', {
      public_id: 'test_upload_' + Date.now(),
      resource_type: 'raw',
      folder: 'dtuser_uploads/test'
    });
    
    console.log('   ✅ Test upload successful');
    console.log(`   📁 Public ID: ${testUpload.public_id}`);
    console.log(`   🔗 URL: ${testUpload.secure_url}\n`);

    // Test 4: File info retrieval
    console.log('4. File Info Test:');
    const fileInfo = await getCloudinaryFileInfo(testUpload.public_id);
    console.log('   ✅ File info retrieval successful');
    console.log(`   📝 Format: ${fileInfo.format}`);
    console.log(`   📏 Size: ${fileInfo.bytes} bytes\n`);

    // Test 5: File deletion
    console.log('5. File Deletion Test:');
    const deleteResult = await deleteCloudinaryFile(testUpload.public_id);
    console.log('   ✅ File deletion successful');
    console.log(`   🗑️ Result: ${deleteResult.result}\n`);

    // Test 6: Upload folders and organization
    console.log('6. Folder Structure Test:');
    const folderTest = await cloudinary.api.sub_folders('dtuser_uploads');
    console.log('   ✅ Folder structure accessible');
    console.log(`   📂 Available folders: ${folderTest.folders.map(f => f.name).join(', ') || 'None yet'}\n`);

    console.log('🎉 All Cloudinary tests passed! Media upload system is ready.\n');
    
    console.log('📋 Available Endpoints:');
    console.log('   POST /api/media/upload/image - Upload single image');
    console.log('   POST /api/media/upload/images - Upload multiple images');
    console.log('   POST /api/media/upload/profile-picture - Update profile picture');
    console.log('   POST /api/media/upload/document - Upload document');
    console.log('   POST /api/media/upload/video - Upload video');
    console.log('   POST /api/media/upload/audio - Upload audio');
    console.log('   POST /api/media/upload/file - Upload general file');
    console.log('   GET /api/media/file/:publicId - Get file info');
    console.log('   DELETE /api/media/file/:publicId - Delete file');
    console.log('   GET /api/media/health - Service health check\n');

    return true;

  } catch (error) {
    console.error('❌ Cloudinary test failed:', error.message || error);
    
    const errorMessage = error.message || '';
    if (errorMessage.includes('Invalid API key')) {
      console.log('💡 Solution: Check your CLOUDINARY_API_KEY in .env file');
    } else if (errorMessage.includes('Invalid cloud name')) {
      console.log('💡 Solution: Check your CLOUDINARY_CLOUD_NAME in .env file');
    } else if (errorMessage.includes('Invalid API secret')) {
      console.log('💡 Solution: Check your CLOUDINARY_API_SECRET in .env file');
    }
    
    return false;
  }
};

// Run the test if this file is executed directly
if (require.main === module) {
  testCloudinaryConnection()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { testCloudinaryConnection };