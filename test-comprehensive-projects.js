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

async function testProjectEndpointComprehensive() {
    try {
        console.log('🎯 COMPREHENSIVE PROJECTS ENDPOINT TEST\n');

        // Step 1: Admin setup
        console.log('🔐 Step 1: Admin Authentication...');
        const adminLogin = await axios.post(`${BASE_URL}/admin/login`, ADMIN_CREDENTIALS);
        const adminToken = adminLogin.data.token || adminLogin.data._usrinfo?.data;
        console.log('✅ Admin authenticated\n');

        // Step 2: DTUser Authentication
        console.log('🔐 Step 2: DTUser Authentication...');
        const userLogin = await axios.post(`${BASE_URL}/auth/dtUserLogin`, DTUSER_CREDENTIALS);
        const userToken = userLogin.data.token;
        console.log('✅ DTUser authenticated\n');

        const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };
        const userHeaders = { 'Authorization': `Bearer ${userToken}` };

        // Step 3: Create a test project and apply to it
        console.log('📋 Step 3: Creating test project...');
        const testProject = await axios.post(`${BASE_URL}/admin/projects`, {
            projectName: `Status Test Project ${Date.now()}`,
            projectDescription: 'Test project for status filtering',
            projectCategory: 'Text Annotation',
            payRate: 25,
            maxAnnotators: 3
        }, { headers: adminHeaders });
        
        const projectId = testProject.data.data.project._id;
        console.log(`✅ Created project: ${testProject.data.data.project.projectName}\n`);

        // Step 4: User applies to project
        console.log('📝 Step 4: User applying to project...');
        await axios.post(`${BASE_URL}/auth/projects/${projectId}/apply`, {
            coverLetter: 'Test application for status testing',
            availability: 'flexible'
        }, { headers: userHeaders });
        console.log('✅ Application submitted\n');

        // Step 5: Get the application ID and test different admin actions
        const applicationsResponse = await axios.get(`${BASE_URL}/admin/applications`, { headers: adminHeaders });
        const applications = applicationsResponse.data.data?.applications || [];
        const userApplication = applications.find(app => 
            app.projectId._id === projectId && app.applicantId?.email === DTUSER_CREDENTIALS.email
        );

        if (!userApplication) {
            throw new Error('Could not find user application');
        }

        console.log(`📋 Found application ID: ${userApplication._id}\n`);

        // Step 6: Test different endpoint views
        console.log('🎯 Step 6: Testing different views and statuses...\n');

        // Test view=available (should exclude applied projects)
        console.log('1️⃣ Testing view=available...');
        const availableResponse = await axios.get(`${BASE_URL}/auth/projects?view=available&limit=5`, { headers: userHeaders });
        const availableCount = availableResponse.data.data.projects.length;
        console.log(`   ✅ Available projects: ${availableCount} found`);
        
        // Check if our test project is NOT in the available list
        const hasTestProject = availableResponse.data.data.projects.some(p => p._id === projectId);
        console.log(`   ✅ Test project in available list: ${hasTestProject ? '❌ YES (should be NO)' : '✅ NO (correct)'}`);

        // Test view=applied (should show our pending application)
        console.log('\n2️⃣ Testing view=applied (should show pending)...');
        const appliedResponse = await axios.get(`${BASE_URL}/auth/projects?view=applied&limit=10`, { headers: userHeaders });
        const appliedProjects = appliedResponse.data.data.projects;
        const ourAppliedProject = appliedProjects.find(p => p._id === projectId);
        
        console.log(`   ✅ Applied projects total: ${appliedProjects.length} found`);
        if (ourAppliedProject) {
            console.log(`   ✅ Test project found with status: ${ourAppliedProject.userApplication?.status || 'undefined'}`);
            console.log(`   ✅ Has Applied: ${ourAppliedProject.hasApplied}`);
            console.log(`   ✅ Can Apply: ${ourAppliedProject.canApply}`);
        } else {
            console.log('   ❌ Test project not found in applied list');
        }

        // Test status=pending filter
        console.log('\n3️⃣ Testing view=applied&status=pending...');
        const pendingResponse = await axios.get(`${BASE_URL}/auth/projects?view=applied&status=pending&limit=10`, { headers: userHeaders });
        const pendingCount = pendingResponse.data.data.projects.length;
        console.log(`   ✅ Pending applications: ${pendingCount} found`);
        
        // Test status=approved filter (should show existing approved apps)
        console.log('\n4️⃣ Testing view=applied&status=approved...');
        const approvedResponse = await axios.get(`${BASE_URL}/auth/projects?view=applied&status=approved&limit=10`, { headers: userHeaders });
        const approvedCount = approvedResponse.data.data.projects.length;
        console.log(`   ✅ Approved applications: ${approvedCount} found`);

        // Test status=rejected filter
        console.log('\n5️⃣ Testing view=applied&status=rejected...');
        const rejectedResponse = await axios.get(`${BASE_URL}/auth/projects?view=applied&status=rejected&limit=10`, { headers: userHeaders });
        const rejectedCount = rejectedResponse.data.data.projects.length;
        console.log(`   ✅ Rejected applications: ${rejectedCount} found`);

        // Step 7: Admin rejects the application
        console.log('\n📝 Step 7: Admin rejecting application...');
        await axios.patch(`${BASE_URL}/admin/applications/${userApplication._id}/reject`, {
            rejectionReason: 'insufficient_experience',
            reviewNotes: 'Test rejection for endpoint testing'
        }, { headers: adminHeaders });
        console.log('✅ Application rejected\n');

        // Test rejected status after rejection
        console.log('6️⃣ Testing view=applied&status=rejected after rejection...');
        const rejectedAfterResponse = await axios.get(`${BASE_URL}/auth/projects?view=applied&status=rejected&limit=10`, { headers: userHeaders });
        const rejectedAfterCount = rejectedAfterResponse.data.data.projects.length;
        console.log(`   ✅ Rejected applications after rejection: ${rejectedAfterCount} found (should be ${rejectedCount + 1})`);

        // Test view=all
        console.log('\n7️⃣ Testing view=all...');
        const allResponse = await axios.get(`${BASE_URL}/auth/projects?view=all&limit=10`, { headers: userHeaders });
        const allProjects = allResponse.data.data.projects;
        console.log(`   ✅ All projects: ${allProjects.length} found`);
        
        const testProjectInAll = allProjects.find(p => p._id === projectId);
        if (testProjectInAll) {
            console.log(`   ✅ Test project status in 'all' view: ${testProjectInAll.userApplication?.status || 'none'}`);
        }

        console.log('\n📊 FINAL SUMMARY:');
        console.log(`   Available projects: ${availableCount}`);
        console.log(`   Applied projects (total): ${appliedProjects.length}`);
        console.log(`   Pending applications: ${pendingCount}`);
        console.log(`   Approved applications: ${approvedCount}`);
        console.log(`   Rejected applications (before): ${rejectedCount}`);
        console.log(`   Rejected applications (after): ${rejectedAfterCount}`);
        console.log(`   All projects: ${allProjects.length}`);

        console.log('\n🎉 COMPREHENSIVE TEST COMPLETED! 🎉');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data?.message || error.message);
        if (error.response?.data) {
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testProjectEndpointComprehensive();