const axios = require('axios');

// In-memory cache for exchange rates
let rateCache = {
  rate: null,
  timestamp: null,
  ttl: 3600000 // 1 hour in milliseconds
};

/**
 * Fetches USD to NGN exchange rate from exchangeratesapi.io
 * @returns {Promise<number>} Exchange rate (USD to NGN)
 */
const getUSDToNGNRate = async () => {
  try {
    const now = Date.now();
    
    // Check if cached rate is still valid
    if (rateCache.rate && rateCache.timestamp && (now - rateCache.timestamp) < rateCache.ttl) {
      console.log(`💰 Using cached USD/NGN rate: ${rateCache.rate}`);
      return rateCache.rate;
    }

    console.log('📊 Fetching fresh USD/NGN exchange rate...');
    
    // Fetch from exchangeratesapi.io
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', {
      timeout: 10000
    });

    const ngnRate = response.data?.rates?.NGN;
    
    if (!ngnRate || typeof ngnRate !== 'number') {
      throw new Error('Invalid NGN rate received from API');
    }

    // Cache the rate
    rateCache = {
      rate: ngnRate,
      timestamp: now,
      ttl: 3600000
    };

    console.log(`✅ Fresh USD/NGN rate fetched and cached: ${ngnRate}`);
    return ngnRate;

  } catch (error) {
    console.error('❌ Failed to fetch exchange rate:', error.message);
    
    // Return fallback rate if API fails
    const fallbackRate = 1680; // Approximate USD/NGN rate as fallback
    console.log(`⚠️ Using fallback USD/NGN rate: ${fallbackRate}`);
    return fallbackRate;
  }
};

/**
 * Converts USD amount to NGN
 * @param {number} usdAmount - Amount in USD
 * @returns {Promise<number>} Amount in NGN
 */
const convertUSDToNGN = async (usdAmount) => {
  try {
    if (!usdAmount || typeof usdAmount !== 'number') {
      throw new Error('Invalid USD amount provided');
    }

    const rate = await getUSDToNGNRate();
    const ngnAmount = usdAmount * rate;
    
    console.log(`💱 Converted $${usdAmount} USD to ₦${ngnAmount.toFixed(2)} NGN`);
    return Math.round(ngnAmount * 100) / 100; // Round to 2 decimal places
    
  } catch (error) {
    console.error('❌ Currency conversion failed:', error.message);
    throw error;
  }
};

/**
 * Gets current cached rate info for debugging
 * @returns {object} Cache information
 */
const getCacheInfo = () => {
  const now = Date.now();
  const isExpired = !rateCache.timestamp || (now - rateCache.timestamp) >= rateCache.ttl;
  
  return {
    rate: rateCache.rate,
    timestamp: rateCache.timestamp,
    age: rateCache.timestamp ? now - rateCache.timestamp : null,
    isExpired,
    ttl: rateCache.ttl
  };
};

/**
 * Clears the rate cache (for testing/debugging)
 */
const clearCache = () => {
  rateCache = {
    rate: null,
    timestamp: null,
    ttl: 3600000
  };
  console.log('🗑️ Exchange rate cache cleared');
};

module.exports = {
  getUSDToNGNRate,
  convertUSDToNGN,
  getCacheInfo,
  clearCache
};