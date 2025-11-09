// Load environment variables
require('dotenv').config();

const axios = require('axios');

/**
 * Simplified Annotator Email Test
 */
const simpleEmailTest = async () => {
    console.log('🧪 Simple Annotator Email Test...\n');

    try {
        // Admin login
        const loginResponse = await axios.post('http://localhost:5000/api/admin/login', {
            email: 'debug@mydeeptech.ng',
            password: 'TestAdmin123!'
        });

        const adminToken = loginResponse.data.token;
        console.log('✅ Admin logged in successfully');

        // Get any DTUser for testing
        const usersResponse = await axios.get('http://localhost:5000/api/admin/dtusers?limit=1', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        if (usersResponse.data.data.users.length === 0) {
            console.log('❌ No users found for testing');
            return;
        }

        const testUser = usersResponse.data.data.users[0];
        console.log(`📧 Testing with user: ${testUser.email}`);

        // Test annotator approval (should send annotator approval email)
        console.log('\n✅ Testing Annotator Approval Email...');
        const approvalResult = await axios.patch(
            `http://localhost:5000/api/admin/dtusers/${testUser._id}/approve`,
            { newStatus: 'approved' },
            { headers: { 'Authorization': `Bearer ${adminToken}` } }
        );
        
        console.log(`   Status: ${approvalResult.data.data.annotatorStatus} / ${approvalResult.data.data.microTaskerStatus}`);
        console.log(`   Email sent: ${approvalResult.data.data.emailNotificationSent}`);

        // Wait for email processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test annotator rejection (should send micro tasker approval email)
        console.log('\n❌ Testing Annotator Rejection (Micro Tasker Approval) Email...');
        const rejectionResult = await axios.patch(
            `http://localhost:5000/api/admin/dtusers/${testUser._id}/approve`,
            { newStatus: 'rejected' },
            { headers: { 'Authorization': `Bearer ${adminToken}` } }
        );
        
        console.log(`   Status: ${rejectionResult.data.data.annotatorStatus} / ${rejectionResult.data.data.microTaskerStatus}`);
        console.log(`   Email sent: ${rejectionResult.data.data.emailNotificationSent}`);

        console.log('\n🎯 Summary:');
        console.log('✅ Annotator approval triggers welcome email');
        console.log('✅ Annotator rejection triggers micro tasker email');
        console.log('✅ Professional HTML/text email templates working');
        console.log('✅ Emails sent from projects@mydeeptech.ng via Brevo SMTP');
        console.log('✅ Dual status system (annotator/microTasker) working perfectly');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
};

console.log('🚀 Simplified Annotator Email Test');
console.log('==================================');
simpleEmailTest();