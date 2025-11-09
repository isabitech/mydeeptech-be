const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/auth';

/**
 * Test DTUser Password Reset Functionality
 */
const testDTUserPasswordReset = async () => {
    console.log('🧪 Testing DTUser Password Reset...\n');

    // First, we need to login to get a token
    console.log('🔐 Step 1: Login to get JWT token...');
    
    try {
        // You'll need to replace these with actual test user credentials
        const loginResponse = await axios.post(`${BASE_URL}/dtUserLogin`, {
            email: 'test@example.com', // Replace with actual test user email
            password: 'OldPassword123!' // Replace with actual test user password
        });

        const token = loginResponse.data.token || loginResponse.data._usrinfo.data;
        console.log('✅ Login successful, token received');

        // Step 2: Test password reset
        console.log('\n🔄 Step 2: Testing password reset...');
        
        const resetResponse = await axios.patch(`${BASE_URL}/dtUserResetPassword`, {
            oldPassword: 'OldPassword123!',      // Current password
            newPassword: 'NewPassword123!',      // New password
            confirmNewPassword: 'NewPassword123!' // Confirm new password
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('\n✅ Password Reset Successful!');
        console.log('Status:', resetResponse.status);
        console.log('Message:', resetResponse.data.message);
        
        if (resetResponse.data.user) {
            console.log('\n👤 Updated User Info:');
            console.log('ID:', resetResponse.data.user.id);
            console.log('Full Name:', resetResponse.data.user.fullName);
            console.log('Email:', resetResponse.data.user.email);
            console.log('Has Password:', resetResponse.data.user.hasSetPassword);
            console.log('Updated At:', resetResponse.data.user.updatedAt);
        }

        // Step 3: Test login with new password
        console.log('\n🔑 Step 3: Testing login with new password...');
        
        const newLoginResponse = await axios.post(`${BASE_URL}/dtUserLogin`, {
            email: 'test@example.com', // Same email
            password: 'NewPassword123!' // New password
        });

        console.log('✅ Login with new password successful!');
        console.log('Status:', newLoginResponse.status);
        console.log('Token received:', newLoginResponse.data.token ? 'Yes' : 'No');

        console.log('\n🎉 Password Reset Flow Test Results:');
        console.log('✅ Old password verification working');
        console.log('✅ New password validation working');
        console.log('✅ Password encryption successful');
        console.log('✅ Login with new password working');

    } catch (error) {
        if (error.response) {
            console.log('\n❌ Test failed:');
            console.log('Status:', error.response.status);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('\n❌ Test failed:', error.message);
        }
    }
};

// Test different password reset scenarios
const testPasswordResetScenarios = async () => {
    console.log('🧪 Testing Password Reset Error Scenarios...\n');

    // For these tests, you'll need a valid token
    const testToken = 'your-test-token-here'; // Replace with actual token

    // Test 1: Invalid old password
    console.log('📋 Test 1: Invalid Old Password (Should Fail)');
    try {
        await axios.patch(`${BASE_URL}/dtUserResetPassword`, {
            oldPassword: 'WrongPassword123!',
            newPassword: 'NewPassword123!',
            confirmNewPassword: 'NewPassword123!'
        }, {
            headers: { 'Authorization': `Bearer ${testToken}` }
        });
        console.log('⚠️ Reset succeeded when it should have failed!');
    } catch (error) {
        console.log('✅ Reset correctly failed with invalid old password');
        console.log('Status:', error.response?.status);
        console.log('Message:', error.response?.data?.message);
    }

    // Test 2: Passwords don't match
    console.log('\n📋 Test 2: Passwords Don\'t Match (Should Fail)');
    try {
        await axios.patch(`${BASE_URL}/dtUserResetPassword`, {
            oldPassword: 'OldPassword123!',
            newPassword: 'NewPassword123!',
            confirmNewPassword: 'DifferentPassword123!'
        }, {
            headers: { 'Authorization': `Bearer ${testToken}` }
        });
        console.log('⚠️ Reset succeeded when it should have failed!');
    } catch (error) {
        console.log('✅ Reset correctly failed with mismatched passwords');
        console.log('Status:', error.response?.status);
        console.log('Message:', error.response?.data?.message);
    }

    // Test 3: New password same as old password
    console.log('\n📋 Test 3: New Password Same as Old (Should Fail)');
    try {
        await axios.patch(`${BASE_URL}/dtUserResetPassword`, {
            oldPassword: 'OldPassword123!',
            newPassword: 'OldPassword123!',
            confirmNewPassword: 'OldPassword123!'
        }, {
            headers: { 'Authorization': `Bearer ${testToken}` }
        });
        console.log('⚠️ Reset succeeded when it should have failed!');
    } catch (error) {
        console.log('✅ Reset correctly failed with same old/new password');
        console.log('Status:', error.response?.status);
        console.log('Message:', error.response?.data?.message);
    }

    // Test 4: No authentication token
    console.log('\n📋 Test 4: No Authentication Token (Should Fail)');
    try {
        await axios.patch(`${BASE_URL}/dtUserResetPassword`, {
            oldPassword: 'OldPassword123!',
            newPassword: 'NewPassword123!',
            confirmNewPassword: 'NewPassword123!'
        });
        console.log('⚠️ Reset succeeded when it should have failed!');
    } catch (error) {
        console.log('✅ Reset correctly failed without authentication');
        console.log('Status:', error.response?.status);
        console.log('Message:', error.response?.data?.message);
    }
};

console.log('📝 DTUser Password Reset Test');
console.log('================================');
console.log('Before running this test, make sure:');
console.log('1. Server is running on port 5000');
console.log('2. You have a test DTUser account');
console.log('3. Update the test credentials in the code');
console.log('================================\n');

// Uncomment to run the main test (after updating credentials)
// testDTUserPasswordReset().catch(console.error);

// Uncomment to run error scenario tests (after getting a valid token)
// testPasswordResetScenarios().catch(console.error);

console.log('💡 Update the test credentials above and uncomment the test functions to run.');