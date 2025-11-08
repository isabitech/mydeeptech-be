const axios = require('axios');

const testDTUserLoginWithJWT = async () => {
    try {
        console.log('🚀 Testing DTUser Login with JWT...\n');

        // Test data - use environment variables or prompt for real credentials
        const loginData = {
            email: process.env.TEST_USER_EMAIL || "test@example.com", // Use env variable or placeholder
            password: process.env.TEST_USER_PASSWORD || "your-password-here" // Use env variable or placeholder
        };

        // Security check - prevent running with placeholder values
        if (loginData.email === "test@example.com" || loginData.password === "your-password-here") {
            console.log('❌ Please set TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables');
            console.log('Example: set TEST_USER_EMAIL=your-email@example.com');
            console.log('Example: set TEST_USER_PASSWORD=your-actual-password');
            return;
        }

        console.log('📤 Sending login request...');
        console.log('Email:', loginData.email);
        
        const response = await axios.post('http://localhost:5000/api/auth/dtUserLogin', loginData);
        
        console.log('\n✅ Login Response:');
        console.log('Status:', response.status);
        console.log('Success:', response.data.success);
        console.log('Message:', response.data.message);
        
        if (response.data.token) {
            console.log('\n🎟️ JWT Token:');
            console.log('Token:', response.data.token);
            console.log('Token length:', response.data.token.length);
            
            // Decode token (just for testing - don't do this in production)
            const jwt = require('jsonwebtoken');
            try {
                const decoded = jwt.decode(response.data.token);
                console.log('\n🔍 Decoded Token Payload:');
                console.log('User ID:', decoded.userId);
                console.log('Email:', decoded.email);
                console.log('Full Name:', decoded.fullName);
                console.log('Expires At:', new Date(decoded.exp * 1000).toLocaleString());
            } catch (decodeError) {
                console.log('❌ Error decoding token:', decodeError.message);
            }
        } else {
            console.log('❌ No JWT token in response!');
        }
        
        console.log('\n👤 User Data:');
        console.log('ID:', response.data.user.id);
        console.log('Name:', response.data.user.fullName);
        console.log('Email:', response.data.user.email);
        console.log('Email Verified:', response.data.user.isEmailVerified);
        console.log('Password Set:', response.data.user.hasSetPassword);
        
    } catch (error) {
        console.error('\n❌ Login test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
};

// Run the test
testDTUserLoginWithJWT();