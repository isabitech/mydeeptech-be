const axios = require('axios');
const { getAllPending } = require('./utils/adminVerificationStore.js');

const BASE_URL = 'http://localhost:5000/api';

/**
 * Test Admin OTP Creation and Immediate Verification
 */
const testAdminOTPFlow = async () => {
    console.log('🧪 Testing Admin OTP Creation and Verification...\n');

    try {
        // Step 1: Create admin account
        console.log('📝 Creating admin account...');
        const createResponse = await axios.post(`${BASE_URL}/admin/create`, {
            fullName: 'Test Admin New',
            email: 'testnew@mydeeptech.ng',
            phone: '+1234567890',
            password: 'TestAdmin123!',
            confirmPassword: 'TestAdmin123!',
            adminKey: 'super-secret-admin-key-2024'
        });

        console.log('\n✅ Admin Account Created!');
        console.log('Status:', createResponse.status);
        console.log('Message:', createResponse.data.message);
        console.log('OTP Verification Required:', createResponse.data.otpVerificationRequired);
        
        // Step 2: Immediately check stored OTP codes
        console.log('\n🔍 Checking stored OTP codes immediately...');
        
        // Wait a moment for async operations to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pending = await getAllPending();
        
        if (pending.length === 0) {
            console.log('❌ No OTP codes found in storage');
        } else {
            console.log(`✅ Found ${pending.length} OTP code(s):\n`);
            
            pending.forEach(([email, data], index) => {
                console.log(`${index + 1}. Email: ${email}`);
                console.log(`   OTP Code: ${data.code}`);
                console.log(`   Admin Name: ${data.adminData?.fullName || 'Unknown'}`);
                console.log(`   TTL: ${data.ttl || 'N/A'}s remaining`);
                console.log('');
            });

            // Step 3: Use the actual OTP for verification
            if (pending.length > 0) {
                const [testEmail, otpData] = pending.find(([email]) => email === 'testnew@mydeeptech.ng') || pending[0];
                const actualOTP = otpData.code;
                
                console.log(`🔐 Testing OTP verification with actual code: ${actualOTP}`);
                
                const otpResponse = await axios.post(`${BASE_URL}/admin/verify-otp`, {
                    email: testEmail,
                    otp: actualOTP
                });

                console.log('\n✅ OTP Verification Successful!');
                console.log('Status:', otpResponse.status);
                console.log('Message:', otpResponse.data.message);
                
                if (otpResponse.data.token) {
                    console.log('JWT Token received:', otpResponse.data.token.substring(0, 30) + '...');
                }

                // Step 4: Test login after OTP verification
                console.log('\n🔑 Testing login after OTP verification...');
                const loginResponse = await axios.post(`${BASE_URL}/admin/login`, {
                    email: testEmail,
                    password: 'TestAdmin123!'
                });

                console.log('✅ Login successful after OTP verification!');
                console.log('Status:', loginResponse.status);
                console.log('Admin Token:', loginResponse.data.token?.substring(0, 30) + '...');
            }
        }

    } catch (error) {
        if (error.response) {
            console.log('❌ Test failed:');
            console.log('Status:', error.response.status);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('❌ Test failed:', error.message);
        }
    }
};

testAdminOTPFlow().then(() => {
    console.log('\n🎉 Complete OTP test flow finished!');
    process.exit(0);
});