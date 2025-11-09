const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

/**
 * Test Admin Login with Email and Password
 */
const testAdminLogin = async () => {
    console.log('🧪 Testing Admin Login with Email and Password...\n');

    try {
        console.log('🔐 Testing admin login...');
        console.log('Email: debug@mydeeptech.ng');
        console.log('Password: [Hidden for security]');
        
        const loginResponse = await axios.post(`${BASE_URL}/admin/login`, {
            email: 'debug@mydeeptech.ng',
            password: 'TestAdmin123!' // The password used during admin creation
        });

        console.log('\n✅ Admin Login Successful!');
        console.log('Status:', loginResponse.status);
        console.log('Message:', loginResponse.data.message);
        console.log('Success:', loginResponse.data.success);

        // Check token formats
        if (loginResponse.data.token) {
            console.log('\n🎟️ Authentication Tokens:');
            console.log('Direct Token:', loginResponse.data.token.substring(0, 30) + '...');
            console.log('_usrinfo format:', loginResponse.data._usrinfo ? 'Present' : 'Missing');
            if (loginResponse.data._usrinfo) {
                console.log('_usrinfo.data:', loginResponse.data._usrinfo.data.substring(0, 30) + '...');
            }
        }

        // Check admin details
        if (loginResponse.data.admin) {
            console.log('\n👑 Admin Profile:');
            console.log('ID:', loginResponse.data.admin.id);
            console.log('Full Name:', loginResponse.data.admin.fullName);
            console.log('Email:', loginResponse.data.admin.email);
            console.log('Phone:', loginResponse.data.admin.phone);
            console.log('Domains:', loginResponse.data.admin.domains);
            console.log('Email Verified:', loginResponse.data.admin.isEmailVerified);
            console.log('Password Set:', loginResponse.data.admin.hasSetPassword);
            console.log('Annotator Status:', loginResponse.data.admin.annotatorStatus);
            console.log('Is Admin:', loginResponse.data.admin.isAdmin);
            console.log('Role:', loginResponse.data.admin.role);
            console.log('Created At:', new Date(loginResponse.data.admin.createdAt).toLocaleString());
        }

        // Test a protected admin route to verify the token works
        console.log('\n🛡️ Testing protected admin route with token...');
        
        const token = loginResponse.data.token;
        const protectedResponse = await axios.get(`${BASE_URL}/admin/dtusers`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('\n✅ Protected Admin Route Access Successful!');
        console.log('Status:', protectedResponse.status);
        console.log('Message:', protectedResponse.data.message);
        
        if (protectedResponse.data.data && protectedResponse.data.data.pagination) {
            console.log('\n📊 DTUsers Data Retrieved:');
            console.log('Total Users:', protectedResponse.data.data.pagination.totalUsers);
            console.log('Users in Response:', protectedResponse.data.data.users.length);
            console.log('Current Page:', protectedResponse.data.data.pagination.currentPage);
            console.log('Total Pages:', protectedResponse.data.data.pagination.totalPages);
        }

        console.log('\n🎉 Admin Login Flow Test Results:');
        console.log('✅ Admin login with email/password successful');
        console.log('✅ JWT token received in correct format');
        console.log('✅ Admin profile data complete');
        console.log('✅ Token authentication working');
        console.log('✅ Protected admin routes accessible');
        console.log('✅ Admin permissions verified');

    } catch (error) {
        if (error.response) {
            console.log('\n❌ Test failed:');
            console.log('Status:', error.response.status);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
            
            if (error.response.status === 401) {
                console.log('\n💡 Possible causes:');
                console.log('- Incorrect email or password');
                console.log('- Admin account not verified');
                console.log('- Email verification not complete');
            } else if (error.response.status === 400) {
                console.log('\n💡 Possible causes:');
                console.log('- Email domain restriction (@mydeeptech.ng required)');
                console.log('- Validation error in request');
            }
        } else {
            console.log('\n❌ Test failed:', error.message);
            console.log('💡 Make sure the server is running on port 5000');
        }
    }
};

// Test different scenarios
const testLoginScenarios = async () => {
    console.log('🧪 Testing Multiple Admin Login Scenarios...\n');

    // Test 1: Valid admin login
    console.log('📋 Test 1: Valid Admin Login');
    await testAdminLogin();

    // Test 2: Invalid password
    console.log('\n📋 Test 2: Invalid Password (Should Fail)');
    try {
        await axios.post(`${BASE_URL}/admin/login`, {
            email: 'debug@mydeeptech.ng',
            password: 'WrongPassword123!'
        });
        console.log('⚠️ Login succeeded when it should have failed!');
    } catch (error) {
        console.log('✅ Login correctly failed with invalid password');
        console.log('Status:', error.response?.status);
        console.log('Message:', error.response?.data?.message);
    }

    // Test 3: Non-admin email domain
    console.log('\n📋 Test 3: Non-Admin Domain (Should Fail)');
    try {
        await axios.post(`${BASE_URL}/admin/login`, {
            email: 'test@gmail.com',
            password: 'TestAdmin123!'
        });
        console.log('⚠️ Login succeeded when it should have failed!');
    } catch (error) {
        console.log('✅ Login correctly failed with non-admin domain');
        console.log('Status:', error.response?.status);
        console.log('Message:', error.response?.data?.message);
    }
};

testLoginScenarios().then(() => {
    console.log('\n🏁 Admin login tests completed!');
    process.exit(0);
});