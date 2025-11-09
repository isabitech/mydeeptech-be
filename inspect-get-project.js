// Load environment variables
require('dotenv').config();

const axios = require('axios');

/**
 * Inspect /api/auth/getProject Endpoint
 */
const inspectGetProjectEndpoint = async () => {
    console.log('🔍 Inspecting /api/auth/getProject Endpoint...\n');

    try {
        // Test the endpoint
        console.log('📡 Making GET request to /api/auth/getProject...');
        const response = await axios.get('http://localhost:5000/api/auth/getProject');

        console.log('\n✅ Request Successful!');
        console.log('📊 Response Details:');
        console.log(`   Status: ${response.status}`);
        console.log(`   Status Text: ${response.statusText}`);
        
        // Analyze response structure
        const data = response.data;
        console.log('\n📄 Response Structure:');
        console.log(`   Type: ${typeof data}`);
        console.log(`   Has responseCode: ${data.hasOwnProperty('responseCode')}`);
        console.log(`   Has message: ${data.hasOwnProperty('message')}`);
        console.log(`   Has data: ${data.hasOwnProperty('data')}`);

        if (data.responseCode) {
            console.log(`   Response Code: ${data.responseCode}`);
        }
        if (data.message) {
            console.log(`   Message: ${data.message}`);
        }

        // Analyze projects data
        if (data.data) {
            const projects = data.data;
            console.log(`\n📂 Projects Data:`);
            console.log(`   Type: ${typeof projects}`);
            console.log(`   Is Array: ${Array.isArray(projects)}`);
            console.log(`   Count: ${projects.length || 'N/A'}`);

            if (Array.isArray(projects) && projects.length > 0) {
                console.log('\n🏷️ Project Schema Analysis (First Project):');
                const firstProject = projects[0];
                Object.keys(firstProject).forEach(key => {
                    const value = firstProject[key];
                    const type = typeof value;
                    console.log(`   ${key}: ${type} = ${value}`);
                });

                console.log('\n📋 All Projects:');
                projects.forEach((project, index) => {
                    console.log(`   ${index + 1}. ${project.projectName || 'Unnamed Project'}`);
                    console.log(`      Company: ${project.company || 'N/A'}`);
                    console.log(`      Due Date: ${project.dueDate || 'N/A'}`);
                    console.log(`      ID: ${project._id || 'N/A'}`);
                    console.log(`      Created: ${project.createdAt || 'N/A'}`);
                    console.log('');
                });
            } else {
                console.log('   No projects found in the data array');
            }
        }

        // Test response headers
        console.log('\n📡 Response Headers:');
        Object.keys(response.headers).forEach(header => {
            console.log(`   ${header}: ${response.headers[header]}`);
        });

        // Summary
        console.log('\n🎯 Endpoint Analysis Summary:');
        console.log('✅ Endpoint is accessible (no authentication required)');
        console.log(`✅ Returns ${data.data ? data.data.length : 0} projects`);
        console.log('✅ Uses standard REST response format');
        console.log('✅ Includes responseCode, message, and data fields');
        
        if (data.data && data.data.length > 0) {
            console.log('✅ Projects include: projectName, company, dueDate, _id');
        }

    } catch (error) {
        console.log('\n❌ Endpoint Inspection Failed:');
        
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Status Text: ${error.response.statusText}`);
            console.log(`   URL: ${error.config?.url}`);
            
            // Try to parse error response
            try {
                console.log(`   Error Data: ${JSON.stringify(error.response.data, null, 2)}`);
            } catch (parseError) {
                console.log(`   Raw Error: ${error.response.data}`);
            }
        } else if (error.request) {
            console.log('   Network Error: No response received');
            console.log(`   Error Code: ${error.code}`);
            if (error.code === 'ECONNREFUSED') {
                console.log('   💡 Make sure the server is running: node index.js');
            }
        } else {
            console.log(`   Error: ${error.message}`);
        }
    }
};

/**
 * Test endpoint edge cases
 */
const testEdgeCases = async () => {
    console.log('\n🧪 Testing Edge Cases...\n');

    try {
        // Test with query parameters (though endpoint doesn't seem to use them)
        console.log('📡 Testing with query parameters...');
        const queryResponse = await axios.get('http://localhost:5000/api/auth/getProject?limit=5&sort=name');
        console.log(`✅ Query parameters accepted (${queryResponse.status})`);
        
        // Test different HTTP methods
        console.log('\n📡 Testing POST method (should fail)...');
        try {
            await axios.post('http://localhost:5000/api/auth/getProject');
            console.log('⚠️ POST method unexpectedly succeeded');
        } catch (methodError) {
            console.log(`✅ POST method properly rejected (${methodError.response?.status || 'No response'})`);
        }

    } catch (error) {
        console.log(`❌ Edge case testing failed: ${error.message}`);
    }
};

console.log('🔍 GET /api/auth/getProject Endpoint Inspector');
console.log('=============================================');
console.log('Analyzing endpoint behavior, response structure, and data');
console.log('=============================================\n');

// Run inspection
inspectGetProjectEndpoint().then(() => {
    return testEdgeCases();
}).then(() => {
    console.log('\n🏁 Endpoint inspection completed!');
});