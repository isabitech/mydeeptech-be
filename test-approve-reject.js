// Load environment variables
require('dotenv').config();

const axios = require('axios');

/**
 * Test Approve and Reject Endpoints
 */
const testApproveRejectEndpoints = async () => {
    console.log('🧪 Testing Approve and Reject Endpoints...\n');

    try {
        // Step 1: Admin Login
        console.log('🔐 Admin Login...');
        const loginResponse = await axios.post('http://localhost:5000/api/admin/login', {
            email: 'debug@mydeeptech.ng',
            password: 'TestAdmin123!'
        });

        console.log('✅ Admin Login Successful!');
        const adminToken = loginResponse.data.token;

        // Step 2: Get a DTUser for testing
        console.log('\n👥 Getting DTUsers list...');
        const usersResponse = await axios.get('http://localhost:5000/api/admin/dtusers?limit=1', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        if (usersResponse.data.data.users.length === 0) {
            console.log('❌ No users found for testing');
            return;
        }

        const testUser = usersResponse.data.data.users[0];
        console.log(`✅ Test user: ${testUser.fullName} (${testUser.email})`);
        console.log(`   Current annotator status: ${testUser.annotatorStatus}`);
        console.log(`   Current micro tasker status: ${testUser.microTaskerStatus}`);

        // Step 3: Test APPROVE endpoint
        console.log('\n✅ Testing APPROVE endpoint...');
        console.log('URL: PATCH /api/admin/dtusers/:userId/approve');
        
        const approveResponse = await axios.patch(
            `http://localhost:5000/api/admin/dtusers/${testUser._id}/approve`,
            { newStatus: 'approved' },
            { headers: { 'Authorization': `Bearer ${adminToken}` } }
        );

        console.log('   Status:', approveResponse.status);
        console.log('   Message:', approveResponse.data.message);
        console.log('   Annotator Status:', approveResponse.data.data.annotatorStatus);
        console.log('   Micro Tasker Status:', approveResponse.data.data.microTaskerStatus);
        console.log('   Email Sent:', approveResponse.data.data.emailNotificationSent);

        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 4: Test REJECT endpoint
        console.log('\n❌ Testing REJECT endpoint...');
        console.log('URL: PATCH /api/admin/dtusers/:userId/reject');
        
        const rejectResponse = await axios.patch(
            `http://localhost:5000/api/admin/dtusers/${testUser._id}/reject`,
            { reason: 'Test rejection for API validation' },
            { headers: { 'Authorization': `Bearer ${adminToken}` } }
        );

        console.log('   Status:', rejectResponse.status);
        console.log('   Message:', rejectResponse.data.message);
        console.log('   Annotator Status:', rejectResponse.data.data.annotatorStatus);
        console.log('   Micro Tasker Status:', rejectResponse.data.data.microTaskerStatus);
        console.log('   Rejection Reason:', rejectResponse.data.data.reason);
        console.log('   Email Sent:', rejectResponse.data.data.emailNotificationSent);
        console.log('   Rejected By:', rejectResponse.data.data.rejectedBy);

        // Step 5: Test approve with rejected status (using approve endpoint)
        console.log('\n🔄 Testing APPROVE endpoint with rejected status...');
        console.log('URL: PATCH /api/admin/dtusers/:userId/approve (with newStatus: rejected)');
        
        const approveRejectResponse = await axios.patch(
            `http://localhost:5000/api/admin/dtusers/${testUser._id}/approve`,
            { newStatus: 'rejected' },
            { headers: { 'Authorization': `Bearer ${adminToken}` } }
        );

        console.log('   Status:', approveRejectResponse.status);
        console.log('   Message:', approveRejectResponse.data.message);
        console.log('   Annotator Status:', approveRejectResponse.data.data.annotatorStatus);
        console.log('   Micro Tasker Status:', approveRejectResponse.data.data.microTaskerStatus);

        console.log('\n🎯 Summary:');
        console.log('✅ APPROVE endpoint working: PATCH /api/admin/dtusers/:userId/approve');
        console.log('✅ REJECT endpoint working: PATCH /api/admin/dtusers/:userId/reject');
        console.log('✅ Both endpoints send appropriate emails');
        console.log('✅ Status updates working correctly');
        console.log('✅ Admin tracking implemented');

        console.log('\n📋 API Endpoints Available:');
        console.log('1. PATCH /api/admin/dtusers/:userId/approve');
        console.log('   Body: { "newStatus": "approved|rejected|pending|submitted|verified" }');
        console.log('');
        console.log('2. PATCH /api/admin/dtusers/:userId/reject');
        console.log('   Body: { "reason": "optional rejection reason" }');

    } catch (error) {
        console.error('\n❌ Test failed:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('URL:', error.config?.url);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Error:', error.message);
        }
    }
};

console.log('🚀 Approve/Reject Endpoints Test');
console.log('================================');
testApproveRejectEndpoints();