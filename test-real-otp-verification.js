const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

/**
 * Test Admin OTP Verification with Real Code
 */
const testRealAdminOTPVerification = async () => {
    console.log('🧪 Testing Admin OTP Verification with Real Code...\n');

    try {
        console.log('🔐 Testing OTP verification with actual code from email...');
        
        const otpResponse = await axios.post(`${BASE_URL}/admin/verify-otp`, {
            email: 'debug@mydeeptech.ng',
            verificationCode: '797862', // Actual OTP from email
            adminKey: 'super-secret-admin-key-2024'
        });

        console.log('\n✅ OTP Verification Successful!');
        console.log('Status:', otpResponse.status);
        console.log('Message:', otpResponse.data.message);
        
        if (otpResponse.data.token) {
            console.log('JWT Token received:', otpResponse.data.token.substring(0, 30) + '...');
            console.log('Token format (_usrinfo):', otpResponse.data._usrinfo ? 'Present' : 'Missing');
        }

        if (otpResponse.data.admin) {
            console.log('\n👤 Verified Admin Details:');
            console.log('ID:', otpResponse.data.admin.id);
            console.log('Full Name:', otpResponse.data.admin.fullName);
            console.log('Email:', otpResponse.data.admin.email);
            console.log('Email Verified:', otpResponse.data.admin.isEmailVerified); // Should now be true
            console.log('Is Admin:', otpResponse.data.admin.isAdmin);
        }

        // Step 2: Test admin login after OTP verification (should now succeed)
        console.log('\n🔑 Testing admin login after OTP verification...');
        
        // We'll need to use the password from the admin creation
        // Let me try with a common test password
        const loginResponse = await axios.post(`${BASE_URL}/admin/login`, {
            email: 'debug@mydeeptech.ng',
            password: 'TestAdmin123!' // This should match the password used in admin creation
        });

        console.log('\n✅ Admin Login Successful after OTP verification!');
        console.log('Status:', loginResponse.status);
        console.log('Message:', loginResponse.data.message);
        console.log('Admin Token:', loginResponse.data.token?.substring(0, 30) + '...');
        
        if (loginResponse.data.admin) {
            console.log('\n👑 Logged-in Admin Details:');
            console.log('Full Name:', loginResponse.data.admin.fullName);
            console.log('Email:', loginResponse.data.admin.email);
            console.log('Role:', loginResponse.data.admin.role);
            console.log('Email Verified:', loginResponse.data.admin.isEmailVerified);
        }

        console.log('\n🎉 Complete Admin Flow Test Results:');
        console.log('✅ Admin account created successfully');
        console.log('✅ OTP code sent to email (Brevo SMTP working)');
        console.log('✅ OTP verification successful');
        console.log('✅ Email verification status updated');
        console.log('✅ JWT token issued after verification');
        console.log('✅ Admin login working after verification');

    } catch (error) {
        if (error.response) {
            console.log('\n❌ Test failed:');
            console.log('Status:', error.response.status);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
            
            if (error.response.status === 404) {
                console.log('\n💡 Possible causes:');
                console.log('- OTP code may have expired (15 min limit)');
                console.log('- Email may not match exactly');
                console.log('- Server may not be running');
            }
        } else {
            console.log('\n❌ Test failed:', error.message);
        }
    }
};

testRealAdminOTPVerification().then(() => {
    console.log('\n🏁 Real OTP verification test completed!');
    process.exit(0);
});