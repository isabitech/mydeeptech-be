const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test credentials
const DTUSER_CREDENTIALS = {
    email: 'dammy22@mailinator.com',
    password: '@Coolguy001'
};

async function testProjectsEndpoint() {
    try {
        console.log('🧪 Testing Enhanced Projects Endpoint\n');

        // Step 1: DTUser Authentication
        console.log('🔐 Step 1: DTUser Authentication...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/dtUserLogin`, DTUSER_CREDENTIALS);
        const token = loginResponse.data.token;
        console.log('✅ DTUser authenticated successfully\n');

        const headers = { 'Authorization': `Bearer ${token}` };

        // Step 2: Test different views
        console.log('📋 Step 2: Testing different project views...\n');

        // Test view=available (default)
        console.log('1️⃣ Testing view=available...');
        const availableResponse = await axios.get(`${BASE_URL}/auth/projects?view=available&limit=5`, { headers });
        console.log(`✅ Available projects: ${availableResponse.data.data.projects.length} found`);
        console.log(`   Total: ${availableResponse.data.data.pagination.totalProjects}`);

        // Test view=applied
        console.log('\n2️⃣ Testing view=applied...');
        const appliedResponse = await axios.get(`${BASE_URL}/auth/projects?view=applied&limit=5`, { headers });
        console.log(`✅ Applied projects: ${appliedResponse.data.data.projects.length} found`);
        console.log(`   Total: ${appliedResponse.data.data.pagination.totalProjects}`);

        if (appliedResponse.data.data.projects.length > 0) {
            const firstProject = appliedResponse.data.data.projects[0];
            console.log(`   Example: "${firstProject.projectName}" - Status: ${firstProject.userApplication?.status || 'unknown'}`);
        }

        // Test view=applied with status=approved
        console.log('\n3️⃣ Testing view=applied&status=approved...');
        const approvedResponse = await axios.get(`${BASE_URL}/auth/projects?view=applied&status=approved&limit=5`, { headers });
        console.log(`✅ Approved applications: ${approvedResponse.data.data.projects.length} found`);

        // Test view=applied with status=rejected
        console.log('\n4️⃣ Testing view=applied&status=rejected...');
        const rejectedResponse = await axios.get(`${BASE_URL}/auth/projects?view=applied&status=rejected&limit=5`, { headers });
        console.log(`✅ Rejected applications: ${rejectedResponse.data.data.projects.length} found`);

        // Test view=applied with status=pending
        console.log('\n5️⃣ Testing view=applied&status=pending...');
        const pendingResponse = await axios.get(`${BASE_URL}/auth/projects?view=applied&status=pending&limit=5`, { headers });
        console.log(`✅ Pending applications: ${pendingResponse.data.data.projects.length} found`);

        // Test view=all
        console.log('\n6️⃣ Testing view=all...');
        const allResponse = await axios.get(`${BASE_URL}/auth/projects?view=all&limit=5`, { headers });
        console.log(`✅ All projects: ${allResponse.data.data.projects.length} found`);
        console.log(`   Total: ${allResponse.data.data.pagination.totalProjects}`);

        // Show detailed example if any projects found
        if (allResponse.data.data.projects.length > 0) {
            console.log('\n📄 Example project data:');
            const example = allResponse.data.data.projects[0];
            console.log(`   Project: ${example.projectName}`);
            console.log(`   Has Applied: ${example.hasApplied}`);
            console.log(`   Can Apply: ${example.canApply}`);
            console.log(`   Application Status: ${example.userApplication?.status || 'none'}`);
            console.log(`   Available Slots: ${example.availableSlots || 'unlimited'}`);
        }

        // Test user info
        console.log('\n👤 User Info from response:');
        const userInfo = allResponse.data.data.userInfo;
        console.log(`   Annotator Status: ${userInfo.annotatorStatus}`);
        console.log(`   Applied Projects: ${userInfo.appliedProjects}`);
        console.log(`   Total Applications: ${userInfo.totalApplications}`);

        console.log('\n🎉 ALL PROJECT ENDPOINT TESTS COMPLETED! 🎉');
        console.log('\n📊 Summary:');
        console.log(`   Available projects: ${availableResponse.data.data.pagination.totalProjects}`);
        console.log(`   Applied projects: ${appliedResponse.data.data.pagination.totalProjects}`);
        console.log(`   Approved applications: ${approvedResponse.data.data.pagination.totalProjects}`);
        console.log(`   Rejected applications: ${rejectedResponse.data.data.pagination.totalProjects}`);
        console.log(`   Pending applications: ${pendingResponse.data.data.pagination.totalProjects}`);

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data?.message || error.message);
        if (error.response?.data) {
            console.error('Response data:', error.response.data);
        }
    }
}

testProjectsEndpoint();