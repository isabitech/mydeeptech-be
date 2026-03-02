const axios = require('axios');
const envConfig = require('../config/envConfig');

// In-memory cache for exchange rates
let rateCache = {
  rate: null,
  timestamp: null,
  ttl: 3600000 // 1 hour in milliseconds
};

// Request queue to prevent concurrent API calls
let pendingRequest = null;

// Rate limiting and circuit breaker state
let rateLimitState = {
  isRateLimited: false,
  retryAfter: null,
  backoffMultiplier: 1000, // Start with 1 second
  maxBackoff: 60000, // Max 1 minute
  circuitBreakerUntil: null
};

/**
 * Sleep function for delays
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches USD to NGN exchange rate from exchangeratesapi.io with rate limiting protection
 * @returns {Promise<number>} Exchange rate (USD to NGN)
 */
const getUSDToNGNRate = async () => {
  try {
    const now = Date.now();
    
    // Check circuit breaker
    if (rateLimitState.circuitBreakerUntil && now < rateLimitState.circuitBreakerUntil) {
      throw new Error(`Exchange rate service circuit breaker active until ${new Date(rateLimitState.circuitBreakerUntil).toLocaleTimeString()}`);
    }
    
    // Check if cached rate is still valid
    if (rateCache.rate && rateCache.timestamp && (now - rateCache.timestamp) < rateCache.ttl) {
      console.log(`💰 Using cached USD/NGN rate: ${rateCache.rate}`);
      return rateCache.rate;
    }

    // If there's already a pending request, wait for it
    if (pendingRequest) {
      console.log('⏳ Waiting for pending exchange rate request...');
      return await pendingRequest;
    }

    // Check if we're currently rate limited
    if (rateLimitState.isRateLimited && rateLimitState.retryAfter && now < rateLimitState.retryAfter) {
      const waitTime = rateLimitState.retryAfter - now;
      console.log(`⏳ Rate limited, waiting ${waitTime}ms before retry...`);
      await sleep(waitTime);
    }

    console.log('📊 Fetching fresh USD/NGN exchange rate...');
  
    // Check if API key is available
    const apiKey = envConfig.EXCHANGE_RATES_API_KEY;
    if (!apiKey) {
      throw new Error('EXCHANGE_RATES_API_KEY environment variable is not set');
    }

    // Create pending request to prevent concurrent calls
    const fetchRate = async () => {
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          // Fetch from exchangeratesapi.io using latest endpoint
          const response = await axios.get('https://api.exchangeratesapi.io/v1/latest', {
            params: {
              access_key: apiKey,
              symbols: 'USD,NGN'
            },
            timeout: 10000
          });

          // Reset rate limiting state on successful request
          rateLimitState.isRateLimited = false;
          rateLimitState.backoffMultiplier = 1000;
          rateLimitState.circuitBreakerUntil = null;

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

          // Calculate USD to NGN rate
          const ngnRate = eurToNgn / eurToUsd;

          // Cache the rate
          rateCache = {
            rate: ngnRate,
            timestamp: Date.now(),
            ttl: 3600000
          };

          console.log(`✅ Fresh USD/NGN rate fetched and cached: ${ngnRate}`);
          return ngnRate;

        } catch (error) {
          console.error(`❌ Exchange rate request attempt ${retryCount + 1} failed:`, error.message);
          
          // Handle 429 rate limit errors specifically
          if (error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : rateLimitState.backoffMultiplier;
            
            console.error(`🚫 Rate limited! Retry after: ${waitTime}ms`);
            
            rateLimitState.isRateLimited = true;
            rateLimitState.retryAfter = Date.now() + waitTime;
            rateLimitState.backoffMultiplier = Math.min(rateLimitState.backoffMultiplier * 2, rateLimitState.maxBackoff);
            
            if (retryCount < maxRetries - 1) {
              console.log(`⏳ Waiting ${waitTime}ms before retry...`);
              await sleep(waitTime);
              retryCount++;
              continue;
            } else {
              // Activate circuit breaker after max retries
              rateLimitState.circuitBreakerUntil = Date.now() + (5 * 60 * 1000); // 5 minutes
              throw new Error(`Rate limit exceeded. Circuit breaker activated for 5 minutes.`);
            }
          }

          // Handle other HTTP errors
          if (error.response) {
            console.error('API Response Status:', error.response.status);
            console.error('API Response Data:', error.response.data);
          }
          
          retryCount++;
          if (retryCount >= maxRetries) {
            throw new Error(`Exchange rate API failed after ${maxRetries} attempts: ${error.message}`);
          }
          
          // Exponential backoff for other errors
          const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
          console.log(`⏳ Backing off for ${backoffTime}ms before retry...`);
          await sleep(backoffTime);
        }
      }
    };

    // Set and execute pending request
    pendingRequest = fetchRate();
    const result = await pendingRequest;
    pendingRequest = null; // Clear pending request
    
    return result;

  } catch (error) {
    // Clean up pending request on error
    pendingRequest = null;
    
    console.error('❌ Failed to fetch exchange rate:', error.message);
    
    // Don't fallback - let the error propagate with additional context
    throw new Error(`Exchange rate service unavailable: ${error.message}`);
  }
};

/**
 * Gets current rate limiting and cache status
 * @returns {object} Status information
 */
const getServiceStatus = () => {
  const now = Date.now();
  const isRateLimited = rateLimitState.isRateLimited && rateLimitState.retryAfter && now < rateLimitState.retryAfter;
  const isCircuitBreakerActive = rateLimitState.circuitBreakerUntil && now < rateLimitState.circuitBreakerUntil;
  
  return {
    cache: {
      rate: rateCache.rate,
      timestamp: rateCache.timestamp,
      age: rateCache.timestamp ? now - rateCache.timestamp : null,
      isExpired: !rateCache.timestamp || (now - rateCache.timestamp) >= rateCache.ttl,
      ttl: rateCache.ttl
    },
    rateLimit: {
      isRateLimited,
      retryAfter: rateLimitState.retryAfter,
      backoffMultiplier: rateLimitState.backoffMultiplier,
      isCircuitBreakerActive,
      circuitBreakerUntil: rateLimitState.circuitBreakerUntil
    },
    hasPendingRequest: !!pendingRequest
  };
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
 * Gets current cached rate info for debugging (legacy function)
 * @returns {object} Cache information
 */
const getCacheInfo = () => {
  return getServiceStatus().cache;
};

/**
 * Clears the rate cache and resets rate limiting state
 */
const clearCache = () => {
  rateCache = {
    rate: null,
    timestamp: null,
    ttl: 3600000
  };
  
  // Reset rate limiting state
  rateLimitState = {
    isRateLimited: false,
    retryAfter: null,
    backoffMultiplier: 1000,
    maxBackoff: 60000,
    circuitBreakerUntil: null
  };
  
  // Clear pending request
  pendingRequest = null;
  
  console.log('🗑️ Exchange rate cache and rate limiting state cleared');
};

module.exports = {
  getUSDToNGNRate,
  convertUSDToNGN,
  getCacheInfo,
  getServiceStatus,
  clearCache
};