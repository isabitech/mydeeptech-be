const axios = require('axios');
const envConfig = require('../config/envConfig');

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
