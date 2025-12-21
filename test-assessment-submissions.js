const axios = require('axios');

// Test Assessment Submissions Endpoint
async function testAssessmentSubmissions() {
  const BASE_URL = 'http://localhost:3000';
  
  console.log('🧪 Testing Assessment Submissions Endpoint\n');

  try {
    // Test 1: English Proficiency Assessment Submissions
    console.log('📊 Test 1: English Proficiency Assessment Submissions');
    console.log('GET /api/assessments/english-proficiency/submissions');
    
    const englishResponse = await axios.get(
      `${BASE_URL}/api/assessments/english-proficiency/submissions`,
      {
        params: {
          page: 1,
          limit: 5
        },
        headers: {
          'Authorization': 'Bearer your-test-token-here',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ English Proficiency Response:', {
      status: englishResponse.status,
      assessmentInfo: englishResponse.data.data.assessment,
      submissionsCount: englishResponse.data.data.submissions?.length || 0,
      pagination: englishResponse.data.data.pagination,
      statistics: englishResponse.data.data.statistics
    });

    console.log('\n📊 Test 2: Multimedia Assessment Submissions (Mock ID)');
    console.log('GET /api/assessments/60f7b3b3b3b3b3b3b3b3b3b3/submissions');
    
    // Test 2: Multimedia Assessment Submissions (using a mock ObjectId)
    const multimediaResponse = await axios.get(
      `${BASE_URL}/api/assessments/60f7b3b3b3b3b3b3b3b3b3b3/submissions`,
      {
        params: {
          page: 1,
          limit: 5,
          status: 'submitted'
        },
        headers: {
          'Authorization': 'Bearer your-test-token-here',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Multimedia Assessment Response:', {
      status: multimediaResponse.status,
      assessmentInfo: multimediaResponse.data.data.assessment,
      submissionsCount: multimediaResponse.data.data.submissions?.length || 0,
      pagination: multimediaResponse.data.data.pagination,
      statistics: multimediaResponse.data.data.statistics
    });

  } catch (error) {
    console.error('❌ Error testing endpoint:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      endpoint: error.config?.url
    });
    
    if (error.response?.status === 401) {
      console.log('\n📝 Note: Update the Authorization token in the test script for proper testing');
    }
  }
}

// Test different query parameters
async function testWithParameters() {
  const BASE_URL = 'http://localhost:3000';
  
  console.log('\n🔍 Testing with different parameters\n');

  const testCases = [
    {
      name: 'Filter by passed status',
      params: { status: 'passed' }
    },
    {
      name: 'Filter by failed status', 
      params: { status: 'failed' }
    },
    {
      name: 'Sort by score descending',
      params: { sortBy: 'scorePercentage', sortOrder: 'desc' }
    },
    {
      name: 'Pagination - page 2',
      params: { page: 2, limit: 3 }
    }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`📊 ${testCase.name}:`, testCase.params);
      
      const response = await axios.get(
        `${BASE_URL}/api/assessments/english-proficiency/submissions`,
        {
          params: testCase.params,
          headers: {
            'Authorization': 'Bearer your-test-token-here',
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Response:', {
        submissionsCount: response.data.data.submissions?.length || 0,
        filters: response.data.data.filters
      });

    } catch (error) {
      console.error('❌ Error:', error.response?.data?.message || error.message);
    }
    console.log('');
  }
}

// Sample request examples
function showExampleRequests() {
  console.log('\n📋 Example API Requests:\n');
  
  console.log('1. Get English Proficiency Assessment Submissions:');
  console.log('GET /api/assessments/english-proficiency/submissions');
  console.log('Query params: ?page=1&limit=10&status=passed&sortBy=createdAt&sortOrder=desc\n');
  
  console.log('2. Get Multimedia Assessment Submissions:');
  console.log('GET /api/assessments/{multimedia_assessment_id}/submissions');
  console.log('Query params: ?page=1&limit=10&status=submitted&userId=user_id\n');
  
  console.log('3. Admin view all submissions for assessment:');
  console.log('GET /api/assessments/english-proficiency/submissions');
  console.log('Headers: Authorization: Bearer {admin_token}\n');
  
  console.log('4. User view their own submissions:');
  console.log('GET /api/assessments/{assessment_id}/submissions');
  console.log('Headers: Authorization: Bearer {user_token}\n');

  console.log('📊 Response Structure:');
  console.log(`{
  success: true,
  message: "Assessment submissions retrieved successfully",
  data: {
    assessment: {
      id: "assessment_id",
      type: "english_proficiency" | "multimedia_assessment", 
      title: "Assessment Title",
      description: "Assessment Description"
    },
    submissions: [
      {
        id: "submission_id",
        type: "english_proficiency" | "multimedia_assessment",
        user: {
          id: "user_id",
          fullName: "User Name", 
          email: "user@example.com",
          annotatorStatus: "approved",
          qaStatus: "approved"
        },
        submission: {
          scorePercentage: 85,
          passed: true,
          timeSpent: 1800,
          attemptNumber: 1,
          submittedAt: "2025-01-01T00:00:00.000Z"
        }
      }
    ],
    pagination: {
      currentPage: 1,
      totalPages: 3,
      totalCount: 25,
      hasNext: true,
      hasPrev: false
    },
    statistics: {
      total: 25,
      passed: 20,
      failed: 5,
      averageScore: 78.5
    }
  }
}`);
}

// Main execution
if (require.main === module) {
  showExampleRequests();
  // Uncomment to run actual tests (update token first):
  // testAssessmentSubmissions().then(() => testWithParameters());
}

module.exports = { testAssessmentSubmissions, testWithParameters, showExampleRequests };