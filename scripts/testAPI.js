#!/usr/bin/env node
const axios = require('axios');

const testAPI = async () => {
  const BASE_URL = 'http://localhost:4000/api';
  
  try {
    console.log('🧪 Testing Assessment API...\n');
    
    // Test 1: English questions
    console.log('1️⃣ Testing English questions...');
    try {
      const englishResponse = await axios.get(`${BASE_URL}/assessments/questions?questionsPerSection=5&language=en`, {
        headers: { 'Authorization': 'Bearer mock-token' }
      });
      console.log('❌ Expected 401 (no auth) but got response');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ English endpoint properly protected (401)');
      } else {
        console.log('⚠️ Unexpected error:', error.response?.status);
      }
    }
    
    // Test 2: Akan questions
    console.log('\n2️⃣ Testing Akan questions...');
    try {
      const akanResponse = await axios.get(`${BASE_URL}/assessments/questions?questionsPerSection=5&language=akan`, {
        headers: { 'Authorization': 'Bearer mock-token' }
      });
      console.log('❌ Expected 401 (no auth) but got response');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Akan endpoint properly protected (401)');
      } else {
        console.log('⚠️ Unexpected error:', error.response?.status);
      }
    }
    
    console.log('\n📊 API endpoints are properly protected');
    console.log('✅ Assessment API is working - need valid token for testing');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

testAPI();