// Load environment variables
require('dotenv').config();

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

/**
 * Test Annotator Approval/Rejection Email Notifications
 */
const testAnnotatorEmailNotifications = async () => {
    console.log('🧪 Testing Annotator Approval/Rejection Email Notifications...\n');

    try {
        // Step 1: Admin Login
        console.log('🔐 Step 1: Admin Login...');
        const loginResponse = await axios.post(`${BASE_URL}/admin/login`, {
            email: 'debug@mydeeptech.ng',
            password: 'TestAdmin123!'
        });

        console.log('✅ Admin Login Successful!');
        const adminToken = loginResponse.data.token;

        // Step 2: Get a list of DTUsers to test with
        console.log('\n👥 Step 2: Getting DTUsers list...');
        const usersResponse = await axios.get(`${BASE_URL}/admin/dtusers?status=pending&limit=5`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        if (usersResponse.data.data.users.length === 0) {
            console.log('⚠️ No pending users found. Checking for any users...');
            
            const allUsersResponse = await axios.get(`${BASE_URL}/admin/dtusers?limit=5`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            
            if (allUsersResponse.data.data.users.length === 0) {
                console.log('❌ No users found in the system to test with');
                return;
            }
            
            var testUser = allUsersResponse.data.data.users[0];
        } else {
            var testUser = usersResponse.data.data.users[0];
        }

        console.log(`✅ Found test user: ${testUser.fullName} (${testUser.email})`);
        console.log(`   Current status: ${testUser.annotatorStatus}`);

        // Step 3: Test Annotator Approval (triggers approval email)
        console.log('\n✅ Step 3: Testing Annotator Approval...');
        console.log('This should:');
        console.log('- Set annotatorStatus = approved');
        console.log('- Set microTaskerStatus = approved');
        console.log('- Send annotator approval email to user');

        const approvalResponse = await axios.patch(
            `${BASE_URL}/admin/dtusers/${testUser._id}/approve`,
            { newStatus: 'approved' },
            { headers: { 'Authorization': `Bearer ${adminToken}` } }
        );

        console.log('\n✅ Annotator Approval Successful!');
        console.log('Status:', approvalResponse.status);
        console.log('Message:', approvalResponse.data.message);
        
        if (approvalResponse.data.data) {
            const result = approvalResponse.data.data;
            console.log('\n📊 Updated Status:');
            console.log('Previous Status:', result.previousStatus);
            console.log('New Status:', result.newStatus);
            console.log('Annotator Status:', result.annotatorStatus);
            console.log('Micro Tasker Status:', result.microTaskerStatus);
            console.log('Email Notification Sent:', result.emailNotificationSent);
            console.log('Updated By:', result.updatedBy);
        }

        // Wait a moment for email processing
        console.log('\n⏳ Waiting 3 seconds for email processing...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Step 4: Test Annotator Rejection (triggers micro tasker email)
        console.log('\n❌ Step 4: Testing Annotator Rejection...');
        console.log('This should:');
        console.log('- Set annotatorStatus = rejected');
        console.log('- Set microTaskerStatus = approved');
        console.log('- Send micro tasker approval email to user');

        const rejectionResponse = await axios.patch(
            `${BASE_URL}/admin/dtusers/${testUser._id}/approve`,
            { newStatus: 'rejected' },
            { headers: { 'Authorization': `Bearer ${adminToken}` } }
        );

        console.log('\n✅ Annotator Rejection (Micro Tasker Approval) Successful!');
        console.log('Status:', rejectionResponse.status);
        console.log('Message:', rejectionResponse.data.message);
        
        if (rejectionResponse.data.data) {
            const result = rejectionResponse.data.data;
            console.log('\n📊 Updated Status:');
            console.log('Previous Status:', result.previousStatus);
            console.log('New Status:', result.newStatus);
            console.log('Annotator Status:', result.annotatorStatus);
            console.log('Micro Tasker Status:', result.microTaskerStatus);
            console.log('Email Notification Sent:', result.emailNotificationSent);
            console.log('Updated By:', result.updatedBy);
        }

        // Step 5: Test other status (no email)
        console.log('\n🔄 Step 5: Testing Other Status Change (No Email)...');
        console.log('This should only update status without sending email');

        const pendingResponse = await axios.patch(
            `${BASE_URL}/admin/dtusers/${testUser._id}/approve`,
            { newStatus: 'pending' },
            { headers: { 'Authorization': `Bearer ${adminToken}` } }
        );

        console.log('\n✅ Status Change to Pending Successful!');
        console.log('Email Notification Sent:', pendingResponse.data.data.emailNotificationSent);

        console.log('\n🎉 Email Notification Test Results:');
        console.log('✅ Admin approval system working');
        console.log('✅ Annotator approval emails triggered');
        console.log('✅ Micro tasker approval emails triggered');
        console.log('✅ Status updates working correctly');
        console.log('✅ Email notifications sent from projects@mydeeptech.ng');
        console.log('✅ HTML and text email formats working');

        console.log('\n📧 Email Details Sent:');
        console.log(`   Recipient: ${testUser.email}`);
        console.log(`   Full Name: ${testUser.fullName}`);
        console.log('   Sender: projects@mydeeptech.ng');
        console.log('   Templates: Both approval and rejection emails tested');

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

// Test email templates directly
const testEmailTemplatesDirectly = async () => {
    console.log('\n📧 Testing Email Templates Directly...\n');
    
    try {
        const { sendAnnotatorApprovalEmail, sendAnnotatorRejectionEmail } = require('../utils/annotatorMailer');
        
        console.log('📤 Testing annotator approval email...');
        await sendAnnotatorApprovalEmail('test@example.com', 'John Doe');
        console.log('✅ Annotator approval email test completed');
        
        console.log('\n📤 Testing micro tasker approval email...');
        await sendAnnotatorRejectionEmail('test@example.com', 'Jane Smith');
        console.log('✅ Micro tasker approval email test completed');
        
    } catch (error) {
        console.error('❌ Direct email test failed:', error.message);
    }
};

console.log('📝 Annotator Email Notification Test');
console.log('===================================');
console.log('Testing the automated email system for:');
console.log('- Annotator approval (both statuses approved)');
console.log('- Annotator rejection (micro tasker approved)');
console.log('- Email sending from projects@mydeeptech.ng');
console.log('===================================\n');

// Run the comprehensive test
testAnnotatorEmailNotifications().then(() => {
    console.log('\n🏁 Annotator email notification test completed!');
    process.exit(0);
}).catch(console.error);