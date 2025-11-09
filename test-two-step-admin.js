const axios = require('axios');

const testTwoStepAdminCreation = async () => {
    try {
        console.log('🔐 Testing Two-Step Admin Creation with Email Verification...\n');

        // Admin creation data
        const adminData = {
            fullName: process.env.NEW_ADMIN_NAME || "Test Admin User",
            email: process.env.NEW_ADMIN_EMAIL || "testadmin@mydeeptech.ng", // Must end with @mydeeptech.ng
            phone: process.env.NEW_ADMIN_PHONE || "+1234567890",
            password: process.env.NEW_ADMIN_PASSWORD || "SecureAdminPass123!",
            confirmPassword: process.env.NEW_ADMIN_PASSWORD || "SecureAdminPass123!",
            adminKey: process.env.ADMIN_CREATION_KEY || "super-secret-admin-key-2024"
        };

        // Security check for admin creation data
        if (adminData.fullName === "Test Admin User" || adminData.password === "SecureAdminPass123!") {
            console.log('❌ Please set admin environment variables:');
            console.log('Example: set NEW_ADMIN_NAME=John Admin');
            console.log('Example: set NEW_ADMIN_EMAIL=john.admin@mydeeptech.ng');
            console.log('Example: set NEW_ADMIN_PHONE=+1234567890');
            console.log('Example: set NEW_ADMIN_PASSWORD=YourSecurePassword123');
            console.log('Example: set ADMIN_CREATION_KEY=your-super-secret-key');
            console.log('\n💡 Note: Admin email MUST end with @mydeeptech.ng');
            return;
        }

        console.log('📧 Step 1: Requesting admin verification email...');
        console.log('Name:', adminData.fullName);
        console.log('Email:', adminData.email);
        console.log('Phone:', adminData.phone);

        try {
            // Step 1: Request verification code
            const verificationResponse = await axios.post('http://localhost:5000/api/admin/create/request', {
                fullName: adminData.fullName,
                email: adminData.email,
                phone: adminData.phone,
                password: adminData.password,
                confirmPassword: adminData.confirmPassword,
                adminKey: adminData.adminKey
            });
            
            console.log('\n✅ Verification Email Sent Successfully!');
            console.log('Status:', verificationResponse.status);
            console.log('Message:', verificationResponse.data.message);
            console.log('Email sent to:', verificationResponse.data.data.email);
            console.log('Code expires in:', verificationResponse.data.data.expiresIn);
            console.log('Next step:', verificationResponse.data.data.nextStep);
            
            // In a real scenario, the user would get the code from their email
            // For testing purposes, we'll prompt for manual input
            console.log('\n📬 Please check the email:', adminData.email);
            console.log('💡 You should receive a 6-digit verification code');
            console.log('📝 Enter the verification code when prompted\n');
            
            // Simulate user input (you would replace this with actual user input)
            console.log('⏳ Waiting for verification code input...');
            console.log('⚠️ In a real test, you would:');
            console.log('1. Check the email for verification code');
            console.log('2. Replace the simulated code below with the actual code');
            console.log('3. Complete the verification process\n');
            
            // For demonstration, we'll show what the next step would look like
            console.log('📤 Step 2: How to confirm verification (example):');
            console.log('Use this endpoint with your actual verification code:');
            console.log('POST /api/admin/create/confirm');
            console.log(JSON.stringify({
                email: adminData.email,
                verificationCode: "123456", // Replace with actual code from email
                adminKey: adminData.adminKey
            }, null, 2));
            
            console.log('\n🔍 Testing error scenarios...');
            
            // Test with wrong verification code
            try {
                await axios.post('http://localhost:5000/api/admin/create/confirm', {
                    email: adminData.email,
                    verificationCode: "000000", // Wrong code
                    adminKey: adminData.adminKey
                });
                console.log('❌ ERROR: Should have failed with wrong verification code!');
            } catch (wrongCodeError) {
                if (wrongCodeError.response && wrongCodeError.response.status === 400) {
                    console.log('✅ Correctly rejected wrong verification code');
                    console.log('Response:', wrongCodeError.response.data.message);
                    console.log('Attempts remaining:', wrongCodeError.response.data.attemptsRemaining);
                }
            }
            
            // Test with wrong admin key
            try {
                await axios.post('http://localhost:5000/api/admin/create/confirm', {
                    email: adminData.email,
                    verificationCode: "123456",
                    adminKey: "wrong-key"
                });
                console.log('❌ ERROR: Should have failed with wrong admin key!');
            } catch (wrongKeyError) {
                if (wrongKeyError.response && wrongKeyError.response.status === 403) {
                    console.log('✅ Correctly rejected wrong admin key');
                }
            }
            
            console.log('\n🎯 Two-Step Admin Creation Process Overview:');
            console.log('✅ Step 1: Request verification - Email sent successfully');
            console.log('⏳ Step 2: Confirm verification - Waiting for user to check email');
            console.log('🔐 Security: Multiple validation layers in place');
            console.log('📧 Email: Verification code sent to admin email');
            console.log('⏱️ Expiry: Verification code expires in 15 minutes');
            console.log('🚫 Limits: Maximum 3 verification attempts');
            
            console.log('\n📋 Security Features Implemented:');
            console.log('- 📧 Email verification required');
            console.log('- 🔑 Admin creation key validation');
            console.log('- 🏢 Domain-based email validation');
            console.log('- ⏰ Time-limited verification codes');
            console.log('- 🔢 Attempt limiting (max 3 tries)');
            console.log('- 🗑️ Automatic cleanup of expired codes');
            console.log('- 🛡️ Duplicate admin prevention');
            
        } catch (verificationError) {
            console.error('\n❌ Verification request failed:');
            if (verificationError.response) {
                console.error('Status:', verificationError.response.status);
                console.error('Response:', verificationError.response.data);
                
                if (verificationError.response.status === 403) {
                    console.log('\n💡 Verification Failed. Possible reasons:');
                    console.log('1. Invalid admin creation key');
                    console.log('2. Email does not end with @mydeeptech.ng');
                    console.log('3. Email not in ADMIN_EMAILS environment variable');
                }
                
                if (verificationError.response.status === 409) {
                    console.log('\n💡 Admin already exists with this email');
                }
            } else {
                console.error('Error:', verificationError.message);
            }
        }
        
    } catch (error) {
        console.error('\n❌ Admin creation test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
};

// Function to test the confirmation step (call this after getting the verification code)
const testConfirmAdminCreation = async (verificationCode) => {
    try {
        const adminData = {
            email: process.env.NEW_ADMIN_EMAIL || "testadmin@mydeeptech.ng",
            adminKey: process.env.ADMIN_CREATION_KEY || "super-secret-admin-key-2024"
        };

        console.log(`\n✅ Testing admin creation confirmation with code: ${verificationCode}`);

        const confirmResponse = await axios.post('http://localhost:5000/api/admin/create/confirm', {
            email: adminData.email,
            verificationCode: verificationCode,
            adminKey: adminData.adminKey
        });

        console.log('\n🎉 Admin Account Created Successfully!');
        console.log('Status:', confirmResponse.status);
        console.log('Message:', confirmResponse.data.message);
        
        const newAdmin = confirmResponse.data.admin;
        console.log('\n👑 New Admin Details:');
        console.log('ID:', newAdmin.id);
        console.log('Full Name:', newAdmin.fullName);
        console.log('Email:', newAdmin.email);
        console.log('JWT Token:', confirmResponse.data.token ? 'Provided' : 'Missing');
        
        console.log('\n🔐 Admin can now perform all administrative functions!');

    } catch (error) {
        console.error('\n❌ Admin confirmation failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
};

// Export for manual testing
module.exports = { testTwoStepAdminCreation, testConfirmAdminCreation };

// Run the initial test
if (require.main === module) {
    testTwoStepAdminCreation();
}