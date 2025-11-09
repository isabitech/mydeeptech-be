// Load environment variables
require('dotenv').config();

const axios = require('axios');

/**
 * Test Admin DTUsers Endpoint Filtering
 */
const testAdminDTUsersFiltering = async () => {
    console.log('🧪 Testing Admin DTUsers Endpoint Filtering...\n');

    try {
        // Step 1: Admin Login
        console.log('🔐 Step 1: Admin Login...');
        const loginResponse = await axios.post('http://localhost:5000/api/admin/login', {
            email: 'debug@mydeeptech.ng',
            password: 'TestAdmin123!'
        });

        console.log('✅ Admin Login Successful!');
        const adminToken = loginResponse.data.token;

        // Step 2: Get all DTUsers
        console.log('\n👥 Step 2: Getting all DTUsers...');
        const usersResponse = await axios.get('http://localhost:5000/api/admin/dtusers', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        const users = usersResponse.data.data.users;
        console.log(`✅ Retrieved ${users.length} users`);

        // Step 3: Check for admin users in the results
        console.log('\n🔍 Step 3: Analyzing user list for admin accounts...');
        
        let adminUsersFound = 0;
        let regularUsersFound = 0;

        users.forEach((user, index) => {
            const isAdminEmail = user.email.toLowerCase().endsWith('@mydeeptech.ng');
            const hasAdminDomains = user.domains && (
                user.domains.includes('Administration') || 
                user.domains.includes('Management')
            );

            if (isAdminEmail || hasAdminDomains) {
                adminUsersFound++;
                console.log(`❌ ADMIN USER FOUND: ${user.email} (${user.fullName})`);
                if (hasAdminDomains) {
                    console.log(`   Admin domains: ${user.domains.join(', ')}`);
                }
            } else {
                regularUsersFound++;
            }
        });

        console.log(`\n📊 Results Summary:`);
        console.log(`   Regular users (annotators/micro-taskers): ${regularUsersFound}`);
        console.log(`   Admin users: ${adminUsersFound}`);

        if (adminUsersFound === 0) {
            console.log('\n🎉 SUCCESS: No admin users found in DTUsers endpoint!');
            console.log('✅ Admin filtering is working correctly');
            console.log('✅ Only annotators and micro-taskers are returned');
        } else {
            console.log('\n❌ FAILURE: Admin users found in DTUsers endpoint!');
            console.log('⚠️  Admin filtering is NOT working correctly');
        }

        // Step 4: Show sample users
        console.log('\n📝 Sample Users (first 3):');
        users.slice(0, 3).forEach((user, index) => {
            console.log(`   ${index + 1}. ${user.fullName} (${user.email})`);
            console.log(`      Annotator Status: ${user.annotatorStatus}`);
            console.log(`      Micro Tasker Status: ${user.microTaskerStatus}`);
            console.log(`      Domains: ${user.domains ? user.domains.join(', ') : 'None'}`);
            console.log('');
        });

    } catch (error) {
        if (error.response) {
            console.log('\n❌ Test failed:');
            console.log('Status:', error.response.status);
            console.log('URL:', error.config?.url);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('\n❌ Test failed:', error.message);
        }
    }
};

console.log('🔒 Admin DTUsers Filtering Test');
console.log('===============================');
console.log('Testing that /admin/dtusers endpoint excludes admin users');
console.log('and only returns annotators and micro-taskers');
console.log('===============================\n');

testAdminDTUsersFiltering();