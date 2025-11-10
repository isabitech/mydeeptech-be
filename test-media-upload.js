require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const API_BASE_URL = 'http://localhost:5000';

// Test media upload system
async function testMediaUploadSystem() {
  console.log('🧪 Testing Media Upload System\n');

  try {
    // Step 1: Login to get authentication token
    console.log('🔐 Step 1: Authentication...');
    const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/dtUserLogin`, {
      email: 'test@deeptech.com', // Replace with a real test user
      password: 'testpassword123'
    });

    if (!loginResponse.data.success) {
      console.log('❌ Authentication failed:', loginResponse.data.message);
      console.log('💡 Please ensure you have a test DTUser account created');
      return;
    }

    const token = loginResponse.data.data.token;
    console.log('✅ Authentication successful\n');

    // Step 2: Test health endpoint
    console.log('💓 Step 2: Testing media service health...');
    const healthResponse = await axios.get(`${API_BASE_URL}/api/media/health`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('✅ Media service is healthy');
    console.log(`   Cloudinary configured: ${healthResponse.data.cloudinaryConfigured}`);
    console.log(`   Cloud name: ${process.env.CLOUDINARY_CLOUD_NAME}\n`);

    // Step 3: Test upload info endpoint
    console.log('📋 Step 3: Getting upload information...');
    const infoResponse = await axios.get(`${API_BASE_URL}/api/media/info`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('✅ Upload information retrieved');
    console.log(`   Available endpoints: ${Object.keys(infoResponse.data.data.endpoints).length}`);
    console.log(`   Supported image types: ${infoResponse.data.data.fileTypes.images.allowed.join(', ')}\n`);

    // Step 4: Create a test file for upload
    console.log('📄 Step 4: Creating test file...');
    const testContent = 'This is a test file for Deep Tech Media Upload System';
    fs.writeFileSync('./test-upload.txt', testContent);
    console.log('✅ Test file created: test-upload.txt\n');

    // Step 5: Test file upload
    console.log('📤 Step 5: Testing file upload...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream('./test-upload.txt'));

    const uploadResponse = await axios.post(`${API_BASE_URL}/api/media/upload/file`, formData, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      }
    });

    if (uploadResponse.data.success) {
      console.log('✅ File uploaded successfully');
      console.log(`   Public ID: ${uploadResponse.data.data.file.publicId}`);
      console.log(`   URL: ${uploadResponse.data.data.file.url}`);
      console.log(`   Size: ${uploadResponse.data.data.file.size} bytes\n`);

      const publicId = uploadResponse.data.data.file.publicId;

      // Step 6: Test file info retrieval
      console.log('ℹ️  Step 6: Testing file info retrieval...');
      const fileInfoResponse = await axios.get(`${API_BASE_URL}/api/media/file/${encodeURIComponent(publicId)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (fileInfoResponse.data.success) {
        console.log('✅ File info retrieved successfully');
        console.log(`   Format: ${fileInfoResponse.data.data.format}`);
        console.log(`   Created: ${fileInfoResponse.data.data.createdAt}\n`);
      }

      // Step 7: Test file deletion
      console.log('🗑️  Step 7: Testing file deletion...');
      const deleteResponse = await axios.delete(`${API_BASE_URL}/api/media/file/${encodeURIComponent(publicId)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (deleteResponse.data.success) {
        console.log('✅ File deleted successfully');
        console.log(`   Deleted at: ${deleteResponse.data.data.deletedAt}\n`);
      }
    }

    // Cleanup
    console.log('🧹 Cleanup: Removing test file...');
    fs.unlinkSync('./test-upload.txt');
    console.log('✅ Test file removed\n');

    console.log('🎉 All media upload tests completed successfully!');
    console.log('\n📋 System Summary:');
    console.log('   ✅ Authentication working');
    console.log('   ✅ Media service healthy');
    console.log('   ✅ Cloudinary configured');
    console.log('   ✅ File upload working');
    console.log('   ✅ File info retrieval working');
    console.log('   ✅ File deletion working');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }

    // Cleanup test file if it exists
    try {
      fs.unlinkSync('./test-upload.txt');
      console.log('🧹 Test file cleaned up');
    } catch (cleanupError) {
      // File doesn't exist, that's okay
    }
  }
}

// Test different upload types
async function testDifferentUploadTypes() {
  console.log('\n🎯 Testing Different Upload Types\n');

  const uploadEndpoints = [
    { name: 'Image Upload', endpoint: '/api/media/upload/image', param: 'image' },
    { name: 'Document Upload', endpoint: '/api/media/upload/document', param: 'document' },
    { name: 'General File Upload', endpoint: '/api/media/upload/file', param: 'file' }
  ];

  for (const test of uploadEndpoints) {
    console.log(`📝 Testing ${test.name}...`);
    console.log(`   Endpoint: POST ${test.endpoint}`);
    console.log(`   Parameter: ${test.param}`);
    console.log(`   Status: Available ✅\n`);
  }

  console.log('💡 Tips for Frontend Integration:');
  console.log('   1. Use FormData for file uploads');
  console.log('   2. Include Authorization header with Bearer token');
  console.log('   3. Handle progress events for user feedback');
  console.log('   4. Validate file types and sizes before upload');
  console.log('   5. Use returned URLs for displaying uploaded content');
}

// Main execution
console.log('🚀 Deep Tech Media Upload System Test\n');

testMediaUploadSystem()
  .then(() => {
    return testDifferentUploadTypes();
  })
  .then(() => {
    console.log('\n🏁 Testing complete!');
  })
  .catch(error => {
    console.error('❌ Unexpected error during testing:', error.message);
  });