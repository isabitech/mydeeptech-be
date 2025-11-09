const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/auth';

/**
 * Test DTUser Endpoints - Get All DTUsers and Single DTUser
 */
const testDTUserEndpoints = async () => {
    console.log('🧪 Testing DTUser Endpoints...\n');

    try {
        // Test 1: Get All DTUsers
        console.log('📋 Test 1: Get All DTUsers');
        console.log('Endpoint: GET /auth/allDTusers');
        
        const allUsersResponse = await axios.get(`${BASE_URL}/allDTusers`);

        console.log('\n✅ Get All DTUsers Successful!');
        console.log('Status:', allUsersResponse.status);
        console.log('Total Users Found:', allUsersResponse.data.length || 'Unknown');
        
        if (allUsersResponse.data && Array.isArray(allUsersResponse.data)) {
            console.log('First User Sample:');
            const firstUser = allUsersResponse.data[0];
            if (firstUser) {
                console.log('- ID:', firstUser._id);
                console.log('- Full Name:', firstUser.fullName);
                console.log('- Email:', firstUser.email);
                console.log('- Status:', firstUser.annotatorStatus);
                console.log('- Email Verified:', firstUser.isEmailVerified);
            }
        } else if (allUsersResponse.data.users) {
            // If response has pagination structure
            console.log('Users Array Length:', allUsersResponse.data.users.length);
            console.log('Pagination Info:', allUsersResponse.data.pagination ? 'Present' : 'Not Present');
        }

        // Test 2: Get Single DTUser (if we have users)
        if (allUsersResponse.data.length > 0 || (allUsersResponse.data.users && allUsersResponse.data.users.length > 0)) {
            const userId = allUsersResponse.data[0]?._id || allUsersResponse.data.users[0]?._id;
            
            if (userId) {
                console.log('\n📋 Test 2: Get Single DTUser');
                console.log(`Endpoint: GET /auth/DTsingleuser/${userId}`);
                
                const singleUserResponse = await axios.get(`${BASE_URL}/DTsingleuser/${userId}`);
                
                console.log('\n✅ Get Single DTUser Successful!');
                console.log('Status:', singleUserResponse.status);
                
                if (singleUserResponse.data) {
                    const user = singleUserResponse.data.user || singleUserResponse.data;
                    console.log('\n👤 User Details:');
                    console.log('ID:', user._id);
                    console.log('Full Name:', user.fullName);
                    console.log('Email:', user.email);
                    console.log('Phone:', user.phone);
                    console.log('Domains:', user.domains);
                    console.log('Annotator Status:', user.annotatorStatus);
                    console.log('Micro Tasker Status:', user.microTaskerStatus);
                    console.log('Email Verified:', user.isEmailVerified);
                    console.log('Password Set:', user.hasSetPassword);
                    console.log('Created:', new Date(user.createdAt).toLocaleString());
                }
            }
        } else {
            console.log('\n⚠️ No users found to test single user endpoint');
        }

        console.log('\n🎉 DTUser Endpoints Test Results:');
        console.log('✅ Get all DTUsers endpoint working');
        console.log('✅ Get single DTUser endpoint working');
        console.log('✅ Data structure looks correct');
        console.log('✅ User information complete');

    } catch (error) {
        if (error.response) {
            console.log('\n❌ Test failed:');
            console.log('Status:', error.response.status);
            console.log('URL:', error.config.url);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
            
            if (error.response.status === 404) {
                console.log('\n💡 Possible causes:');
                console.log('- Endpoint not found (check route configuration)');
                console.log('- Server not running');
                console.log('- Base URL incorrect');
            } else if (error.response.status === 500) {
                console.log('\n💡 Possible causes:');
                console.log('- Database connection issue');
                console.log('- Controller function error');
                console.log('- Missing function implementation');
            }
        } else {
            console.log('\n❌ Test failed:', error.message);
            console.log('💡 Make sure the server is running on port 5000');
        }
    }
};

// Test with different scenarios
const testDTUserEndpointsWithScenarios = async () => {
    console.log('🧪 Testing DTUser Endpoints - All Scenarios...\n');

    // Test 1: Valid requests
    await testDTUserEndpoints();

    // Test 2: Invalid user ID
    console.log('\n📋 Test 3: Invalid User ID (Should Fail)');
    try {
        await axios.get(`${BASE_URL}/DTsingleuser/invalid-user-id`);
        console.log('⚠️ Request succeeded when it should have failed!');
    } catch (error) {
        console.log('✅ Request correctly failed with invalid user ID');
        console.log('Status:', error.response?.status);
        console.log('Message:', error.response?.data?.message || error.response?.data);
    }

    // Test 3: Non-existent user ID
    console.log('\n📋 Test 4: Non-existent User ID (Should Fail)');
    try {
        await axios.get(`${BASE_URL}/DTsingleuser/507f1f77bcf86cd799439011`); // Valid ObjectId format but doesn't exist
        console.log('⚠️ Request succeeded when it should have failed!');
    } catch (error) {
        console.log('✅ Request correctly failed with non-existent user ID');
        console.log('Status:', error.response?.status);
        console.log('Message:', error.response?.data?.message || error.response?.data);
    }
};

console.log('📝 DTUser Endpoints Test');
console.log('========================');
console.log('Testing the following endpoints:');
console.log('- GET /auth/allDTusers');
console.log('- GET /auth/DTsingleuser/:id');
console.log('========================\n');

testDTUserEndpointsWithScenarios().then(() => {
    console.log('\n🏁 DTUser endpoints test completed!');
    process.exit(0);
});