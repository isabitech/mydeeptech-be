const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test DTUser credentials (you can modify these)
const DTUSER_CREDENTIALS = {
    email: 'dammy22@mailinator.com',
    password: '@Coolguy001'
};

async function testDashboardEndpoint() {
    try {
        console.log('🧪 Testing Invoice Dashboard Endpoint\n');

        // Step 1: DTUser Authentication
        console.log('🔐 Step 1: DTUser Authentication...');
        
        try {
            const loginResponse = await axios.post(`${BASE_URL}/auth/dtUserLogin`, DTUSER_CREDENTIALS);
            const token = loginResponse.data.token;
            console.log('✅ DTUser authenticated successfully\n');

            // Step 2: Test Dashboard Endpoint
            console.log('📊 Step 2: Testing dashboard endpoint...');
            const dashboardResponse = await axios.get(`${BASE_URL}/auth/invoices/dashboard`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log('✅ Dashboard endpoint working!');
            console.log('📈 Dashboard data:');
            console.log('  Summary:', JSON.stringify(dashboardResponse.data.data.summary, null, 2));
            
            if (dashboardResponse.data.data.recentInvoices) {
                console.log(`  Recent invoices: ${dashboardResponse.data.data.recentInvoices.length} found`);
            }
            
            if (dashboardResponse.data.data.upcomingPayments) {
                console.log(`  Upcoming payments: ${dashboardResponse.data.data.upcomingPayments.length} found`);
            }

            // Step 3: Test other invoice endpoints
            console.log('\n📋 Step 3: Testing other invoice endpoints...');
            
            const invoicesResponse = await axios.get(`${BASE_URL}/auth/invoices`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`✅ User invoices: ${invoicesResponse.data.data.invoices.length} found`);

            const unpaidResponse = await axios.get(`${BASE_URL}/auth/invoices/unpaid`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`✅ Unpaid invoices: ${unpaidResponse.data.data.invoices.length} found`);

            console.log('\n🎉 ALL INVOICE ENDPOINTS WORKING PERFECTLY! 🎉');

        } catch (loginError) {
            if (loginError.response?.status === 400) {
                console.log('⚠️ DTUser login failed - possibly no password set');
                console.log('💡 Try setting up password first or use different credentials');
            } else {
                console.log('❌ Login error:', loginError.response?.data?.message || loginError.message);
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data?.message || error.message);
        if (error.response?.data) {
            console.error('Response data:', error.response.data);
        }
    }
}

testDashboardEndpoint();