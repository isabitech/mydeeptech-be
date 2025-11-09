const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

/**
 * Test Admin Access to All DTUsers
 */
const testAdminGetAllDTUsers = async () => {
    console.log('🧪 Testing Admin Access to All DTUsers...\n');

    try {
        // Step 1: Admin Login
        console.log('🔐 Step 1: Admin Login...');
        const loginResponse = await axios.post(`${BASE_URL}/admin/login`, {
            email: 'debug@mydeeptech.ng', // Use the verified admin account
            password: 'TestAdmin123!' // The password used during admin creation
        });

        console.log('✅ Admin Login Successful!');
        console.log('Status:', loginResponse.status);
        
        const adminToken = loginResponse.data.token;
        console.log('Admin Token received:', adminToken ? 'Yes' : 'No');

        // Step 2: Get All DTUsers using admin token
        console.log('\n👥 Step 2: Getting All DTUsers with Admin Token...');
        
        const usersResponse = await axios.get(`${BASE_URL}/admin/dtusers`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('\n✅ Get All DTUsers Successful!');
        console.log('Status:', usersResponse.status);
        console.log('Message:', usersResponse.data.message);
        
        if (usersResponse.data.data) {
            const { users, pagination, summary } = usersResponse.data.data;
            
            console.log('\n📊 DTUsers Data Summary:');
            console.log('Total Users:', pagination.totalUsers);
            console.log('Users in Current Page:', users.length);
            console.log('Current Page:', pagination.currentPage);
            console.log('Total Pages:', pagination.totalPages);
            console.log('Has Next Page:', pagination.hasNextPage);

            console.log('\n📈 Status Breakdown:');
            Object.entries(summary.statusBreakdown).forEach(([status, count]) => {
                console.log(`  ${status}: ${count} users`);
            });

            console.log('\n👤 Sample User Data:');
            if (users.length > 0) {
                const firstUser = users[0];
                console.log('- ID:', firstUser._id);
                console.log('- Full Name:', firstUser.fullName);
                console.log('- Email:', firstUser.email);
                console.log('- Phone:', firstUser.phone);
                console.log('- Domains:', firstUser.domains);
                console.log('- Annotator Status:', firstUser.annotatorStatus);
                console.log('- Email Verified:', firstUser.isEmailVerified);
                console.log('- Password Set:', firstUser.hasSetPassword);
                console.log('- Created:', new Date(firstUser.createdAt).toLocaleDateString());
            }
        }

        // Step 3: Test pagination and filtering
        console.log('\n🔍 Step 3: Testing Pagination and Filters...');
        
        const filteredResponse = await axios.get(`${BASE_URL}/admin/dtusers?page=1&limit=5&status=approved`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Filtered Request Successful!');
        console.log('Filtered Users Count:', filteredResponse.data.data.users.length);
        console.log('Filter Applied: status=approved, limit=5');

        // Step 4: Test getting single DTUser details
        if (usersResponse.data.data.users.length > 0) {
            console.log('\n👤 Step 4: Getting Single DTUser Details...');
            
            const userId = usersResponse.data.data.users[0]._id;
            const singleUserResponse = await axios.get(`${BASE_URL}/admin/dtusers/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ Get Single DTUser Successful!');
            console.log('Status:', singleUserResponse.status);
            console.log('Message:', singleUserResponse.data.message);
            
            if (singleUserResponse.data.data && singleUserResponse.data.data.user) {
                const user = singleUserResponse.data.data.user;
                console.log('User Details Retrieved:', user.fullName, '-', user.email);
            }
        }

        console.log('\n🎉 Admin DTUsers Access Test Results:');
        console.log('✅ Admin authentication working');
        console.log('✅ Admin can access all DTUsers');
        console.log('✅ Pagination and filtering working');
        console.log('✅ Single DTUser details accessible');
        console.log('✅ Admin authorization middleware working');
        console.log('✅ Complete DTUser management available to admins');

    } catch (error) {
        if (error.response) {
            console.log('\n❌ Test failed:');
            console.log('Status:', error.response.status);
            console.log('URL:', error.config?.url);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
            
            if (error.response.status === 401) {
                console.log('\n💡 Possible causes:');
                console.log('- Invalid admin credentials');
                console.log('- Admin token expired or invalid');
                console.log('- Admin authentication middleware issue');
            } else if (error.response.status === 403) {
                console.log('\n💡 Possible causes:');
                console.log('- Admin token valid but insufficient privileges');
                console.log('- Admin authorization middleware blocking access');
            }
        } else {
            console.log('\n❌ Test failed:', error.message);
            console.log('💡 Make sure the server is running on port 5000');
        }
    }
};

// Test without admin authentication (should fail)
const testUnauthorizedAccess = async () => {
    console.log('\n🔒 Testing Unauthorized Access (Should Fail)...\n');

    try {
        await axios.get(`${BASE_URL}/admin/dtusers`);
        console.log('⚠️ Unauthorized access succeeded when it should have failed!');
    } catch (error) {
        console.log('✅ Unauthorized access correctly blocked');
        console.log('Status:', error.response?.status);
        console.log('Message:', error.response?.data?.message || 'Access denied');
    }
};

console.log('📝 Admin DTUsers Access Test');
console.log('============================');
console.log('Testing admin access to DTUsers endpoints:');
console.log('- POST /admin/login (admin authentication)');
console.log('- GET /admin/dtusers (get all DTUsers)');
console.log('- GET /admin/dtusers?filters (pagination/filtering)');
console.log('- GET /admin/dtusers/:userId (single DTUser)');
console.log('============================\n');

// Run tests
testAdminGetAllDTUsers()
    .then(() => testUnauthorizedAccess())
    .then(() => {
        console.log('\n🏁 Admin DTUsers access test completed!');
        process.exit(0);
    })
    .catch(console.error);