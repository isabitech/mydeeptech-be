const axios = require('axios');

const API_URL = 'http://localhost:5000/api/domains';

async function testMiddleware() {
    console.log('--- Testing Domain Routes Middleware ---');

    // 1. Test without token
    try {
        console.log('Testing POST /categories without token...');
        await axios.post(`${API_URL}/categories`, { name: 'Test Category' });
    } catch (error) {
        console.log(`Expected Result (401): ${error.response.status} - ${error.response.data.message}`);
    }

    // 2. Test with invalid JSON (this will trigger the global error handler)
    // We can't easily test invalid JSON with axios easily as it stringifies objects,
    // but we can send a raw string if we set the content-type.
    try {
        console.log('\nTesting generic JSON syntax error...');
        await axios.post(`${API_URL}/categories`, '{ "name": "Invalid JSON" ', {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.log(`Expected Result (400): ${error.response.status} - ${error.response.data.message}`);
        console.log(`Error detail: ${error.response.data.error}`);
    }

    // 3. Test validation error (valid JSON, invalid schema)
    // Note: We need a valid token to reach validation for the secured routes, 
    // but we can test a GET route if any had validation, or we can just mock a token
    // that fails authentication but we want to see it reach validation? 
    // Actually, authentication is usually before validation.

    console.log('\nNote: Further testing (validation, auth success) requires a valid Admin JWT and a running server.');
}

// Note: This script assumes the server is running.
// testMiddleware();

console.log('Verification script created. Run it with: node scripts/testDomainMiddleware.js');
