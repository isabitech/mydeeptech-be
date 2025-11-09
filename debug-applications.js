const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test credentials
const ADMIN_CREDENTIALS = {
    email: 'kolatunde@mydeeptech.ng',
    password: '@Coolguy001'
};

const DTUSER_CREDENTIALS = {
    email: 'dammy22@mailinator.com',
    password: '@Coolguy001'
};

async function debugApplicationData() {
    try {
        console.log('🔍 Debugging Application Data\n');

        // Admin login to check applications
        console.log('🔐 Admin Authentication...');
        const adminLogin = await axios.post(`${BASE_URL}/admin/login`, ADMIN_CREDENTIALS);
        const adminToken = adminLogin.data.token || adminLogin.data._usrinfo?.data;
        console.log('✅ Admin authenticated\n');

        // Get all applications
        console.log('📋 Getting all applications...');
        const applicationsResponse = await axios.get(`${BASE_URL}/admin/applications`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        const applications = applicationsResponse.data.data?.applications || [];
        console.log(`Found ${applications.length} total applications\n`);

        // Filter applications for our test user
        const userApplications = applications.filter(app => 
            app.applicantId?.email === DTUSER_CREDENTIALS.email
        );

        console.log(`📊 Applications for ${DTUSER_CREDENTIALS.email}:`);
        console.log(`   Total applications: ${userApplications.length}`);

        const statusCounts = userApplications.reduce((acc, app) => {
            acc[app.status] = (acc[app.status] || 0) + 1;
            return acc;
        }, {});

        console.log('   Status breakdown:', statusCounts);

        userApplications.forEach((app, index) => {
            console.log(`   ${index + 1}. Project: "${app.projectId?.projectName || 'Unknown'}" - Status: ${app.status} - Applied: ${new Date(app.appliedAt).toDateString()}`);
        });

        // Now test user view
        console.log('\n👤 Testing user view...');
        const userLogin = await axios.post(`${BASE_URL}/auth/dtUserLogin`, DTUSER_CREDENTIALS);
        const userToken = userLogin.data.token;
        
        // Test applied projects view
        const userProjectsResponse = await axios.get(`${BASE_URL}/auth/projects?view=applied&limit=10`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });

        console.log('\n🔍 User view results:');
        console.log(`   Projects returned: ${userProjectsResponse.data.data.projects.length}`);
        userProjectsResponse.data.data.projects.forEach((project, index) => {
            console.log(`   ${index + 1}. "${project.projectName}" - Has Applied: ${project.hasApplied} - User App Status: ${project.userApplication?.status || 'none'}`);
        });

        // Test with specific status
        console.log('\n🎯 Testing status=approved filter...');
        const approvedResponse = await axios.get(`${BASE_URL}/auth/projects?view=applied&status=approved&limit=10`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        console.log(`   Approved projects: ${approvedResponse.data.data.projects.length}`);

    } catch (error) {
        console.error('❌ Debug failed:', error.response?.data?.message || error.message);
        if (error.response?.data) {
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

debugApplicationData();