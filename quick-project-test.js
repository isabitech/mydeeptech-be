// Quick test for project creation fix
require('dotenv').config();

const axios = require('axios');

const quickProjectTest = async () => {
    try {
        console.log('🔧 Quick Project Creation Test...\n');

        const BASE_URL = 'http://localhost:5000/api';

        // Admin Login
        console.log('🔐 Admin Login...');
        const loginResponse = await axios.post(`${BASE_URL}/admin/login`, {
            email: 'debug@mydeeptech.ng',
            password: 'TestAdmin123!'
        });
        
        console.log('✅ Login successful');
        const token = loginResponse.data.token;
        console.log('Admin info:', loginResponse.data.admin);

        // Create Project
        console.log('\n🏗️ Creating project...');
        const projectResponse = await axios.post(`${BASE_URL}/admin/projects`, {
            projectName: 'Quick Test Project',
            projectDescription: 'Testing createdBy fix',
            projectCategory: 'Text Annotation',
            payRate: 15
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('✅ Project created successfully!');
        console.log('Project:', projectResponse.data.data.project);

    } catch (error) {
        console.log('❌ Error:', error.response?.data || error.message);
    }
};

quickProjectTest();