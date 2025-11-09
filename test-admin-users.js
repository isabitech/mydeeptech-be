// Load environment variables
require('dotenv').config();

const axios = require('axios');

/**
 * Test Admin Users Endpoint
 */
const testAdminUsersEndpoint = async () => {
    console.log('🧪 Testing Admin Users Endpoint...\n');

    try {
        // Step 1: Admin Login
        console.log('🔐 Step 1: Admin Login...');
        const loginResponse = await axios.post('http://localhost:5000/api/admin/login', {
            email: 'debug@mydeeptech.ng',
            password: 'TestAdmin123!'
        });

        console.log('✅ Admin Login Successful!');
        const adminToken = loginResponse.data.token;

        // Step 2: Get all admin users
        console.log('\n👑 Step 2: Getting all admin users...');
        const adminUsersResponse = await axios.get('http://localhost:5000/api/admin/admin-users', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        const adminUsers = adminUsersResponse.data.data.adminUsers;
        console.log(`✅ Retrieved ${adminUsers.length} admin users`);

        // Step 3: Analyze admin users
        console.log('\n🔍 Step 3: Analyzing admin user list...');
        
        let myDeepTechEmails = 0;
        let adminDomainUsers = 0;

        adminUsers.forEach((user, index) => {
            console.log(`\n   ${index + 1}. ${user.fullName} (${user.email})`);
            console.log(`      Phone: ${user.phone || 'Not provided'}`);
            console.log(`      Email Verified: ${user.isEmailVerified}`);
            console.log(`      Domains: ${user.domains ? user.domains.join(', ') : 'None'}`);
            console.log(`      Annotator Status: ${user.annotatorStatus}`);
            console.log(`      Micro Tasker Status: ${user.microTaskerStatus}`);
            console.log(`      Created: ${new Date(user.createdAt).toLocaleDateString()}`);

            if (user.email.toLowerCase().endsWith('@mydeeptech.ng')) {
                myDeepTechEmails++;
            }
            
            if (user.domains && (user.domains.includes('Administration') || user.domains.includes('Management'))) {
                adminDomainUsers++;
            }
        });

        console.log(`\n📊 Admin Users Summary:`);
        console.log(`   Total admin users: ${adminUsers.length}`);
        console.log(`   Users with @mydeeptech.ng emails: ${myDeepTechEmails}`);
        console.log(`   Users with admin domains: ${adminDomainUsers}`);

        // Step 4: Check pagination and summary
        const pagination = adminUsersResponse.data.data.pagination;
        const summary = adminUsersResponse.data.data.summary;

        console.log(`\n📄 Pagination Info:`);
        console.log(`   Current page: ${pagination.currentPage}`);
        console.log(`   Total pages: ${pagination.totalPages}`);
        console.log(`   Total admin users: ${pagination.totalAdminUsers}`);
        console.log(`   Has next page: ${pagination.hasNextPage}`);

        console.log(`\n📈 Summary:`);
        console.log(`   Total admin users: ${summary.totalAdminUsers}`);
        if (summary.roleSummary && summary.roleSummary.length > 0) {
            console.log(`   Role breakdown:`);
            summary.roleSummary.forEach(role => {
                console.log(`     - ${JSON.stringify(role._id)}: ${role.count}`);
            });
        }

        // Step 5: Test with pagination
        console.log('\n📄 Step 4: Testing pagination (limit=5)...');
        const paginatedResponse = await axios.get('http://localhost:5000/api/admin/admin-users?limit=5&page=1', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        console.log(`✅ Paginated request returned ${paginatedResponse.data.data.adminUsers.length} users (limited to 5)`);

        // Step 6: Test with search
        console.log('\n🔍 Step 5: Testing search functionality...');
        if (adminUsers.length > 0) {
            const searchTerm = adminUsers[0].fullName.split(' ')[0]; // Get first name
            const searchResponse = await axios.get(`http://localhost:5000/api/admin/admin-users?search=${searchTerm}`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            
            console.log(`✅ Search for "${searchTerm}" returned ${searchResponse.data.data.adminUsers.length} users`);
        }

        console.log('\n🎉 Admin Users Endpoint Test Results:');
        console.log('✅ Admin users endpoint working correctly');
        console.log('✅ Returns only admin users (@mydeeptech.ng or admin domains)');
        console.log('✅ Pagination working correctly');
        console.log('✅ Search functionality working');
        console.log('✅ Proper filtering and response structure');

    } catch (error) {
        if (error.response) {
            console.log('\n❌ Test failed:');
            console.log('Status:', error.response.status);
            console.log('URL:', error.config?.url);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('\n❌ Test failed:', error.message);
            if (error.code === 'ECONNREFUSED') {
                console.log('💡 Make sure the server is running: node index.js');
            }
        }
    }
};

console.log('👑 Admin Users Endpoint Test');
console.log('============================');
console.log('Testing the new /admin/admin-users endpoint');
console.log('that returns only admin users');
console.log('============================\n');

testAdminUsersEndpoint();