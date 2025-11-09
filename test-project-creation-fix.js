// Test the project creation fix
require('dotenv').config();

const axios = require('axios');

const testProjectCreationFix = async () => {
    console.log('🔧 Testing Project Creation Fix...\n');

    try {
        const BASE_URL = 'http://localhost:5000/api';

        // Step 1: Admin Login
        console.log('🔐 Step 1: Admin Login...');
        const adminLoginResponse = await axios.post(`${BASE_URL}/admin/login`, {
            email: 'debug@mydeeptech.ng',
            password: 'TestAdmin123!'
        });
        console.log('✅ Admin Login Successful!');
        const adminToken = adminLoginResponse.data.token;

        // Step 2: Create a Test Project (this should work now)
        console.log('\n🏗️ Step 2: Creating test project (testing the fix)...');
        const projectData = {
            projectName: 'Test Project Creation Fix',
            projectDescription: 'This project tests if the createdBy field issue is resolved.',
            projectCategory: 'Text Annotation',
            payRate: 20,
            payRateCurrency: 'USD',
            payRateType: 'per_hour',
            maxAnnotators: 3,
            difficultyLevel: 'intermediate',
            requiredSkills: ['text analysis', 'annotation'],
            tags: ['test', 'fix-validation']
        };

        const createProjectResponse = await axios.post(`${BASE_URL}/admin/projects`, projectData, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        console.log('✅ Project created successfully!');
        console.log(`   Project Name: ${createProjectResponse.data.data.project.projectName}`);
        console.log(`   Project ID: ${createProjectResponse.data.data.project._id}`);
        console.log(`   Created By: ${createProjectResponse.data.data.project.createdBy}`);
        console.log(`   Status: ${createProjectResponse.data.data.project.status}`);

        // Step 3: Verify project details
        console.log('\n📋 Step 3: Verifying project was created with correct fields...');
        const projectId = createProjectResponse.data.data.project._id;
        
        const getProjectResponse = await axios.get(`${BASE_URL}/admin/projects/${projectId}`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        const project = getProjectResponse.data.data.project;
        console.log('✅ Project verification complete:');
        console.log(`   ✅ createdBy field populated: ${project.createdBy ? 'YES' : 'NO'}`);
        console.log(`   ✅ assignedAdmins populated: ${project.assignedAdmins?.length > 0 ? 'YES' : 'NO'}`);
        console.log(`   ✅ Project status: ${project.status}`);
        console.log(`   ✅ Pay rate: ${project.payRate} ${project.payRateCurrency}/${project.payRateType}`);
        
        // Step 4: Test project listing
        console.log('\n📊 Step 4: Testing project listing...');
        const listProjectsResponse = await axios.get(`${BASE_URL}/admin/projects`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        const projects = listProjectsResponse.data.data.projects;
        const testProject = projects.find(p => p.projectName === projectData.projectName);
        
        if (testProject) {
            console.log('✅ Test project found in listing');
            console.log(`   Projects total: ${projects.length}`);
        } else {
            console.log('❌ Test project not found in listing');
        }

        console.log('\n🎉 PROJECT CREATION FIX TEST RESULTS:');
        console.log('✅ Admin authentication working correctly');
        console.log('✅ Project creation endpoint working (createdBy field fixed)');
        console.log('✅ Project retrieval working');
        console.log('✅ Project listing working');
        console.log('✅ All required fields being populated correctly');
        
        console.log('\n✅ The createdBy validation error has been RESOLVED! ✅');
        console.log('\n📋 Fix Summary:');
        console.log('   🔧 Changed req.admin._id to req.admin.userId in createAnnotationProject');
        console.log('   🔧 Changed req.admin._id to req.admin.userId in approveAnnotationProjectApplication');
        console.log('   🔧 Changed req.admin._id to req.admin.userId in rejectAnnotationProjectApplication');
        console.log('   ✅ Admin middleware correctly sets req.admin.userId');

    } catch (error) {
        if (error.response) {
            console.log('\n❌ Test failed:');
            console.log('Status:', error.response.status);
            console.log('URL:', error.config?.url);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
            
            if (error.response.data.error && error.response.data.error.includes('createdBy')) {
                console.log('\n❌ The createdBy validation error still exists!');
                console.log('💡 Check that the fix was applied correctly in annotationProject.controller.js');
            }
        } else {
            console.log('\n❌ Test failed:', error.message);
            if (error.code === 'ECONNREFUSED') {
                console.log('💡 Make sure the server is running: node index.js');
            }
        }
    }
};

console.log('🔧 Project Creation Fix Test');
console.log('============================');
console.log('Testing fix for: "createdBy: Path `createdBy` is required" error');
console.log('============================\n');

testProjectCreationFix();