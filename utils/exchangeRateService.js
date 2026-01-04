import axios from 'axios';

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
export const getUSDToNGNRate = async () => {
  try {
    const now = Date.now();

    // Check if cached rate is still valid
    if (rateCache.rate && rateCache.timestamp && (now - rateCache.timestamp) < rateCache.ttl) {
      console.log(`💰 Using cached USD/NGN rate: ${rateCache.rate}`);
      return rateCache.rate;
    }

    console.log('📊 Fetching fresh USD/NGN exchange rate...');

    // Check if API key is available
    const apiKey = process.env.EXCHANGE_RATES_API_KEY;
    if (!apiKey) {
      throw new Error('EXCHANGE_RATES_API_KEY environment variable is not set');
    }

    // Fetch from exchangeratesapi.io using latest endpoint (free plan uses EUR as base)
    const response = await axios.get('https://api.exchangeratesapi.io/v1/latest', {
      params: {
        access_key: apiKey,
        symbols: 'USD,NGN'
      },
      timeout: 10000
    });

    // Check if API response indicates success
    if (!response.data.success) {
      const errorMessage = response.data.error?.info || response.data.error?.message || 'Unknown API error';
      throw new Error(`Exchange rate API failed: ${errorMessage}`);
    }

    const eurToUsd = response.data?.rates?.USD;
    const eurToNgn = response.data?.rates?.NGN;

    if (!eurToUsd || !eurToNgn || typeof eurToUsd !== 'number' || typeof eurToNgn !== 'number') {
      throw new Error('Invalid currency rates received from API');
    }

    // Calculate USD to NGN rate: NGN/USD = (EUR/NGN) / (EUR/USD)
    const ngnRate = eurToNgn / eurToUsd;

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

    // Log more details for debugging
    if (error.response) {
      console.error('API Response Status:', error.response.status);
      console.error('API Response Data:', error.response.data);
    }

    // Don't fallback - let the error propagate so dependent operations can fail gracefully
    throw new Error(`Exchange rate service unavailable: ${error.message}`);
  }
};

/**
 * Converts USD amount to NGN
 * @param {number} usdAmount - Amount in USD
 * @returns {Promise<number>} Amount in NGN
 */
export const convertUSDToNGN = async (usdAmount) => {
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
export const getCacheInfo = () => {
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
export const clearCache = () => {
  rateCache = {
    rate: null,
    timestamp: null,
    ttl: 3600000
  };
  console.log('🗑️ Exchange rate cache cleared');
};

export default {
  getUSDToNGNRate,
  convertUSDToNGN,
  getCacheInfo,
  clearCache
};