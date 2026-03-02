const express = require('express');
const router = express.Router();
const { getExchangeRate } = require('../controllers/exchangeRate.controller');

// GET /api/exchange-rate?country=Nigeria
router.get('/', getExchangeRate);

module.exports = router;
