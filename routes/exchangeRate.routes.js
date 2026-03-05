const express = require('express');
const router = express.Router();
const { getExchangeRate, getExchangeRateHealth } = require('../controllers/exchangeRate.controller');

// GET /api/exchange-rate?country=Nigeria
router.get('/', getExchangeRate);

// GET /api/exchange-rate/health
router.get('/health', getExchangeRateHealth);

module.exports = router;
