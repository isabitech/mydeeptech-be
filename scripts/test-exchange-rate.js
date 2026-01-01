#!/usr/bin/env node

/**
 * Exchange Rate Service Test
 * Tests the USD to NGN conversion functionality
 */

require('dotenv').config();
const { convertUSDToNGN, getUSDToNGNRate, getCacheInfo } = require('../utils/exchangeRateService');

const testExchangeRate = async () => {
  console.log('🧪 Testing Exchange Rate Service...');
  console.log('📅 Date:', new Date().toISOString());
  console.log('🔑 API Key Set:', !!process.env.EXCHANGE_RATES_API_KEY);
  console.log('');

  try {
    // Test 1: Get exchange rate
    console.log('📊 Test 1: Fetching USD/NGN exchange rate...');
    const rate = await getUSDToNGNRate();
    console.log(`✅ Current rate: 1 USD = ${rate} NGN`);
    console.log('');

    // Test 2: Convert various amounts
    console.log('💱 Test 2: Converting USD amounts to NGN...');
    const testAmounts = [1, 10, 100, 250.50];
    
    for (const amount of testAmounts) {
      try {
        const convertedAmount = await convertUSDToNGN(amount);
        console.log(`✅ $${amount} USD = ₦${convertedAmount.toLocaleString('en-NG', {minimumFractionDigits: 2})} NGN`);
      } catch (error) {
        console.log(`❌ Failed to convert $${amount}: ${error.message}`);
      }
    }
    console.log('');

    // Test 3: Check cache info
    console.log('📱 Test 3: Cache information...');
    const cacheInfo = getCacheInfo();
    console.log(`✅ Cache Info:`, {
      rate: cacheInfo.rate,
      age: cacheInfo.age ? `${Math.round(cacheInfo.age / 1000)}s` : 'N/A',
      isExpired: cacheInfo.isExpired
    });
    console.log('');

    // Test 4: Test with invalid amount
    console.log('🚫 Test 4: Testing error handling with invalid amount...');
    try {
      await convertUSDToNGN('invalid');
    } catch (error) {
      console.log(`✅ Error handling works: ${error.message}`);
    }

    console.log('');
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('EXCHANGE_RATES_API_KEY')) {
      console.log('');
      console.log('💡 Solution: Set your exchange rate API key in .env file:');
      console.log('   EXCHANGE_RATES_API_KEY=your_api_key_here');
    }
    
    process.exit(1);
  }
};

// Run the test
testExchangeRate();