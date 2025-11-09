const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: './.env' });

const testCreateAdmin = async () => {
    try {
        console.log('👑 Testing Admin Account Creation...\n');

        // Debug: Show loaded environment variables
        console.log('🔍 Environment Variables:');
        console.log('NEW_ADMIN_NAME:', process.env.NEW_ADMIN_NAME || 'NOT SET');
        console.log('NEW_ADMIN_EMAIL:', process.env.NEW_ADMIN_EMAIL || 'NOT SET');
        console.log('NEW_ADMIN_PHONE:', process.env.NEW_ADMIN_PHONE || 'NOT SET');
        console.log('NEW_ADMIN_PASSWORD:', process.env.NEW_ADMIN_PASSWORD ? '[HIDDEN]' : 'NOT SET');
        console.log('ADMIN_CREATION_KEY:', process.env.ADMIN_CREATION_KEY ? '[HIDDEN]' : 'NOT SET');
        console.log('');

        // Admin creation data
        const adminData = {
            fullName: process.env.NEW_ADMIN_NAME || "Admin User",
            email: process.env.NEW_ADMIN_EMAIL || "dammy@mydeeptech.ng", // Must end with @mydeeptech.ng
            phone: process.env.NEW_ADMIN_PHONE || "+1234567890",
            password: process.env.NEW_ADMIN_PASSWORD || "AdminPassword123!",
            confirmPassword: process.env.NEW_ADMIN_PASSWORD || "AdminPassword123!",
            adminKey: process.env.ADMIN_CREATION_KEY || "super-secret-admin-key-2024"
        };

        // Security check for admin creation data
        if (adminData.fullName === "Admin User" || adminData.password === "AdminPassword123!") {
            console.log('❌ Please set admin environment variables:');
            console.log('Example: set NEW_ADMIN_NAME=John Admin');
            console.log('Example: set NEW_ADMIN_EMAIL=john.admin@mydeeptech.ng');
            console.log('Example: set NEW_ADMIN_PHONE=+1234567890');
            console.log('Example: set NEW_ADMIN_PASSWORD=YourSecurePassword123');
            console.log('Example: set ADMIN_CREATION_KEY=your-super-secret-key');
            console.log('\n💡 Note: Admin email MUST end with @mydeeptech.ng');
            return;
        }

        console.log('📤 Creating admin account...');
        console.log('Name:', adminData.fullName);
        console.log('Email:', adminData.email);
        console.log('Phone:', adminData.phone);

        try {
            const createResponse = await axios.post('http://localhost:5000/api/admin/create', {
                fullName: adminData.fullName,
                email: adminData.email,
                phone: adminData.phone,
                password: adminData.password,
                confirmPassword: adminData.confirmPassword,
                adminKey: adminData.adminKey
            });
            
            console.log('\n✅ Admin Account Created Successfully!');
            console.log('Status:', createResponse.status);
            console.log('Message:', createResponse.data.message);
            
            const newAdmin = createResponse.data.admin;
            console.log('\n👑 New Admin Details:');
            console.log('ID:', newAdmin.id);
            console.log('Full Name:', newAdmin.fullName);
            console.log('Email:', newAdmin.email);
            console.log('Phone:', newAdmin.phone);
            console.log('Domains:', newAdmin.domains);
            console.log('Email Verified:', newAdmin.isEmailVerified);
            console.log('Password Set:', newAdmin.hasSetPassword);
            console.log('Annotator Status:', newAdmin.annotatorStatus);
            console.log('MicroTasker Status:', newAdmin.microTaskerStatus);
            console.log('Is Admin:', newAdmin.isAdmin);
            
            // Test immediate login with created admin
            console.log('\n🔐 Testing immediate login with created admin...');
            const adminToken = createResponse.data._usrinfo.data;
            console.log('JWT Token Length:', adminToken.length);
            
            // Test admin functionality immediately
            console.log('\n📊 Testing admin access with new account...');
            
            const adminTestResponse = await axios.get(
                'http://localhost:5000/api/admin/dtusers?limit=5',
                {
                    headers: {
                        'Authorization': `Bearer ${adminToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('✅ Admin access test successful!');
            console.log('Retrieved', adminTestResponse.data.data.users.length, 'users');
            console.log('Total users in system:', adminTestResponse.data.data.summary.totalUsers);
            
            console.log('\n🎯 Admin account creation and verification complete!');
            console.log('🔑 Admin can now perform all administrative functions');

        } catch (createError) {
            console.error('\n❌ Admin creation failed:');
            if (createError.response) {
                console.error('Status:', createError.response.status);
                console.error('Response:', createError.response.data);
                
                if (createError.response.status === 403) {
                    console.log('\n💡 Admin Creation Failed. Possible reasons:');
                    console.log('1. Invalid admin creation key');
                    console.log('2. Email does not end with @mydeeptech.ng');
                    console.log('3. Email not in ADMIN_EMAILS environment variable');
                    console.log('\nCurrent admin creation key from env:', process.env.ADMIN_CREATION_KEY || 'super-secret-admin-key-2024');
                }
                
                if (createError.response.status === 409) {
                    console.log('\n💡 Admin already exists with this email');
                    console.log('Try using a different email address');
                }
                
                if (createError.response.status === 400) {
                    console.log('\n💡 Validation Error:');
                    console.log('Check that all required fields are provided correctly');
                }
            } else {
                console.error('Error:', createError.message);
            }
        }

        // Test creating admin with invalid data
        console.log('\n🧪 Testing validation with invalid data...');
        
        try {
            await axios.post('http://localhost:5000/api/admin/create', {
                fullName: "Test Admin",
                email: "invalid@gmail.com", // Invalid domain
                phone: "+1234567890",
                password: "password123",
                confirmPassword: "password123",
                adminKey: adminData.adminKey
            });
            
            console.log('❌ ERROR: Should have failed with invalid email domain!');
        } catch (validationError) {
            if (validationError.response && validationError.response.status === 400) {
                console.log('✅ Validation correctly rejected invalid email domain');
            }
        }

        // Test with wrong admin key
        try {
            await axios.post('http://localhost:5000/api/admin/create', {
                fullName: "Test Admin",
                email: "test@mydeeptech.ng",
                phone: "+1234567890",
                password: "password123",
                confirmPassword: "password123",
                adminKey: "wrong-key"
            });
            
            console.log('❌ ERROR: Should have failed with wrong admin key!');
        } catch (keyError) {
            if (keyError.response && keyError.response.status === 403) {
                console.log('✅ Security correctly rejected wrong admin key');
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

// Run the test
testCreateAdmin();