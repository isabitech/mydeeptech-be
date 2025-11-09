const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function createTestAdmin() {
    try {
        console.log('🔧 Creating test admin user...');
        
        const adminData = {
            fullName: 'Test Admin',
            email: 'admin@mydeeptech.ng',
            password: 'Admin@123',
            role: 'admin'
        };

        const response = await axios.post(`${BASE_URL}/admin/create`, adminData);
        
        console.log('✅ Admin created successfully:', response.data);
        
    } catch (error) {
        if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
            console.log('ℹ️ Admin user already exists');
        } else {
            console.error('❌ Failed to create admin:', error.response?.data?.message || error.message);
            if (error.response?.data) {
                console.error('Response data:', error.response.data);
            }
        }
    }
}

createTestAdmin();