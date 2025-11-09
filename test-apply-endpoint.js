const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test the projects apply endpoint with the specific user
const TEST_USER = {
    email: 'damilolamiraclek@gmail.com',
    password: '@Coolguy001'
};

const PROJECT_ID = '6910dbbb9410dbfa4798dfe6'; // From user's request

async function testApplyToProject() {
    try {
        console.log('🧪 TESTING /api/auth/projects/:projectId/apply ENDPOINT');
        console.log('=====================================================\n');

        // Step 1: Login as the DTUser
        console.log(`🔐 Step 1: Logging in as ${TEST_USER.email}...`);
        
        const loginResponse = await axios.post(`${BASE_URL}/auth/dtUserLogin`, TEST_USER);
        const token = loginResponse.data.token || loginResponse.data._usrinfo?.data;
        
        console.log('✅ Login successful');
        console.log('User info:', {
            fullName: loginResponse.data.user?.fullName,
            email: loginResponse.data.user?.email,
            annotatorStatus: loginResponse.data.user?.annotatorStatus
        });
        console.log('');

        if (!token) {
            console.log('❌ No token received, cannot proceed');
            return;
        }

        // Step 2: Try to apply to the project
        console.log(`📝 Step 2: Applying to project ${PROJECT_ID}...`);
        
        const applicationData = {
            coverLetter: 'I am interested in contributing to this annotation project. I have experience in data annotation and would like to participate.',
            availability: 'part_time',
            estimatedCompletionTime: '2 weeks'
        };

        const applyResponse = await axios.post(`${BASE_URL}/auth/projects/${PROJECT_ID}/apply`, applicationData, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Application submitted successfully!');
        console.log('Application details:', {
            success: applyResponse.data.success,
            message: applyResponse.data.message,
            applicationId: applyResponse.data.data?.application?._id,
            status: applyResponse.data.data?.application?.status,
            projectName: applyResponse.data.data?.application?.projectId?.projectName
        });

    } catch (error) {
        if (error.response?.status === 403) {
            console.log('❌ Access denied (403)');
            console.log('Error message:', error.response.data.message);
        } else if (error.response?.status === 401) {
            console.log('❌ Authentication failed (401)');
            console.log('Error message:', error.response.data.message);
        } else if (error.response?.status === 400) {
            console.log('⚠️ Application issue (400)');
            console.log('Error message:', error.response.data.message);
        } else if (error.response?.status === 404) {
            console.log('❌ Project not found (404)');
            console.log('Error message:', error.response.data.message);
        } else {
            console.log('❌ Other error:', error.response?.data?.message || error.message);
        }
        
        if (error.response?.data) {
            console.log('Full error response:', error.response.data);
        }
    }
}

testApplyToProject();