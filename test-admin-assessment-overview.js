const axios = require('axios');

// Test Admin Assessment Overview Endpoint
async function testAdminAssessmentOverview() {
  const BASE_URL = 'http://localhost:5000';
  
  console.log('🔍 Testing Admin Assessment Overview Endpoint\n');

  try {
    console.log('📊 GET /api/assessments/admin/overview');
    console.log('🔑 Admin authentication required\n');
    
    const response = await axios.get(
      `${BASE_URL}/api/assessments/admin/overview`,
      {
        headers: {
          'Authorization': 'Bearer YOUR_ADMIN_TOKEN_HERE',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Response Status:', response.status);
    console.log('📋 Assessment Overview Data:');
    
    if (response.data.success) {
      const { assessments, statistics } = response.data.data;
      
      console.log('\n📊 Overall Statistics:');
      console.log(JSON.stringify(statistics, null, 2));
      
      console.log('\n📋 Individual Assessments:');
      assessments.forEach((assessment, index) => {
        console.log(`\n${index + 1}. ${assessment.title}`);
        console.log(`   ID: ${assessment.id}`);
        console.log(`   Type: ${assessment.type}`);
        console.log(`   Total Submissions: ${assessment.totalSubmissions}`);
        console.log(`   Pending Review: ${assessment.pendingReview}`);
        console.log(`   Approved: ${assessment.approvedSubmissions}`);
        console.log(`   Rejected: ${assessment.rejectedSubmissions}`);
        console.log(`   Average Score: ${assessment.averageScore}`);
        console.log(`   Passing Score: ${assessment.passingScore}`);
        console.log(`   Completion Rate: ${assessment.completionRate}%`);
        console.log(`   Avg Completion Time: ${Math.round(assessment.averageCompletionTime / 60000)} minutes`);
        console.log(`   Active: ${assessment.isActive}`);
        console.log(`   Last Submission: ${assessment.lastSubmissionAt || 'None'}`);
        
        if (assessment.projectInfo) {
          console.log(`   Project: ${assessment.projectInfo.name} (${assessment.projectInfo.category})`);
        }
      });
      
      console.log('\n🎯 Frontend Integration Example:');
      console.log('This data structure matches your mockAssessments format exactly!');
      
    } else {
      console.log('❌ Request failed:', response.data.message);
    }

  } catch (error) {
    console.error('❌ Error testing endpoint:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      details: error.response?.data
    });
    
    if (error.response?.status === 401) {
      console.log('\n📝 Note: Replace YOUR_ADMIN_TOKEN_HERE with a valid admin JWT token');
      console.log('💡 Admin tokens should have admin: true in the JWT payload');
    }
  }
}

// Show expected response structure
function showExpectedResponse() {
  console.log('\n📋 Expected Response Structure:\n');
  
  console.log(`{
  "success": true,
  "message": "Assessment overview retrieved successfully",
  "data": {
    "assessments": [
      {
        "id": "english_proficiency",
        "title": "English Proficiency Assessment",
        "description": "Evaluate English language skills including grammar, vocabulary, and comprehension.",
        "type": "english_proficiency",
        "totalSubmissions": 128,
        "pendingReview": 0,
        "approvedSubmissions": 98,
        "rejectedSubmissions": 30,
        "averageScore": 8.2,
        "passingScore": 60,
        "completionRate": 76.6,
        "averageCompletionTime": 1800000,
        "createdAt": "2023-12-01T08:00:00Z",
        "isActive": true,
        "lastSubmissionAt": "2024-01-14T16:20:00Z"
      },
      {
        "id": "multimedia_assessment_id",
        "title": "Multimedia Assessment",
        "description": "Create engaging conversations from Instagram-style video reels",
        "type": "multimedia",
        "totalSubmissions": 45,
        "pendingReview": 8,
        "approvedSubmissions": 32,
        "rejectedSubmissions": 5,
        "averageScore": 7.8,
        "passingScore": 70,
        "completionRate": 82.2,
        "averageCompletionTime": 2730000,
        "createdAt": "2024-01-01T10:00:00Z",
        "isActive": true,
        "lastSubmissionAt": "2024-01-15T14:30:00Z",
        "projectInfo": {
          "id": "project_id",
          "name": "Video Annotation Project",
          "category": "E-commerce"
        }
      }
    ],
    "statistics": {
      "totalAssessments": 2,
      "activeAssessments": 2,
      "totalSubmissions": 173,
      "totalPendingReview": 8,
      "totalApproved": 130,
      "totalRejected": 35,
      "averageCompletionRate": 79.4
    }
  }
}`);

  console.log('\n🔧 Frontend Integration:');
  console.log(`
// Replace your mock data with real API call
const fetchAssessments = async () => {
  try {
    const response = await fetch('/api/assessments/admin/overview', {
      headers: {
        'Authorization': \`Bearer \${adminToken}\`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    if (data.success) {
      setAssessments(data.data.assessments);
      setStatistics(data.data.statistics);
    }
  } catch (error) {
    console.error('Failed to fetch assessments:', error);
  }
};`);

  console.log('\n📊 Key Differences from Mock Data:');
  console.log('✅ Real submission counts from database');
  console.log('✅ Actual average scores and completion rates');
  console.log('✅ Real timestamps and activity status');
  console.log('✅ Project information for multimedia assessments');
  console.log('✅ Pending review counts (multimedia only, English is auto-graded)');
}

// Show curl command examples
function showCurlExamples() {
  console.log('\n🌐 cURL Examples:\n');
  
  console.log('1. Basic Overview Request:');
  console.log('curl -X GET "http://localhost:5000/api/assessments/admin/overview" \\');
  console.log('  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\');
  console.log('  -H "Content-Type: application/json"\n');
  
  console.log('2. With Response Formatting:');
  console.log('curl -X GET "http://localhost:5000/api/assessments/admin/overview" \\');
  console.log('  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\');
  console.log('  -H "Content-Type: application/json" | jq\n');
}

// Main execution
if (require.main === module) {
  console.log('🎯 Admin Assessment Overview API Test\n');
  console.log('This endpoint provides assessment statistics matching your frontend structure.\n');
  
  showExpectedResponse();
  showCurlExamples();
  
  console.log('\n🚀 To test with real data:');
  console.log('1. Update YOUR_ADMIN_TOKEN_HERE in the code');
  console.log('2. Uncomment the line below and run the test');
  console.log('// testAdminAssessmentOverview();\n');
  
  // Uncomment to run actual test (update token first):
  // testAdminAssessmentOverview();
}

module.exports = { testAdminAssessmentOverview, showExpectedResponse, showCurlExamples };