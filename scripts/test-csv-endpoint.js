#!/usr/bin/env node

/**
 * Test CSV Generation Endpoint
 * Tests the updated CSV generation with better error handling
 */

require('dotenv').config();
const axios = require('axios');

const testCSVEndpoint = async () => {
  console.log('🧪 Testing CSV Generation Endpoint...');
  console.log('📅 Date:', new Date().toISOString());
  console.log('');

  // You'll need to get an admin token first - this is just for testing the structure
  const adminToken = 'your-admin-token-here';
  const baseURL = 'http://localhost:4000';

  try {
    // Test 1: Generate CSV for all unpaid invoices
    console.log('📋 Test 1: Generate CSV for all unpaid invoices...');
    const response1 = await axios.get(`${baseURL}/api/admin/invoices/generate-paystack-csv`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      timeout: 30000
    });

    console.log('✅ Response for all invoices:');
    console.log('Status:', response1.status);
    console.log('Message:', response1.data.message);
    if (response1.data.data?.summary) {
      console.log('Summary:', response1.data.data.summary);
    }
    console.log('');

    // Test 2: Generate CSV for specific invoices (using the IDs from your URL)
    console.log('🎯 Test 2: Generate CSV for specific invoices...');
    const specificIds = [
      '6954196ee8b6e6a840c52acc',
      '694bce86d3d84f0a1647cccb', 
      '694aa1b0710807ff387b3858',
      '6941c56e6a11ae564fe1a640'
    ];

    const params = new URLSearchParams();
    specificIds.forEach(id => {
      params.append('invoiceIds[]', id);
    });

    const response2 = await axios.get(`${baseURL}/api/admin/invoices/generate-paystack-csv?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      timeout: 30000
    });

    console.log('✅ Response for specific invoices:');
    console.log('Status:', response2.status);
    console.log('Message:', response2.data.message);
    if (response2.data.data?.summary) {
      console.log('Summary:', response2.data.data.summary);
    }

  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:');
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('❌ Network Error:', error.message);
    }
  }
};

// Note: You need to start the server and have a valid admin token to run this test
console.log('💡 To run this test:');
console.log('1. Start your server: npm start');
console.log('2. Get an admin token by logging in');
console.log('3. Replace "your-admin-token-here" with the actual token');
console.log('4. Run: node scripts/test-csv-endpoint.js');
console.log('');

// Uncomment the line below when you have the token
// testCSVEndpoint();