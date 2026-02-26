#!/usr/bin/env node

/**
 * Paystack Configuration Checker
 * Run this script to verify your Paystack test environment setup
 */

const axios = require('axios');
const envConfig = require('../config/envConfig');

async function checkPaystackConfig() {
  console.log('🔍 Checking Paystack Configuration...\n');
  
  const secretKey = envConfig.paystack.PAYSTACK_SECRET_KEY || '';
  const publicKey = envConfig.paystack.PAYSTACK_PUBLIC_KEY || '';
  const baseURL = envConfig.paystack.PAYSTACK_BASE_URL;
  
  // Check key formats
  const isTestSecret = secretKey.startsWith('sk_test_');
  const isLiveSecret = secretKey.startsWith('sk_live_');
  const isTestPublic = publicKey.startsWith('pk_test_');
  const isLivePublic = publicKey.startsWith('pk_live_');
  
  console.log('📋 Environment Configuration:');
  console.log(`   Base URL: ${baseURL}`);
  console.log(`   Secret Key: ${secretKey.substring(0, 15)}... (${secretKey.length} chars)`);
  console.log(`   Public Key: ${publicKey.substring(0, 15)}... (${publicKey.length} chars)`);
  console.log(`   Secret Key Type: ${isTestSecret ? '✅ TEST' : isLiveSecret ? '🚨 LIVE' : '❌ INVALID FORMAT'}`);
  console.log(`   Public Key Type: ${isTestPublic ? '✅ TEST' : isLivePublic ? '🚨 LIVE' : '❌ INVALID FORMAT'}`);
  console.log('');
  
  if (!isTestSecret) {
    console.log('❌ ERROR: You need TEST secret keys for testing!');
    console.log('   Expected format: sk_test_xxxxxxxxxx');
    console.log('   Get test keys from: https://dashboard.paystack.com/settings/developer');
    return;
  }
  
  // Test API connectivity
  try {
    console.log('🔌 Testing API Connectivity...');
    const response = await axios.get(`${baseURL}/bank`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ API Connection successful!');
    console.log(`   Found ${response.data.data.length} banks available`);
  } catch (error) {
    console.log('❌ API Connection failed:');
    console.log(`   Status: ${error.response?.status}`);
    console.log(`   Message: ${error.response?.data?.message}`);
    return;
  }
  
  // Check balance
  try {
    console.log('\n💰 Checking Balance...');
    const balanceResponse = await axios.get(`${baseURL}/balance`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const balances = balanceResponse.data.data;
    console.log('💳 Account Balances:');
    balances.forEach(balance => {
      const amount = (balance.balance / 100).toLocaleString();
      console.log(`   ${balance.currency}: ₦${amount}`);
    });
    
    // Check if there's sufficient balance for testing
    const ngnBalance = balances.find(b => b.currency === 'NGN');
    if (ngnBalance && ngnBalance.balance < 100000) { // Less than ₦1,000
      console.log('\n⚠️  Low Balance Warning:');
      console.log('   Your test balance is low. For testing:');
      console.log('   1. Try transferring smaller amounts (₦10-100)');
      console.log('   2. Check if your test environment allows balance top-up');
      console.log('   3. Contact Paystack support for test balance issues');
    }
    
  } catch (error) {
    console.log('❌ Balance check failed:');
    console.log(`   Status: ${error.response?.status}`);
    console.log(`   Message: ${error.response?.data?.message}`);
    
    if (error.response?.status === 401) {
      console.log('   This suggests your API keys might be invalid');
    }
  }
  
  console.log('\n✅ Configuration check complete!');
  console.log('💡 Tips for testing:');
  console.log('   - Use test bank details: Account: 0123456789, Bank: 058 (GTBank)');
  console.log('   - Start with small amounts (₦10-100) for testing');
  console.log('   - Monitor the Paystack test dashboard for transaction details');
  console.log('   - Test dashboard: https://dashboard.paystack.com/test');
}

// Run the checker
if (require.main === module) {
  checkPaystackConfig().catch(console.error);
}

module.exports = { checkPaystackConfig };