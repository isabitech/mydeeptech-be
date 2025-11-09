const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test the projects endpoint with the specific user
const TEST_USER = {
    email: 'damilolamiraclek@gmail.com',
    password: '@Coolguy001' // Try common password
};

async function testProjectsEndpoint() {
    try {
        console.log('🧪 TESTING /api/auth/projects ENDPOINT');
        console.log('=====================================\n');

        // Step 1: Login as the DTUser
        console.log(`🔐 Step 1: Logging in as ${TEST_USER.email}...`);
        
        const loginResponse = await axios.post(`${BASE_URL}/auth/dtUserLogin`, TEST_USER);
        const token = loginResponse.data.token || loginResponse.data._usrinfo?.data;
        
        console.log('✅ Login successful');
        console.log('Token received:', token ? 'Yes ✅' : 'No ❌');
        console.log('Full login response:', JSON.stringify(loginResponse.data, null, 2));
        console.log('');

        if (!token) {
            console.log('❌ No token received, cannot proceed');
            return;
        }

        // Step 2: Try to access projects endpoint
        console.log('🏗️ Step 2: Accessing projects endpoint...');
        
        const projectsResponse = await axios.get(`${BASE_URL}/auth/projects`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Projects endpoint accessible!');
        console.log('Response data:', {
            success: projectsResponse.data.success,
            message: projectsResponse.data.message,
            projectCount: projectsResponse.data.data?.projects?.length || 0,
            totalProjects: projectsResponse.data.data?.pagination?.totalProjects || 0
        });

    } catch (error) {
        if (error.response?.status === 403) {
            console.log('❌ Access denied (403)');
            console.log('Error message:', error.response.data.message);
            console.log('User status check failed');
        } else if (error.response?.status === 401) {
            console.log('❌ Authentication failed (401)');
            console.log('Error message:', error.response.data.message);
        } else {
            console.log('❌ Other error:', error.response?.data?.message || error.message);
        }
        
        if (error.response?.data) {
            console.log('Full error response:', error.response.data);
        }
    }
}

testProjectsEndpoint();