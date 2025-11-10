require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Test the result submission endpoint with file upload
const testResultSubmission = async () => {
  console.log('🧪 Testing Result File Upload with Cloudinary Storage\n');

  const baseURL = 'http://localhost:5000/api/auth';
  let userToken = null;

  try {
    // Step 1: Login as DTUser to get token
    console.log('🔐 Step 1: Authenticating DTUser...');
    const loginResponse = await axios.post(`${baseURL}/dtUserLogin`, {
      email: 'test@example.com', // Replace with actual test user email
      password: 'password123'     // Replace with actual test user password
    });

    if (loginResponse.data.success) {
      userToken = loginResponse.data.data.token;
      console.log('✅ DTUser authenticated successfully\n');
    } else {
      console.log('❌ DTUser authentication failed:', loginResponse.data.message);
      console.log('💡 Please ensure you have a test DTUser account created\n');
      return false;
    }

    // Step 2: Create a test file for upload
    console.log('� Step 2: Creating test file...');
    const testFilePath = path.join(__dirname, 'test-result-image.txt');
    const testFileContent = `Test Result Submission
Date: ${new Date().toISOString()}
User: Test User
Project: Sample Project
Notes: This is a test result file for validation.
Status: Completed Successfully
`;

    // Write test file
    fs.writeFileSync(testFilePath, testFileContent);
    console.log('✅ Test file created successfully\n');

    // Step 3: Test result file upload
    console.log('📤 Step 3: Uploading result file to Cloudinary...');
    
    const formData = new FormData();
    formData.append('resultFile', fs.createReadStream(testFilePath));
    formData.append('notes', 'Test result submission via API with file upload');
    // Optional: formData.append('projectId', 'some-project-id');

    const submitResultResponse = await axios.post(`${baseURL}/submit-result`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${userToken}`
      }
    });

    if (submitResultResponse.data.success) {
      console.log('✅ Result file uploaded successfully!');
      console.log('📋 Upload Details:');
      console.log(`   Original File Name: ${submitResultResponse.data.data.resultSubmission.originalFileName}`);
      console.log(`   Cloudinary URL: ${submitResultResponse.data.data.resultSubmission.cloudinaryUrl}`);
      console.log(`   File Size: ${submitResultResponse.data.data.resultSubmission.fileSize} bytes`);
      console.log(`   File Format: ${submitResultResponse.data.data.resultSubmission.fileFormat}`);
      console.log(`   Submission Date: ${submitResultResponse.data.data.resultSubmission.submissionDate}`);
      console.log(`   Status: ${submitResultResponse.data.data.resultSubmission.status}`);
      console.log(`   Total Submissions: ${submitResultResponse.data.data.totalResultSubmissions}`);
      console.log(`   Updated Profile resultLink: ${submitResultResponse.data.data.updatedResultLink}\n`);
    } else {
      console.log('❌ Result file upload failed:', submitResultResponse.data.message);
      return false;
    }

    // Step 4: Test getting all result submissions
    console.log('📋 Step 4: Retrieving result submissions...');
    const getSubmissionsResponse = await axios.get(`${baseURL}/result-submissions?page=1&limit=5`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });

    if (getSubmissionsResponse.data.success) {
      console.log('✅ Result submissions retrieved successfully!');
      const submissions = getSubmissionsResponse.data.data.submissions;
      const stats = getSubmissionsResponse.data.data.statistics;
      
      console.log('📊 Statistics:');
      console.log(`   Total Submissions: ${stats.total}`);
      console.log(`   Successfully Stored: ${stats.stored}`);
      console.log(`   Failed: ${stats.failed}`);
      console.log(`   Pending: ${stats.pending}\n`);

      console.log('📄 Recent Submissions:');
      submissions.slice(0, 3).forEach((submission, index) => {
        console.log(`   ${index + 1}. ${submission.cloudinaryData.originalName}`);
        console.log(`      Cloudinary URL: ${submission.cloudinaryData.url}`);
        console.log(`      File Size: ${submission.cloudinaryData.size} bytes`);
        console.log(`      Status: ${submission.status}`);
        console.log(`      Upload Method: ${submission.uploadMethod || 'direct_upload'}`);
        console.log(`      Date: ${new Date(submission.submissionDate).toLocaleString()}\n`);
      });
    } else {
      console.log('❌ Failed to retrieve submissions:', getSubmissionsResponse.data.message);
      return false;
    }

    // Step 5: Test with missing file
    console.log('🚫 Step 5: Testing with missing file...');
    try {
      const emptyFormData = new FormData();
      emptyFormData.append('notes', 'This should fail - no file attached');

      const noFileResponse = await axios.post(`${baseURL}/submit-result`, emptyFormData, {
        headers: {
          ...emptyFormData.getHeaders(),
          'Authorization': `Bearer ${userToken}`
        }
      });
    } catch (error) {
      if (error.response && error.response.data) {
        console.log('✅ Validation working correctly - rejected missing file');
        console.log(`   Error message: ${error.response.data.message}\n`);
      }
    }

    // Step 6: Test filtering by status
    console.log('🔍 Step 6: Testing status filtering...');
    const filteredResponse = await axios.get(`${baseURL}/result-submissions?status=stored&limit=3`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });

    if (filteredResponse.data.success) {
      console.log('✅ Status filtering working correctly');
      console.log(`   Found ${filteredResponse.data.data.submissions.length} stored submissions\n`);
    }

    // Cleanup: Remove test file
    fs.unlinkSync(testFilePath);
    console.log('🧹 Test file cleaned up\n');

    console.log('🎉 All tests passed! Result file upload system is working correctly.\n');

    console.log('📋 API Endpoints Available:');
    console.log('   POST /api/auth/submit-result - Upload result file to Cloudinary (multipart/form-data)');
    console.log('     - Field name: "resultFile" (file)');
    console.log('     - Optional fields: "notes" (text), "projectId" (text)');
    console.log('   GET /api/auth/result-submissions - Get all user result submissions');
    console.log('   GET /api/auth/result-submissions?status=stored - Filter by status');
    console.log('   GET /api/auth/result-submissions?page=1&limit=10 - Pagination support\n');

    return true;

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the server is running on http://localhost:5000');
    } else if (error.response?.status === 401) {
      console.log('💡 Authentication failed - check login credentials');
    } else if (error.response?.status === 404) {
      console.log('💡 Endpoint not found - check if routes are properly set up');
    }
    
    // Cleanup test file if it exists
    const testFilePath = path.join(__dirname, 'test-result-image.txt');
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    
    return false;
  }
};

// Test with different file types
const testMultipleFileUploads = async () => {
  console.log('🧪 Testing Multiple File Type Uploads\n');

  // First login to get token
  try {
    const loginResponse = await axios.post('http://localhost:5000/api/auth/dtUserLogin', {
      email: 'test@example.com',
      password: 'password123'
    });

    if (!loginResponse.data.success) {
      console.log('❌ Login failed for multiple files test');
      return;
    }

    const userToken = loginResponse.data.data.token;

    // Create different test files
    const testFiles = [
      {
        name: 'test-result-1.txt',
        content: 'Text result file content for testing'
      },
      {
        name: 'test-result-2.json',
        content: JSON.stringify({ result: 'success', data: { score: 95, accuracy: 0.92 } }, null, 2)
      },
      {
        name: 'test-result-3.csv',
        content: 'id,name,score\n1,Test1,85\n2,Test2,92\n3,Test3,78'
      }
    ];

    // Upload each file
    for (let i = 0; i < testFiles.length; i++) {
      const file = testFiles[i];
      const filePath = path.join(__dirname, file.name);
      
      console.log(`📤 Uploading file ${i + 1}/${testFiles.length}: ${file.name}...`);
      
      // Create file
      fs.writeFileSync(filePath, file.content);
      
      // Upload file
      const formData = new FormData();
      formData.append('resultFile', fs.createReadStream(filePath));
      formData.append('notes', `Test upload for ${file.name}`);

      try {
        const response = await axios.post('http://localhost:5000/api/auth/submit-result', formData, {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${userToken}`
          }
        });

        if (response.data.success) {
          console.log(`✅ ${file.name} uploaded successfully`);
          console.log(`   Cloudinary URL: ${response.data.data.resultSubmission.cloudinaryUrl}`);
        } else {
          console.log(`❌ ${file.name} upload failed: ${response.data.message}`);
        }
      } catch (error) {
        console.log(`❌ ${file.name} upload error: ${error.response?.data?.message || error.message}`);
      }

      // Cleanup file
      fs.unlinkSync(filePath);
    }

    console.log('\n🎉 Multiple file upload test completed!');

  } catch (error) {
    console.error('❌ Multiple files test failed:', error.message);
  }
};

// Run the tests
if (require.main === module) {
  testResultSubmission()
    .then(success => {
      if (success) {
        console.log('🚀 Consider running additional tests with testMultipleResults()');
      }
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error);
    });
}

module.exports = { testResultSubmission, testMultipleResults };