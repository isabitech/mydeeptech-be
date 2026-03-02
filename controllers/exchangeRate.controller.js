const axios = require('axios');
const envConfig = require('../config/envConfig');
const { getServiceStatus } = require('../utils/exchangeRateService');

// GET /api/exchange-rate?country=Nigeria
const countryCurrencyMap = {
  Nigeria: 'NGN',
  Ghana: 'GHS',
  Kenya: 'KES',
  SouthAfrica: 'ZAR',
  USA: 'USD',
  UK: 'GBP',
  Eurozone: 'EUR',
  India: 'INR',
  Canada: 'CAD',
  Australia: 'AUD',
};

exports.getExchangeRate = async (req, res) => {
  const { country = 'Nigeria' } = req.query;
 
  const currency = countryCurrencyMap[country];
  if (!currency) {
    return res.status(400).json({ success: false, message: 'Unsupported country', data: null });
  }

  try {
    const apiKey = envConfig.EXCHANGE_RATES_API_KEY;
    const apiUrl = 'https://api.exchangeratesapi.io/v1/latest';
    const response = await axios.get(apiUrl, {
      params: { access_key: apiKey, symbols: currency },
      timeout: 10000
    });

    const rate = response.data.rates[currency];

    if (response.data && response.data.rates && rate) {
      return res.json({ success: true, message: "Exchange rate fetched successfully", data: { country, currency, rate } });
    } else {
      return res.status(404).json({ success: false, message: 'Rate not found', data: null });
    }
  } catch (err) {
    console.error('Exchange rate API error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch exchange rate', data: null });
  }
};

/**
 * GET /api/exchange-rate/health
 * Health check endpoint for exchange rate service
 */
exports.getExchangeRateHealth = async (req, res) => {
  try {
    const status = getServiceStatus();
    
    // Determine overall health status
    const isHealthy = !status.rateLimit.isCircuitBreakerActive && 
                      (!status.rateLimit.isRateLimited || status.cache.rate);
    
    const httpStatus = isHealthy ? 200 : 503;
    
    return res.status(httpStatus).json({
      success: isHealthy,
      message: isHealthy ? 'Exchange rate service is healthy' : 'Exchange rate service has issues',
      data: {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        ...status
      }
    });
  } catch (error) {
    console.error('Exchange rate health check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Health check failed',
      data: { error: error.message }
    });
  }
};
